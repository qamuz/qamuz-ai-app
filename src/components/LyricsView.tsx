import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLyrics } from '@/lib/queries';
import { usePlayer } from '@/hooks/usePlayer';
import type { LyricLine } from '@/types/music';
import { useModules } from '@/hooks/useModules';
import { useI18n } from '@/hooks/useI18n';

const UNSUNG = 'color-mix(in srgb, var(--color-foreground) 38%, transparent)';

/** When a line "finishes" being sung: before the next line, estimated from its length. */
function lineEnd(lines: LyricLine[], i: number): number {
  const line = lines[i];
  const estimate = Math.max(1800, line.text.length * 110);
  const next = lines[i + 1];
  return next ? Math.min(next.time_ms, line.time_ms + estimate) : line.time_ms + estimate;
}

/** One line with a word-by-word karaoke fill driven by the exact audio position. */
function KaraokeText({ text, start, end }: {text: string;start: number;end: number;}) {
  const { getTime, isPlaying } = usePlayer();
  const [ms, setMs] = useState(() => getTime() * 1000);

  useEffect(() => {
    setMs(getTime() * 1000);
    if (!isPlaying) return;
    let frame = 0;
    const loop = () => {
      setMs(getTime() * 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [getTime, isPlaying]);

  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const totalChars = words.reduce((sum, w) => sum + w.length, 0) || 1;
  const fraction = Math.min(1, Math.max(0, (ms - start) / Math.max(1, end - start)));
  const sungChars = fraction * totalChars;

  let cursor = 0;
  return (
    <>
      {words.map((word, i) => {
        const from = cursor;
        cursor += word.length;
        const pct = Math.min(100, Math.max(0, (sungChars - from) / word.length * 100));
        return (
          <span data-ev-id="ev_kar_word"
          key={`${word}-${i}`}
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: `linear-gradient(90deg, var(--color-primary) ${pct}%, ${UNSUNG} ${pct}%)` }}>
            
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </span>);

      })}
    </>);

}

interface LyricsViewProps {
  trackId: string;
  compact?: boolean;
  /** "list": scrolling lyrics; "overlay": current + next line; "stage": full-height karaoke scroller for Shorts. */
  variant?: 'list' | 'overlay' | 'stage';
  /** Text alignment for the "stage" variant. */
  align?: 'left' | 'center';
}

export function LyricsView({ trackId, compact = false, variant = 'list', align = 'center' }: LyricsViewProps) {
  const { progress, seek } = usePlayer();
  const { isEnabled } = useModules();
  const { t } = useI18n();
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchLyrics(trackId).then((data) => {
      if (!active) return;
      setLines(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [trackId]);

  const activeIndex = useMemo(() => {
    const ms = progress * 1000;
    let found = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].time_ms <= ms) found = i;else
      break;
    }
    return found;
  }, [lines, progress]);

  useEffect(() => {
    const node = activeRef.current;
    const container = containerRef.current;
    if (!node || !container) return;
    const target = node.offsetTop - container.clientHeight / 2 + node.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeIndex]);

  if (!isEnabled('lyrics')) return null;

  if (variant === 'stage') {
    const centered = align === 'center';
    if (loading || lines.length === 0) {
      return (
        <div data-ev-id="ev_kar_stage_empty" className={`flex h-full items-center ${centered ? 'justify-center text-center' : ''}`}>
          <p data-ev-id="ev_kar_stage_msg" className="text-sm text-foreground/60">{loading ? t('Loading lyrics...') : t("This song doesn't have synced lyrics yet.")}</p>
        </div>);
    }
    return (
      <div data-ev-id="ev_kar_stage" ref={containerRef} aria-live="polite" className="no-scrollbar relative h-full overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,#000_20%,#000_80%,transparent)]">
        <div data-ev-id="ev_kar_stage_list" className={`flex flex-col gap-3 py-[30vh] md:gap-4 ${centered ? 'items-center text-center' : 'items-start text-left'}`}>
          {lines.map((line, i) => {
            const isActive = i === activeIndex;
            const isPast = i < activeIndex;
            return (
              <button data-ev-id="ev_kar_stage_line"
              key={line.id}
              ref={isActive ? activeRef : null}
              type="button"
              onClick={() => seek(line.time_ms / 1000)}
              className={`font-black leading-tight text-balance transition-all duration-500 ease-out drop-shadow-[0_2px_10px_#00000099] ${centered ? 'origin-center' : 'origin-left'} ${
              isActive ? 'scale-100 text-2xl md:text-4xl' : isPast ? 'scale-90 text-lg text-foreground/30 blur-[0.5px] hover:text-foreground/70 md:text-2xl' : 'scale-90 text-lg text-foreground/55 hover:text-foreground md:text-2xl'}`
              }>
                {isActive ? <KaraokeText text={line.text} start={line.time_ms} end={lineEnd(lines, i)} /> : line.text}
              </button>);
          })}
        </div>
      </div>);
  }

  if (variant === 'overlay') {
    if (loading || lines.length === 0) return null;
    const currentIdx = Math.max(0, activeIndex);
    const current = lines[currentIdx];
    const next = lines[currentIdx + 1];
    const started = activeIndex >= 0;
    return (
      <div data-ev-id="ev_kar_overlay" className="pointer-events-none flex flex-col items-center gap-2 px-4 text-center drop-shadow-[0_2px_10px_#000000e6]" aria-live="polite">
        <p data-ev-id="ev_kar_ov_cur" key={current.id} className="text-2xl font-black leading-tight text-balance md:text-3xl">
          {started ? <KaraokeText text={current.text} start={current.time_ms} end={lineEnd(lines, currentIdx)} /> : <span data-ev-id="ev_kar_ov_wait" className="text-foreground/50">{current.text}</span>}
        </p>
        {next && <p data-ev-id="ev_kar_ov_next" className="text-base font-semibold text-balance text-foreground/55 md:text-lg">{next.text}</p>}
      </div>);

  }

  if (loading) {
    return <p data-ev-id="ev_3fe0ef8fb9" className="text-sm text-muted-foreground">{t('Loading lyrics...')}</p>;
  }

  if (lines.length === 0) {
    return <p data-ev-id="ev_7c2b532738" className="text-sm text-muted-foreground">{t("This song doesn't have synced lyrics yet.")}</p>;
  }

  return (
    <div data-ev-id="ev_5fcdf9b386" ref={containerRef} className={`no-scrollbar overflow-y-auto ${compact ? 'max-h-64' : 'max-h-[55vh]'}`}>
			<div data-ev-id="ev_a47fdabe82" className="flex flex-col gap-4 py-6">
				{lines.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <button data-ev-id="ev_9f4525f08e"
            key={line.id}
            ref={isActive ? activeRef : null}
            type="button"
            onClick={() => seek(line.time_ms / 1000)}
            className={`origin-left text-left font-bold text-balance transition-all duration-300 ${
            isActive ? 'scale-100 text-2xl md:text-3xl' : isPast ? 'scale-95 text-xl text-muted-foreground/50 hover:text-foreground md:text-2xl' : 'scale-95 text-xl text-muted-foreground hover:text-foreground md:text-2xl'}`
            }>
              
							{isActive ? <KaraokeText text={line.text} start={line.time_ms} end={lineEnd(lines, i)} /> : line.text}
						</button>);

        })}
			</div>
		</div>);

}
