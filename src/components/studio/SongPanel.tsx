import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AudioWaveform, Clapperboard, Heart, Loader2, Pause, Play, Send, Share2, X } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useAccount } from '@/hooks/useAccount';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { songToTrack, type Creation, type StudioSong } from '@/lib/studio';
import { openSongInStudio } from '@/lib/studio-stems';
import { ShareDialog } from '@/components/ShareDialog';
import { StudioLyrics } from '@/components/studio/StudioLyrics';
import { useSongActions } from '@/components/studio/useSongActions';
import type { TrackWithArtist } from '@/types/music';

interface Props {
  song: StudioSong;
  creation?: Creation;
  videoUrl: string | null;
  queue: TrackWithArtist[];
  onClose: () => void;
  onChanged: () => void;
  onMakeVideo: (song: StudioSong) => void;
}

/** Floating "Now playing" side panel: cover or song video, actions, and rising lyrics. */
export function SongPanel({ song, creation, videoUrl, queue, onClose, onChanged, onMakeVideo }: Props) {
  const { current, isPlaying, progress, duration, toggle, playTracks, seek } = usePlayer();
  const { artist } = useAccount();
  const { t } = useI18n();
  const navigate = useNavigate();
  const a = useSongActions(song, creation, onChanged);
  const [sharing, setSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const active = current?.id === song.trackId;
  const total = active ? duration || song.duration : song.duration;
  const position = active ? progress : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The video is the song's visual: muted, looping and kept in step with the audio.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && isPlaying) void v.play().catch(() => undefined);else
    v.pause();
  }, [active, isPlaying, videoUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active || !v.duration || !Number.isFinite(v.duration)) return;
    const target = progress % v.duration;
    if (Math.abs(v.currentTime - target) > 0.6) v.currentTime = target;
  }, [progress, active]);

  function play() {
    if (active) {
      toggle();
      return;
    }
    const idx = queue.findIndex((q) => q.id === song.trackId);
    if (idx >= 0) playTracks(queue, idx);else
    playTracks([songToTrack(song, artist)], 0);
  }

  function share() {
    if (a.shareTrack) setSharing(true);else
    a.copyLink();
  }

  const actionClass = 'flex h-10 items-center gap-2 rounded-lg bg-surface-3/70 px-3 text-xs font-semibold transition-colors hover:bg-surface-3 disabled:opacity-50';

  return (
    <aside data-ev-id="ev_sp_panel" aria-label={t('Now playing')} className="fixed inset-x-0 top-0 bottom-[140px] z-[35] flex flex-col overflow-hidden bg-surface/95 shadow-2xl shadow-black/60 backdrop-blur-xl lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-4 lg:w-[380px] lg:rounded-2xl lg:border lg:border-border">
      <div data-ev-id="ev_sp_head" className="flex items-center justify-between gap-3 px-4 py-3">
        <p data-ev-id="ev_sp_label" className="truncate text-sm font-bold text-foreground">{song.title}</p>
        <button data-ev-id="ev_sp_close" type="button" onClick={onClose} aria-label={t('Close')} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div data-ev-id="ev_sp_scroll" className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
        <div data-ev-id="ev_sp_media" className="relative overflow-hidden rounded-xl bg-black">
          {videoUrl ?
          <video data-ev-id="ev_sp_video" ref={videoRef} key={videoUrl} src={videoUrl} poster={song.coverUrl ?? undefined} muted loop playsInline preload="auto" className="aspect-square w-full object-cover sm:aspect-video lg:aspect-square" /> :

          <img data-ev-id="ev_sp_cover" src={coverUrl(song.coverUrl)} alt={t('Cover of {title}', { title: song.title })} width={380} height={380} className="aspect-square w-full object-cover" />
          }
          {videoUrl &&
          <span data-ev-id="ev_sp_vbadge" className="absolute top-3 left-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              <Clapperboard className="h-3 w-3" /> {t('Video')}
            </span>
          }
          <button data-ev-id="ev_sp_play" type="button" onClick={play} aria-label={active && isPlaying ? t('Pause') : t('Play')} className="absolute right-3 bottom-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/40 transition-transform hover:scale-105">
            {active && isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 translate-x-[2px] fill-current" />}
          </button>
        </div>

        <div data-ev-id="ev_sp_info" className="flex flex-col gap-1">
          <h2 data-ev-id="ev_sp_title" className="text-2xl font-black tracking-tight text-balance text-foreground">{song.title}</h2>
          <p data-ev-id="ev_sp_sub" className="truncate text-sm text-muted-foreground">
            {[artist?.name, song.version ? t('Version {n}', { n: song.version }) : null, song.style?.split(',').slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div data-ev-id="ev_sp_progress" className="flex flex-col gap-1.5">
          <input data-ev-id="ev_sp_range" type="range" min={0} max={total || 1} step={1} value={Math.min(position, total)} disabled={!active} onChange={(e) => seek(Number(e.target.value))} aria-label={t('Progress')} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary disabled:cursor-default" />
          <div data-ev-id="ev_sp_times" className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span data-ev-id="ev_sp_t1">{formatTime(position)}</span>
            <span data-ev-id="ev_sp_t2">{formatTime(total)}</span>
          </div>
        </div>

        <div data-ev-id="ev_sp_actions" className="flex flex-wrap items-center gap-2">
          {a.canLike &&
          <button data-ev-id="ev_sp_like" type="button" onClick={() => void a.like()} aria-pressed={a.liked} aria-label={a.liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')} className={`${actionClass} ${a.liked ? 'text-primary' : 'text-foreground'}`}>
              <Heart className={`h-4 w-4 ${a.liked ? 'fill-current' : ''}`} /> {t('Like')}
            </button>
          }
          <button data-ev-id="ev_sp_share" type="button" onClick={share} className={`${actionClass} text-foreground`}>
            <Share2 className="h-4 w-4" /> {t('Share')}
          </button>
          {a.canPublish &&
          <button data-ev-id="ev_sp_publish" type="button" disabled={a.busy} onClick={() => void a.publish()} className="flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">
              {a.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('Publish')}
            </button>
          }
          {a.publishedId && <span data-ev-id="ev_sp_pub" className="rounded-lg bg-primary/15 px-3 py-2.5 text-xs font-bold text-primary">{t('Published')}</span>}
          {song.audioUrl && (
            <button
              data-ev-id="ev_sp_daw"
              type="button"
              onClick={() => openSongInStudio(navigate, { id: song.trackId, title: song.title, audioUrl: song.audioUrl, bpm: song.bpm })}
              className={`${actionClass} text-foreground hover:text-cyan-400`}
            >
              <AudioWaveform className="h-4 w-4 text-cyan-400" /> {t('Open in DAW')}
            </button>
          )}
          <button data-ev-id="ev_sp_mkvideo" type="button" onClick={() => onMakeVideo(song)} className={`${actionClass} text-foreground`}>
            <Clapperboard className="h-4 w-4" /> {videoUrl ? t('New video') : t('Make video')}
          </button>
        </div>
        {a.note && <p data-ev-id="ev_sp_note" role="status" className={`text-xs ${a.note.error ? 'text-destructive' : 'text-primary'}`}>{a.note.text}</p>}

        <section data-ev-id="ev_sp_lyrics" className="flex flex-col gap-2 rounded-xl bg-gradient-to-b from-primary/20 to-surface-2 p-4">
          <h3 data-ev-id="ev_sp_lyrics_h" className="text-sm font-bold text-foreground">{t('Lyrics')}</h3>
          <StudioLyrics text={song.lyrics} position={position} duration={total} active={active} onSeek={seek} />
        </section>
      </div>

      {sharing && a.shareTrack && <ShareDialog track={a.shareTrack} onClose={() => setSharing(false)} />}
    </aside>);

}