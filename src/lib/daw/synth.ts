import type { InstrumentPreset } from '@/lib/daw/types';

interface OscSpec {
	type: OscillatorType;
	detune: number;
	gain: number;
}

interface Preset {
	voices: OscSpec[];
	attack: number;
	decay: number;
	sustain: number;
	release: number;
	cutoff: number;
	q: number;
	gain: number;
}

export const PRESETS: Record<InstrumentPreset, Preset> = {
	piano: {
		voices: [
			{ type: 'triangle', detune: 0, gain: 0.7 },
			{ type: 'sine', detune: 1200, gain: 0.22 },
			{ type: 'square', detune: 0, gain: 0.05 },
		],
		attack: 0.005,
		decay: 0.9,
		sustain: 0.2,
		release: 0.35,
		cutoff: 4200,
		q: 0.7,
		gain: 0.35,
	},
	synth: {
		voices: [
			{ type: 'sawtooth', detune: -7, gain: 0.5 },
			{ type: 'sawtooth', detune: 7, gain: 0.5 },
		],
		attack: 0.01,
		decay: 0.2,
		sustain: 0.7,
		release: 0.2,
		cutoff: 2800,
		q: 4,
		gain: 0.2,
	},
	bass: {
		voices: [
			{ type: 'sawtooth', detune: 0, gain: 0.6 },
			{ type: 'square', detune: -1200, gain: 0.5 },
		],
		attack: 0.005,
		decay: 0.25,
		sustain: 0.6,
		release: 0.12,
		cutoff: 900,
		q: 6,
		gain: 0.32,
	},
	pad: {
		voices: [
			{ type: 'sawtooth', detune: -10, gain: 0.4 },
			{ type: 'sawtooth', detune: 10, gain: 0.4 },
			{ type: 'triangle', detune: 1200, gain: 0.2 },
		],
		attack: 0.5,
		decay: 1,
		sustain: 0.8,
		release: 1.2,
		cutoff: 1600,
		q: 1,
		gain: 0.16,
	},
	pluck: {
		voices: [
			{ type: 'square', detune: 0, gain: 0.5 },
			{ type: 'triangle', detune: 1200, gain: 0.3 },
		],
		attack: 0.002,
		decay: 0.25,
		sustain: 0,
		release: 0.2,
		cutoff: 3000,
		q: 2,
		gain: 0.28,
	},
	requinto: {
		voices: [
			{ type: 'sawtooth', detune: 0, gain: 0.45 },
			{ type: 'triangle', detune: 1200, gain: 0.4 },
			{ type: 'square', detune: 2400, gain: 0.15 },
		],
		attack: 0.002,
		decay: 0.35,
		sustain: 0.18,
		release: 0.24,
		cutoff: 5800,
		q: 3.5,
		gain: 0.36,
	},
	segunda: {
		voices: [
			{ type: 'triangle', detune: 0, gain: 0.6 },
			{ type: 'sine', detune: 1200, gain: 0.3 },
			{ type: 'sawtooth', detune: 7, gain: 0.1 },
		],
		attack: 0.004,
		decay: 0.42,
		sustain: 0.25,
		release: 0.3,
		cutoff: 3600,
		q: 1.5,
		gain: 0.32,
	},
	bongo: {
		voices: [
			{ type: 'sine', detune: 0, gain: 0.7 },
			{ type: 'triangle', detune: 700, gain: 0.2 },
			{ type: 'square', detune: 1900, gain: 0.1 },
		],
		attack: 0.001,
		decay: 0.18,
		sustain: 0.02,
		release: 0.14,
		cutoff: 1600,
		q: 7.5,
		gain: 0.44,
	},
	guira: {
		voices: [
			{ type: 'square', detune: 15, gain: 0.5 },
			{ type: 'square', detune: -15, gain: 0.5 },
			{ type: 'sawtooth', detune: 2400, gain: 0.2 },
		],
		attack: 0.001,
		decay: 0.08,
		sustain: 0.01,
		release: 0.06,
		cutoff: 8200,
		q: 4.8,
		gain: 0.34,
	},
	tambora: {
		voices: [
			{ type: 'sine', detune: -1200, gain: 0.6 },
			{ type: 'triangle', detune: 0, gain: 0.3 },
			{ type: 'square', detune: 500, gain: 0.1 },
		],
		attack: 0.002,
		decay: 0.24,
		sustain: 0.04,
		release: 0.18,
		cutoff: 950,
		q: 6.0,
		gain: 0.42,
	},
	slapBass: {
		voices: [
			{ type: 'sawtooth', detune: 0, gain: 0.55 },
			{ type: 'sine', detune: -1200, gain: 0.35 },
			{ type: 'square', detune: 1200, gain: 0.2 },
		],
		attack: 0.003,
		decay: 0.28,
		sustain: 0.35,
		release: 0.16,
		cutoff: 2400,
		q: 4.2,
		gain: 0.36,
	},
	maracas: {
		voices: [
			{ type: 'square', detune: 20, gain: 0.45 },
			{ type: 'sawtooth', detune: -20, gain: 0.45 },
			{ type: 'sine', detune: 3600, gain: 0.1 },
		],
		attack: 0.001,
		decay: 0.07,
		sustain: 0.01,
		release: 0.05,
		cutoff: 7200,
		q: 3.2,
		gain: 0.28,
	},
};

