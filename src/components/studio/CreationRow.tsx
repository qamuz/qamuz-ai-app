import { useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Film, Image as ImageIcon, Loader2, Music2, Pause, Play, Send, Trash2, Video, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/hooks/usePlayer';
import { useAccount } from '@/hooks/useAccount';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { videoSourceOf, type Creation } from '@/lib/studio';
import { isLocalModalId, removeLocalModalCreation } from '@/lib/modalClient';
import { useModules } from '@/hooks/useModules';
import { publishMusicVideo } from '@/lib/videos';
import { formatTime } from '@/lib/format';
import type { TrackWithArtist } from '@/types/music';

interface Props {
  creation: Creation;
  onChange: () => void;
  onDeleted: (id: string) => void;
  onOpen?: () => void;
}

const STATUS_STYLE: Record<Creation['status'], string> = {
  queued: 'bg-surface-3 text-muted-foreground',
  generating: 'bg-accent/15 text-accent',
  ready: 'bg-primary/15 text-primary',
  error: 'bg-destructive/15 text-destructive'
};

const STATUS_KEY: Record<Creation['status'], string> = {
  queued: 'Queued',
  generating: 'Generating',
  ready: 'Ready',
  error: 'Error'
};

const KIND_ICON = { music: Music2, video: Video, image: ImageIcon };

const MEDIA_PATH = '/storage/v1/object/public/media/';

/** Storage paths inside the user's own folder of the media bucket (external provider URLs are skipped). */
function ownMediaPaths(creation: Creation, userId: string): string[] {
  const urls = [...creation.result_urls, creation.kind === 'video' ? null : creation.thumbnail_url].filter((u): u is string => Boolean(u));
  return urls.
  map((u) => {
    const at = u.indexOf(MEDIA_PATH);
    return at >= 0 ? decodeURIComponent(u.slice(at + MEDIA_PATH.length).split('?')[0]) : null;
  }).
  filter((p): p is string => Boolean(p && p.startsWith(`${userId}/`)));
}

/** One creation as a compact list row, with versions, actions and delete. */
export function CreationRow({ creation, onChange, onDeleted, onOpen }: Props) {
  const { playTracks, current, isPlaying } = usePlayer();
  const { artist } = useAccount();
  const { user } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{text: string;error?: boolean;} | null>(null);
  const [inGallery, setInGallery] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [inVideos, setInVideos] = useState(false);
  const { isEnabled } = useModules();
  const canPublishVideo = isEnabled('videos') && creation.kind === 'video' && creation.status === 'ready' && Boolean(creation.result_urls[0]) && Boolean(videoSourceOf(creation)) && !inVideos;

  async function publishToVideos() {
    if (!user) return;
    setBusy(true);
    const result = await publishMusicVideo(creation, user.id, artist?.id ?? null);
    setBusy(false);
    if (result === 'error') {
      setMessage({ text: t('Could not publish the video'), error: true });
      return;
    }
    setInVideos(true);
    setMessage({ text: result === 'exists' ? t('Already in the video gallery') : t('Published to the video gallery') });
  }

  const title = creation.title || creation.prompt.slice(0, 48);
  const tracks: TrackWithArtist[] = creation.result_urls.map((url, i) => ({
    id: `ai-${creation.id}-${i}`,
    title: creation.result_urls.length > 1 ? t('{title} (version {n})', { title, n: i + 1 }) : title,
    audio_url: url,
    cover_key: creation.thumbnail_url,
    duration_seconds: creation.duration_seconds ?? 0,
    genre: null,
    plays: 0,
    album_id: null,
    artist: artist ? { id: artist.id, name: artist.name, slug: artist.slug } : null
  }));
  const KindIcon = KIND_ICON[creation.kind];
  const firstPlaying = tracks.some((tr) => tr.id === current?.id) && isPlaying;
  const date = new Date(creation.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  async function publish() {
    if (!supabase || !artist || tracks.length === 0) return;
    setBusy(true);
    const { data, error } = await supabase.
    from('tracks').
    insert({
      artist_id: artist.id,
      title,
      audio_url: tracks[0].audio_url,
      cover_key: creation.thumbnail_url,
      duration_seconds: creation.duration_seconds ?? 0,
      genre: creation.options.style as string | null ?? 'AI',
      is_published: true
    }).
    select('id').
    single();
    if (error || !data) {
      setBusy(false);
      setMessage({ text: t('Could not publish'), error: true });
      return;
    }
    await supabase.from('ai_creations').update({ published_track_id: data.id }).eq('id', creation.id);
    setBusy(false);
    setMessage({ text: t('Published to your artist profile') });
    onChange();
  }

  async function publishMedia() {
    if (!supabase || !artist || !creation.result_urls[0] || creation.kind === 'music') return;
    setBusy(true);
    const { error } = await supabase.from('artist_media').insert({
      artist_id: artist.id,
      creation_id: creation.id,
      kind: creation.kind,
      url: creation.result_urls[0],
      thumbnail_url: creation.kind === 'video' ? creation.thumbnail_url : null,
      title
    });
    setBusy(false);
    if (error && error.code !== '23505') {
      setMessage({ text: t('Could not publish to your profile'), error: true });
      return;
    }
    setInGallery(true);
    setMessage({ text: error ? t('Already on your profile') : t('Published to your profile gallery') });
  }

  async function remove() {
    if (isLocalModalId(creation.id)) {
      removeLocalModalCreation(creation.id);
      onDeleted(creation.id);
      return;
    }
    if (!supabase || !user) return;
    setBusy(true);
    const { error } = await supabase.from('ai_creations').delete().eq('id', creation.id).eq('user_id', user.id);
    if (error) {
      setBusy(false);
      setConfirming(false);
      setMessage({ text: t('Could not delete the creation'), error: true });
      return;
    }
    const paths = ownMediaPaths(creation, user.id);
    if (paths.length > 0) void supabase.storage.from('media').remove(paths);
    onDeleted(creation.id);
  }

  return (
    <li data-ev-id="ev_cr_row" className={`flex flex-col gap-2 rounded-xl border bg-surface p-3 transition-colors ${confirming ? 'border-destructive/50' : 'border-border hover:border-foreground/20'}`}>
      <div data-ev-id="ev_cr_main" className="flex items-center gap-3">
        {/* Small play / preview button */}
        <button data-ev-id="ev_cr_thumb"
        type="button"
        disabled={creation.status !== 'ready' || creation.result_urls.length === 0}
        onClick={() => {
          if (creation.kind === 'music') playTracks(tracks, 0);else
          if (creation.kind === 'video' && onOpen) onOpen();else
          if (creation.kind === 'video') setShowVideo((v) => !v);else
          window.open(creation.result_urls[0], '_blank', 'noopener');
        }}
        aria-label={creation.kind === 'music' ? firstPlaying ? t('Pause') : t('Play') : t('Open')}
        className="group relative flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-muted-foreground">
          
          {creation.kind !== 'music' && creation.thumbnail_url ?
          <img data-ev-id="ev_cr_thumb_img" src={creation.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" /> :
          creation.status === 'error' ?
          <AlertTriangle className="h-5 w-5 text-destructive" /> :
          creation.status !== 'ready' ?
          <Loader2 className="h-5 w-5 animate-spin" /> :
          creation.kind === 'music' ?
          firstPlaying ? <Pause className="h-5 w-5 fill-current text-primary" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current text-foreground" /> :

          <KindIcon className="h-5 w-5 text-foreground" />
          }
        </button>

        <div data-ev-id="ev_cr_text" className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div data-ev-id="ev_cr_titlerow" className="flex items-center gap-2">
            <h3 data-ev-id="ev_cr_title" className="truncate text-sm font-semibold">{title}</h3>
            <span data-ev-id="ev_cr_status" className={`flex-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[creation.status]}`}>{t(STATUS_KEY[creation.status])}</span>
            {creation.published_track_id && <span data-ev-id="ev_cr_pub" className="hidden flex-none text-[11px] font-semibold text-primary sm:inline">{t('Published')}</span>}
          </div>
          <p data-ev-id="ev_cr_prompt" className="truncate text-xs text-muted-foreground">
            {date} · {t('{count} credits', { count: creation.credits_spent })} · {creation.prompt}
          </p>
        </div>

        {/* Actions */}
        <div data-ev-id="ev_cr_actions" className="flex flex-none items-center gap-1">
          {confirming ?
          <>
              <span data-ev-id="ev_cr_confirm_q" className="hidden text-xs font-semibold text-destructive sm:inline">{t('Delete this creation?')}</span>
              <button data-ev-id="ev_cr_confirm_yes" type="button" disabled={busy} onClick={() => void remove()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-bold text-white disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t('Delete')}
              </button>
              <button data-ev-id="ev_cr_confirm_no" type="button" disabled={busy} onClick={() => setConfirming(false)} aria-label={t('Cancel')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </> :

          <>
              {creation.kind === 'music' && creation.status === 'ready' && artist && !creation.published_track_id &&
            <button data-ev-id="ev_cr_publish" type="button" disabled={busy} onClick={() => void publish()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" /> <span data-ev-id="ev_cr_publish_l" className="hidden sm:inline">{t('Publish')}</span>
                </button>
            }
              {creation.kind !== 'music' && creation.status === 'ready' && creation.result_urls[0] && artist && !inGallery &&
            <button data-ev-id="ev_cr_pubmedia" type="button" disabled={busy} onClick={() => void publishMedia()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" /> <span data-ev-id="ev_cr_pubmedia_l" className="hidden sm:inline">{t('Publish to profile')}</span>
                </button>
            }
              {canPublishVideo &&
            <button data-ev-id="ev_693fb527e4" type="button" disabled={busy} onClick={() => void publishToVideos()} title={t('Publish to video gallery')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/40 px-3 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50">
                  <Film className="h-3.5 w-3.5" /> <span data-ev-id="ev_7c9217e27f" className="hidden sm:inline">{t('Video gallery')}</span>
                </button>
            }
              {creation.kind !== 'music' && creation.result_urls[0] &&
            <a data-ev-id="ev_cr_open" href={creation.result_urls[0]} target="_blank" rel="noreferrer" aria-label={t('Open')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground">
                  <ExternalLink className="h-4 w-4" />
                </a>
            }
              <button data-ev-id="ev_cr_delete" type="button" disabled={busy || creation.status === 'generating'} onClick={() => setConfirming(true)} aria-label={t('Delete creation')} title={t('Delete creation')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          }
        </div>
      </div>

      {/* Music versions */}
      {creation.kind === 'music' && tracks.length > 1 &&
      <div data-ev-id="ev_cr_versions" className="flex flex-wrap gap-2 pl-[60px]">
          {tracks.map((tr, i) => {
          const on = current?.id === tr.id;
          return (
            <button data-ev-id="ev_cr_version" key={tr.id} type="button" onClick={() => playTracks(tracks, i)} className={`inline-flex min-h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {on && isPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                {t('Version {n}', { n: i + 1 })}
                {tr.duration_seconds > 0 && <span data-ev-id="ev_cr_version_d" className="tabular-nums opacity-70">{formatTime(tr.duration_seconds)}</span>}
              </button>);
        })}
        </div>
      }

      {creation.kind === 'video' && showVideo && creation.result_urls[0] &&
      <video data-ev-id="ev_cr_video" src={creation.result_urls[0]} poster={creation.thumbnail_url ?? undefined} controls autoPlay playsInline className="aspect-video max-h-[340px] w-full rounded-lg bg-black object-contain" />
      }

      {creation.status === 'error' && creation.error_message &&
      <p data-ev-id="ev_cr_err" className="pl-[60px] text-xs text-destructive">{creation.error_message} · {t('Credits refunded')}</p>
      }
      {message && <p data-ev-id="ev_cr_msg" className={`pl-[60px] text-xs ${message.error ? 'text-destructive' : 'text-primary'}`}>{message.text}</p>}
    </li>);

}