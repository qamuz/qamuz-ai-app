import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, AudioWaveform, Check, Download, Headphones, Loader2, Pause, Play, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useModules } from '@/hooks/useModules';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { formatTime } from '@/lib/format';
import { downloadFile } from '@/lib/mastering';
import { deleteStemJob, sortedStems, STEM_LABELS, type StemJob } from '@/lib/stems';
import { StemWave } from '@/components/stems/StemWave';

/** Wait until an audio element has data at its current position (or give up after 5s). */
function whenReady(a: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    if (a.readyState >= 3 && !a.seeking) return resolve();
    const done = () => {
      a.removeEventListener('canplay', done);
      a.removeEventListener('seeked', check);
      resolve();
    };
    const check = () => {
      if (a.readyState >= 3) done();
    };
    a.addEventListener('canplay', done);
    a.addEventListener('seeked', check);
    window.setTimeout(done, 5000);
  });
}

interface Props {
  job: StemJob;
  onDeleted: (id: string) => void;
}

/** One separation: status, a mini mixer (play all, mute, solo) and per-stem downloads. */
export function StemJobCard({ job, onDeleted }: Props) {
  const { user } = useAuth();
  const { pause: pauseGlobal, onGlobalPlay } = usePlayer();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isEnabled } = useModules();
  const [now, setNow] = useState(() => Date.now());
  const audios = useRef<Record<string, HTMLAudioElement | null>>({});
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const [solo, setSolo] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{text: string;error?: boolean;} | null>(null);
  const [starting, setStarting] = useState(false);
  const playToken = useRef(0);
  const stopRef = useRef<() => void>(() => undefined);

  const stems = sortedStems(job.stems ?? {});
  const signature = stems.map(([k]) => k).join(',');
  const date = new Date(job.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const label = (key: string) => t(STEM_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1));

  useEffect(() => {
    for (const key of signature.split(',')) {
      const a = audios.current[key];
      if (a) a.muted = solo ? key !== solo : muted.includes(key);
    }
  }, [muted, solo, signature]);

  useEffect(() => {
    if (!playing) return;
    return onGlobalPlay(() => stopRef.current());
  }, [onGlobalPlay, playing]);

  // Keep every stem locked to the first one: tiny speed nudges fix drift without clicks, big gaps jump.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const sync = window.setInterval(() => {
      const [master, ...rest] = list();
      if (!master || master.paused) return;
      for (const a of rest) {
        const drift = a.currentTime - master.currentTime;
        if (Math.abs(drift) > 0.2) {
          a.currentTime = master.currentTime;
          a.playbackRate = 1;
        } else if (Math.abs(drift) > 0.012) {
          a.playbackRate = 1 - Math.max(-0.06, Math.min(0.06, drift * 1.5));
        } else {
          a.playbackRate = 1;
        }
      }
    }, 150);
    const tick = () => {
      const master = list()[0];
      if (master) setTime(master.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.clearInterval(sync);
      cancelAnimationFrame(raf);
      list().forEach((a) => {
        a.playbackRate = 1;
      });
    };
  }, [playing]);

  useEffect(() => () => {
    playToken.current += 1;
    Object.values(audios.current).forEach((a) => a?.pause());
  }, []);

  useEffect(() => {
    if (job.status !== 'generating') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [job.status]);

  const elapsed = Math.max(0, Math.floor((now - new Date(job.created_at).getTime()) / 1000));

  function stopAll() {
    playToken.current += 1;
    list().forEach((a) => a.pause());
    setPlaying(false);
    setStarting(false);
  }
  stopRef.current = stopAll;

  /** Pause everything, line every stem up on the same position, wait until all can play, then start together. */
  async function startAll(at: number) {
    const els = list();
    if (els.length === 0) return;
    const token = ++playToken.current;
    pauseGlobal();
    els.forEach((a) => {
      a.pause();
      a.playbackRate = 1;
      a.currentTime = at;
    });
    setStarting(true);
    await Promise.all(els.map(whenReady));
    if (token !== playToken.current) return;
    els.forEach((a) => {
      a.currentTime = at;
    });
    await Promise.all(els.map((a) => a.play().catch(() => undefined)));
    if (token !== playToken.current) {
      els.forEach((a) => a.pause());
      return;
    }
    setStarting(false);
    setPlaying(true);
  }

  function openInDaw() {
    stopAll();
    navigate(`/studio?stems=${job.id}`);
  }

  function list(): HTMLAudioElement[] {
    return Object.values(audios.current).filter((a): a is HTMLAudioElement => Boolean(a));
  }

  function togglePlay() {
    const els = list();
    if (els.length === 0) return;
    if (playing || starting) {
      stopAll();
      return;
    }
    const at = els[0].currentTime;
    void startAll(duration && at >= duration - 0.05 ? 0 : at);
  }

  function seek(v: number) {
    setTime(v);
    if (playing) {
      void startAll(v);
      return;
    }
    list().forEach((a) => {
      a.currentTime = v;
    });
  }

  async function download(key: string, url: string) {
    setNote({ text: t('Preparing your download...') });
    const ok = await downloadFile(url, `${job.title} - ${label(key)}.mp3`);
    setNote(ok ? { text: t('Download started') } : { text: t('Could not download this stem'), error: true });
  }

  async function remove() {
    if (!user) return;
    setBusy(true);
    stopAll();
    const error = await deleteStemJob(job.id, user.id);
    setBusy(false);
    if (error) {
      setConfirming(false);
      setNote({ text: t('Could not delete the separation'), error: true });
      return;
    }
    onDeleted(job.id);
  }

  const statusStyle = job.status === 'ready' ? 'bg-primary/15 text-primary' : job.status === 'error' ? 'bg-destructive/15 text-destructive' : 'bg-accent/15 text-accent';
  const statusLabel = job.status === 'ready' ? t('Ready') : job.status === 'error' ? t('Error') : t('Separating');

  return (
    <li data-ev-id="ev_c9225d935c" className={`flex flex-col gap-3 rounded-xl border bg-surface p-3 sm:p-4 ${confirming ? 'border-destructive/50' : 'border-border'}`}>
			<div data-ev-id="ev_2656052898" className="flex items-center gap-3">
				<button data-ev-id="ev_840649a025"
        type="button"
        onClick={togglePlay}
        disabled={job.status !== 'ready'}
        aria-label={playing ? t('Pause') : t('Play all stems')}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-surface-3 disabled:opacity-60">
          
					{job.status === 'generating' || starting ?
          <Loader2 className="h-5 w-5 animate-spin text-accent" /> :
          job.status === 'error' ?
          <AlertTriangle className="h-5 w-5 text-destructive" /> :
          playing ?
          <Pause className="h-5 w-5 fill-current text-primary" /> :

          <Play className="h-5 w-5 translate-x-[1px] fill-current" />
          }
				</button>
				<div data-ev-id="ev_c99310d2dd" className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div data-ev-id="ev_2f9dc05d3f" className="flex items-center gap-2">
						<h3 data-ev-id="ev_2fe99a62f8" className="truncate text-sm font-semibold">{job.title}</h3>
						<span data-ev-id="ev_1812f956c9" className={`flex-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle}`}>{statusLabel}</span>
					</div>
					<p data-ev-id="ev_4a32c01b89" className="truncate text-xs text-muted-foreground">
						{job.status === 'generating' ?
            <span data-ev-id="ev_3e8fdb5e59" className="tabular-nums text-accent">{formatTime(elapsed)} · {t(job.mode === 'split_stem' ? 'About 3–5 minutes' : job.mode === 'split_stem_advanced' ? 'About 2–4 minutes' : 'About 1 minute')}</span> :
            <>{date} · {job.mode === 'split_stem' ? t('Full stems') : job.mode === 'split_stem_advanced' ? `${t('Single instrument')}${job.stem_name ? ` (${job.stem_name})` : ''}` : t('Vocals + instrumental')} · {t('{count} credits', { count: job.credits_spent })}</>
            }
					</p>
				</div>
				{job.status === 'ready' && stems.length > 0 && isEnabled('daw') && !confirming &&
        <button data-ev-id="ev_4c48606666" type="button" onClick={openInDaw} className="inline-flex min-h-9 flex-none items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90">
						<AudioWaveform className="h-4 w-4" /> <span data-ev-id="ev_191b3232dc" className="hidden sm:inline">{t('Open in DAW')}</span>
					</button>
        }
				{confirming ?
        <div data-ev-id="ev_4d3b92ebe3" className="flex flex-none items-center gap-1">
						<button data-ev-id="ev_0264a12f40" type="button" disabled={busy} onClick={() => void remove()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-bold text-white disabled:opacity-50">
							{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t('Delete')}
						</button>
						<button data-ev-id="ev_9c51dceb59" type="button" disabled={busy} onClick={() => setConfirming(false)} aria-label={t('Cancel')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground">
							<X className="h-4 w-4" />
						</button>
					</div> :

        <button data-ev-id="ev_5adf99c179" type="button" disabled={job.status === 'generating'} onClick={() => setConfirming(true)} aria-label={t('Delete separation')} title={t('Delete separation')} className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30">
						<Trash2 className="h-4 w-4" />
					</button>
        }
			</div>

			{job.status === 'error' && job.error_message &&
      <p data-ev-id="ev_5bde6bb16c" className="text-xs text-destructive">
					{job.error_message} · {t('Credits refunded')}
				</p>
      }

			{job.status === 'ready' && stems.length > 0 &&
      <>
					<div data-ev-id="ev_00dc79474a" className="flex items-center gap-3">
						<span data-ev-id="ev_5233bd4f72" className="w-10 text-[11px] tabular-nums text-muted-foreground">{formatTime(time)}</span>
						<input data-ev-id="ev_96a7266ad3" type="range" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration || 0)} onChange={(e) => seek(Number(e.target.value))} aria-label={t('Progress')} className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary" />
						<span data-ev-id="ev_849a377d9d" className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{formatTime(duration)}</span>
					</div>
					<ul data-ev-id="ev_f423e8c838" className="flex flex-col divide-y divide-border rounded-lg bg-surface-2">
						{stems.map(([key, url], i) => {
            const isMuted = solo ? key !== solo : muted.includes(key);
            return (
              <li data-ev-id="ev_976ea95ffa" key={key} className="flex items-center gap-2 px-3 py-1.5">
									<audio data-ev-id="ev_ca1d403372"
                ref={(el) => {
                  audios.current[key] = el;
                }}
                src={url}
                preload="auto"
                onTimeUpdate={i === 0 && !playing ? (e) => setTime(e.currentTarget.currentTime) : undefined}
                onLoadedMetadata={i === 0 ? (e) => setDuration(e.currentTarget.duration || 0) : undefined}
                onEnded={i === 0 ? () => stopAll() : undefined} />
                
									<span data-ev-id="ev_76002bd5d2" className={`w-20 flex-none truncate text-xs font-semibold sm:w-28 sm:text-sm ${isMuted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{label(key)}</span>
									<StemWave url={url} progress={duration ? Math.min(1, time / duration) : 0} muted={isMuted} label={t('Progress')} onSeek={(f) => seek(f * duration)} />
									<button data-ev-id="ev_b9f6db912f"
                type="button"
                onClick={() => setSolo((s) => s === key ? null : key)}
                aria-pressed={solo === key}
                aria-label={t('Solo {name}', { name: label(key) })}
                title={t('Solo')}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${solo === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`}>
                  
										<Headphones className="h-4 w-4" />
									</button>
									<button data-ev-id="ev_f32b09448c"
                type="button"
                onClick={() => setMuted((m) => m.includes(key) ? m.filter((k) => k !== key) : [...m, key])}
                aria-pressed={muted.includes(key)}
                aria-label={t('Mute {name}', { name: label(key) })}
                title={t('Mute')}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
                  
										{muted.includes(key) ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
									</button>
									<button data-ev-id="ev_b61dad38eb" type="button" onClick={() => void download(key, url)} aria-label={t('Download {name}', { name: label(key) })} title={t('Download')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
										<Download className="h-4 w-4" />
									</button>
								</li>);

          })}
					</ul>
				</>
      }
			{note && <p data-ev-id="ev_e427bdbb60" role="status" className={`text-xs ${note.error ? 'text-destructive' : 'text-primary'}`}>{note.text}</p>}
		</li>);

}