export const PRESET_LABELS: Record<InstrumentPreset, string> = {
	piano: 'Piano',
	synth: 'Synth lead',
	bass: 'Bass',
	pad: 'Pad',
	pluck: 'Pluck',
	requinto: 'Requinto (Bachata)',
	segunda: 'Segunda (Guitarra)',
	bongo: 'Bongó Dominicano',
	guira: 'Güira Tradicional',
	tambora: 'Tambora Merengue',
	slapBass: 'Slap Bass Latino',
	maracas: 'Maracas Tropicales',
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(pitch: number): string {
	return `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export function midiToFreq(pitch: number): number {
	return 440 * Math.pow(2, (pitch - 69) / 12);
}

export interface Voice {
	/** Start the release phase at a given context time. */
	release: (at: number) => void;
	/** Silence immediately (used when playback stops). */
	kill: () => void;
}

/** Play one synth note. Pass `duration` for scheduled notes; omit it for held (live) notes. */
export function playVoice(
	ctx: BaseAudioContext,
	dest: AudioNode,
	preset: InstrumentPreset,
	pitch: number,
	when: number,
	velocity: number,
	duration?: number,
): Voice {
	const p = PRESETS[preset] ?? PRESETS.piano;
	const peak = p.gain * Math.max(0.05, Math.min(1, velocity));
	const amp = ctx.createGain();
	amp.gain.setValueAtTime(0, when);
	amp.gain.linearRampToValueAtTime(peak, when + p.attack);
	amp.gain.setTargetAtTime(peak * p.sustain, when + p.attack, Math.max(0.01, p.decay / 3));

	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = p.cutoff;
	filter.Q.value = p.q;
	filter.connect(amp);
	amp.connect(dest);

	const freq = midiToFreq(pitch);
	const oscs = p.voices.map((v) => {
		const osc = ctx.createOscillator();
		osc.type = v.type;
		osc.frequency.value = freq;
		osc.detune.value = v.detune;
		const g = ctx.createGain();
		g.gain.value = v.gain;
		osc.connect(g);
		g.connect(filter);
		osc.start(when);
		return osc;
	});

	let released = false;
	const release = (at: number) => {
		if (released) return;
		released = true;
		const t = Math.max(at, when + 0.005);
		const param = amp.gain;
		const hold = (param as unknown as { cancelAndHoldAtTime?: (time: number) => void }).cancelAndHoldAtTime;
		if (typeof hold === 'function') {
			hold.call(param, t);
		} else {
			param.cancelScheduledValues(t);
			param.setValueAtTime(peak * p.sustain, t);
		}
		param.setTargetAtTime(0, t, Math.max(0.01, p.release / 4));
		oscs.forEach((o) => o.stop(t + p.release + 0.1));
	};
	if (duration !== undefined) release(when + duration);

	const kill = () => {
		oscs.forEach((o) => {
			try {
				o.stop();
			} catch {
				/* already stopped */
			}
		});
		amp.disconnect();
	};

	return { release, kill };
}

/** Metronome tick. */
export function click(ctx: BaseAudioContext, dest: AudioNode, when: number, accent: boolean) {
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.frequency.value = accent ? 1600 : 1000;
	g.gain.setValueAtTime(accent ? 0.5 : 0.3, when);
	g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
	osc.connect(g);
	g.connect(dest);
	osc.start(when);
	osc.stop(when + 0.06);
}
