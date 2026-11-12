import type { FxSlot, FxType, MasterSettings } from '@/lib/daw/types';

export interface FxParamSpec {
	key: string;
	label: string;
	min: number;
	max: number;
	step: number;
	def: number;
	unit: string;
	/** Slider moves on a logarithmic scale (frequencies). */
	log?: boolean;
}

export const FX_TYPES: FxType[] = [
	'vocal',
	'lead',
	'eq',
	'filter',
	'comp',
	'saturation',
	'chorus',
	'delay',
	'reverb',
	'imager',
];

export const FX_LABELS: Record<FxType, string> = {
	vocal: 'Vocal Forge',
	lead: 'Lead Exciter',
	eq: 'EQ',
	filter: 'Filter',
	comp: 'Compressor',
	saturation: 'Saturation',
	chorus: 'Chorus',
	delay: 'Delay',
	reverb: 'Reverb',
	imager: 'Stereo Imager',
};

export const FX_HINTS: Record<FxType, string> = {
	vocal: 'Pitch snapping, de-esser & vocal sheen',
	lead: 'Solo guitar bite & requinto excitation',
	eq: 'Shape lows, mids and highs',
	filter: 'Cut lows or highs',
	comp: 'Even out the dynamics',
	saturation: 'Warmth and grit',
	chorus: 'Width and shimmer',
	delay: 'Echoes in time',
	reverb: 'Space and depth',
	imager: 'Stereo width & mono bass focus',
};

export const MAX_FX = 5;

