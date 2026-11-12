import { useEffect, useRef, useState } from 'react';
import { drawWaveform, loadPeaks, themeColor, type Peaks } from '@/lib/waveform';

interface Props {
  url: string;
  /** 0–1 playback progress. */
  progress: number;
  muted: boolean;
  label: string;
  onSeek: (fraction: number) => void;
}

/** The real waveform of one stem, with the played part highlighted. Click to seek. */
export function StemWave({ url, progress, muted, label, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let alive = true;
    void loadPeaks(url).then((p) => {
      if (alive) setPeaks(p);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !peaks || size.w === 0) return;
    const base = themeColor('--color-muted-foreground', '#8a8a8a');
    const played = themeColor('--color-primary', '#1ed760');
    drawWaveform(el, peaks, { width: size.w, height: size.h, color: base, playedColor: muted ? base : played, progress });
  }, [peaks, progress, muted, size]);

  return (
    <div data-ev-id="ev_stemwave_box" className={`relative h-10 min-w-0 flex-1 ${muted ? 'opacity-40' : ''}`}>
      {!peaks && <div data-ev-id="ev_stemwave_load" className="absolute inset-x-0 top-1/2 h-px animate-pulse bg-muted-foreground/40" />}
      <canvas data-ev-id="ev_stemwave_canvas"
        ref={canvasRef}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={-1}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
        }}
        className="block h-full w-full cursor-pointer" />
    </div>);

}
