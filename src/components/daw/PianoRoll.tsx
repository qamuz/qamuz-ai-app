import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Layers, Music2, Plus, Sparkles, Wand2, ZoomIn, ZoomOut } from 'lucide-react';
import type { DawEngine } from '@/lib/daw/engine';
import { noteName } from '@/lib/daw/synth';
import type { MidiClip, MidiNote } from '@/lib/daw/types';
import { isTypingTarget } from '@/hooks/use-note-input';
import { useI18n } from '@/hooks/useI18n';
import {
  PITCH_NAMES_SHARP,
  SCALES,
  CHORD_PATTERNS,
  isPitchInScale,
  snapPitchToScale,
  buildProgressionNotes,
  type ChordProgressionPattern,
} from '@/lib/daw/theory';

const LO = 24;
const HI = 107;
const ROW = 14;
const KEYS_W = 64;
const RULER = 22;
const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (p: number) => BLACK.has(p % 12);
const PITCHES = Array.from({ length: HI - LO + 1 }, (_, i) => HI - i);
const clampPitch = (p: number) => Math.min(HI, Math.max(LO, p));

type Drag = {mode: 'move' | 'resize';index: number;x0: number;y0: number;start: number;pitch: number;duration: number;heard: number;};

interface PianoRollProps {
  clip: MidiClip | null;
  color: string;
  bpm: number;
  snap: number;
  engine: DawEngine;
  activeNotes: Set<number>;
  canCreate: boolean;
  extra?: ReactNode;
  onChange: (patch: Partial<MidiClip>) => void;
  onCreate: () => void;
  onKeyDown: (pitch: number) => void;
  onKeyUp: (pitch: number) => void;
}

