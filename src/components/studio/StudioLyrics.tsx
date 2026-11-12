import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { lyricLines, lyricTimes } from '@/lib/studio';

interface Props {
  text: string | null;
  position: number;
  duration: number;
  active: boolean;
  onSeek?: (seconds: number) => void;
}

/** Spotify-style lyrics: lines rise and the current one lights up while the song plays. */
export function StudioLyrics({ text, position, duration, active, onSeek }: Props) {
  const { t } = useI18n();
  const lines = useMemo(() => lyricLines(text), [text]);
  const times = useMemo(() => lyricTimes(lines.length, duration), [lines.length, duration]);
  const boxRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  let current = -1;
  if (active) for (let i = 0; i < times.length; i++) if (position >= times[i]) current = i;

  useEffect(() => {
    const box = boxRef.current;
    const el = current >= 0 ? lineRefs.current[current] : null;
    if (!box) return;
    const top = el ? el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2 : 0;
    box.scrollTo({ top, behavior: 'smooth' });
  }, [current]);

  if (lines.length === 0) {
    return <p data-ev-id="ev_sl_empty" className="py-6 text-sm text-pretty text-foreground/60">{t('No lyrics for this song yet.')}</p>;
  }

  return (
    <div data-ev-id="ev_sl_box" ref={boxRef} className="no-scrollbar relative max-h-[360px] overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]">
      <div data-ev-id="ev_sl_lines" className="flex flex-col gap-3 py-24">
        {lines.map((line, i) =>
        <button data-ev-id="ev_sl_line"
        key={`${i}-${line}`}
        ref={(el) => {
          lineRefs.current[i] = el;
        }}
        type="button"
        disabled={!active || !onSeek}
        onClick={() => onSeek?.(times[i])}
        className={`text-left text-xl font-bold leading-snug text-balance transition-all duration-500 disabled:cursor-default ${
        i === current ? 'scale-[1.02] text-foreground' : i < current ? 'text-foreground/45' : 'text-foreground/25'}`
        }>
          
            {line}
          </button>
        )}
      </div>
    </div>);

}