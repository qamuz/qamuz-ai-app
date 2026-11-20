export interface AudioSegmentAnalysis {
	index: number;
	startTime: number;
	endTime: number;
	energy: number; // 0..1 normalized RMS
	role: 'intro' | 'vocal-entry' | 'verse' | 'chorus' | 'bridge' | 'climax' | 'outro';
	label: string;
}

export interface AudioAnalysisResult {
	duration: number;
	estimatedBpm: number;
	beatOffset: number; // seconds to first strong beat / downbeat phase
	beatTimes: number[]; // all detected beat timestamps across duration
	barTimes: number[]; // 4/4 compás downbeat timestamps
	vocalEntryTime: number;
	peakHookStart: number;
	peakHookEnd: number;
	energyBins: number[]; // ~48 normalized bars for UI waveform
	segments: AudioSegmentAnalysis[];
	detectedLyrics: { time: number; text: string; isSlogan: boolean }[];
}

function cleanLyricsLines(
	lyrics: string | null | undefined
): { text: string; sectionHint?: string; isSlogan: boolean }[] {
	if (!lyrics) return [];
	const lines = lyrics.split(/\r?\n/);
	const out: { text: string; sectionHint?: string; isSlogan: boolean }[] = [];
	let currentSection = '';

	for (const raw of lines) {
		const trimmed = raw.trim();
		if (!trimmed) continue;
		const tagMatch = trimmed.match(/^\[(.*)\]$/);
		if (tagMatch) {
			currentSection = tagMatch[1].toLowerCase();
			continue;
		}
		if (/^\(.*\)$/.test(trimmed)) continue;

		const isChorus =
			currentSection.includes('coro') ||
			currentSection.includes('chorus') ||
			currentSection.includes('hook') ||
			currentSection.includes('estribillo');

		out.push({
			text: trimmed,
			sectionHint: currentSection || undefined,
			isSlogan: isChorus || trimmed.length <= 42,
		});
	}
	return out;
}

/**
 * Estimates real BPM and beat phase offset directly from a decoded mono PCM channel
 * using a ~43 Hz onset-flux envelope + autocorrelation comb scoring.
 */
function detectTempoAndBeatPhase(
	channel: Float32Array,
	sampleRate: number
): { bpm: number; beatOffset: number } {
	const hopSamples = Math.max(256, Math.round(sampleRate / 43)); // ~23.2ms per frame
	const frameCount = Math.floor(channel.length / hopSamples);
	if (frameCount < 48) {
		return { bpm: 118, beatOffset: 0 };
	}

	const fps = sampleRate / hopSamples;
	const rms = new Float32Array(frameCount);
	for (let f = 0; f < frameCount; f++) {
		const start = f * hopSamples;
		const end = Math.min(channel.length, start + hopSamples);
		let sum = 0;
		const stride = Math.max(1, Math.floor((end - start) / 64));
		let count = 0;
		for (let i = start; i < end; i += stride) {
			const v = channel[i];
			sum += v * v;
			count++;
		}
		rms[f] = Math.sqrt(sum / Math.max(1, count));
	}

	// Half-wave rectified onset strength relative to short moving baseline
	const onset = new Float32Array(frameCount);
	const avgWin = 6;
	for (let f = 1; f < frameCount; f++) {
		let localAvg = 0;
		const lo = Math.max(0, f - avgWin);
		for (let j = lo; j < f; j++) localAvg += rms[j];
		localAvg /= Math.max(1, f - lo);
		const diff = rms[f] - localAvg * 1.05;
		onset[f] = diff > 0 ? diff : 0;
	}

	// Autocorrelation over musical tempo lags (76..168 BPM)
	const minBpm = 76;
	const maxBpm = 168;
	const minLag = Math.max(4, Math.floor((fps * 60) / maxBpm));
	const maxLag = Math.min(Math.floor(frameCount / 3), Math.ceil((fps * 60) / minBpm));

	let bestLag = Math.round((fps * 60) / 120);
	let bestScore = -1;

	for (let lag = minLag; lag <= maxLag; lag++) {
		let corr = 0;
		const limit = frameCount - lag;
		for (let i = 0; i < limit; i++) {
			corr += onset[i] * onset[i + lag];
		}
		// Gently prefer common pop/urban musical tempos (92–136 BPM) to prevent half/double-time errors
		const candBpm = (fps * 60) / lag;
		const perceptualWeight =
			1 - 0.18 * Math.min(1, Math.abs(candBpm - 116) / 60);
		const score = (corr / Math.max(1, limit)) * perceptualWeight;
		if (score > bestScore) {
			bestScore = score;
			bestLag = lag;
		}
	}

	let bpm = Math.round((fps * 60) / Math.max(1, bestLag));
	while (bpm < 80) bpm *= 2;
	while (bpm > 165) bpm = Math.round(bpm / 2);
	bpm = Math.max(76, Math.min(168, bpm));

	// Find optimal beat phase offset in [0, beatPeriodFrames)
	const beatFrames = (fps * 60) / bpm;
	const phaseSteps = Math.max(8, Math.round(beatFrames));
	let bestPhase = 0;
	let bestPhaseEnergy = -1;
	for (let p = 0; p < phaseSteps; p++) {
		let energy = 0;
		for (let pos = p; pos < frameCount; pos += beatFrames) {
			const idx = Math.round(pos);
			if (idx >= 0 && idx < frameCount) {
				energy += onset[idx];
				if (idx > 0) energy += onset[idx - 1] * 0.4;
				if (idx + 1 < frameCount) energy += onset[idx + 1] * 0.4;
			}
		}
		if (energy > bestPhaseEnergy) {
			bestPhaseEnergy = energy;
			bestPhase = p;
		}
	}

	const beatOffset = Number((bestPhase / fps).toFixed(3));
	return { bpm, beatOffset };
}

