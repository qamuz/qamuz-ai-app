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
	vocalEntryTime: number;
	peakHookStart: number;
	peakHookEnd: number;
	energyBins: number[]; // ~48 normalized bars for UI waveform
	segments: AudioSegmentAnalysis[];
	detectedLyrics: { time: number; text: string; isSlogan: boolean }[];
}

function cleanLyricsLines(lyrics: string | null | undefined): { text: string; sectionHint?: string; isSlogan: boolean }[] {
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
 * Real Web Audio API energy + vocal onset detector with lyrics alignment.
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

	if (audioUrl) {
		try {
			const res = await fetch(audioUrl, { mode: 'cors' });
			if (res.ok) {
				const buf = await res.arrayBuffer();
				const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				const ctx = new AudioCtx();
				try {
					const decoded = await ctx.decodeAudioData(buf);
					actualDuration = Math.max(8, decoded.duration || safeDur);
					const channel = decoded.getChannelData(0);
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
	const hookBins = Math.max(4, Math.round((Math.min(15, actualDuration * 0.35) / actualDuration) * energyBins.length));
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

	// Estimate BPM from peak transitions
	let peaks = 0;
	for (let i = 1; i < energyBins.length - 1; i++) {
		if (energyBins[i] > energyBins[i - 1] && energyBins[i] > energyBins[i + 1] && energyBins[i] > 0.55) {
			peaks++;
		}
	}
	const estimatedBpm = Math.max(76, Math.min(148, Math.round(88 + peaks * 4.2)));

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
		const end = i === segCount - 1 ? Number(actualDuration.toFixed(1)) : Number(((i + 1) * segDur).toFixed(1));
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
	isPeak: boolean;
	isVocalEntryBoundary: boolean;
}

/**
 * Generates rhythmic 1.0s - 2.0s cut boundaries locked to the song's BPM/compás,
 * aligned so a clean cut lands right at vocalEntryTime and tightens during the peak chorus.
 */
export function buildMusicalCutGrid(params: {
	duration: number;
	bpm: number;
	vocalEntryTime?: number;
	peakHookStart?: number;
	peakHookEnd?: number;
}): MusicalCutSlot[] {
	const total = Math.max(4, Number(params.duration) || 45);
	const safeBpm = Math.max(70, Math.min(180, Number(params.bpm) || 115));
	const beatSec = 60 / safeBpm;

	// Choose an integer number of beats per cut so verse cuts stay ~1.4s-2.0s
	// and peak/chorus cuts stay ~1.0s-1.55s (always <= 2.05s to match 25-frame SVD clips cleanly).
	let verseBeats = 3;
	while (beatSec * verseBeats < 1.35 && verseBeats < 6) verseBeats++;
	while (beatSec * verseBeats > 2.05 && verseBeats > 2) verseBeats--;
	const normalCutSec = Math.max(1.2, Math.min(2.05, Number((beatSec * verseBeats).toFixed(2))));

	let peakBeats = Math.max(2, verseBeats - 1);
	if (beatSec * peakBeats < 1.0) peakBeats++;
	const peakCutSec = Math.max(1.0, Math.min(1.6, Number((beatSec * peakBeats).toFixed(2))));

	const vocalEntry =
		typeof params.vocalEntryTime === 'number' && params.vocalEntryTime > 1.1 && params.vocalEntryTime < total - 1.5
			? Number(params.vocalEntryTime.toFixed(2))
			: null;
	const peakStart = params.peakHookStart ?? total * 0.35;
	const peakEnd = params.peakHookEnd ?? total * 0.72;

	const rawBoundaries: number[] = [0];

	const pushSectionCuts = (from: number, to: number) => {
		let cur = from;
		while (to - cur > 0.25) {
			const inPeak = cur >= peakStart - 0.1 && cur < peakEnd;
			const step = inPeak ? peakCutSec : normalCutSec;
			const remaining = to - cur;
			if (remaining <= step * 1.35) {
				rawBoundaries.push(Number(to.toFixed(2)));
				break;
			}
			cur = Number((cur + step).toFixed(2));
			rawBoundaries.push(cur);
		}
	};

	if (vocalEntry !== null) {
		pushSectionCuts(0, vocalEntry);
		pushSectionCuts(vocalEntry, total);
	} else {
		pushSectionCuts(0, total);
	}

	const slots: MusicalCutSlot[] = [];
	for (let i = 0; i < rawBoundaries.length - 1; i++) {
		const startTime = rawBoundaries[i];
		const endTime = rawBoundaries[i + 1];
		const duration = Number((endTime - startTime).toFixed(2));
		if (duration < 0.45) continue;
		const mid = (startTime + endTime) / 2;
		const isPeak = mid >= peakStart && mid <= peakEnd;
		const isVocalEntryBoundary = vocalEntry !== null && Math.abs(startTime - vocalEntry) < 0.08;
		slots.push({
			cutIndex: slots.length,
			startTime,
			endTime,
			duration,
			isPeak,
			isVocalEntryBoundary,
		});
	}

	return slots;
}
