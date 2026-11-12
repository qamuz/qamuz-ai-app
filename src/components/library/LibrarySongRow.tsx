import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Clapperboard, Download, Heart, Link2, Loader2, Pause, Play, Share2, ThumbsDown, Trash2, Wand2, X } from 'lucide-react';
import { TrackMenu } from '@/components/TrackMenu';
import { ShareDialog } from '@/components/ShareDialog';
import { useAccount } from '@/hooks/useAccount';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { downloadTrack } from '@/lib/engagement';
import { songToTrack, type Creation, type StudioSong } from '@/lib/studio';
import { songPath } from '@/lib/library';
import { useSongActions } from '@/components/studio/useSongActions';
import { useDislike } from '@/components/library/useDislike';
import type { TrackWithArtist } from '@/types/music';

interface Props {
  song: StudioSong;
  creation?: Creation;
  hasVideo: boolean;
  queue: TrackWithArtist[];
  onChanged: () => void;
  onDeleted: () => void;
}

const iconBtn = 'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-40';
const sideBtn = 'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors';

/** One song in the Library list. Clicking the row opens its detail page; the cover plays it and opens the large cover panel. */
export function LibrarySongRow({ song, creation, hasVideo, queue, onChanged, onDeleted }: Props) {
  const { current, isPlaying, toggle, playTracks, setExpanded } = usePlayer();
  const { artist } = useAccount();
  const { t } = useI18n();
  const navigate = useNavigate();
  const a = useSongActions(song, creation, onChanged);
  const d = useDislike(song, creation, a.liked, () => void a.like(), onChanged);
  const [confirming, setConfirming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const active = current?.id === song.trackId;
  const artistRef = artist ? { id: artist.id, name: artist.name, slug: artist.slug } : null;
  const baseTrack = songToTrack(song, artistRef);
  const menuTrack = a.publishedId ? { ...baseTrack, id: a.publishedId, is_published: true } : baseTrack;
  const isTrim = creation?.provider_slug === 'trimmed-audio';
  const meta = [song.duration > 0 ? formatTime(song.duration) : null, song.style].filter(Boolean).join(' · ');

  const menuExtra = [
  { key: 'remix', icon: <Wand2 className="h-4 w-4" />, label: t('Remix/Edit'), onClick: remix },
  { key: 'video', icon: <Clapperboard className="h-4 w-4" />, label: hasVideo ? t('New video') : t('Make video'), onClick: makeVideo },
  ...(!a.publishedId ? [{ key: 'copy', icon: <Link2 className="h-4 w-4" />, label: t('Copy link'), onClick: a.copyLink }] : []),
  ...(a.canDelete ? [{ key: 'delete', icon: <Trash2 className="h-4 w-4" />, label: t('Delete song'), onClick: () => setConfirming(true), danger: true }] : [])];

  function play() {
    if (active) {
      if (!isPlaying) setExpanded(true);
      toggle();
      return;
    }
    const idx = queue.findIndex((q) => q.id === song.trackId);
    if (idx >= 0) playTracks(queue, idx);else
    playTracks([baseTrack], 0);
    setExpanded(true);
  }

  function remix() {
    navigate(`/estudio?remix=${encodeURIComponent(song.key)}`);
  }

  function makeVideo() {
    navigate(`/estudio?kind=video&video=${encodeURIComponent(song.key)}`);
  }

  function openDetail(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button, a, [role="menu"]')) return;
    navigate(songPath(song));
  }

  async function download() {
    setDownloading(true);
    await downloadTrack(baseTrack, 'mp3');
    setDownloading(false);
  }

  async function confirmDelete() {
    if (await a.remove()) onDeleted();else
    setConfirming(false);
  }

  return (
    <li data-ev-id="ev_lsr_row" onClick={openDetail} className={`group flex cursor-pointer flex-col gap-1 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2/60 ${active ? 'bg-surface-2/40' : ''} ${confirming ? 'ring-1 ring-destructive/50' : ''}`}>
      <div data-ev-id="ev_lsr_main" className="flex items-center gap-3">
        <button data-ev-id="ev_lsr_cover" type="button" onClick={play} aria-label={active && isPlaying ? t('Pause') : t('Play')} className="relative h-16 w-16 flex-none overflow-hidden rounded-lg bg-surface-3">
          <img data-ev-id="ev_lsr_img" src={coverUrl(song.coverUrl)} alt="" width={64} height={64} loading="lazy" className="h-full w-full object-cover" />
          <span data-ev-id="ev_lsr_overlay" className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {active && isPlaying ? <Pause className="h-5 w-5 fill-current text-primary" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current text-white" />}
          </span>
        </button>

        <div data-ev-id="ev_lsr_text" className="flex min-w-0 flex-1 flex-col gap-1">
          <div data-ev-id="ev_lsr_title_row" className="flex min-w-0 items-center gap-1.5">
            <span data-ev-id="ev_lsr_title" className={`truncate text-sm font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{song.title}</span>
            {song.version && <span data-ev-id="ev_lsr_ver" className="flex-none rounded border border-border px-1 text-[10px] font-semibold leading-4 text-muted-foreground">v{song.version}</span>}
            {song.origin === 'upload' && <span data-ev-id="ev_lsr_up" className="flex-none rounded border border-border px-1 text-[10px] font-semibold leading-4 text-muted-foreground">{t('Uploaded')}</span>}
            {isTrim && <span data-ev-id="ev_lsr_trim" className="flex-none rounded border border-border px-1 text-[10px] font-semibold leading-4 text-muted-foreground">{t('Trim')}</span>}
          </div>
          {meta && <p data-ev-id="ev_lsr_meta" className="truncate text-xs text-muted-foreground">{meta}</p>}

          {confirming ?
          <div data-ev-id="ev_lsr_confirm" className="flex items-center gap-2">
              <span data-ev-id="ev_lsr_confirm_q" className="text-xs font-semibold text-destructive">{t('Delete this song?')}</span>
              <button data-ev-id="ev_lsr_yes" type="button" disabled={a.busy} onClick={() => void confirmDelete()} className="inline-flex h-7 items-center gap-1 rounded-md bg-destructive px-2.5 text-[11px] font-bold text-white disabled:opacity-50">
                {a.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {t('Delete')}
              </button>
              <button data-ev-id="ev_lsr_no" type="button" onClick={() => setConfirming(false)} aria-label={t('Cancel')} className={iconBtn}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div> :

          <div data-ev-id="ev_lsr_quick" className="flex items-center gap-1">
              {a.publishedId ?
            <span data-ev-id="ev_lsr_pub" className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{t('Published')}</span> :
            a.canPublish ?
            <button data-ev-id="ev_lsr_publish" type="button" disabled={a.busy} onClick={() => void a.publish()} className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-3 px-2 text-[10px] font-bold text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
                  {a.busy && <Loader2 className="h-3 w-3 animate-spin" />} {t('Publish')}
                </button> :
            null}
              <button data-ev-id="ev_lsr_share" type="button" onClick={() => a.shareTrack ? setSharing(true) : a.copyLink()} aria-label={t('Share')} title={t('Share')} className={iconBtn}>
                <Share2 className="h-3.5 w-3.5" />
              </button>
              <button data-ev-id="ev_lsr_dl" type="button" onClick={() => void download()} disabled={downloading} aria-label={t('Download')} title={t('Download')} className={iconBtn}>
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              </button>
              {a.canLike &&
            <button data-ev-id="ev_lsr_like" type="button" onClick={() => void a.like()} aria-pressed={a.liked} aria-label={a.liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')} className={`${iconBtn} ${a.liked ? 'text-primary hover:text-primary' : ''}`}>
                  <Heart className={`h-3.5 w-3.5 ${a.liked ? 'fill-current' : ''}`} />
                </button>
            }
              {d.canDislike &&
            <button data-ev-id="ev_lsr_dislike" type="button" onClick={() => void d.toggle()} aria-pressed={d.disliked} aria-label={d.disliked ? t('Remove dislike') : t('Dislike')} title={d.disliked ? t('Remove dislike') : t('Dislike')} className={`${iconBtn} ${d.disliked ? 'text-destructive hover:text-destructive' : ''}`}>
                  <ThumbsDown className={`h-3.5 w-3.5 ${d.disliked ? 'fill-current' : ''}`} />
                </button>
            }
            </div>
          }
        </div>

        <div data-ev-id="ev_lsr_actions" className="flex flex-none items-center gap-2">
          <button data-ev-id="ev_lsr_remix" type="button" onClick={remix} className={`${sideBtn} hidden border-border bg-surface-2 text-foreground hover:border-foreground/30 md:inline-flex`}>
            <Wand2 className="h-3.5 w-3.5" /> {t('Remix/Edit')}
          </button>
          {hasVideo &&
          <button data-ev-id="ev_lsr_mv" type="button" onClick={() => navigate(`${songPath(song)}?view=mv`)} className={`${sideBtn} hidden border-primary/50 text-primary hover:bg-primary/10 sm:inline-flex`}>
              <Clapperboard className="h-3.5 w-3.5" /> {t('Preview MV')}
            </button>
          }
          <TrackMenu track={menuTrack} extra={menuExtra} buttonClassName="h-9 w-9 rounded-lg border border-border bg-surface-2" />
        </div>
      </div>
      {a.note && <p data-ev-id="ev_lsr_note" className={`pl-[76px] text-xs ${a.note.error ? 'text-destructive' : 'text-primary'}`}>{a.note.text}</p>}
      {sharing && a.shareTrack && <ShareDialog track={a.shareTrack} onClose={() => setSharing(false)} />}
    </li>);

}
