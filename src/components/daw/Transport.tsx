import { useEffect, useRef, type ReactNode } from 'react';
import { Circle, Magnet, Minus, Pause, Play, Plus, Square, Timer } from 'lucide-react';
import type { DawEngine } from '@/lib/daw/engine';
import { useI18n } from '@/hooks/useI18n';

function format(time: number, bpm: number) {
  const minutes = Math.floor(time / 60);
  const seconds = time - minutes * 60;
  const beats = Math.floor(time / (60 / bpm) + 1e-6);
  return {
    clock: `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`,
    bars: `${Math.floor(beats / 4) + 1}.${beats % 4 + 1}`
  };
}

function TimeDisplay({ engine, playing, position, bpm }: {engine: DawEngine;playing: boolean;position: number;bpm: number;}) {
  const clockRef = useRef<HTMLSpanElement | null>(null);
  const barsRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const paint = (time: number) => {
      const f = format(time, bpm);
      if (clockRef.current) clockRef.current.textContent = f.clock;
      if (barsRef.current) barsRef.current.textContent = f.bars;
    };
    if (!playing) {
      paint(position);
      return;
    }
    let frame = 0;
    const loop = () => {
      paint(engine.getTime());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine, playing, position, bpm]);

  return (
    <div data-ev-id="ev_0e322e1fe3" className="flex min-w-[9rem] items-baseline gap-3 rounded-lg bg-background px-3 py-1.5 tabular-nums">
			<span data-ev-id="ev_e0fee1507d" ref={clockRef} className="text-lg font-bold text-primary">
				0:00.0
			</span>
			<span data-ev-id="ev_b71283deb6" ref={barsRef} className="text-xs font-semibold text-muted-foreground">
				1.1
			</span>
		</div>);

}

function ToggleButton({ active, label, onClick, children }: {active: boolean;label: string;onClick: () => void;children: ReactNode;}) {
  return (
    <button data-ev-id="ev_d769ab69cf"
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    title={label}
    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`}>
      
			{children}
		</button>);

}

interface TransportProps {
  engine: DawEngine;
  playing: boolean;
  recording: boolean;
  position: number;
  bpm: number;
  metronome: boolean;
  snap: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onMetronome: () => void;
  onSnap: () => void;
  onBpm: (bpm: number) => void;
  onZoom: (factor: number) => void;
}

export function Transport({ engine, playing, recording, position, bpm, metronome, snap, onPlay, onStop, onRecord, onMetronome, onSnap, onBpm, onZoom }: TransportProps) {
  const { t } = useI18n();
  return (
    <div data-ev-id="ev_fe30ab6966" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
			<button data-ev-id="ev_609a9f4271"
      type="button"
      onClick={onPlay}
      aria-label={playing ? t('Pause') : t('Play')}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95">
        
				{playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current" />}
			</button>
			<button data-ev-id="ev_434ecf06f2" type="button" onClick={onStop} aria-label={t('Stop')} title={t('Stop')} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground">
				<Square className="h-4 w-4 fill-current" />
			</button>
			<button data-ev-id="ev_30d3898c5f"
      type="button"
      onClick={onRecord}
      aria-label={recording ? t('Stop recording') : t('Record')}
      title={recording ? t('Stop recording') : t('Record')}
      aria-pressed={recording}
      className={`flex h-10 items-center gap-2 rounded-full px-3 text-xs font-bold transition-colors ${recording ? 'bg-destructive text-destructive-foreground' : 'text-destructive hover:bg-destructive/15'}`}>
        
				<Circle className={`h-4 w-4 fill-current ${recording ? 'animate-pulse' : ''}`} />
				<span data-ev-id="ev_b6e5f547a9" className="hidden sm:inline">{recording ? t('Recording') : t('Record')}</span>
			</button>

			<TimeDisplay engine={engine} playing={playing} position={position} bpm={bpm} />

			<label data-ev-id="ev_1a6ef24969" className="flex items-center gap-2 rounded-lg bg-background px-2 py-1 text-xs text-muted-foreground">
				<span data-ev-id="ev_f8f9b22285">{t('Tempo (BPM)')}</span>
				<input data-ev-id="ev_2846cee976"
        type="number"
        min={40}
        max={240}
        value={bpm}
        onChange={(e) => {
          const value = Number(e.target.value);
          if (Number.isFinite(value)) onBpm(Math.min(240, Math.max(40, Math.round(value))));
        }}
        className="w-14 rounded bg-surface-2 px-1.5 py-1 text-sm font-semibold tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        
			</label>

			<div data-ev-id="ev_dc6e62a87d" className="flex items-center gap-1">
				<ToggleButton active={metronome} label={t('Metronome')} onClick={onMetronome}>
					<Timer className="h-4 w-4" />
				</ToggleButton>
				<ToggleButton active={snap} label={t('Snap to grid')} onClick={onSnap}>
					<Magnet className="h-4 w-4" />
				</ToggleButton>
			</div>

			<div data-ev-id="ev_79de8b185a" className="ml-auto flex items-center gap-1">
				<button data-ev-id="ev_463ea78c8c" type="button" onClick={() => onZoom(1 / 1.5)} aria-label={t('Zoom out')} title={t('Zoom out')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-foreground">
					<Minus className="h-4 w-4" />
				</button>
				<button data-ev-id="ev_becd95816e" type="button" onClick={() => onZoom(1.5)} aria-label={t('Zoom in')} title={t('Zoom in')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-foreground">
					<Plus className="h-4 w-4" />
				</button>
			</div>
		</div>);

}