/** Vertical keyboard on the left, time running to the right. Click to draw, drag to move, drag the right edge to resize, double-click to delete. */
export function PianoRoll({ clip, color, bpm, snap, engine, activeNotes, canCreate, extra, onChange, onCreate, onKeyDown, onKeyUp }: PianoRollProps) {
  const { t } = useI18n();
  const [pps, setPps] = useState(140);
  const [selected, setSelected] = useState<number | null>(null);

  // Musical Theory Scale & Chord Assistant
  const [scaleRoot, setScaleRoot] = useState<number>(0); // 0 = C
  const [scaleId, setScaleId] = useState<string>('chromatic');
  const [scaleSnap, setScaleSnap] = useState(false);
  const [showChordsMenu, setShowChordsMenu] = useState(false);

  const scroller = useRef<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const head = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const lastLen = useRef(60 / bpm / 2);
  const clipRef = useRef(clip);
  clipRef.current = clip;
  const pressed = useRef(new Set<number>());

  const beat = 60 / bpm;
  const bar = beat * 4;
  const minLen = snap || beat / 16;
  const q = (v: number) => snap ? Math.round(v / snap) * snap : v;
  const qFloor = (v: number) => snap ? Math.floor(v / snap) * snap : v;
  const clipId = clip?.id;

  useEffect(() => setSelected(null), [clipId]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = (HI - 76) * ROW;
  }, [clipId]);

  // Playhead follows the transport without re-rendering.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const c = clipRef.current;
      if (head.current && c) {
        const rel = engine.getTime() - c.start;
        head.current.style.display = rel >= 0 ? 'block' : 'none';
        head.current.style.transform = `translateX(${rel * pps}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, pps]);

  const commit = (notes: MidiNote[]) => {
    const c = clipRef.current;
    if (!c) return;
    const end = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
    onChange({ notes, duration: Math.max(c.duration, Math.ceil(end / bar - 1e-6) * bar) });
  };

  const remove = (index: number) => {
    const c = clipRef.current;
    if (!c) return;
    commit(c.notes.filter((_, i) => i !== index));
    setSelected(null);
  };

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove(selected);
      } else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const preview = (pitch: number) => {
    onKeyDown(pitch);
    window.setTimeout(() => onKeyUp(pitch), 160);
  };

  const locate = (e: React.PointerEvent) => {
    const r = grid.current?.getBoundingClientRect();
    if (!r) return { time: 0, pitch: 60 };
    let rawPitch = clampPitch(HI - Math.floor((e.clientY - r.top) / ROW));
    if (scaleSnap && scaleId !== 'chromatic') {
      rawPitch = snapPitchToScale(rawPitch, scaleRoot, scaleId);
    }
    return { time: Math.max(0, (e.clientX - r.left) / pps), pitch: rawPitch };
  };

  const insertProgression = (pattern: ChordProgressionPattern) => {
    if (!clip) return;
    const notesToAdd = buildProgressionNotes(
      pattern,
      scaleRoot,
      4,
      bar,
      0
    );
    const newNotes: MidiNote[] = [
      ...clip.notes,
      ...notesToAdd.map((n) => ({
        pitch: n.pitch,
        start: n.start,
        duration: n.duration,
        velocity: 0.8,
      })),
    ];
    commit(newNotes);
    setShowChordsMenu(false);
  };

  const startDrag = (e: React.PointerEvent, mode: Drag['mode'], index: number, note: MidiNote) => {
    drag.current = { mode, index, x0: e.clientX, y0: e.clientY, start: note.start, pitch: note.pitch, duration: note.duration, heard: note.pitch };
    grid.current?.setPointerCapture(e.pointerId);
  };

  const onGridDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!clip || e.button !== 0) return;
    const { time, pitch } = locate(e);
    const note: MidiNote = { pitch, start: qFloor(time), duration: lastLen.current, velocity: 0.8 };
    const notes = [...clip.notes, note];
    commit(notes);
    setSelected(notes.length - 1);
    preview(pitch);
    startDrag(e, 'resize', notes.length - 1, note);
  };

  const onNoteDown = (e: React.PointerEvent<HTMLDivElement>, index: number, note: MidiNote) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelected(index);
    const r = e.currentTarget.getBoundingClientRect();
    const edge = r.right - e.clientX < Math.min(8, r.width / 3);
    if (!edge) preview(note.pitch);
    startDrag(e, edge ? 'resize' : 'move', index, note);
  };

  const onGridMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const c = clipRef.current;
    if (!d || !c || !c.notes[d.index]) return;
    const dx = (e.clientX - d.x0) / pps;
    const notes = c.notes.slice();
    if (d.mode === 'move') {
      let pitch = clampPitch(d.pitch + Math.round((d.y0 - e.clientY) / ROW));
      if (scaleSnap && scaleId !== 'chromatic') {
        pitch = snapPitchToScale(pitch, scaleRoot, scaleId);
      }
      notes[d.index] = { ...notes[d.index], start: Math.max(0, q(d.start + dx)), pitch };
      if (pitch !== d.heard) {
        d.heard = pitch;
        preview(pitch);
      }
    } else {
      const end = q(d.start + d.duration + dx);
      notes[d.index] = { ...notes[d.index], duration: Math.max(minLen, end - d.start) };
    }
    commit(notes);
  };

  const onGridUp = () => {
    const d = drag.current;
    const note = d ? clipRef.current?.notes[d.index] : undefined;
    if (d?.mode === 'resize' && note) lastLen.current = note.duration;
    drag.current = null;
  };

  const keyDown = (pitch: number, e: React.PointerEvent) => {
    e.preventDefault();
    if (pressed.current.has(pitch)) return;
    pressed.current.add(pitch);
    onKeyDown(pitch);
  };
  const keyUp = (pitch: number) => {
    if (pressed.current.delete(pitch)) onKeyUp(pitch);
  };

  const length = clip ? Math.max(clip.duration + bar * 2, bar * 8) : bar * 8;
  const width = Math.ceil(length * pps);
  const bars = Math.ceil(length / bar);
  const lines = {
    backgroundImage: `linear-gradient(to right, #ffffff26 1px, transparent 1px), linear-gradient(to right, #ffffff10 1px, transparent 1px), linear-gradient(to right, #ffffff07 1px, transparent 1px)`,
    backgroundSize: `${bar * pps}px 100%, ${beat * pps}px 100%, ${beat / 4 * pps}px 100%`
  };

  return (
    <div data-ev-id="ev_e9ab944f35" className="flex flex-col">
			<div data-ev-id="ev_8b70b0fb0c" className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
				{clip ?
        <span data-ev-id="ev_56511e28e7" className="flex items-center gap-2 text-xs font-semibold">
						<span data-ev-id="ev_41ecad5f5a" className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
						{clip.name}
						<span data-ev-id="ev_da2de95f1b" className="text-muted-foreground">· {t('{n} notes', { n: clip.notes.length })}</span>
					</span> :
        null}
				<div data-ev-id="ev_da4875c71c" className="flex items-center gap-0.5 rounded-lg bg-background p-0.5">
					<button data-ev-id="ev_cf4c0cbcd9" type="button" onClick={() => setPps((v) => Math.max(40, v / 1.25))} aria-label={t('Zoom out')} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface-3 hover:text-foreground">
						<ZoomOut className="h-3.5 w-3.5" />
					</button>
					<button data-ev-id="ev_c9bd6731c1" type="button" onClick={() => setPps((v) => Math.min(600, v * 1.25))} aria-label={t('Zoom in')} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface-3 hover:text-foreground">
						<ZoomIn className="h-3.5 w-3.5" />
					</button>
				</div>

				{/* Scale & Theory Assistant Toolbar */}
				<div className="flex items-center gap-1.5 rounded-lg bg-surface-2 p-1 border border-white/5">
					{/* Root Selector */}
					<select
						value={scaleRoot}
						onChange={(e) => setScaleRoot(Number(e.target.value))}
						className="h-6 rounded bg-black/40 px-1.5 text-[11px] font-bold text-cyan-300 outline-none cursor-pointer"
						title={t('Tonalidad / Nota Raíz')}
					>
						{PITCH_NAMES_SHARP.map((name, i) => (
							<option key={name} value={i} className="bg-zinc-900 text-foreground">
								{name}
							</option>
						))}
					</select>

					{/* Scale Selector */}
					<select
						value={scaleId}
						onChange={(e) => setScaleId(e.target.value)}
						className="h-6 rounded bg-black/40 px-2 text-[11px] font-bold text-foreground outline-none cursor-pointer"
						title={t('Escala Musical')}
					>
						<option value="chromatic" className="bg-zinc-900 text-foreground">
							{t('Escala: Ninguna')}
						</option>
						{Object.values(SCALES).map((s) => (
							<option key={s.id} value={s.id} className="bg-zinc-900 text-foreground">
								{s.name}
							</option>
						))}
					</select>

					{/* Scale Snap Toggle */}
					{scaleId !== 'chromatic' && (
						<button
							type="button"
							onClick={() => setScaleSnap((v) => !v)}
							className={`h-6 rounded px-2 text-[10px] font-bold transition-colors ${
								scaleSnap
									? 'bg-cyan-500 text-black'
									: 'bg-white/5 text-muted-foreground hover:text-foreground'
							}`}
							title={t('Forzar notas a la escala al dibujar')}
						>
							{scaleSnap ? 'Snap: ON' : 'Snap: OFF'}
						</button>
					)}

					{/* Chord Progressions Dropdown */}
					<div className="relative">
						<button
							type="button"
							onClick={() => setShowChordsMenu((v) => !v)}
							className="flex h-6 items-center gap-1 rounded bg-gradient-to-r from-purple-500/20 to-cyan-500/20 px-2 text-[10px] font-bold text-cyan-300 hover:bg-white/10 transition-colors"
							title={t('Insertar Progresión de Acordes')}
						>
							<Sparkles className="h-3 w-3" />
							{t('Acordes')}
							<ChevronDown className="h-2.5 w-2.5 opacity-60" />
						</button>

						{showChordsMenu && (
							<div className="absolute left-0 top-full z-50 mt-1 flex w-64 flex-col rounded-xl border border-white/10 bg-[#0f1723] p-1.5 shadow-2xl backdrop-blur-xl">
								<p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
									{t('Progresiones en')} {PITCH_NAMES_SHARP[scaleRoot]}
								</p>
								{CHORD_PATTERNS.map((pattern) => (
									<button
										key={pattern.id}
										type="button"
										onClick={() => insertProgression(pattern)}
										className="flex flex-col rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/10"
									>
										<span className="font-bold text-foreground">{pattern.name}</span>
										<span className="text-[10px] text-muted-foreground">
											{pattern.genre} · {pattern.degrees.map((d) => d.roman).join(' - ')}
										</span>
									</button>
								))}
							</div>
						)}
					</div>
				</div>

				{extra}
				<span data-ev-id="ev_ff9b4e6731" className="ml-auto hidden text-[11px] text-muted-foreground lg:block">{t('Click to draw · drag to move · drag the edge to resize · double-click or Delete to remove')}</span>
			</div>

			{!clip ?
      <div data-ev-id="ev_532ecb08c9" className="flex flex-col items-center justify-center gap-3 p-10 text-center">
					<p data-ev-id="ev_ff32030170" className="text-sm text-muted-foreground">{canCreate ? t('Select a MIDI clip or create a new one to edit its notes.') : t('Add an instrument track to play')}</p>
					{canCreate &&
        <button data-ev-id="ev_c60b8025be" type="button" onClick={onCreate} className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground hover:opacity-90">
							<Plus className="h-4 w-4" />
							{t('New MIDI clip')}
						</button>
        }
				</div> :

      <div data-ev-id="ev_9063d32bb1" ref={scroller} className="relative h-[340px] overflow-auto overscroll-contain">
					<div data-ev-id="ev_4934fda52a" className="relative" style={{ width: KEYS_W + width }}>
						<div data-ev-id="ev_e89f357ba6" className="sticky top-0 z-20 flex border-b border-border bg-surface-2" style={{ height: RULER }}>
							<div data-ev-id="ev_ab323d28ee" className="sticky left-0 z-10 flex-none border-r border-border bg-surface-2" style={{ width: KEYS_W }} />
							<div data-ev-id="ev_657c0d61d5" className="relative flex-none" style={{ width }}>
								{Array.from({ length: bars }, (_, i) =>
              <span data-ev-id="ev_139b57e6c5" key={i} className="absolute top-0 flex h-full items-center border-l border-border pl-1 text-[10px] font-semibold tabular-nums text-muted-foreground" style={{ left: i * bar * pps }}>
										{i + 1}
									</span>
              )}
							</div>
						</div>

						<div data-ev-id="ev_d88d917f9f" className="flex">
							<div data-ev-id="ev_eae73ef149" className="sticky left-0 z-10 flex-none touch-none select-none border-r border-black bg-background" style={{ width: KEYS_W }}>
								{PITCHES.map((p) => {
									const on = activeNotes.has(p);
									const black = isBlack(p);
									const inScale = scaleId === 'chromatic' || isPitchInScale(p, scaleRoot, scaleId);
									const isRoot = scaleId !== 'chromatic' && ((p % 12 + 12) % 12 === scaleRoot);

									return (
										<button
											data-ev-id="ev_0f1559b096"
											key={p}
											type="button"
											aria-label={noteName(p)}
											onPointerDown={(e) => keyDown(p, e)}
											onPointerUp={() => keyUp(p)}
											onPointerLeave={() => keyUp(p)}
											className={`flex w-full items-center justify-end pr-1.5 text-[9px] font-bold ${
												isRoot
													? 'border-b border-cyan-400/80 bg-cyan-950/80 text-cyan-300'
													: p % 12 === 0
													? 'border-b border-black/60'
													: 'border-b border-black/20'
											} ${
												on
													? 'bg-primary text-primary-foreground'
													: isRoot
													? 'bg-cyan-900/50 text-cyan-200'
													: black
													? 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
													: 'bg-zinc-200 text-zinc-500 hover:bg-white'
											} ${!inScale ? 'opacity-35' : ''}`}
											style={{ height: ROW, ...(black ? { width: '72%' } : {}) }}
										>
											{isRoot ? noteName(p) : p % 12 === 0 ? noteName(p) : ''}
										</button>
									);
								})}
							</div>

							<div data-ev-id="ev_a43b300477"
            ref={grid}
            className="relative flex-none cursor-crosshair touch-none select-none"
            style={{ width, height: PITCHES.length * ROW }}
            onPointerDown={onGridDown}
            onPointerMove={onGridMove}
            onPointerUp={onGridUp}
            onPointerCancel={onGridUp}>
              
								{PITCHES.map((p, i) => {
									const inScale = scaleId === 'chromatic' || isPitchInScale(p, scaleRoot, scaleId);
									const isRoot = scaleId !== 'chromatic' && ((p % 12 + 12) % 12 === scaleRoot);
									const black = isBlack(p);

									let rowBg = black ? 'bg-black/35' : 'bg-surface';
									if (scaleId !== 'chromatic') {
										if (isRoot) {
											rowBg = 'bg-cyan-500/20';
										} else if (inScale) {
											rowBg = black ? 'bg-cyan-950/30' : 'bg-cyan-900/15';
										} else {
											rowBg = 'bg-black/65 opacity-30';
										}
									}

									return (
										<div
											data-ev-id="ev_e98480d2d6"
											key={p}
											className={`absolute inset-x-0 ${rowBg} ${
												isRoot
													? 'border-b border-cyan-500/30'
													: p % 12 === 0
													? 'border-b border-black/60'
													: 'border-b border-white/[0.03]'
											}`}
											style={{ top: i * ROW, height: ROW }}
										/>
									);
								})}
								<div data-ev-id="ev_8fe49eb2cb" className="pointer-events-none absolute inset-0" style={lines} />
								<div data-ev-id="ev_75d24f4de4" className="pointer-events-none absolute inset-y-0 right-0 bg-black/45" style={{ left: clip.duration * pps }} />
								{clip.notes.map((note, i) =>
              <div data-ev-id="ev_d3b9d66805"
              key={i}
              onPointerDown={(e) => onNoteDown(e, i, note)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                remove(i);
              }}
              className={`absolute cursor-grab rounded-[3px] border active:cursor-grabbing ${selected === i ? 'border-white' : 'border-black/50'}`}
              style={{
                left: note.start * pps,
                top: (HI - note.pitch) * ROW + 1,
                width: Math.max(4, note.duration * pps - 1),
                height: ROW - 2,
                backgroundColor: color,
                opacity: 0.55 + note.velocity * 0.45
              }}>
                
										<span data-ev-id="ev_0b41c0e3f4" className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-[3px] bg-black/25" />
									</div>
              )}
								<div data-ev-id="ev_1a5119dc62" ref={head} className="pointer-events-none absolute inset-y-0 left-0 w-px bg-primary" style={{ display: 'none' }} />
							</div>
						</div>
					</div>
				</div>
      }
		</div>);

}