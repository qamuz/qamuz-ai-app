import { useEffect, useRef } from 'react';
import { ROW_H, type Clip } from '@/lib/daw/types';
import { drawWaveform, peaksFromBuffer } from '@/lib/waveform';

interface ClipViewProps {
  clip: Clip;
  color: string;
  pps: number;
  snap: number;
  selected: boolean;
  buffer?: AudioBuffer;
  onSelect: () => void;
  onChange: (patch: Partial<Clip>) => void;
}

const CLIP_H = ROW_H - 12;
const BODY_H = CLIP_H - 20;

export function ClipView({ clip, color, pps, snap, selected, buffer, onSelect, onChange }: ClipViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{mode: 'move' | 'trim';x: number;start: number;duration: number;} | null>(null);
  const width = Math.max(6, Math.round(clip.duration * pps));
  const offset = clip.kind === 'audio' ? clip.offset : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || clip.kind !== 'audio' || !buffer) return;
    drawWaveform(canvas, peaksFromBuffer(buffer), { width, height: BODY_H, offset, duration: clip.duration, color });
  }, [buffer, clip.kind, clip.duration, offset, width, color]);

  const quantize = (v: number) => snap > 0 ? Math.round(v / snap) * snap : v;

  function begin(e: React.PointerEvent<HTMLElement>, mode: 'move' | 'trim') {
    e.stopPropagation();
    onSelect();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode, x: e.clientX, start: clip.start, duration: clip.duration };
  }

  function move(e: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = (e.clientX - drag.x) / pps;
    if (drag.mode === 'move') {
      const start = Math.max(0, quantize(drag.start + delta));
      if (start !== clip.start) onChange({ start });
      return;
    }
    let duration = Math.max(0.1, quantize(drag.start + drag.duration + delta) - drag.start);
    if (clip.kind === 'audio' && buffer) duration = Math.min(duration, buffer.duration - clip.offset);
    if (duration !== clip.duration) onChange({ duration });
  }

  function end() {
    dragRef.current = null;
  }

  const notes = clip.kind === 'midi' ? clip.notes : [];
  const pitches = notes.map((n) => n.pitch);
  const hi = pitches.length ? Math.max(...pitches) : 0;
  const lo = pitches.length ? Math.min(...pitches) : 0;
  const range = hi - lo + 1;

  return (
    <div data-ev-id="ev_50fa311128"
    onPointerDown={(e) => begin(e, 'move')}
    onPointerMove={move}
    onPointerUp={end}
    onPointerCancel={end}
    className={`absolute top-1.5 flex cursor-grab touch-none select-none flex-col overflow-hidden rounded-md border active:cursor-grabbing ${selected ? 'z-10 border-foreground shadow-[0_0_0_1px_var(--color-foreground)]' : 'border-black/40'}`}
    style={{ left: clip.start * pps, width, height: CLIP_H, backgroundColor: `${color}26` }}>
      
			<div data-ev-id="ev_aa91b19611" className="truncate px-1.5 text-[11px] font-semibold leading-5 text-foreground" style={{ backgroundColor: `${color}55` }}>
				{clip.name}
			</div>
			<div data-ev-id="ev_3b843694b6" className="relative flex-1">
				{clip.kind === 'audio' ?
        <canvas data-ev-id="ev_c86fdba0f8" ref={canvasRef} className="block h-full w-full" /> :

        notes.map((note, i) =>
        <span data-ev-id="ev_d832eb04fa"
        key={`${note.pitch}-${note.start}-${i}`}
        className="absolute rounded-[2px]"
        style={{
          left: note.start * pps,
          width: Math.max(2, note.duration * pps),
          top: (hi - note.pitch) / range * BODY_H,
          height: Math.max(2, BODY_H / range - 1),
          backgroundColor: color
        }} />

        )
        }
			</div>
			<span data-ev-id="ev_d5eee880a6"
      onPointerDown={(e) => begin(e, 'trim')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-foreground/30" />
      
		</div>);

}