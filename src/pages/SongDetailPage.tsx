import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, AudioWaveform, ChevronDown, ChevronUp, Clapperboard, Heart, Image as ImageIcon, Loader2, MessageCircle, Pause, Play, Send, Share2, ThumbsDown, Wand2 } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TrackMenu } from '@/components/TrackMenu';
import { TrackComments } from '@/components/TrackComments';
import { ShareDialog } from '@/components/ShareDialog';
import { useSongActions } from '@/components/studio/useSongActions';
import { useDislike } from '@/components/library/useDislike';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { fetchTrack } from '@/lib/queries';
import { fetchCreation, fetchCreations, songToTrack, type Creation, type StudioSong } from '@/lib/studio';
import { openSongInStudio } from '@/lib/studio-stems';
import { buildLibrary, formatStamp } from '@/lib/library';
import type { TrackWithArtist } from '@/types/music';

const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-foreground transition-colors hover:bg-surface-3 disabled:opacity-40';
const textBtn = 'inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-xs font-bold text-foreground transition-colors hover:bg-surface-3 disabled:opacity-50';

function SongDetailContent() {
  const { creationId = '', index = '0' } = useParams<{creationId: string;index: string;}>();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [creations, setCreations] = useState<Creation[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const list = await fetchCreations(user.id);
    if (!list.some((c) => c.id === creationId)) {
      const one = await fetchCreation(creationId);
      if (one) list.push(one);
    }
    setCreations(list);
  }, [user, creationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const lib = useMemo(() => buildLibrary(creations ?? []), [creations]);
  const song = lib.songs.find((s) => s.creationId === creationId && s.index === Number(index)) ?? null;

  if (creations === null) {
    return <div data-ev-id="ev_sd_loading" className="flex justify-center py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!song) {
    return (
      <div data-ev-id="ev_sd_missing" className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <p data-ev-id="ev_sd_missing_t" className="text-lg font-bold text-foreground">{t('Song not found')}</p>
        <p data-ev-id="ev_sd_missing_s" className="text-sm text-muted-foreground">{t('It may have been deleted or belongs to another account.')}</p>
        <button data-ev-id="ev_sd_missing_back" type="button" onClick={() => navigate('/biblioteca?tab=songs')} className="mt-2 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">{t('Back to library')}</button>
      </div>);

  }

  return <SongDetail key={song.key} song={song} creation={lib.creationById.get(song.creationId)} videoUrl={lib.videoBySong.get(song.key) ?? null} onChanged={() => void load()} />;
}

function SongDetail({ song, creation, videoUrl, onChanged }: {song: StudioSong;creation?: Creation;videoUrl: string | null;onChanged: () => void;}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { artist } = useAccount();
  const { current, isPlaying, toggle, playTracks } = usePlayer();
  const a = useSongActions(song, creation, onChanged);
  const d = useDislike(song, creation, a.liked, () => void a.like(), onChanged);
  const [view, setView] = useState<'cover' | 'mv'>(params.get('view') === 'mv' && videoUrl ? 'mv' : 'cover');
  const [published, setPublished] = useState<TrackWithArtist | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!a.publishedId) {
      setPublished(null);
      return;
    }
    let on = true;
    void fetchTrack(a.publishedId).then((tr) => {
      if (on) setPublished(tr);
    });
    return () => {
      on = false;
    };
  }, [a.publishedId]);

  const artistRef = artist ? { id: artist.id, name: artist.name, slug: artist.slug } : null;
  const baseTrack = songToTrack(song, artistRef);
  const menuTrack = a.publishedId ? { ...baseTrack, id: a.publishedId, is_published: true } : baseTrack;
  const active = current?.id === song.trackId;
  const lyrics = (song.lyrics || published?.lyrics || '').trim();
  const meta = [artist?.name, song.duration > 0 ? formatTime(song.duration) : null, formatStamp(song.createdAt)].filter(Boolean);

  function play() {
    if (active) toggle();else
    playTracks([baseTrack], 0);
  }

  return (
    <div data-ev-id="ev_sd_root" className="mx-auto flex max-w-[1200px] flex-col gap-8">
      <div data-ev-id="ev_sd_head" className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        <div data-ev-id="ev_sd_left" className="flex items-start gap-3">
          <button data-ev-id="ev_sd_back" type="button" onClick={() => navigate(-1)} aria-label={t('Back')} className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-surface-3">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div data-ev-id="ev_sd_art" className="relative w-full max-w-[300px] overflow-hidden rounded-3xl bg-surface-3 shadow-2xl shadow-black/50 md:w-[280px]">
            {view === 'mv' && videoUrl ?
            <video data-ev-id="ev_sd_video" src={videoUrl} poster={coverUrl(song.coverUrl)} controls autoPlay className="aspect-square w-full bg-black object-cover" /> :
            <img data-ev-id="ev_sd_cover" src={coverUrl(song.coverUrl)} alt={t('Cover of {title}', { title: song.title })} width={300} height={300} className="aspect-square w-full object-cover" />
            }
            {videoUrl &&
            <div data-ev-id="ev_sd_switch" className="absolute inset-x-4 bottom-4 flex rounded-full bg-black/45 p-1 backdrop-blur-md">
                <button data-ev-id="ev_sd_sw_cover" type="button" onClick={() => setView('cover')} aria-pressed={view === 'cover'} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-bold transition-colors ${view === 'cover' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}>
                  <ImageIcon className="h-3.5 w-3.5" /> {t('Cover')}
                </button>
                <button data-ev-id="ev_sd_sw_mv" type="button" onClick={() => setView('mv')} aria-pressed={view === 'mv'} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-bold transition-colors ${view === 'mv' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}>
                  <Clapperboard className="h-3.5 w-3.5" /> {t('MV preview')}
                </button>
              </div>
            }
          </div>
        </div>

        <div data-ev-id="ev_sd_info" className="flex min-w-0 flex-1 flex-col gap-3 md:pt-12">
          <div data-ev-id="ev_sd_title_row" className="flex flex-wrap items-center gap-2">
            <h1 data-ev-id="ev_sd_title" className="text-3xl font-black tracking-tight text-balance text-foreground">{song.title}</h1>
            {song.version && <span data-ev-id="ev_sd_ver" className="rounded border border-border px-1.5 text-[10px] font-semibold leading-5 text-muted-foreground">v{song.version}</span>}
            {a.publishedId && <span data-ev-id="ev_sd_pub" className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{t('Published')}</span>}
          </div>
          <p data-ev-id="ev_sd_meta" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {meta.map((m, i) => <span data-ev-id="ev_sd_meta_i" key={i} className="flex items-center gap-2">{i > 0 && <span data-ev-id="ev_sd_sep" aria-hidden className="h-3 w-px bg-border" />}{m}</span>)}
            {published &&
            <span data-ev-id="ev_sd_plays" className="flex items-center gap-2"><span data-ev-id="ev_sd_sep2" aria-hidden className="h-3 w-px bg-border" /><Play className="h-3 w-3 fill-current" /> {published.plays}</span>
            }
          </p>
          {song.style && <p data-ev-id="ev_sd_style" className="line-clamp-2 max-w-2xl text-xs text-muted-foreground">{song.style}</p>}

          <div data-ev-id="ev_sd_actions" className="mt-2 flex flex-wrap items-center gap-2">
            <button data-ev-id="ev_sd_play" type="button" onClick={play} aria-label={active && isPlaying ? t('Pause') : t('Play')} className="mr-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95">
              {active && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current" />}
            </button>
            <button data-ev-id="ev_sd_remix" type="button" onClick={() => navigate(`/estudio?remix=${encodeURIComponent(song.key)}`)} className={textBtn}>
              <Wand2 className="h-3.5 w-3.5" /> {t('Remix/Edit')}
            </button>
            <button data-ev-id="ev_sd_video_btn" type="button" onClick={() => navigate(`/estudio?kind=video&video=${encodeURIComponent(song.key)}`)} aria-label={videoUrl ? t('New video') : t('Make video')} title={videoUrl ? t('New video') : t('Make video')} className={iconBtn}>
              <Clapperboard className="h-4 w-4" />
            </button>
            {a.canPublish &&
            <button data-ev-id="ev_sd_publish" type="button" disabled={a.busy} onClick={() => void a.publish()} className={textBtn}>
                {a.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {t('Publish')}
              </button>
            }
            {song.audioUrl &&
            <button data-ev-id="ev_sd_daw" type="button" onClick={() => openSongInStudio(navigate, { id: song.trackId, title: song.title, audioUrl: song.audioUrl, bpm: song.bpm })} aria-label={t('Open in DAW')} title={t('Open in DAW')} className={iconBtn}>
                <AudioWaveform className="h-4 w-4" />
              </button>
            }
            {a.canLike &&
            <button data-ev-id="ev_sd_like" type="button" onClick={() => void a.like()} aria-pressed={a.liked} aria-label={a.liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')} className={`${iconBtn} ${a.liked ? 'text-primary' : ''}`}>
                <Heart className={`h-4 w-4 ${a.liked ? 'fill-current' : ''}`} />
              </button>
            }
            {d.canDislike &&
            <button data-ev-id="ev_sd_dislike" type="button" onClick={() => void d.toggle()} aria-pressed={d.disliked} aria-label={d.disliked ? t('Remove dislike') : t('Dislike')} title={d.disliked ? t('Remove dislike') : t('Dislike')} className={`${iconBtn} ${d.disliked ? 'text-destructive' : ''}`}>
                <ThumbsDown className={`h-4 w-4 ${d.disliked ? 'fill-current' : ''}`} />
              </button>
            }
            {a.publishedId &&
            <button data-ev-id="ev_sd_comments_btn" type="button" onClick={() => setCommentsOpen(true)} aria-label={t('Comments')} title={t('Comments')} className={iconBtn}>
                <MessageCircle className="h-4 w-4" />
              </button>
            }
            <button data-ev-id="ev_sd_share" type="button" onClick={() => a.shareTrack ? setSharing(true) : a.copyLink()} aria-label={t('Share')} title={t('Share')} className={iconBtn}>
              <Share2 className="h-4 w-4" />
            </button>
            <TrackMenu track={menuTrack} buttonClassName="h-9 w-9 rounded-lg bg-surface-2" />
          </div>
          {a.note && <p data-ev-id="ev_sd_note" className={`text-xs ${a.note.error ? 'text-destructive' : 'text-primary'}`}>{a.note.text}</p>}
        </div>
      </div>

      <section data-ev-id="ev_sd_lyrics" aria-label={t('Lyrics')} className="md:pl-[342px]">
        {lyrics ?
        <div data-ev-id="ev_sd_lyrics_text" className="flex flex-col gap-3 text-lg leading-relaxed text-foreground/90">
            {lyrics.split('\n').map((line, i) =>
          line.trim() ? <p data-ev-id="ev_sd_line" key={i} className={/^\[.*\]$/.test(line.trim()) ? 'text-muted-foreground' : ''}>{line}</p> : <span data-ev-id="ev_sd_gap" key={i} className="h-2" />
          )}
          </div> :
        <p data-ev-id="ev_sd_nolyrics" className="text-sm text-muted-foreground">{t('This song has no lyrics')}</p>
        }
      </section>

      {a.publishedId &&
      <aside data-ev-id="ev_sd_comments" className="fixed bottom-40 right-3 z-30 flex w-[min(360px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl shadow-black/60 backdrop-blur-xl lg:bottom-28">
          <button data-ev-id="ev_sd_comments_head" type="button" onClick={() => setCommentsOpen((v) => !v)} aria-expanded={commentsOpen} className="flex items-center justify-between px-4 py-3 text-sm font-bold text-foreground">
            <span data-ev-id="ev_sd_comments_t">{t('{count} comments', { count: published?.comments_count ?? 0 })}</span>
            {commentsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {commentsOpen &&
        <div data-ev-id="ev_sd_comments_body" className="no-scrollbar max-h-80 overflow-y-auto border-t border-border px-4 py-3">
              <TrackComments trackId={a.publishedId} />
            </div>
        }
        </aside>
      }

      {sharing && a.shareTrack && <ShareDialog track={a.shareTrack} onClose={() => setSharing(false)} />}
    </div>);

}

export default function SongDetailPage() {
  return (
    <AppLayout>
      <ProtectedRoute>
        <SongDetailContent />
      </ProtectedRoute>
    </AppLayout>);

}