export const FX_PARAMS: Record<FxType, FxParamSpec[]> = {
	vocal: [
		{ key: 'retuneSpeed', label: 'Retune Speed', min: 0, max: 50, step: 0.5, def: 12, unit: 'ms' },
		{ key: 'humanize', label: 'Humanize', min: 0, max: 100, step: 1, def: 45, unit: '%' },
		{ key: 'deEsser', label: 'De-Esser', min: -30, max: 0, step: 0.5, def: -12, unit: 'dB' },
		{ key: 'air', label: 'Air EQ', min: -6, max: 12, step: 0.5, def: 3.5, unit: 'dB' },
		{ key: 'warmth', label: 'Vocal Warmth', min: 0, max: 100, step: 1, def: 25, unit: '%' },
	],
	lead: [
		{ key: 'drive', label: 'Solo Drive', min: 0, max: 100, step: 1, def: 40, unit: '%' },
		{ key: 'bite', label: 'Mid Focus', min: 1000, max: 5000, step: 10, def: 3200, unit: 'Hz', log: true },
		{ key: 'boost', label: 'Lead Boost', min: 0, max: 15, step: 0.5, def: 6, unit: 'dB' },
		{ key: 'delayTap', label: 'Slapback Echo', min: 20, max: 350, step: 5, def: 120, unit: 'ms' },
		{ key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, def: 75, unit: '%' },
	],
	eq: [
		{ key: 'low', label: 'Low', min: -15, max: 15, step: 0.5, def: 0, unit: 'dB' },
		{ key: 'mid', label: 'Mid', min: -15, max: 15, step: 0.5, def: 0, unit: 'dB' },
		{ key: 'midFreq', label: 'Mid freq', min: 200, max: 5000, step: 1, def: 1000, unit: 'Hz', log: true },
		{ key: 'high', label: 'High', min: -15, max: 15, step: 0.5, def: 0, unit: 'dB' },
	],
	filter: [
		{ key: 'hp', label: 'High-pass', min: 20, max: 2000, step: 1, def: 20, unit: 'Hz', log: true },
		{ key: 'lp', label: 'Low-pass', min: 500, max: 20000, step: 1, def: 20000, unit: 'Hz', log: true },
		{ key: 'q', label: 'Resonance', min: 0.5, max: 10, step: 0.1, def: 0.7, unit: '' },
	],
	comp: [
		{ key: 'threshold', label: 'Threshold', min: -60, max: 0, step: 0.5, def: -18, unit: 'dB' },
		{ key: 'ratio', label: 'Ratio', min: 1, max: 20, step: 0.1, def: 4, unit: ':1' },
		{ key: 'attack', label: 'Attack', min: 1, max: 200, step: 1, def: 10, unit: 'ms' },
		{ key: 'release', label: 'Release', min: 20, max: 1000, step: 5, def: 200, unit: 'ms' },
		{ key: 'makeup', label: 'Makeup', min: 0, max: 24, step: 0.5, def: 3, unit: 'dB' },
	],
	saturation: [
		{ key: 'drive', label: 'Drive', min: 0, max: 100, step: 1, def: 30, unit: '%' },
		{ key: 'tone', label: 'Tone', min: 1000, max: 20000, step: 10, def: 12000, unit: 'Hz', log: true },
		{ key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, def: 100, unit: '%' },
	],
	chorus: [
		{ key: 'rate', label: 'Rate', min: 0.1, max: 5, step: 0.05, def: 1.2, unit: 'Hz' },
		{ key: 'depth', label: 'Depth', min: 0, max: 100, step: 1, def: 40, unit: '%' },
		{ key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, def: 50, unit: '%' },
	],
	delay: [
		{ key: 'time', label: 'Time', min: 20, max: 2000, step: 5, def: 375, unit: 'ms' },
		{ key: 'feedback', label: 'Feedback', min: 0, max: 90, step: 1, def: 35, unit: '%' },
		{ key: 'tone', label: 'Tone', min: 1000, max: 20000, step: 10, def: 6000, unit: 'Hz', log: true },
		{ key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, def: 30, unit: '%' },
	],
	reverb: [
		{ key: 'size', label: 'Size', min: 0.3, max: 8, step: 0.1, def: 2.5, unit: 's' },
		{ key: 'predelay', label: 'Pre-delay', min: 0, max: 200, step: 1, def: 20, unit: 'ms' },
		{ key: 'tone', label: 'Tone', min: 1000, max: 20000, step: 10, def: 9000, unit: 'Hz', log: true },
		{ key: 'mix', label: 'Mix', min: 0, max: 100, step: 1, def: 25, unit: '%' },
	],
	imager: [
		{ key: 'width', label: 'Stereo Width', min: 0, max: 200, step: 1, def: 135, unit: '%' },
		{ key: 'monoBass', label: 'Mono Bass Cut', min: 60, max: 250, step: 5, def: 120, unit: 'Hz', log: true },
		{ key: 'airSpread', label: 'High Spread', min: -6, max: 6, step: 0.5, def: 1.5, unit: 'dB' },
	],
};

export const DEFAULT_MASTER: MasterSettings = { volume: 1, limiter: true, ceiling: -1, drive: 0 };

export function newFx(type: FxType, id: string): FxSlot {
	const params: Record<string, number> = {};
	for (const spec of FX_PARAMS[type]) params[spec.key] = spec.def;
	return { id, type, bypass: false, params };
}

export function paramValue(slot: FxSlot, key: string): number {
	const v = slot.params[key];
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	return FX_PARAMS[slot.type].find((s) => s.key === key)?.def ?? 0;
}

const db = (v: number) => Math.pow(10, v / 20);

interface FxUnit {
	input: AudioNode;
	output: AudioNode;
	set: (slot: FxSlot, instant: boolean) => void;
	dispose: () => void;
}

function setter(ctx: BaseAudioContext) {
	return (param: AudioParam, value: number, instant: boolean) => {
		if (instant) {
			param.cancelScheduledValues(0);
			param.value = value;
			return;
		}
		param.cancelScheduledValues(ctx.currentTime);
		param.setTargetAtTime(value, ctx.currentTime, 0.02);
	};
}

