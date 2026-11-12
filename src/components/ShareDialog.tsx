import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Facebook, Mail, Send, Share2, X } from 'lucide-react';
import { copyText, shareUrl, trackEvent, type ShareChannel } from '@/lib/engagement';
import { coverUrl } from '@/lib/covers';
import { useI18n } from '@/hooks/useI18n';
import type { TrackWithArtist } from '@/types/music';

interface ShareDialogProps {
  track: TrackWithArtist;
  onClose: () => void;
  onShared?: () => void;
}

function XLogo({ className }: {className?: string;}) {
  return (
    <svg data-ev-id="ev_share_xlogo" viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path data-ev-id="ev_share_xpath" d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.7L6.4 3.9H4.6L17.7 20Z" />
    </svg>);

}

function WhatsAppLogo({ className }: {className?: string;}) {
  return (
    <svg data-ev-id="ev_share_walogo" viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path data-ev-id="ev_share_wapath" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>);

}

export function ShareDialog({ track, onClose, onShared }: ShareDialogProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = shareUrl(track.id);
  const text = t('Listen to “{title}” by {artist} on Qamuz AI', { title: track.title, artist: track.artist?.name ?? 'Qamuz' });
  const encUrl = encodeURIComponent(url);
  const encText = encodeURIComponent(text);

  function record(channel: ShareChannel) {
    void trackEvent(track.id, 'share', channel);
    onShared?.();
  }

  function handleCopy() {
    if (copyText(url)) {
      setCopied(true);
      record('copy');
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleNative() {
    try {
      await navigator.share({ title: track.title, text, url });
      record('native');
      onClose();
    } catch {
      /* user cancelled */
    }
  }

  const targets: {id: ShareChannel;label: string;href: string;icon: React.ReactNode;}[] = [
  { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encText}%20${encUrl}`, icon: <WhatsAppLogo className="h-5 w-5" /> },
  { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${encText}&url=${encUrl}`, icon: <XLogo className="h-4 w-4" /> },
  { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`, icon: <Facebook className="h-5 w-5" /> },
  { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${encUrl}&text=${encText}`, icon: <Send className="h-5 w-5" /> },
  { id: 'email', label: t('Email'), href: `mailto:?subject=${encodeURIComponent(track.title)}&body=${encText}%20${encUrl}`, icon: <Mail className="h-5 w-5" /> }];


  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return createPortal(
    <div data-ev-id="ev_share_root" className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t('Share')} onClick={onClose}>
      <div data-ev-id="ev_share_panel" className="flex w-full max-w-md flex-col gap-5 rounded-t-2xl border border-border bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div data-ev-id="ev_share_head" className="flex items-center gap-3">
          <img data-ev-id="ev_share_cover" src={coverUrl(track.cover_key)} width={48} height={48} alt="" className="h-12 w-12 rounded-md object-cover" />
          <div data-ev-id="ev_share_titles" className="flex min-w-0 flex-1 flex-col">
            <p data-ev-id="ev_share_title" className="truncate text-sm font-bold">{track.title}</p>
            <p data-ev-id="ev_share_artist" className="truncate text-xs text-muted-foreground">{track.artist?.name}</p>
          </div>
          <button data-ev-id="ev_share_close" type="button" onClick={onClose} aria-label={t('Close')} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div data-ev-id="ev_share_grid" className="grid grid-cols-5 gap-2">
          {targets.map((target) =>
          <a data-ev-id="ev_share_target"
          key={target.id}
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => record(target.id)}
          className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
            
              <span data-ev-id="ev_share_icon" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-foreground">{target.icon}</span>
              {target.label}
            </a>
          )}
        </div>

        <div data-ev-id="ev_share_link" className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-1.5 pl-3">
          <span data-ev-id="ev_share_url" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url}</span>
          <button data-ev-id="ev_share_copy" type="button" onClick={handleCopy} className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t('Copied') : t('Copy link')}
          </button>
        </div>

        {canNative &&
        <button data-ev-id="ev_share_native" type="button" onClick={() => void handleNative()} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold hover:bg-surface-2">
            <Share2 className="h-4 w-4" /> {t('More options')}
          </button>
        }
      </div>
    </div>,
    document.body
  );
}
