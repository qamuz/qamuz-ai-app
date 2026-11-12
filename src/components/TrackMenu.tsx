import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import {
  AudioWaveform,
  BadgeCheck,
  Clapperboard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Film,
  Heart,
  ImageUp,
  Layers,
  Lock,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  UploadCloud,
  UserRound,
  Wand2 } from
'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { useLikes } from '@/hooks/useLikes';
import { useModules } from '@/hooks/useModules';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { canDownload, downloadTrack, isCatalogTrack, isTrackOwner } from '@/lib/engagement';
import { uploadMedia } from '@/lib/media';
import { ShareDialog } from '@/components/ShareDialog';
import { PublishModal } from '@/components/PublishModal';
import type { TrackWithArtist } from '@/types/music';

interface TrackMenuProps {
  track: TrackWithArtist;
  onComments?: () => void;
  onShared?: () => void;
  buttonClassName?: string;
  iconClassName?: string;
  /** Context actions shown at the top of the menu (e.g. Studio: make video, publish, delete). */
  extra?: {key: string;icon: ReactNode;label: string;onClick: () => void;danger?: boolean;}[];
}

const MENU_WIDTH = 248;

function Item({ icon, label, onClick, soon, danger }: {icon: ReactNode;label: string;onClick?: () => void;soon?: string;danger?: boolean;}) {
  return (
    <button data-ev-id="ev_tm_item"
    type="button"
    role="menuitem"
    disabled={Boolean(soon)}
    onClick={onClick}
    className={`flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${danger ? 'text-destructive' : 'text-foreground'} enabled:hover:bg-surface-3`}>
      
      <span data-ev-id="ev_tm_icon" className="flex h-4 w-4 flex-none items-center justify-center text-muted-foreground">{icon}</span>
      <span data-ev-id="ev_tm_label" className="flex-1 truncate">{label}</span>
      {soon && <span data-ev-id="ev_tm_soon" className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{soon}</span>}
    </button>);

}

function Divider() {
  return <div data-ev-id="ev_tm_div" className="my-1 h-px bg-border" role="separator" />;
}