function generateBeatAndBarGrids(
	duration: number,
	bpm: number,
	beatOffset: number
): { beatTimes: number[]; barTimes: number[] } {
	const safeBpm = Math.max(70, Math.min(180, bpm || 118));
	const beatSec = 60 / safeBpm;
	const startOffset = ((beatOffset % beatSec) + beatSec) % beatSec;
	const beatTimes: number[] = [];
	const barTimes: number[] = [];

	let idx = 0;
	for (let t = startOffset; t < duration - 0.05; t += beatSec) {
		const rounded = Number(t.toFixed(3));
		beatTimes.push(rounded);
		if (idx % 4 === 0) {
			barTimes.push(rounded);
		}
		idx++;
	}
	return { beatTimes, barTimes };
}

/**
 * Real Web Audio API energy, tempo (BPM), beat phase & vocal onset detector with lyrics alignment.
 * Falls back cleanly to structural envelope estimation if external audio URL blocks CORS decoding.
 */
export async function analyzeAudioTrack(
	audioUrl: string,
	durationHint = 45,
	lyrics?: string | null
): Promise<AudioAnalysisResult> {
	const safeDur = Math.max(12, Math.min(durationHint || 45, 240));
	let actualDuration = safeDur;
	let energyBins: number[] = [];
	let detectedBpm: number | null = null;
	let beatOffset = 0;

	if (audioUrl) {
		try {
			const res = await fetch(audioUrl, { mode: 'cors' });
			if (res.ok) {
				const buf = await res.arrayBuffer();
				const AudioCtx =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				const ctx = new AudioCtx();
				try {
					const decoded = await ctx.decodeAudioData(buf);
					actualDuration = Math.max(8, decoded.duration || safeDur);
					const channel = decoded.getChannelData(0);

					// Real BPM + compás phase detection from PCM onset flux
					const tempo = detectTempoAndBeatPhase(channel, decoded.sampleRate);
					detectedBpm = tempo.bpm;
					beatOffset = tempo.beatOffset;

					const binCount = 48;
					const step = Math.max(1, Math.floor(channel.length / binCount));
					const rawRms: number[] = [];
					for (let i = 0; i < binCount; i++) {
						const start = i * step;
						const end = Math.min(channel.length, start + step);
						let sum = 0;
						const sampleStride = Math.max(1, Math.floor((end - start) / 400));
						let samples = 0;
						for (let j = start; j < end; j += sampleStride) {
							const v = channel[j];
							sum += v * v;
							samples++;
						}
						rawRms.push(Math.sqrt(sum / Math.max(1, samples)));
					}
					const maxRms = Math.max(0.001, ...rawRms);
					energyBins = rawRms.map((v) => Number(Math.min(1, v / maxRms).toFixed(3)));
				} finally {
					void ctx.close();
				}
			}
		} catch {
			// Fallback smoothly below if CORS or network prevents raw PCM decode
		}
	}

	if (energyBins.length === 0) {
		energyBins = Array.from({ length: 48 }, (_, i) => {
			const p = i / 47;
			const base =
				p < 0.1
					? 0.28 + p * 2
					: p < 0.35
					? 0.55 + Math.sin(i * 0.9) * 0.12
					: p < 0.65
					? 0.85 + Math.cos(i * 1.1) * 0.12
					: p < 0.85
					? 0.68 + Math.sin(i * 0.7) * 0.15
					: 0.42 - (p - 0.85) * 1.2;
			return Number(Math.max(0.15, Math.min(1, base)).toFixed(3));
		});
	}

	// Detect vocal/beat onset (first sustained energy jump after intro)
	let vocalBin = 4;
	const avgEnergy = energyBins.reduce((s, v) => s + v, 0) / energyBins.length;
	for (let i = 1; i < Math.min(16, energyBins.length); i++) {
		if (energyBins[i] >= avgEnergy * 0.72) {
			vocalBin = i;
			break;
		}
	}
	const vocalEntryTime = Number(((vocalBin / energyBins.length) * actualDuration).toFixed(1));

	// Find peak ~15s hook window
	const hookBins = Math.max(
		4,
		Math.round((Math.min(15, actualDuration * 0.35) / actualDuration) * energyBins.length)
	);
	let bestStartBin = Math.min(vocalBin, Math.max(0, energyBins.length - hookBins));
	let bestSum = -1;
	for (let i = 0; i <= energyBins.length - hookBins; i++) {
		const s = energyBins.slice(i, i + hookBins).reduce((a, b) => a + b, 0);
		if (s > bestSum) {
			bestSum = s;
			bestStartBin = i;
		}
	}
	const peakHookStart = Number(((bestStartBin / energyBins.length) * actualDuration).toFixed(1));
	const peakHookEnd = Number(
		Math.min(actualDuration, ((bestStartBin + hookBins) / energyBins.length) * actualDuration).toFixed(1)
	);

	// Fallback BPM estimation if PCM decode wasn't available
	let estimatedBpm = detectedBpm ?? 118;
	if (detectedBpm === null) {
		let peaks = 0;
		for (let i = 1; i < energyBins.length - 1; i++) {
			if (energyBins[i] > energyBins[i - 1] && energyBins[i] > energyBins[i + 1] && energyBins[i] > 0.55) {
				peaks++;
			}
		}
		estimatedBpm = Math.max(82, Math.min(148, Math.round(92 + peaks * 4.0)));
	}

	const { beatTimes, barTimes } = generateBeatAndBarGrids(actualDuration, estimatedBpm, beatOffset);

	// Build 5-6 structural segments
	const segCount = actualDuration <= 35 ? 4 : actualDuration <= 80 ? 5 : 6;
	const roles: { role: AudioSegmentAnalysis['role']; label: string }[] = [
		{ role: 'intro', label: 'Intro & Atmósfera' },
		{ role: 'vocal-entry', label: 'Entrada de Voz / Verso 1' },
		{ role: 'chorus', label: 'Coro & Eslogan Principal' },
		{ role: 'bridge', label: 'Puente & Desarrollo' },
		{ role: 'climax', label: 'Clímax Rítmico' },
		{ role: 'outro', label: 'Cierre & Outro' },
	];

	const segments: AudioSegmentAnalysis[] = [];
	const segDur = actualDuration / segCount;
	for (let i = 0; i < segCount; i++) {
		const start = Number((i * segDur).toFixed(1));
		const end =
			i === segCount - 1 ? Number(actualDuration.toFixed(1)) : Number(((i + 1) * segDur).toFixed(1));
		const bStart = Math.floor((start / actualDuration) * energyBins.length);
		const bEnd = Math.max(bStart + 1, Math.floor((end / actualDuration) * energyBins.length));
		const slice = energyBins.slice(bStart, bEnd);
		const segEnergy = Number((slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length)).toFixed(2));
		const meta = i === segCount - 1 ? roles[5] : roles[Math.min(i, 4)];
		segments.push({
			index: i,
			startTime: start,
			endTime: end,
			energy: segEnergy,
			role: meta.role,
			label: meta.label,
		});
	}

	// Align lyrics & slogans starting right at vocalEntryTime
	const cleaned = cleanLyricsLines(lyrics);
	const span = Math.max(6, actualDuration * 0.9 - vocalEntryTime);
	const detectedLyrics = cleaned.map((line, idx) => ({
		time: Number((vocalEntryTime + (span * idx) / Math.max(1, cleaned.length)).toFixed(1)),
		text: line.text,
		isSlogan: line.isSlogan,
	}));

	return {
		duration: Number(actualDuration.toFixed(1)),
		estimatedBpm,
		beatOffset,
		beatTimes,
		barTimes,
		vocalEntryTime,
		peakHookStart,
		peakHookEnd,
		energyBins,
		segments,
		detectedLyrics,
	};
}

