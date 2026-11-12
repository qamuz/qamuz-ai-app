import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { Link2, Loader2, Pause, Play, Trash2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { copyText } from '@/lib/engagement';
import { formatTime } from '@/lib/format';
import { unpublishMusicVideo, type MusicVideo } from '@/lib/videos';

interface Props {
  video: MusicVideo;
  onClose: () => void;
  onRemoved: (id: string) => void;
}

/** Fullscreen music video: the visual loops in sync with the song. */
export function VideoTheater({ video, onClose, onRemoved }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useAccount();
  const { isPlaying: globalPlaying, toggle: toggleGlobal } = usePlayer();
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(video.duration_seconds);
  const [note, setNote] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const canRemove = Boolean(user && (user.id === video.user_id || isAdmin));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 2600);
    return () => window.clearTimeout(timer);
  }, [note]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => undefined);else
    a.pause();
  }

  function syncVideo(audioTime: number) {
    const v = videoRef.current;
    if (!v || !v.duration || !Number.isFinite(v.duration)) return;
    const target = audioTime % v.duration;
    if (Math.abs(v.currentTime - target) > 0.5) v.currentTime = target;
  }

  function share() {
    const ok = copyText(`${window.location.origin}/videos?v=${video.id}`);
    setNote(ok ? t('Link copied') : t('Could not copy the link'));
  }

  async function remove() {
    setRemoving(true);
    const ok = await unpublishMusicVideo(video.id);
    setRemoving(false);
    if (!ok) {
      setNote(t('Could not remove the video'));
      return;
    }
    onRemoved(video.id);
  }

  return createPortal(
    <div data-ev-id="ev_f4fb7523b9" role="dialog" aria-modal="true" aria-label={video.title} className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
			<div data-ev-id="ev_673976edc7" className="flex items-center justify-between gap-3 px-4 py-3">
				<div data-ev-id="ev_bd77bc9ec1" className="flex min-w-0 flex-col">
					<h2 data-ev-id="ev_a3b0479b48" className="truncate text-base font-bold">{video.title}</h2>
					{video.artist &&
          <Link data-ev-id="ev_b69fd9741d" to={`/artista/${video.artist.slug}`} onClick={onClose} className="truncate text-sm text-white/70 hover:text-white hover:underline">
							{video.artist.name}
						</Link>
          }
				</div>
				<button data-ev-id="ev_dc1089682b" type="button" onClick={onClose} aria-label={t('Close')} className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
					<X className="h-5 w-5" />
				</button>
			</div>

			<button data-ev-id="ev_d7a53a0e54" type="button" onClick={toggle} aria-label={playing ? t('Pause') : t('Play')} className="relative flex min-h-0 flex-1 items-center justify-center">
				<video data-ev-id="ev_875272704d" ref={videoRef} src={video.video_url} poster={video.cover_url ? coverUrl(video.cover_url) : undefined} muted loop playsInline preload="auto" className="max-h-full w-full object-contain" />
				{!playing &&
        <span data-ev-id="ev_3988718cc5" className="absolute flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl">
						<Play className="h-8 w-8 translate-x-[2px] fill-current" />
					</span>
        }
			</button>

			<audio data-ev-id="ev_20ab628bbc"
      ref={audioRef}
      src={video.audio_url}
      autoPlay
      onPlay={() => {
        if (globalPlaying) toggleGlobal();
        setPlaying(true);
        void videoRef.current?.play().catch(() => undefined);
      }}
      onPause={() => {
        setPlaying(false);
        videoRef.current?.pause();
      }}
      onTimeUpdate={(e) => {
        setTime(e.currentTarget.currentTime);
        syncVideo(e.currentTarget.currentTime);
      }}
      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || video.duration_seconds)} />
      

			<div data-ev-id="ev_66933d4319" className="flex flex-col gap-3 px-4 pt-2 pb-5 sm:px-8">
				<input data-ev-id="ev_511fdf138c"
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(time, duration || 0)}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (audioRef.current) audioRef.current.currentTime = v;
          setTime(v);
          syncVideo(v);
        }}
        aria-label={t('Progress')}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-primary" />
        
				<div data-ev-id="ev_1bbdac9ad6" className="flex items-center gap-3">
					<button data-ev-id="ev_70e8c0d0f3" type="button" onClick={toggle} aria-label={playing ? t('Pause') : t('Play')} className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-white text-black">
						{playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current" />}
					</button>
					<span data-ev-id="ev_9b5456fd31" className="text-xs tabular-nums text-white/70">
						{formatTime(time)} / {formatTime(duration)}
					</span>
					<div data-ev-id="ev_1fe6cd2808" className="ml-auto flex items-center gap-2">
						<button data-ev-id="ev_a362a36bc1" type="button" onClick={share} className="flex h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-semibold transition-colors hover:bg-white/20">
							<Link2 className="h-4 w-4" /> <span data-ev-id="ev_caeb52df19" className="hidden sm:inline">{t('Copy link')}</span>
						</button>
						{canRemove &&
            <button data-ev-id="ev_64dd5dd913" type="button" onClick={() => void remove()} disabled={removing} className="flex h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-semibold transition-colors hover:bg-destructive disabled:opacity-50">
								{removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} <span data-ev-id="ev_701b2e96aa" className="hidden sm:inline">{t('Remove from gallery')}</span>
							</button>
            }
					</div>
				</div>
				{note &&
        <p data-ev-id="ev_0424300740" role="status" className="text-xs text-white/80">
						{note}
					</p>
        }
			</div>
		</div>,
    document.body
  );
}