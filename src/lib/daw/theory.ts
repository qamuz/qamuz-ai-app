/**
 * QAMUZ Musical Language — Theory Engine
 * Ported and adapted from QAMUZ_PROD theory.py (Package 4)
 * Standardizes 12-TET pitch classes, scales, chord realization, and scale quantization.
 */

export const PITCH_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const PITCH_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export type PitchName = (typeof PITCH_NAMES_SHARP)[number];

export interface ScaleDefinition {
	id: string;
	name: string;
	intervals: number[]; // semitone offsets from root
	category?: 'standard' | 'modal' | 'latin' | 'pentatonic';
}

export const SCALES: Record<string, ScaleDefinition> = {
	major: {
		id: 'major',
		name: 'Mayor (Jónico)',
		intervals: [0, 2, 4, 5, 7, 9, 11],
		category: 'standard',
	},
	natural_minor: {
		id: 'natural_minor',
		name: 'Menor Natural (Eólico)',
		intervals: [0, 2, 3, 5, 7, 8, 10],
		category: 'standard',
	},
	harmonic_minor: {
		id: 'harmonic_minor',
		name: 'Menor Armónica',
		intervals: [0, 2, 3, 5, 7, 8, 11],
		category: 'standard',
	},
	melodic_minor: {
		id: 'melodic_minor',
		name: 'Menor Melódica',
		intervals: [0, 2, 3, 5, 7, 9, 11],
		category: 'standard',
	},
	dorian: {
		id: 'dorian',
		name: 'Dórico',
		intervals: [0, 2, 3, 5, 7, 9, 10],
		category: 'modal',
	},
	phrygian: {
		id: 'phrygian',
		name: 'Frigio',
		intervals: [0, 1, 3, 5, 7, 8, 10],
		category: 'modal',
	},
	mixolydian: {
		id: 'mixolydian',
		name: 'Mixolidio',
		intervals: [0, 2, 4, 5, 7, 9, 10],
		category: 'modal',
	},
	bachata_amargue: {
		id: 'bachata_amargue',
		name: 'Bachata Amargue (Requinto DNA)',
		intervals: [0, 2, 3, 5, 7, 8, 11],
		category: 'latin',
	},
	pentatonic_major: {
		id: 'pentatonic_major',
		name: 'Pentatónica Mayor',
		intervals: [0, 2, 4, 7, 9],
		category: 'pentatonic',
	},
	pentatonic_minor: {
		id: 'pentatonic_minor',
		name: 'Pentatónica Menor',
		intervals: [0, 3, 5, 7, 10],
		category: 'pentatonic',
	},
	blues: {
		id: 'blues',
		name: 'Blues Escala',
		intervals: [0, 3, 5, 6, 7, 10],
		category: 'pentatonic',
	},
};

export interface ChordProgressionPattern {
	id: string;
	name: string;
	genre: string;
	degrees: { roman: string; semitoneOffset: number; intervals: number[] }[];
}