export interface MusicalCutSlot {
	cutIndex: number;
	startTime: number;
	endTime: number;
	duration: number;
	beatCount: number;
	isPeak: boolean;
	isBarDownbeat: boolean;
	isVocalEntryBoundary: boolean;
}

/**
 * Generates strictly contiguous, beat-locked 1.0s - 2.0s cut boundaries snapped to the song's
 * compás (BPM + beatOffset), tightening to 1.0–1.5s during high-energy chorus/hook peaks and
 * landing cleanly on vocalEntryTime.
 */
export function buildMusicalCutGrid(params: {
	duration: number;
	bpm: number;
	beatOffset?: number;
	energyBins?: number[];
	vocalEntryTime?: number;
	peakHookStart?: number;
	peakHookEnd?: number;
}): MusicalCutSlot[] {
	const total = Math.max(4, Number(params.duration) || 45);
	const safeBpm = Math.max(70, Math.min(180, Number(params.bpm) || 118));
	const beatSec = 60 / safeBpm;
	const rawOffset = Number.isFinite(params.beatOffset) ? Number(params.beatOffset) : 0;
	const phase = ((rawOffset % beatSec) + beatSec) % beatSec;

	// Choose integer beats per cut so every slot strictly sits inside [1.0s, 2.0s]
	// Prefer musical sub-bar multiples (2 or 4 beats, or 3 beats when 4 beats > 2.05s)
	let normalBeats = 4;
	while (beatSec * normalBeats > 2.0 && normalBeats > 2) normalBeats--;
	while (beatSec * normalBeats < 1.35 && normalBeats < 6) normalBeats++;
	if (beatSec * normalBeats > 2.05 && normalBeats > 2) normalBeats--;

	let peakBeats = Math.max(2, normalBeats - 1);
	if (beatSec * peakBeats < 1.0) peakBeats = normalBeats;
	if (beatSec * peakBeats > 1.55 && peakBeats > 2 && beatSec * (peakBeats - 1) >= 0.98) {
		peakBeats--;
	}

	const snapToBeat = (t: number): number => {
		const k = Math.round((t - phase) / beatSec);
		return Math.max(0, Math.min(total, Number((phase + k * beatSec).toFixed(3))));
	};

	const vocalEntry =
		typeof params.vocalEntryTime === 'number' &&
		params.vocalEntryTime > 1.0 &&
		params.vocalEntryTime < total - 1.2
			? snapToBeat(params.vocalEntryTime)
			: null;

	const peakStart = params.peakHookStart ?? total * 0.35;
	const peakEnd = params.peakHookEnd ?? total * 0.72;
	const bins = params.energyBins ?? [];
	const avgBinEnergy =
		bins.length > 0 ? bins.reduce((sum, v) => sum + v, 0) / bins.length : 0.65;

	const energyAt = (t: number): number => {
		if (bins.length === 0) return avgBinEnergy;
		const idx = Math.max(0, Math.min(bins.length - 1, Math.floor((t / total) * bins.length)));
		return bins[idx] ?? avgBinEnergy;
	};

	// Build contiguous beat-locked cut points from 0 -> total
	const rawBoundaries: number[] = [0];

	const pushSectionCuts = (from: number, to: number) => {
		let cur = from;
		let guard = 0;
		while (to - cur > 0.25 && guard < 400) {
			guard++;
			const remaining = to - cur;
			const localEnergy = energyAt(cur + 0.5);
			const inPeak =
				(cur >= peakStart - 0.1 && cur < peakEnd) || localEnergy >= avgBinEnergy * 1.15;
			const targetBeats = inPeak ? peakBeats : normalBeats;
			const targetStep = targetBeats * beatSec;

			// If remaining fits cleanly in one 1.0–2.05s slot, close the section here
			if (remaining <= 2.05) {
				rawBoundaries.push(Number(to.toFixed(3)));
				break;
			}

			// If remaining would leave a tiny tail (< 0.95s), split remaining into two balanced beat-aligned cuts
			if (remaining - targetStep < 0.95) {
				const midBeat = snapToBeat(cur + remaining / 2);
				const splitPoint =
					midBeat > cur + 0.9 && to - midBeat > 0.9
						? midBeat
						: Number((cur + remaining / 2).toFixed(3));
				rawBoundaries.push(splitPoint);
				rawBoundaries.push(Number(to.toFixed(3)));
				break;
			}

			// Advance onto the exact beat grid
			let nextT = snapToBeat(cur + targetStep);
			if (nextT <= cur + 0.92) {
				nextT = Number((cur + Math.max(1.0, Math.min(2.0, targetStep))).toFixed(3));
			}
			if (nextT - cur > 2.05) {
				nextT = snapToBeat(cur + Math.max(1, targetBeats - 1) * beatSec);
				if (nextT <= cur + 0.92) {
					nextT = Number((cur + 1.5).toFixed(3));
				}
			}
			nextT = Math.min(to, nextT);
			rawBoundaries.push(Number(nextT.toFixed(3)));
			cur = nextT;
		}
	};

	if (vocalEntry !== null && vocalEntry >= 1.0 && total - vocalEntry >= 1.0) {
		pushSectionCuts(0, vocalEntry);
		pushSectionCuts(vocalEntry, total);
	} else {
		pushSectionCuts(0, total);
	}

	// Ensure final boundary reaches exact duration with zero trailing gap
	const lastBound = rawBoundaries[rawBoundaries.length - 1] ?? 0;
	if (total - lastBound > 0.05) {
		if (total - lastBound < 0.85 && rawBoundaries.length >= 2) {
			rawBoundaries[rawBoundaries.length - 1] = Number(total.toFixed(3));
		} else {
			rawBoundaries.push(Number(total.toFixed(3)));
		}
	}

	// Deduplicate and build strictly contiguous slots (endTime[i] === startTime[i+1])
	const cleanBounds: number[] = [0];
	for (let i = 1; i < rawBoundaries.length; i++) {
		const b = rawBoundaries[i];
		if (b - cleanBounds[cleanBounds.length - 1] >= 0.5) {
			cleanBounds.push(b);
		}
	}
	if (cleanBounds[cleanBounds.length - 1] < total - 0.05) {
		cleanBounds[cleanBounds.length - 1] = Number(total.toFixed(3));
	}

	const slots: MusicalCutSlot[] = [];
	for (let i = 0; i < cleanBounds.length - 1; i++) {
		const startTime = Number(cleanBounds[i].toFixed(3));
		const endTime = Number(cleanBounds[i + 1].toFixed(3));
		const duration = Number((endTime - startTime).toFixed(3));
		if (duration < 0.4) continue;
		const mid = (startTime + endTime) / 2;
		const beatIndex = Math.round((startTime - phase) / beatSec);
		const isBarDownbeat = beatIndex >= 0 && beatIndex % 4 === 0;
		const isPeak =
			(mid >= peakStart && mid <= peakEnd) || energyAt(mid) >= avgBinEnergy * 1.15;
		const isVocalEntryBoundary =
			vocalEntry !== null && Math.abs(startTime - vocalEntry) < 0.1;

		slots.push({
			cutIndex: slots.length,
			startTime,
			endTime,
			duration,
			beatCount: Math.max(1, Math.round(duration / beatSec)),
			isPeak,
			isBarDownbeat,
			isVocalEntryBoundary,
		});
	}

	return slots;
}
