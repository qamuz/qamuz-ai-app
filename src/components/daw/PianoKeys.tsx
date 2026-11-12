import { useRef } from 'react';
import { KEY_MAP } from '@/hooks/use-note-input';
import { noteName } from '@/lib/daw/synth';

const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
/** Black key semitone → index of the white key on its left. */
const BLACK_STEPS: [number, number][] = [
[1, 0],
[3, 1],
[6, 3],
[8, 4],
[10, 5]];

const HINTS: Record<number, string> = Object.fromEntries(Object.entries(KEY_MAP).map(([key, step]) => [step, key.toUpperCase()]));
const BLACK_W = 0.62;

interface PianoKeysProps {
  base: number;
  activeNotes: Set<number>;
  onDown: (pitch: number) => void;
  onUp: (pitch: number) => void;
}

/** Two-octave on-screen keyboard. */
export function PianoKeys({ base, activeNotes, onDown, onUp }: PianoKeysProps) {
  const pressed = useRef(new Set<number>());
  const whites: number[] = [];
  const blacks: {pitch: number;slot: number;}[] = [];
  for (let o = 0; o < 2; o += 1) {
    WHITE_STEPS.forEach((step) => whites.push(base + o * 12 + step));
    BLACK_STEPS.forEach(([step, white]) => blacks.push({ pitch: base + o * 12 + step, slot: o * 7 + white + 1 }));
  }
  whites.push(base + 24);
  const total = whites.length;

  const down = (pitch: number, e: React.PointerEvent) => {
    e.preventDefault();
    if (pressed.current.has(pitch)) return;
    pressed.current.add(pitch);
    onDown(pitch);
  };
  const up = (pitch: number) => {
    if (!pressed.current.delete(pitch)) return;
    onUp(pitch);
  };

  return (
    <div data-ev-id="ev_8c4ccb3206" className="relative h-36 w-full touch-none select-none">
			<div data-ev-id="ev_481f51df6d" className="flex h-full gap-px">
				{whites.map((pitch) =>
        <button data-ev-id="ev_0099ca15c9"
        key={pitch}
        type="button"
        aria-label={noteName(pitch)}
        onPointerDown={(e) => down(pitch, e)}
        onPointerUp={() => up(pitch)}
        onPointerLeave={() => up(pitch)}
        className={`flex flex-1 flex-col items-center justify-end gap-0.5 rounded-b-md pb-2 text-[10px] font-bold transition-colors ${activeNotes.has(pitch) ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background/55 hover:bg-foreground/90'}`}>
          
						<span data-ev-id="ev_783bd43d48">{HINTS[pitch - base] ?? ''}</span>
						{pitch % 12 === 0 && <span data-ev-id="ev_13951c2c18" className="text-[9px] font-semibold opacity-70">{noteName(pitch)}</span>}
					</button>
        )}
			</div>
			{blacks.map(({ pitch, slot }) =>
      <button data-ev-id="ev_31226a2356"
      key={pitch}
      type="button"
      aria-label={noteName(pitch)}
      onPointerDown={(e) => down(pitch, e)}
      onPointerUp={() => up(pitch)}
      onPointerLeave={() => up(pitch)}
      className={`absolute top-0 z-10 flex h-[60%] items-end justify-center rounded-b-md border border-black pb-1.5 text-[9px] font-bold transition-colors ${activeNotes.has(pitch) ? 'bg-primary text-primary-foreground' : 'bg-surface text-foreground/50 hover:bg-surface-3'}`}
      style={{ left: `${slot / total * 100 - BLACK_W / total * 50}%`, width: `${BLACK_W / total * 100}%` }}>
        
					{HINTS[pitch - base] ?? ''}
				</button>
      )}
		</div>);

}