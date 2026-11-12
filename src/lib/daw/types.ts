export type InstrumentPreset =
	| 'piano'
	| 'synth'
	| 'bass'
	| 'pad'
	| 'pluck'
	| 'requinto'
	| 'segunda'
	| 'bongo'
	| 'guira'
	| 'tambora'
	| 'slapBass'
	| 'maracas';
export type LaneType = 'audio' | 'instrument';
export type FxType =
	| 'eq'
	| 'filter'
	| 'comp'
	| 'saturation'
	| 'chorus'
	| 'delay'
	| 'reverb'
	| 'vocal'
	| 'lead'
	| 'imager';

export interface FxSlot {
	id: string;
	type: FxType;
	bypass: boolean;
	params: Record<string, number>;
}

export interface MasterSettings {
	/** Linear output gain. */
	volume: number;
	limiter: boolean;
	/** Limiter ceiling, dBFS. */
	ceiling: number;
	/** Gain pushed into the limiter, dB. */
	drive: number;
}

export interface AudioClip {
	id: string;
	kind: 'audio';
	name: string;
	url: string;
	/** Position on the timeline, seconds. */
	start: number;
	/** Where playback begins inside the source file, seconds. */
	offset: number;
	duration: number;
}

export interface MidiNote {
	pitch: number;
	/** Relative to the clip start, seconds. */
	start: number;
	duration: number;
	velocity: number;
}

export interface MidiClip {
	id: string;
	kind: 'midi';
	name: string;
	start: number;
	duration: number;
	notes: MidiNote[];
}

export type Clip = AudioClip | MidiClip;

export interface Lane {
	id: string;
	name: string;
	type: LaneType;
	instrument: InstrumentPreset;
	color: string;
	volume: number;
	pan: number;
	mute: boolean;
	solo: boolean;
	clips: Clip[];
	/** Insert effects, in order. Missing on projects saved before the mixer existed. */
	fx?: FxSlot[];
}

export interface DawProject {
	id: string | null;
	name: string;
	bpm: number;
	lanes: Lane[];
	master?: MasterSettings;
}

export interface DawProjectSummary {
	id: string;
	name: string;
	bpm: number;
	updated_at: string;
}

export const ROW_H = 88;
export const RULER_H = 28;

export function clipEnd(clip: Clip): number {
	return clip.start + clip.duration;
}

export function projectEnd(lanes: Lane[]): number {
	let end = 0;
	for (const lane of lanes) for (const clip of lane.clips) end = Math.max(end, clipEnd(clip));
	return end;
}

export function effectiveGain(lane: Lane, anySolo: boolean): number {
	if (lane.mute || (anySolo && !lane.solo)) return 0;
	return lane.volume;
}