/** input → dry → output, input → (effect) → wet → output */
function dryWet(ctx: BaseAudioContext) {
	const input = ctx.createGain();
	const output = ctx.createGain();
	const dry = ctx.createGain();
	const wet = ctx.createGain();
	input.connect(dry);
	dry.connect(output);
	wet.connect(output);
	return { input, output, dry, wet };
}

function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
	const rate = ctx.sampleRate;
	const length = Math.max(1, Math.floor(rate * seconds));
	const buffer = ctx.createBuffer(2, length, rate);
	for (let c = 0; c < 2; c += 1) {
		const data = buffer.getChannelData(c);
		for (let i = 0; i < length; i += 1) {
			const t = i / length;
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * Math.exp(-t * 3);
		}
	}
	return buffer;
}

function curve(drive: number): Float32Array<ArrayBuffer> {
	const k = 1 + (drive / 100) * 40;
	const n = 2048;
	const out = new Float32Array(new ArrayBuffer(n * 4));
	const norm = Math.tanh(k);
	for (let i = 0; i < n; i += 1) {
		const x = (i / (n - 1)) * 2 - 1;
		out[i] = Math.tanh(k * x) / norm;
	}
	return out;
}

function buildUnit(ctx: BaseAudioContext, type: FxType): FxUnit {
	const set = setter(ctx);
	switch (type) {
		case 'eq': {
			const low = ctx.createBiquadFilter();
			low.type = 'lowshelf';
			low.frequency.value = 120;
			const mid = ctx.createBiquadFilter();
			mid.type = 'peaking';
			mid.Q.value = 0.8;
			const high = ctx.createBiquadFilter();
			high.type = 'highshelf';
			high.frequency.value = 6000;
			low.connect(mid);
			mid.connect(high);
			return {
				input: low,
				output: high,
				set: (s, i) => {
					set(low.gain, paramValue(s, 'low'), i);
					set(mid.gain, paramValue(s, 'mid'), i);
					set(mid.frequency, paramValue(s, 'midFreq'), i);
					set(high.gain, paramValue(s, 'high'), i);
				},
				dispose: () => undefined,
			};
		}
		case 'filter': {
			const hp = ctx.createBiquadFilter();
			hp.type = 'highpass';
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass';
			hp.connect(lp);
			return {
				input: hp,
				output: lp,
				set: (s, i) => {
					const q = paramValue(s, 'q');
					set(hp.frequency, paramValue(s, 'hp'), i);
					set(lp.frequency, Math.min(ctx.sampleRate / 2 - 100, paramValue(s, 'lp')), i);
					set(hp.Q, q, i);
					set(lp.Q, q, i);
				},
				dispose: () => undefined,
			};
		}
		case 'comp': {
			const comp = ctx.createDynamicsCompressor();
			comp.knee.value = 6;
			const makeup = ctx.createGain();
			comp.connect(makeup);
			return {
				input: comp,
				output: makeup,
				set: (s, i) => {
					set(comp.threshold, paramValue(s, 'threshold'), i);
					set(comp.ratio, paramValue(s, 'ratio'), i);
					set(comp.attack, paramValue(s, 'attack') / 1000, i);
					set(comp.release, paramValue(s, 'release') / 1000, i);
					set(makeup.gain, db(paramValue(s, 'makeup')), i);
				},
				dispose: () => undefined,
			};
		}
		case 'saturation': {
			const m = dryWet(ctx);
			const shaper = ctx.createWaveShaper();
			shaper.oversample = '4x';
			const tone = ctx.createBiquadFilter();
			tone.type = 'lowpass';
			m.input.connect(shaper);
			shaper.connect(tone);
			tone.connect(m.wet);
			let lastDrive = -1;
			return {
				input: m.input,
				output: m.output,
				set: (s, i) => {
					const drive = paramValue(s, 'drive');
					if (drive !== lastDrive) {
						shaper.curve = curve(drive);
						lastDrive = drive;
					}
					const mix = paramValue(s, 'mix') / 100;
					set(tone.frequency, Math.min(ctx.sampleRate / 2 - 100, paramValue(s, 'tone')), i);
					set(m.dry.gain, Math.cos((mix * Math.PI) / 2), i);
					set(m.wet.gain, Math.sin((mix * Math.PI) / 2), i);
				},
				dispose: () => undefined,
			};
		}
		case 'chorus': {
			const m = dryWet(ctx);
			const osc = ctx.createOscillator();
			osc.type = 'sine';
			const voices = [-0.7, 0.7].map((side, n) => {
				const delay = ctx.createDelay(0.1);
				delay.delayTime.value = 0.018 + n * 0.004;
				const depth = ctx.createGain();
				const pan = ctx.createStereoPanner();
				pan.pan.value = side;
				osc.connect(depth);
				depth.connect(delay.delayTime);
				m.input.connect(delay);
				delay.connect(pan);
				pan.connect(m.wet);
				return { depth, sign: n === 0 ? 1 : -1 };
			});
			osc.start();
			return {
				input: m.input,
				output: m.output,
				set: (s, i) => {
					const mix = paramValue(s, 'mix') / 100;
					const depth = (paramValue(s, 'depth') / 100) * 0.006;
					set(osc.frequency, paramValue(s, 'rate'), i);
					voices.forEach((v) => set(v.depth.gain, depth * v.sign, i));
					set(m.dry.gain, Math.cos((mix * Math.PI) / 2), i);
					set(m.wet.gain, Math.sin((mix * Math.PI) / 2), i);
				},
				dispose: () => {
					try {
						osc.stop();
					} catch {
						/* already stopped */
					}
				},
			};
		}
		case 'delay': {
			const m = dryWet(ctx);
			const delay = ctx.createDelay(2.5);
			const tone = ctx.createBiquadFilter();
			tone.type = 'lowpass';
			const feedback = ctx.createGain();
			m.input.connect(delay);
			delay.connect(tone);
			tone.connect(feedback);
			feedback.connect(delay);
			tone.connect(m.wet);
			return {
				input: m.input,
				output: m.output,
				set: (s, i) => {
					set(delay.delayTime, paramValue(s, 'time') / 1000, i);
					set(feedback.gain, paramValue(s, 'feedback') / 100, i);
					set(tone.frequency, Math.min(ctx.sampleRate / 2 - 100, paramValue(s, 'tone')), i);
					set(m.dry.gain, 1, i);
					set(m.wet.gain, paramValue(s, 'mix') / 100, i);
				},
				dispose: () => feedback.disconnect(),
			};
		}
		case 'reverb': {
			const m = dryWet(ctx);
			const pre = ctx.createDelay(0.5);
			const conv = ctx.createConvolver();
			const tone = ctx.createBiquadFilter();
			tone.type = 'lowpass';
			m.input.connect(pre);
			pre.connect(conv);
			conv.connect(tone);
			tone.connect(m.wet);
			let lastSize = -1;
			return {
				input: m.input,
				output: m.output,
				set: (s, i) => {
					const size = paramValue(s, 'size');
					if (Math.abs(size - lastSize) > 0.05) {
						conv.buffer = impulse(ctx, size);
						lastSize = size;
					}
					set(pre.delayTime, paramValue(s, 'predelay') / 1000, i);
					set(tone.frequency, Math.min(ctx.sampleRate / 2 - 100, paramValue(s, 'tone')), i);
					set(m.dry.gain, 1, i);
					set(m.wet.gain, (paramValue(s, 'mix') / 100) * 1.4, i);
				},
				dispose: () => undefined,
			};
		}
		case 'vocal': {
			const deEsser = ctx.createBiquadFilter();
			deEsser.type = 'peaking';
			deEsser.frequency.value = 6800;
			deEsser.Q.value = 2.0;

			const air = ctx.createBiquadFilter();
			air.type = 'highshelf';
			air.frequency.value = 14000;

			const shaper = ctx.createWaveShaper();
			shaper.oversample = '2x';
			const makeup = ctx.createGain();

			deEsser.connect(air);
			air.connect(shaper);
			shaper.connect(makeup);

			let lastWarmth = -1;
			return {
				input: deEsser,
				output: makeup,
				set: (s, i) => {
					set(deEsser.gain, paramValue(s, 'deEsser'), i);
					set(air.gain, paramValue(s, 'air'), i);
					const warmth = paramValue(s, 'warmth');
					if (warmth !== lastWarmth) {
						shaper.curve = curve(warmth * 0.5);
						lastWarmth = warmth;
					}
					set(makeup.gain, 1.0 + (warmth / 100) * 0.25, i);
				},
				dispose: () => undefined,
			};
		}
		case 'lead': {
			const m = dryWet(ctx);
			const shaper = ctx.createWaveShaper();
			shaper.oversample = '4x';

			const bite = ctx.createBiquadFilter();
			bite.type = 'peaking';
			bite.Q.value = 1.6;

			const slap = ctx.createDelay(0.5);
			const slapGain = ctx.createGain();
			slapGain.gain.value = 0.35;

			m.input.connect(shaper);
			shaper.connect(bite);
			bite.connect(m.wet);
			bite.connect(slap);
			slap.connect(slapGain);
			slapGain.connect(m.wet);

			let lastDrive = -1;
			return {
				input: m.input,
				output: m.output,
				set: (s, i) => {
					const drive = paramValue(s, 'drive');
					if (drive !== lastDrive) {
						shaper.curve = curve(drive * 0.9);
						lastDrive = drive;
					}
					set(bite.frequency, paramValue(s, 'bite'), i);
					set(bite.gain, paramValue(s, 'boost'), i);
					set(slap.delayTime, paramValue(s, 'delayTap') / 1000, i);
					const mix = paramValue(s, 'mix') / 100;
					set(m.dry.gain, Math.cos((mix * Math.PI) / 2), i);
					set(m.wet.gain, Math.sin((mix * Math.PI) / 2), i);
				},
				dispose: () => {
					try {
						slap.disconnect();
					} catch {
						/* ignore */
					}
				},
			};
		}
		case 'imager': {
			const splitter = ctx.createChannelSplitter(2);
			const merger = ctx.createChannelMerger(2);

			const midFromL = ctx.createGain();
			const midFromR = ctx.createGain();
			midFromL.gain.value = 0.5;
			midFromR.gain.value = 0.5;

			const sideFromL = ctx.createGain();
			const sideFromR = ctx.createGain();
			sideFromL.gain.value = 0.5;
			sideFromR.gain.value = -0.5;

			const monoBassFilter = ctx.createBiquadFilter();
			monoBassFilter.type = 'highpass';
			monoBassFilter.Q.value = 0.7;

			const sideAir = ctx.createBiquadFilter();
			sideAir.type = 'highshelf';
			sideAir.frequency.value = 8000;

			const sideWidthGain = ctx.createGain();

			splitter.connect(midFromL, 0);
			splitter.connect(midFromR, 1);
			splitter.connect(sideFromL, 0);
			splitter.connect(sideFromR, 1);

			sideFromL.connect(monoBassFilter);
			sideFromR.connect(monoBassFilter);
			monoBassFilter.connect(sideAir);
			sideAir.connect(sideWidthGain);

			const toLeftMid = ctx.createGain();
			toLeftMid.gain.value = 1.0;
			const toLeftSide = ctx.createGain();
			toLeftSide.gain.value = 1.0;

			const toRightMid = ctx.createGain();
			toRightMid.gain.value = 1.0;
			const toRightSide = ctx.createGain();
			toRightSide.gain.value = -1.0;

			midFromL.connect(toLeftMid);
			midFromR.connect(toLeftMid);
			midFromL.connect(toRightMid);
			midFromR.connect(toRightMid);

			sideWidthGain.connect(toLeftSide);
			sideWidthGain.connect(toRightSide);

			toLeftMid.connect(merger, 0, 0);
			toLeftSide.connect(merger, 0, 0);
			toRightMid.connect(merger, 0, 1);
			toRightSide.connect(merger, 0, 1);

			return {
				input: splitter,
				output: merger,
				set: (s, i) => {
					const widthRatio = paramValue(s, 'width') / 100;
					set(sideWidthGain.gain, widthRatio, i);
					set(monoBassFilter.frequency, paramValue(s, 'monoBass'), i);
					set(sideAir.gain, paramValue(s, 'airSpread'), i);
				},
				dispose: () => undefined,
			};
		}
	}
}