/** The "⋮" options menu shown on every song. */
export function TrackMenu({ track, onComments, onShared, buttonClassName = '', iconClassName = 'h-4 w-4', extra }: TrackMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { artist, isAdmin, plan } = useAccount();
  const { isLiked, toggleLike } = useLikes();
  const { isEnabled } = useModules();
  const { setExpanded } = usePlayer();
  const { t } = useI18n();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const canvasInput = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{left: number;top?: number;bottom?: number;}>({ left: 0 });
  const [sharing, setSharing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [notice, setNotice] = useState<{text: string;error?: boolean;} | null>(null);
  const [published, setPublished] = useState(track.is_published ?? true);

  useEffect(() => setPublished(track.is_published ?? true), [track.id, track.is_published]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function close() {
    setOpen(false);
  }

  function toggleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    const below = window.innerHeight - rect.bottom;
    setPos(below < 420 && rect.top > below ? { left, bottom: window.innerHeight - rect.top + 6 } : { left, top: rect.bottom + 6 });
    setOpen((o) => !o);
  }

  function go(path: string) {
    close();
    setExpanded(false);
    navigate(path);
  }

  const catalog = isCatalogTrack(track.id);
  const owner = isTrackOwner(track, { artist, isAdmin });
  const downloadable = canDownload(track, { artist, isAdmin, plan });
  const liked = isLiked(track.id);
  const studioOn = isEnabled('studio');
  const draft = !catalog && track.id.startsWith('ai-');
  const stemsOn = isEnabled('stems');
  const masteringOn = isEnabled('mastering');
  const artistName = track.artist?.name ?? '';

  async function handleDownload(format: 'mp3' | 'wav') {
    close();
    setNotice({ text: t('Preparing your download...') });
    const error = await downloadTrack(track, format);
    setNotice(error ? { text: t(error), error: true } : { text: t('Download started') });
  }

  async function togglePublish() {
    close();
    if (!supabase) return;
    const next = !published;
    const { error } = await supabase.from('tracks').update({ is_published: next }).eq('id', track.id);
    if (error) {
      setNotice({ text: t('Could not update the song'), error: true });
      return;
    }
    setPublished(next);
    setNotice({ text: next ? t('Song published') : t('Song unpublished — only you can see it now') });
  }

  async function handleUpload(file: File | undefined, field: 'cover_key' | 'canvas_url') {
    if (!file || !user || !supabase) return;
    const isVideo = file.type.startsWith('video/');
    if (field === 'cover_key' && !file.type.startsWith('image/')) return setNotice({ text: t('Choose an image file'), error: true });
    if (file.size > (isVideo ? 30 : 8) * 1024 * 1024) return setNotice({ text: t('The file is too large'), error: true });
    setNotice({ text: t('Uploading...') });
    const { url, error } = await uploadMedia(user.id, file, field === 'cover_key' ? 'covers' : 'canvas');
    if (error || !url) return setNotice({ text: t('Upload failed'), error: true });
    const { error: dbError } = await supabase.from('tracks').update({ [field]: url }).eq('id', track.id);
    if (dbError) return setNotice({ text: t('Could not update the song'), error: true });
    setNotice({ text: field === 'cover_key' ? t('Cover updated') : t('Canvas updated') });
  }

  const studioLink = (kind: 'music' | 'video', prompt: string) => `/estudio?kind=${kind}&prompt=${encodeURIComponent(prompt)}`;

  return (
    <>
      <button data-ev-id="ev_tm_trigger"
      ref={buttonRef}
      type="button"
      onClick={toggleOpen}
      aria-label={t('More options')}
      aria-haspopup="menu"
      aria-expanded={open}
      className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground ${buttonClassName}`}>
        
        <MoreVertical className={iconClassName} />
      </button>

      <input data-ev-id="ev_tm_cover_in" ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => {void handleUpload(e.target.files?.[0], 'cover_key');e.target.value = '';}} />
      <input data-ev-id="ev_tm_canvas_in" ref={canvasInput} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {void handleUpload(e.target.files?.[0], 'canvas_url');e.target.value = '';}} />

      {open &&
      createPortal(
        <div data-ev-id="ev_tm_layer" className="fixed inset-0 z-[70]" onClick={close}>
            <div data-ev-id="ev_tm_menu"
          role="menu"
          aria-label={t('Song options')}
          onClick={(e) => e.stopPropagation()}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: MENU_WIDTH }}
          className="no-scrollbar absolute flex max-h-[70vh] flex-col overflow-y-auto rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xl shadow-black/60">
            
              {extra && extra.length > 0 &&
            <>
                  {extra.map((x) => <Item key={x.key} icon={x.icon} label={x.label} danger={x.danger} onClick={() => {close();x.onClick();}} />)}
                  <Divider />
                </>
            }
              {user && catalog && <Item icon={<Heart className={`h-4 w-4 ${liked ? 'fill-primary text-primary' : ''}`} />} label={liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')} onClick={() => {void toggleLike(track.id);close();}} />}
              {onComments && catalog && <Item icon={<MessageCircle className="h-4 w-4" />} label={t('Comments')} onClick={() => {close();onComments();}} />}
              {catalog && <Item icon={<Share2 className="h-4 w-4" />} label={t('Share')} onClick={() => {close();setSharing(true);}} />}
              {track.artist && <Item icon={<UserRound className="h-4 w-4" />} label={t('Go to artist profile')} onClick={() => go(`/artista/${track.artist?.slug}`)} />}

              <Divider />
              {downloadable ?
            <>
                  <Item icon={<Download className="h-4 w-4" />} label={t('Download MP3')} onClick={() => void handleDownload('mp3')} />
                  <Item icon={<Download className="h-4 w-4" />} label={t('Download WAV')} onClick={() => void handleDownload('wav')} />
                </> :

            <Item icon={<Lock className="h-4 w-4" />} label={user ? t('Download (paid plans)') : t('Log in to download')} onClick={() => go(user ? '/planes' : '/login')} />
            }

              {studioOn &&
            <>
                  <Divider />
                  <Item icon={<Wand2 className="h-4 w-4" />} label={t('Remix')} onClick={() => go(studioLink('music', t('Remix of “{title}” by {artist}', { title: track.title, artist: artistName })))} />
                  <Item icon={<Clapperboard className="h-4 w-4" />} label={t('Create video')} onClick={() => go(studioLink('video', t('Music video for “{title}” by {artist}', { title: track.title, artist: artistName })))} />
                </>
            }
              {isEnabled('daw') && track.audio_url && (
                <Item
                  icon={<AudioWaveform className="h-4 w-4" />}
                  label={t('Open in DAW')}
                  onClick={() => go(`/studio?track=${track.id}&audio=${encodeURIComponent(track.audio_url)}&title=${encodeURIComponent(track.title)}`)}
                />
              )}
              {track.audio_url && (
                <Item
                  icon={<FileText className="h-4 w-4 text-cyan-400" />}
                  label={t('Letras sincronizadas')}
                  onClick={() => go(`/karaoke/${track.id}`)}
                />
              )}

              {draft && user && (masteringOn || stemsOn && !track.id.startsWith('ai-v-')) &&
            <>
                  <Divider />
                  {stemsOn && !track.id.startsWith('ai-v-') && <Item icon={<Layers className="h-4 w-4" />} label={t('Extract stems')} onClick={() => go(`/stems?song=${track.id}`)} />}
                  {masteringOn && <Item icon={<SlidersHorizontal className="h-4 w-4" />} label={t('Mastering')} onClick={() => go(`/mastering?song=${track.id}`)} />}
                </>
            }
              {owner && catalog &&
            <>
                  <Divider />
                  <p data-ev-id="ev_tm_owner_h" className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('Your song')}</p>
                  <Item
                    icon={published ? <BadgeCheck className="h-4 w-4 text-amber-400" /> : <UploadCloud className="h-4 w-4 text-primary" />}
                    label={published ? t('Editar publicación') : t('Publicar canción')}
                    onClick={() => {
                      close();
                      setPublishOpen(true);
                    }}
                  />
                  {studioOn && <Item icon={<RefreshCw className="h-4 w-4" />} label={t('Redo with AI')} onClick={() => go(studioLink('music', t('New version of “{title}”', { title: track.title })))} />}
                  <Item icon={<ImageUp className="h-4 w-4" />} label={t('Update cover')} onClick={() => {close();coverInput.current?.click();}} />
                  <Item icon={<Film className="h-4 w-4" />} label={t('Update canvas')} onClick={() => {close();canvasInput.current?.click();}} />
                  {isEnabled('artists') && <Item icon={<FileText className="h-4 w-4" />} label={t('Edit lyrics')} onClick={() => go('/artista-panel?tab=lyrics')} />}
                  {stemsOn && <Item icon={<Layers className="h-4 w-4" />} label={t('Extract stems')} onClick={() => go(`/stems?song=${track.id}`)} />}
                  {masteringOn && <Item icon={<SlidersHorizontal className="h-4 w-4" />} label={t('Mastering')} onClick={() => go(`/mastering?song=${track.id}`)} />}
                  {isEnabled('daw') && <Item icon={<AudioWaveform className="h-4 w-4" />} label={t('Open in Studio')} onClick={() => go(`/studio?track=${track.id}`)} />}
                </>
            }
            </div>
          </div>,
        document.body
      )}

      {sharing && <ShareDialog track={track} onClose={() => setSharing(false)} onShared={onShared} />}

      <PublishModal
        track={track}
        isOpen={publishOpen}
        onClose={() => setPublishOpen(false)}
        onUpdated={(updated) => {
          if (updated.is_published !== undefined) setPublished(updated.is_published);
          if (updated.title) track.title = updated.title;
          if (updated.genre !== undefined) track.genre = updated.genre;
          if (updated.cover_key) track.cover_key = updated.cover_key;
        }}
      />

      {notice &&
      createPortal(
        <div data-ev-id="ev_tm_toast" role="status" className={`fixed bottom-32 left-1/2 z-[90] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-xl ${notice.error ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background'}`}>
            {notice.text}
          </div>,
        document.body
      )}
    </>);

}
