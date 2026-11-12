import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { formatTime } from '@/lib/format';

interface ShortControlsProps {
  isCurrent: boolean;
  playing: boolean;
  fallbackDuration: number;
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  size?: 'sm' | 'lg';
}

/** Seek bar + previous / play / next for a Short. */
export function ShortControls({ isCurrent, playing, fallbackDuration, onPlay, onPrev, onNext, hasPrev, hasNext, size = 'sm' }: ShortControlsProps) {
  const { progress, duration, seek } = usePlayer();
  const { t } = useI18n();
  const total = (isCurrent && duration) || fallbackDuration || 1;
  const position = isCurrent ? Math.min(progress, total) : 0;
  const pct = position / total * 100;
  const big = size === 'lg';

  return (
    <div data-ev-id="ev_sc_wrap" className="flex w-full flex-col gap-2">
      <input data-ev-id="ev_sc_range"
      type="range"
      min={0}
      max={total}
      step={0.1}
      value={position}
      disabled={!isCurrent}
      onChange={(e) => seek(Number(e.target.value))}
      aria-label={t('Song position')}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-transparent disabled:cursor-default [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
      style={{ background: `linear-gradient(90deg, var(--color-primary) ${pct}%, #ffffff33 ${pct}%)` }} />
      
      <div data-ev-id="ev_sc_row" className="flex items-center justify-between gap-3">
        <span data-ev-id="ev_sc_time" className="w-12 text-xs tabular-nums text-foreground/70">{formatTime(position)}</span>
        <div data-ev-id="ev_sc_btns" className="flex items-center gap-3">
          <button data-ev-id="ev_sc_prev" type="button" onClick={onPrev} disabled={!hasPrev} aria-label={t('Previous short')} className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/10 disabled:opacity-30">
            <SkipBack className="h-5 w-5 fill-current" />
          </button>
          <button data-ev-id="ev_sc_play" type="button" onClick={onPlay} aria-label={playing ? t('Pause') : t('Play')} className={`flex items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95 ${big ? 'h-14 w-14' : 'h-12 w-12'}`}>
            {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 translate-x-[2px] fill-current" />}
          </button>
          <button data-ev-id="ev_sc_next" type="button" onClick={onNext} disabled={!hasNext} aria-label={t('Next short')} className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/10 disabled:opacity-30">
            <SkipForward className="h-5 w-5 fill-current" />
          </button>
        </div>
        <span data-ev-id="ev_sc_total" className="w-12 text-right text-xs tabular-nums text-foreground/70">{formatTime(total)}</span>
      </div>
    </div>);

}