const signature = (slots: FxSlot[]) => slots.map((s) => `${s.id}:${s.type}:${s.bypass ? 0 : 1}`).join('|');

/** A track's insert chain between `input` and `output`. Rebuilt when slots are added, removed, reordered or bypassed; params update live. */
export class FxChain {
	private units: { slot: FxSlot; unit: FxUnit }[] = [];
	private sig = '';

	constructor(
		private ctx: BaseAudioContext,
		private input: AudioNode,
		private output: AudioNode,
		slots: FxSlot[],
	) {
		this.build(slots);
	}

	private teardown() {
		this.input.disconnect();
		this.units.forEach(({ unit }) => {
			unit.dispose();
			unit.output.disconnect();
		});
		this.units = [];
	}

	private build(slots: FxSlot[]) {
		this.sig = signature(slots);
		let prev: AudioNode = this.input;
		for (const slot of slots) {
			if (slot.bypass) continue;
			const unit = buildUnit(this.ctx, slot.type);
			unit.set(slot, true);
			prev.connect(unit.input);
			prev = unit.output;
			this.units.push({ slot, unit });
		}
		prev.connect(this.output);
	}

	update(slots: FxSlot[]) {
		if (signature(slots) !== this.sig) {
			this.teardown();
			this.build(slots);
			return;
		}
		const active = slots.filter((s) => !s.bypass);
		active.forEach((slot, i) => {
			const entry = this.units[i];
			if (entry && entry.slot !== slot) {
				entry.unit.set(slot, false);
				entry.slot = slot;
			}
		});
	}

