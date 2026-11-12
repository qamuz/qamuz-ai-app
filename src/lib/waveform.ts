/** Real waveforms from decoded audio: every sample is scanned once into min/max blocks, then drawn per pixel. */

const BLOCK = 256;

export interface Peaks {
	min: Float32Array;
	max: Float32Array;
	sampleRate: number;
	duration: number;
}

const bufferPeaks = new WeakMap<AudioBuffer, Peaks>();

/** Min/max per 256-sample block across all channels (cached per buffer). */
export function peaksFromBuffer(buffer: AudioBuffer): Peaks {
	const have = bufferPeaks.get(buffer);
	if (have) return have;
	const blocks = Math.ceil(buffer.length / BLOCK);
	const min = new Float32Array(blocks);
	const max = new Float32Array(blocks);
	const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
	for (let b = 0; b < blocks; b += 1) {
		let lo = 0;
		let hi = 0;
		const start = b * BLOCK;
		const end = Math.min(buffer.length, start + BLOCK);
		for (const data of channels) {
			for (let i = start; i < end; i += 1) {
				const v = data[i];
				if (v < lo) lo = v;
				else if (v > hi) hi = v;
			}
		}
		min[b] = lo;
		max[b] = hi;
	}
	const peaks = { min, max, sampleRate: buffer.sampleRate, duration: buffer.duration };
	bufferPeaks.set(buffer, peaks);
	return peaks;
}

// Decode a couple of files at a time so a 12-stem job doesn't spike memory.
const urlPeaks = new Map<string, Promise<Peaks | null>>();
let active = 0;
const waiting: Array<() => void> = [];
let decoder: OfflineAudioContext | null = null;

async function slot<T>(work: () => Promise<T>): Promise<T> {
	if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
	active += 1;
	try {
		return await work();
	} finally {
		active -= 1;
		waiting.shift()?.();
	}
}

/** Download + decode an audio URL and keep only its peaks (the decoded audio is released). */
export function loadPeaks(url: string): Promise<Peaks | null> {
	const have = urlPeaks.get(url);
	if (have) return have;
	const job = slot(async () => {
		const res = await fetch(url);
		if (!res.ok) throw new Error('fetch failed');
		const data = await res.arrayBuffer();
		if (!decoder) decoder = new OfflineAudioContext(1, 1, 44100);
		return peaksFromBuffer(await decoder.decodeAudioData(data));
	}).catch(() => {
		urlPeaks.delete(url);
		return null;
	});
	urlPeaks.set(url, job);
	return job;
}

export interface WaveformOptions {
	/** CSS pixel size to draw at. */
	width: number;
	height: number;
	/** Seconds into the audio where the view starts, and how many seconds it shows. */
	offset?: number;
	duration?: number;
	color: string;
	/** 0–1: part already played, drawn in `playedColor`. */
	progress?: number;
	playedColor?: string;
}

export function drawWaveform(canvas: HTMLCanvasElement, peaks: Peaks, opts: WaveformOptions) {
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const w = Math.max(1, Math.min(8000, Math.round(opts.width * dpr)));
	const h = Math.max(1, Math.round(opts.height * dpr));
	if (canvas.width !== w) canvas.width = w;
	if (canvas.height !== h) canvas.height = h;
	const g = canvas.getContext('2d');
	if (!g) return;
	g.clearRect(0, 0, w, h);

	const { min, max, sampleRate } = peaks;
	const offset = opts.offset ?? 0;
	const duration = opts.duration ?? peaks.duration;
	const firstBlock = (offset * sampleRate) / BLOCK;
	const blocksPerPx = (duration * sampleRate) / BLOCK / w;
	const mid = h / 2;
	const playedX = opts.progress !== undefined ? opts.progress * w : -1;

	for (let x = 0; x < w; x += 1) {
		const from = Math.floor(firstBlock + x * blocksPerPx);
		if (from >= min.length) break;
		const to = Math.max(from + 1, Math.floor(firstBlock + (x + 1) * blocksPerPx));
		let lo = 0;
		let hi = 0;
		for (let b = from; b < to && b < min.length; b += 1) {
			if (min[b] < lo) lo = min[b];
			if (max[b] > hi) hi = max[b];
		}
		const top = mid - hi * mid * 0.96;
		const bottom = mid - lo * mid * 0.96;
		g.fillStyle = x < playedX && opts.playedColor ? opts.playedColor : opts.color;
		g.fillRect(x, top, 1, Math.max(1, bottom - top));
	}
}

/** Read a theme color (CSS custom property) for canvas drawing. */
export function themeColor(name: string, fallback: string): string {
	if (typeof window === 'undefined') return fallback;
	const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return v || fallback;
}
