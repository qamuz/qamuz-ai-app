import { encodeWav } from '@/lib/engagement';

export type PresetKey =
	| 'balanced'
	| 'warm'
	| 'bright'
	| 'loud'
	| 'vocal'
	| 'latin_punch'
	| 'club_loud'
	| 'analog_tape';

export interface MasterPreset {
	key: PresetKey;
	label: string;
	description: string;
	/** Low shelf gain (dB) at 110 Hz */
	low: number;
	/** Presence gain (dB) at 2.6 kHz */
	mid: number;
	/** High shelf gain (dB) at 9.5 kHz */
	high: number;
	threshold: number;
	ratio: number;
	/** Make-up gain (dB) after compression */
	makeup: number;
	/** Stereo width multiplier (0.5 to 1.8) */
	width?: number;
	/** Analog tape/tube saturation amount (0 to 1) */
	saturation?: number;
	/** Target LUFS loudness (-16 to -8 LUFS) */
	targetLufs?: number;
}

export interface LoudnessReport {
	peakDb: number;
	rmsDb: number;
	lufs: number;
	dynamicRange: number;
	durationSec: number;
}

export const PRESETS: MasterPreset[] = [
	{
		key: 'balanced',
		label: 'Balanced Studio',
		description: 'Pule el sonido de forma transparente y uniforme para cualquier plataforma',
		low: 1.5,
		mid: 0.5,
		high: 1.5,
		threshold: -18,
		ratio: 2.5,
		makeup: 4,
		width: 1.1,
		saturation: 0.25,
		targetLufs: -14,
	},
	{
		key: 'latin_punch',
		label: 'Latin Punch (Bachata & Merengue)',
		description: 'Pegada definida en percusión (güira/tambora/bongó) y brillo sedoso en requinto',
		low: 2.8,
		mid: 1.2,
		high: 2.6,
		threshold: -20,
		ratio: 3.2,
		makeup: 5.5,
		width: 1.25,
		saturation: 0.35,
		targetLufs: -12.5,
	},
	{
		key: 'warm',
		label: 'Warm Analog',
		description: 'Graves profundos y redondos con agudos aterciopelados estilo vinilo',
		low: 3.8,
		mid: -0.8,
		high: -0.5,
		threshold: -20,
		ratio: 2.5,
		makeup: 4.5,
		width: 1.05,
		saturation: 0.45,
		targetLufs: -14,
	},
	{
		key: 'bright',
		label: 'Air & Clarity',
		description: 'Apertura de altas frecuencias cristalinas y presencia vocal frontal',
		low: 0.5,
		mid: 1.5,
		high: 4.2,
		threshold: -18,
		ratio: 2.5,
		makeup: 4,
		width: 1.2,
		saturation: 0.2,
		targetLufs: -13.5,
	},
	{
		key: 'club_loud',
		label: 'Club / Radio Loud',
		description: 'Máxima sonoridad comercial competitiva con sub-bass contundente sin distorsión',
		low: 3.2,
		mid: 1.2,
		high: 2.8,
		threshold: -26,
		ratio: 4.5,
		makeup: 8.5,
		width: 1.2,
		saturation: 0.5,
		targetLufs: -9.5,
	},
	{
		key: 'analog_tape',
		label: 'Vintage Tape Warmth',
		description: 'Saturación armónica de cinta analógica con pegamento natural de bus',
		low: 2.5,
		mid: 0.2,
		high: 0.8,
		threshold: -19,
		ratio: 2.8,
		makeup: 4.8,
		width: 1.15,
		saturation: 0.6,
		targetLufs: -13,
	},
	{
		key: 'loud',
		label: 'Modern Streaming',
		description: 'Optimizado para Spotify y Apple Music con pegada y balance de rango',
		low: 2.5,
		mid: 1.0,
		high: 2.5,
		threshold: -24,
		ratio: 4.0,
		makeup: 7.0,
		width: 1.15,
		saturation: 0.3,
		targetLufs: -14,
	},
	{
		key: 'vocal',
		label: 'Vocal Presence',
		description: 'Destaca la voz solista o coros sobre la instrumentación',
		low: -1.0,
		mid: 3.2,
		high: 2.0,
		threshold: -20,
		ratio: 3.0,
		makeup: 5.0,
		width: 1.1,
		saturation: 0.25,
		targetLufs: -13.5,
	},
];

export interface MasterChain {
	input: AudioNode;
	output: AudioNode;
	update: (preset: MasterPreset, amount: number, smooth: boolean) => void;
}

const dbToGain = (db: number) => Math.pow(10, db / 20);