	dispose() {
		this.teardown();
	}
}

/** Master bus: input → drive → brickwall limiter → volume → destination. */
export class MasterBus {
	readonly input: GainNode;
	readonly out: GainNode;
	private drive: GainNode;
	private limiter: DynamicsCompressorNode;
	private trim: GainNode;

	constructor(
		private ctx: BaseAudioContext,
		dest: AudioNode,
		settings: MasterSettings,
	) {
		this.input = ctx.createGain();
		this.drive = ctx.createGain();
		this.limiter = ctx.createDynamicsCompressor();
		this.limiter.knee.value = 0;
		this.limiter.attack.value = 0.002;
		this.limiter.release.value = 0.12;
		this.trim = ctx.createGain();
		this.out = ctx.createGain();
		this.input.connect(this.drive);
		this.drive.connect(this.limiter);
		this.limiter.connect(this.trim);
		this.trim.connect(this.out);
		this.out.connect(dest);
		this.update(settings, true);
	}

	update(m: MasterSettings, instant = false) {
		const set = setter(this.ctx);
		set(this.drive.gain, m.limiter ? db(m.drive) : 1, instant);
		set(this.limiter.threshold, m.limiter ? m.ceiling - 0.3 : 0, instant);
		set(this.limiter.ratio, m.limiter ? 20 : 1, instant);
		set(this.trim.gain, 1, instant);
		set(this.out.gain, m.volume, instant);
	}

	get reduction(): number {
		return this.limiter.reduction;
	}
}