export const CHORD_PATTERNS: ChordProgressionPattern[] = [
	{
		id: 'pop_latin_anthem',
		name: 'Pop / Latino Épico (I - V - vi - IV)',
		genre: 'Pop / Latino',
		degrees: [
			{ roman: 'I', semitoneOffset: 0, intervals: [0, 4, 7] }, // Major
			{ roman: 'V', semitoneOffset: 7, intervals: [0, 4, 7] }, // Major
			{ roman: 'vi', semitoneOffset: 9, intervals: [0, 3, 7] }, // Minor
			{ roman: 'IV', semitoneOffset: 5, intervals: [0, 4, 7] }, // Major
		],
	},
	{
		id: 'bachata_amargue_cadence',
		name: 'Bachata Clásica de Amargue (i - iv - V7 - i)',
		genre: 'Bachata / Bolero',
		degrees: [
			{ roman: 'i', semitoneOffset: 0, intervals: [0, 3, 7] }, // Minor
			{ roman: 'iv', semitoneOffset: 5, intervals: [0, 3, 7] }, // Minor
			{ roman: 'V7', semitoneOffset: 7, intervals: [0, 4, 7, 10] }, // Dominant 7th
			{ roman: 'i', semitoneOffset: 0, intervals: [0, 3, 7] }, // Minor
		],
	},
	{
		id: 'reggaeton_dembow_loop',
		name: 'Reggaeton / Dembow Nocturno (i - VII - VI - VII)',
		genre: 'Urbano / Dembow',
		degrees: [
			{ roman: 'i', semitoneOffset: 0, intervals: [0, 3, 7] },
			{ roman: 'VII', semitoneOffset: 10, intervals: [0, 4, 7] },
			{ roman: 'VI', semitoneOffset: 8, intervals: [0, 4, 7] },
			{ roman: 'VII', semitoneOffset: 10, intervals: [0, 4, 7] },
		],
	},
	{
		id: 'jazz_soul_turnaround',
		name: 'Neo-Soul / R&B (ii7 - V7 - Imaj7 - VI7)',
		genre: 'R&B / Soul',
		degrees: [
			{ roman: 'ii7', semitoneOffset: 2, intervals: [0, 3, 7, 10] },
			{ roman: 'V7', semitoneOffset: 7, intervals: [0, 4, 7, 10] },
			{ roman: 'Imaj7', semitoneOffset: 0, intervals: [0, 4, 7, 11] },
			{ roman: 'VI7', semitoneOffset: 9, intervals: [0, 4, 7, 10] },
		],
	},
	{
		id: 'balada_romantica',
		name: 'Balada Romántica Sentimental (I - vi - IV - V)',
		genre: 'Balada',
		degrees: [
			{ roman: 'I', semitoneOffset: 0, intervals: [0, 4, 7] },
			{ roman: 'vi', semitoneOffset: 9, intervals: [0, 3, 7] },
			{ roman: 'IV', semitoneOffset: 5, intervals: [0, 4, 7] },
			{ roman: 'V', semitoneOffset: 7, intervals: [0, 4, 7] },
		],
	},
];

/**
 * Checks whether a MIDI pitch (0-127) belongs to the scale given a root pitch class.
 */
export function isPitchInScale(pitch: number, rootPitchClass: number, scaleId: string): boolean {
	const scale = SCALES[scaleId];
	if (!scale) return true;
	const pitchClass = (pitch % 12 + 12) % 12;
	const offset = (pitchClass - rootPitchClass + 12) % 12;
	return scale.intervals.includes(offset);
}

/**
 * Snaps a MIDI pitch to the closest in-scale pitch.
 */
export function snapPitchToScale(pitch: number, rootPitchClass: number, scaleId: string): number {
	const scale = SCALES[scaleId];
	if (!scale || scale.intervals.length === 0) return pitch;

	if (isPitchInScale(pitch, rootPitchClass, scaleId)) return pitch;

	// Check up and down
	for (let delta = 1; delta <= 6; delta++) {
		if (pitch - delta >= 0 && isPitchInScale(pitch - delta, rootPitchClass, scaleId)) {
			return pitch - delta;
		}
		if (pitch + delta <= 127 && isPitchInScale(pitch + delta, rootPitchClass, scaleId)) {
			return pitch + delta;
		}
	}
	return pitch;
}

/**
 * Generates MIDI notes for a selected chord progression starting at a given time position.
 */
export function buildProgressionNotes(
	pattern: ChordProgressionPattern,
	rootPitchClass: number,
	baseOctave = 4, // C4 = 60
	chordDuration = 2, // 2 seconds (or 1 bar at 120 bpm)
	startTime = 0
): { pitch: number; start: number; duration: number }[] {
	const baseMidi = 12 * (baseOctave + 1) + rootPitchClass;
	const notes: { pitch: number; start: number; duration: number }[] = [];

	pattern.degrees.forEach((deg, chordIndex) => {
		const chordStart = startTime + chordIndex * chordDuration;
		const chordRoot = baseMidi + deg.semitoneOffset;

		deg.intervals.forEach((interval) => {
			notes.push({
				pitch: chordRoot + interval,
				start: chordStart,
				duration: chordDuration * 0.95, // slight articulation gap
			});
		});
	});

	return notes;
}