/** EQ → bus compressor → make-up gain → brick-wall limiter. `amount` (0–100) scales how hard it works. */
export function buildChain(ctx: BaseAudioContext, preset: MasterPreset, amount: number, smooth: boolean): MasterChain {
	const highpass = ctx.createBiquadFilter();
	highpass.type = 'highpass';
	highpass.frequency.value = 28;
	highpass.Q.value = 0.7;

	const low = ctx.createBiquadFilter();
	low.type = 'lowshelf';
	low.frequency.value = 110;

	const mid = ctx.createBiquadFilter();
	mid.type = 'peaking';
	mid.frequency.value = 2600;
	mid.Q.value = 0.9;

	const high = ctx.createBiquadFilter();
	high.type = 'highshelf';
	high.frequency.value = 9500;

	const comp = ctx.createDynamicsCompressor();
	comp.attack.value = 0.015;
	comp.release.value = 0.25;
	comp.knee.value = 8;

	const makeup = ctx.createGain();

	const limiter = ctx.createDynamicsCompressor();
	limiter.threshold.value = -1.0;
	limiter.knee.value = 0;
	limiter.ratio.value = 20;
	limiter.attack.value = 0.002;
	limiter.release.value = 0.08;

	highpass.connect(low).connect(mid).connect(high).connect(comp).connect(makeup).connect(limiter);

	const set = (param: AudioParam, value: number, useSmooth: boolean) => {
		if (useSmooth) param.setTargetAtTime(value, ctx.currentTime, 0.04);
		else param.value = value;
	};

	const update = (p: MasterPreset, amt: number, useSmooth: boolean) => {
		const k = Math.max(0, Math.min(100, amt)) / 100;
		set(low.gain, p.low * k, useSmooth);
		set(mid.gain, p.mid * k, useSmooth);
		set(high.gain, p.high * k, useSmooth);
		set(comp.threshold, p.threshold * k, useSmooth);
		set(comp.ratio, 1 + (p.ratio - 1) * k, useSmooth);
		set(makeup.gain, dbToGain(p.makeup * k), useSmooth);
	};
	update(preset, amount, smooth);

	return { input: highpass, output: limiter, update };
}

/** Real-time and offline loudness analysis (Peak dBFS, RMS dBFS, and LUFS estimation). */
export function measureLoudness(buffer: AudioBuffer): LoudnessReport {
	const channels = Math.min(2, buffer.numberOfChannels);
	const length = buffer.length;
	const left = buffer.getChannelData(0);
	const right = channels > 1 ? buffer.getChannelData(1) : left;
	let peak = 0;
	let energy = 0;
	for (let i = 0; i < length; i += 1) {
		const l = left[i];
		const r = right[i];
		peak = Math.max(peak, Math.abs(l), Math.abs(r));
		energy += (l * l + r * r) * 0.5;
	}
	const rms = Math.sqrt(energy / Math.max(1, length));
	const peakDb = peak > 0 ? 20 * Math.log10(peak) : -120;
	const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -120;
	const lufs = rmsDb + 0.7;
	const dynamicRange = Math.max(0, peakDb - rmsDb);
	return {
		peakDb: Math.round(peakDb * 10) / 10,
		rmsDb: Math.round(rmsDb * 10) / 10,
		lufs: Math.round(lufs * 10) / 10,
		dynamicRange: Math.round(dynamicRange * 10) / 10,
		durationSec: length / buffer.sampleRate,
	};
}

/**
 * Logarithmic 96-band spectrum curve calculator.
 * Ported directly from Qamuz Studio 2.0 Mastering Engine.
 */
export function logSpectrum(buffer: AudioBuffer, bands = 96): Float32Array {
	const channel = buffer.getChannelData(0);
	const sampleRate = buffer.sampleRate;
	const window = Math.min(6144, channel.length);
	const start = Math.max(0, Math.floor((channel.length - window) / 2));
	const out = new Float32Array(bands);
	for (let band = 0; band < bands; band += 1) {
		const freq = 20 * Math.pow(1000, band / Math.max(1, bands - 1));
		const omega = (2 * Math.PI * freq) / sampleRate;
		let re = 0;
		let im = 0;
		const step = 3;
		for (let i = 0; i < window; i += step) {
			const sample = channel[start + i];
			re += sample * Math.cos(omega * i);
			im += sample * Math.sin(omega * i);
		}
		out[band] = Math.sqrt(re * re + im * im) / (window / step);
	}
	return out;
}

/** Download and decode a song into memory. */
export async function loadAudio(url: string): Promise<AudioBuffer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error('fetch failed');
	const data = await res.arrayBuffer();
	const ctx = new AudioContext();
	try {
		return await ctx.decodeAudioData(data);
	} finally {
		void ctx.close();
	}
}

/** Peak value (0–1) for each bar of a waveform overview. */
export function computePeaks(buffer: AudioBuffer, bars: number): number[] {
	const data = buffer.getChannelData(0);
	const size = Math.max(1, Math.floor(data.length / bars));
	const peaks: number[] = [];
	let max = 0;
	for (let i = 0; i < bars; i++) {
		let peak = 0;
		const end = Math.min(data.length, (i + 1) * size);
		for (let j = i * size; j < end; j += 16) peak = Math.max(peak, Math.abs(data[j]));
		peaks.push(peak);
		max = Math.max(max, peak);
	}
	return peaks.map((p) => (max > 0 ? p / max : 0));
}

/** Render the full mastered song offline and encode it as WAV. */
export async function renderMaster(buffer: AudioBuffer, preset: MasterPreset, amount: number): Promise<Blob> {
	const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
	const source = offline.createBufferSource();
	source.buffer = buffer;
	const chain = buildChain(offline, preset, amount, false);
	source.connect(chain.input);
	chain.output.connect(offline.destination);
	source.start();
	const rendered = await offline.startRendering();
	return encodeWav(rendered);
}

export function safeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Qamuz';
}

/** Trigger a browser download for a blob. */
export function saveBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = safeFileName(filename);
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Fetch a remote file and save it under a friendly name. Returns false on failure. */
export async function downloadFile(url: string, filename: string): Promise<boolean> {
	try {
		const res = await fetch(url);
		if (!res.ok) return false;
		saveBlob(await res.blob(), filename);
		return true;
	} catch {
		return false;
	}
}
