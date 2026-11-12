import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AudioWaveform, Check, Clapperboard, Download, Heart, Link2, Loader2, Mic2, Pause, Play, Share2, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { KieToolsModal } from '@/components/studio/KieToolsModal';
import { TrackMenu } from '@/components/TrackMenu';
import { ShareDialog } from '@/components/ShareDialog';
import { useAccount } from '@/hooks/useAccount';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { downloadTrack } from '@/lib/engagement';
import { songToTrack, type Creation, type StudioSong } from '@/lib/studio';
import { openSongInStudio } from '@/lib/studio-stems';
import { useSongActions } from '@/components/studio/useSongActions';

interface Props {
  song: StudioSong;
  creation?: Creation;
  selected: boolean;
  hasVideo: boolean;
  generating?: boolean;
  onSelect: () => void;
  onMakeVideo: () => void;
  onPreviewVideo: () => void;
  onRemix: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}

const iconBtn = 'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-40';
const sideBtn = 'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors disabled:opacity-40';

/** One song in "My workspace": cover, title + version, duration · style, quick icons, Remix/Edit, Preview MV and ⋯. */
export function SongRow({ song, creation, selected, hasVideo, generating, onSelect, onMakeVideo, onPreviewVideo, onRemix, onChanged, onDeleted }: Props) {
  const { current, isPlaying, toggle } = usePlayer();
  const { artist } = useAccount();
  const { t } = useI18n();
  const navigate = useNavigate();
  const a = useSongActions(song, creation, onChanged);
  const [confirming, setConfirming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const active = current?.id === song.trackId;
  const meta = [song.duration > 0 ? formatTime(song.duration) : null, song.style].filter(Boolean).join(' · ');

  const artistRef = artist ? { id: artist.id, name: artist.name, slug: artist.slug } : null;
  const baseTrack = songToTrack(song, artistRef);
  const menuTrack = a.publishedId ? { ...baseTrack, id: a.publishedId, is_published: true } : baseTrack;
  const menuExtra = [
  { key: 'lyrics', icon: <Mic2 className="h-4 w-4" />, label: t('Lyrics'), onClick: onSelect },
  ...(generating ? [] : [{ key: 'remix', icon: <Wand2 className="h-4 w-4" />, label: t('Remix/Edit'), onClick: onRemix }]),
  ...(generating ? [] : [{ key: 'ai-tools', icon: <Sparkles className="h-4 w-4" />, label: t('AI tools'), onClick: () => setToolsOpen(true) }]),
  ...(generating ? [] : [{ key: 'video', icon: <Clapperboard className="h-4 w-4" />, label: hasVideo ? t('New video') : t('Make video'), onClick: onMakeVideo }]),
  ...(generating || !song.audioUrl ? [] : [{ key: 'daw', icon: <AudioWaveform className="h-4 w-4" />, label: t('Open in DAW'), onClick: () => openSongInStudio(navigate, { id: song.trackId, title: song.title, audioUrl: song.audioUrl, bpm: song.bpm }) }]),
  ...(!a.publishedId ? [{ key: 'copy', icon: <Link2 className="h-4 w-4" />, label: t('Copy link'), onClick: a.copyLink }] : []),
  ...(a.canDelete ? [{ key: 'delete', icon: <Trash2 className="h-4 w-4" />, label: t('Delete song'), onClick: () => setConfirming(true), danger: true }] : [])];

  async function confirmDelete() {
    if (await a.remove()) onDeleted();else
    setConfirming(false);
  }

  async function download() {
    setDownloading(true);
    await downloadTrack(baseTrack, 'mp3');
    setDownloading(false);
  }

  function share() {
    if (a.shareTrack) setSharing(true);else
    a.copyLink();
  }

  return (
    <li data-ev-id="ev_sr_row" className={`group relative flex flex-col gap-1 rounded-xl px-2 py-2 transition-colors ${selected ? 'bg-surface-2' : 'hover:bg-surface-2/60'} ${confirming ? 'ring-1 ring-destructive/50' : ''}`}>
      {selected && <span data-ev-id="ev_sr_mark" aria-hidden className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-full bg-primary" />}
      <div data-ev-id="ev_sr_main" className="flex items-center gap-3">
        <button data-ev-id="ev_sr_cover"
        type="button"
        onClick={() => active ? toggle() : onSelect()}
        aria-label={active && isPlaying ? t('Pause') : t('Play')}
        className="relative h-16 w-16 flex-none overflow-hidden rounded-lg bg-surface-3">
          <img data-ev-id="ev_sr_img" src={coverUrl(song.coverUrl)} alt="" width={64} height={64} loading="lazy" className="h-full w-full object-cover" />
          <span data-ev-id="ev_sr_overlay" className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {active && isPlaying ? <Pause className="h-5 w-5 fill-current text-primary" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current text-white" />}
          </span>
        </button>

        <div data-ev-id="ev_sr_text" className="flex min-w-0 flex-1 flex-col gap-1">
          <button data-ev-id="ev_sr_title_b" type="button" onClick={onSelect} className="flex min-w-0 items-center gap-2 text-left">
            <span data-ev-id="ev_sr_title" className={`truncate text-sm font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{song.title}</span>
            {song.version &&
            <span data-ev-id="ev_sr_ver" className="flex-none rounded border border-border px-1 text-[10px] font-semibold leading-4 text-muted-foreground">v{song.version}</span>
            }
            {hasVideo && <span data-ev-id="ev_sr_vid" className="flex flex-none items-center gap-1 rounded border border-accent/40 px-1 text-[10px] font-semibold leading-4 text-accent"><Clapperboard className="h-3 w-3" /> MV</span>}
            {generating && <span data-ev-id="ev_sr_gen" className="flex flex-none items-center gap-1 text-[10px] font-bold uppercase text-accent"><Loader2 className="h-3 w-3 animate-spin" /> {t('Generating')}</span>}
          </button>
          {meta && <button data-ev-id="ev_sr_meta" type="button" onClick={onSelect} className="truncate text-left text-xs text-muted-foreground">{meta}</button>}

          {confirming ?
          <div data-ev-id="ev_sr_confirm" className="flex items-center gap-2">
              <span data-ev-id="ev_sr_confirm_q" className="text-xs font-semibold text-destructive">{t('Delete this song?')}</span>
              <button data-ev-id="ev_sr_confirm_yes" type="button" disabled={a.busy} onClick={() => void confirmDelete()} className="inline-flex h-7 items-center gap-1 rounded-md bg-destructive px-2.5 text-[11px] font-bold text-white disabled:opacity-50">
                {a.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {t('Delete')}
              </button>
              <button data-ev-id="ev_sr_confirm_no" type="button" onClick={() => setConfirming(false)} aria-label={t('Cancel')} className={iconBtn}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div> :

          <div data-ev-id="ev_sr_quick" className="flex items-center gap-1">
              {a.publishedId ?
            <span data-ev-id="ev_sr_pub" className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{t('Published')}</span> :
            a.canPublish && !generating ?
            <button data-ev-id="ev_sr_publish" type="button" disabled={a.busy} onClick={() => void a.publish()} className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-3 px-2 text-[10px] font-bold text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-50">
                  {a.busy && <Loader2 className="h-3 w-3 animate-spin" />} {t('Publish')}
                </button> :
            null}
              {!generating &&
            <>
                  <button data-ev-id="ev_sr_share" type="button" onClick={share} aria-label={t('Share')} title={t('Share')} className={iconBtn}>
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button data-ev-id="ev_sr_dl" type="button" onClick={() => void download()} disabled={downloading} aria-label={t('Download')} title={t('Download')} className={iconBtn}>
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </button>
                </>
            }
              {a.canLike &&
            <button data-ev-id="ev_sr_like" type="button" onClick={() => void a.like()} aria-pressed={a.liked} aria-label={a.liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')} className={`${iconBtn} ${a.liked ? 'text-primary hover:text-primary' : ''}`}>
                  <Heart className={`h-3.5 w-3.5 ${a.liked ? 'fill-current' : ''}`} />
                </button>
            }
            </div>
          }
        </div>

        <div data-ev-id="ev_sr_actions" className="flex flex-none items-center gap-2">
          {!generating &&
          <>
              <button data-ev-id="ev_sr_tools" type="button" onClick={() => setToolsOpen(true)} className={`${sideBtn} hidden border-border bg-surface-2 text-foreground hover:border-primary hover:text-primary lg:inline-flex`}>
                <Sparkles className="h-3.5 w-3.5" /> {t('AI tools')}
              </button>
              <button data-ev-id="ev_sr_remix" type="button" onClick={onRemix} className={`${sideBtn} hidden border-border bg-surface-2 text-foreground hover:border-foreground/30 md:inline-flex`}>
                <Wand2 className="h-3.5 w-3.5" /> {t('Remix/Edit')}
              </button>
              <button data-ev-id="ev_sr_mv" type="button" onClick={hasVideo ? onPreviewVideo : onMakeVideo} className={`${sideBtn} hidden border-primary/50 text-primary hover:bg-primary/10 sm:inline-flex`}>
                <Clapperboard className="h-3.5 w-3.5" /> {hasVideo ? t('Preview MV') : t('Make video')}
              </button>
            </>
          }
          <TrackMenu track={menuTrack} extra={menuExtra} buttonClassName="h-9 w-9 rounded-lg border border-border bg-surface-2" />
        </div>
      </div>
      {a.note && <p data-ev-id="ev_sr_note" className={`pl-[76px] text-xs ${a.note.error ? 'text-destructive' : 'text-primary'}`}>{a.note.text}</p>}
      {sharing && a.shareTrack && <ShareDialog track={a.shareTrack} onClose={() => setSharing(false)} />}
      {toolsOpen && <KieToolsModal open song={song} creation={creation} onClose={() => setToolsOpen(false)} />}
    </li>);

}
