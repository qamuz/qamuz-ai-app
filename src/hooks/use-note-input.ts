import { useEffect, useRef, useState } from 'react';

/** Computer keyboard → semitone offset from the current octave's C. */
export const KEY_MAP: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14 };

export type MidiStatus = 'unsupported' | 'blocked' | 'waiting' | 'connected';

interface MidiMessageLike {
	data: Uint8Array | null;
}
interface MidiInputLike {
	name?: string | null;
	onmidimessage: ((e: MidiMessageLike) => void) | null;
}
interface MidiAccessLike {
	inputs: Map<string, MidiInputLike>;
	onstatechange: (() => void) | null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el || !el.tagName) return false;
	return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/** Notes from the computer keyboard and any connected MIDI keyboard. */
export function useNoteInput(enabled: boolean, onNoteOn: (pitch: number, velocity: number) => void, onNoteOff: (pitch: number) => void) {
	const [octave, setOctave] = useState(4);
	const [midi, setMidi] = useState<{ status: MidiStatus; device: string }>({ status: 'waiting', device: '' });
	const onRef = useRef(onNoteOn);
	const offRef = useRef(onNoteOff);
	const octaveRef = useRef(octave);
	const enabledRef = useRef(enabled);
	onRef.current = onNoteOn;
	offRef.current = onNoteOff;
	octaveRef.current = octave;
	enabledRef.current = enabled;

	useEffect(() => {
		const held = new Map<string, number>();
		const down = (e: KeyboardEvent) => {
			if (!enabledRef.current || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
			const key = e.key.toLowerCase();
			if (key === 'z') {
				setOctave((o) => Math.max(1, o - 1));
				return;
			}
			if (key === 'x') {
				setOctave((o) => Math.min(7, o + 1));
				return;
			}
			const step = KEY_MAP[key];
			if (step === undefined || held.has(key)) return;
			e.preventDefault();
			const pitch = 12 * (octaveRef.current + 1) + step;
			held.set(key, pitch);
			onRef.current(pitch, 0.8);
		};
		const up = (e: KeyboardEvent) => {
			const key = e.key.toLowerCase();
			const pitch = held.get(key);
			if (pitch === undefined) return;
			held.delete(key);
			offRef.current(pitch);
		};
		const releaseAll = () => {
			held.forEach((pitch) => offRef.current(pitch));
			held.clear();
		};
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		window.addEventListener('blur', releaseAll);
		return () => {
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
			window.removeEventListener('blur', releaseAll);
			releaseAll();
		};
	}, []);

	useEffect(() => {
		const request = (navigator as unknown as { requestMIDIAccess?: () => Promise<MidiAccessLike> }).requestMIDIAccess;
		if (typeof request !== 'function') {
			setMidi({ status: 'unsupported', device: '' });
			return;
		}
		let access: MidiAccessLike | null = null;
		let alive = true;
		const handle = (e: MidiMessageLike) => {
			const d = e.data;
			if (!d || d.length < 3 || !enabledRef.current) return;
			const cmd = d[0] & 0xf0;
			if (cmd === 0x90 && d[2] > 0) onRef.current(d[1], d[2] / 127);
			else if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) offRef.current(d[1]);
		};
		const bind = () => {
			if (!access) return;
			let name = '';
			access.inputs.forEach((input) => {
				input.onmidimessage = handle;
				if (!name) name = input.name || 'MIDI';
			});
			setMidi(name ? { status: 'connected', device: name } : { status: 'waiting', device: '' });
		};
		request
			.call(navigator)
			.then((a) => {
				if (!alive) return;
				access = a;
				a.onstatechange = bind;
				bind();
			})
			.catch(() => {
				if (alive) setMidi({ status: 'blocked', device: '' });
			});
		return () => {
			alive = false;
			if (access) {
				access.onstatechange = null;
				access.inputs.forEach((input) => {
					input.onmidimessage = null;
				});
			}
		};
	}, []);

	return { octave, setOctave, midi };
}
