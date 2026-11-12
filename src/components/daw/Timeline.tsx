import { useEffect, useRef, type RefObject } from 'react';
import { ClipView } from '@/components/daw/ClipView';
import type { DawEngine } from '@/lib/daw/engine';
import { ROW_H, RULER_H, type Clip, type Lane } from '@/lib/daw/types';
import { useI18n } from '@/hooks/useI18n';

function Playhead({ engine, playing, position, pps, scrollerRef }: {engine: DawEngine;playing: boolean;position: number;pps: number;scrollerRef: RefObject<HTMLDivElement | null>;}) {
  const lineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    const place = (time: number) => {
      line.style.transform = `translateX(${time * pps}px)`;
    };
    if (!playing) {
      place(position);
      return;
    }
    let frame = 0;
    const loop = () => {
      const time = engine.getTime();
      place(time);
      const scroller = scrollerRef.current;
      if (scroller) {
        const x = time * pps;
        if (x > scroller.scrollLeft + scroller.clientWidth - 60 || x < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, x - 60);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine, playing, position, pps, scrollerRef]);

  return (
    <div data-ev-id="ev_0f212794e1" ref={lineRef} className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-px bg-primary">
			<span data-ev-id="ev_b51fa5aad2" className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-primary" />
		</div>);

}

interface TimelineProps {
  lanes: Lane[];
  pps: number;
  bpm: number;
  length: number;
  snap: number;
  engine: DawEngine;
  playing: boolean;
  position: number;
  selectedLaneId: string | null;
  selectedClipId: string | null;
  onSeek: (time: number) => void;
  onSelectLane: (id: string) => void;
  onSelectClip: (id: string | null) => void;
  onPatchClip: (laneId: string, clipId: string, patch: Partial<Clip>) => void;
}

export function Timeline({ lanes, pps, bpm, length, snap, engine, playing, position, selectedLaneId, selectedClipId, onSeek, onSelectLane, onSelectClip, onPatchClip }: TimelineProps) {
  const { t } = useI18n();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const width = Math.ceil(length * pps);
  const bar = 240 / bpm;
  const bars = Math.ceil(length / bar);
  const labelEvery = bar * pps < 28 ? 4 : bar * pps < 56 ? 2 : 1;
  const grid = {
    backgroundImage: 'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to right, #ffffff0a 1px, transparent 1px)',
    backgroundSize: `${bar * pps}px 100%, ${bar / 4 * pps}px 100%`
  };

  const timeAt = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, (e.clientX - rect.left) / pps);
  };

  return (
    <div data-ev-id="ev_a246c1a796" ref={scrollerRef} className="relative min-w-0 flex-1 overflow-x-auto">
			<div data-ev-id="ev_a4dca3d06d" className="relative" style={{ width }}>
				<div data-ev-id="ev_72a8195ac6"
        className="relative cursor-pointer border-b border-border bg-surface-2"
        style={{ height: RULER_H }}
        onPointerDown={(e) => onSeek(timeAt(e))}
        aria-label={t('Timeline')}>
          
					{Array.from({ length: bars }, (_, i) =>
          <span data-ev-id="ev_de041dd44d"
          key={i}
          className="absolute top-0 flex h-full items-end border-l border-border pb-1 pl-1 text-[10px] font-semibold tabular-nums text-muted-foreground"
          style={{ left: i * bar * pps }}>
            
							{i % labelEvery === 0 ? i + 1 : ''}
						</span>
          )}
				</div>

				{lanes.map((lane) =>
        <div data-ev-id="ev_bd3307a8d6"
        key={lane.id}
        className={`relative border-b border-border ${lane.id === selectedLaneId ? 'bg-surface-2/60' : ''}`}
        style={{ height: ROW_H, ...grid }}
        onPointerDown={(e) => {
          onSelectLane(lane.id);
          onSelectClip(null);
          onSeek(timeAt(e));
        }}>
          
						{lane.clips.map((clip) =>
          <ClipView
            key={clip.id}
            clip={clip}
            color={lane.color}
            pps={pps}
            snap={snap}
            selected={clip.id === selectedClipId}
            buffer={clip.kind === 'audio' ? engine.getBuffer(clip.url) : undefined}
            onSelect={() => {
              onSelectLane(lane.id);
              onSelectClip(clip.id);
            }}
            onChange={(patch) => onPatchClip(lane.id, clip.id, patch)} />

          )}
					</div>
        )}

				<Playhead engine={engine} playing={playing} position={position} pps={pps} scrollerRef={scrollerRef} />
			</div>
		</div>);

}