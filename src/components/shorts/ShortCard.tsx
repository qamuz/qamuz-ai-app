import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AudioLines,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Share2,
  Shuffle,
  UploadCloud,
} from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useLikes } from '@/hooks/useLikes';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatCount } from '@/lib/format';
import { LyricsView } from '@/components/LyricsView';
import { TrackMenu } from '@/components/TrackMenu';
import { ShareDialog } from '@/components/ShareDialog';
import { PublishModal } from '@/components/PublishModal';
import { ShortControls } from '@/components/shorts/ShortControls';
import type { TrackWithArtist } from '@/types/music';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;

function RailButton({
  icon,
  label,
  onClick,
  ariaLabel,
  pressed,
  activeColor = 'border-primary/50 bg-primary/20 text-primary',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  ariaLabel: string;
  pressed?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      data-ev-id="ev_short_rail_btn"
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className="group flex flex-col items-center gap-1 text-[11px] font-bold tabular-nums text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] cursor-pointer"
    >
      <span
        data-ev-id="ev_short_rail_icon"
        className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border backdrop-blur-md transition-all group-active:scale-90 shadow-lg ${
          pressed
            ? activeColor
            : 'border-white/12 bg-black/45 text-white hover:bg-black/65 hover:border-white/20'
        }`}
      >
        {icon}
      </span>
      <span className="max-w-[56px] truncate text-center">{label}</span>
    </button>
  );
}

interface ShortCardProps {
  track: TrackWithArtist;
  index: number;
  active: boolean;
  desktop: boolean;
  commentsOpen: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onActivate: () => void;
  onToggleComments: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function ShortCard({
  track,
  index,
  active,
  desktop,
  commentsOpen,
  hasPrev,
  hasNext,
  onActivate,
  onToggleComments,
  onPrev,
  onNext,
}: ShortCardProps) {
  const navigate = useNavigate();
  const { current, isPlaying, toggle, shuffle, toggleShuffle } = usePlayer();
  const { isLiked, toggleLike, likeDelta } = useLikes();
  const { user } = useAuth();
  const { t } = useI18n();

  const [sharing, setSharing] = useState(false);
  const [shareBump, setShareBump] = useState(0);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const isCurrent = current?.id === track.id;
  const playing = isCurrent && isPlaying;
  const liked = isLiked(track.id);
  const likes = Math.max(0, (track.likes_count ?? 0) + likeDelta(track.id));
  const shares = (track.shares_count ?? 0) + shareBump;
  const canvas = track.canvas_url;
  const canvasIsVideo = Boolean(canvas && VIDEO_EXT.test(canvas));
  const cover = coverUrl(track.cover_key);

  function handlePlay() {
    if (isCurrent) toggle();
    else onActivate();
  }

  function handleLike() {
    if (!user) {
      window.location.assign('/login');
      return;
    }
    void toggleLike(track.id);
  }

  function handleStems() {
    navigate(
      `/studio?track=${track.id}&audio=${encodeURIComponent(track.audio_url)}&title=${encodeURIComponent(track.title)}`
    );
  }

  const rail = (
    <>
      <RailButton
        icon={
          <Heart
            className={`h-5 w-5 sm:h-6 sm:w-6 transition-transform ${
              liked ? 'fill-[#ff3366] text-[#ff3366] scale-110' : ''
            }`}
          />
        }
        label={likes > 0 ? formatCount(likes) : t('Me gusta')}
        onClick={handleLike}
        ariaLabel={liked ? t('Quitar me gusta') : t('Me gusta')}
        pressed={liked}
        activeColor="border-[#ff3366]/40 bg-[#ff3366]/20 text-[#ff3366]"
      />

      <RailButton
        icon={
          <MessageCircle
            className={`h-5 w-5 sm:h-6 sm:w-6 ${
              commentsOpen ? 'fill-primary/30 text-primary' : ''
            }`}
          />
        }
        label={track.comments_count ? formatCount(track.comments_count) : t('Comentar')}
        onClick={onToggleComments}
        ariaLabel={commentsOpen ? t('Ocultar comentarios') : t('Comentarios')}
        pressed={commentsOpen}
        activeColor="border-primary/40 bg-primary/20 text-primary"
      />

      <RailButton
        icon={<Share2 className="h-5 w-5 sm:h-6 sm:w-6" />}
        label={shares > 0 ? formatCount(shares) : t('Share')}
        onClick={() => setSharing(true)}
        ariaLabel={t('Compartir')}
      />

      <RailButton
        icon={<AudioLines className="h-5 w-5 sm:h-5.5 sm:w-5.5 text-cyan-400" />}
        label={t('Stems')}
        onClick={handleStems}
        ariaLabel={t('Extraer stems o abrir en DAW')}
      />

      <RailButton
        icon={
          <UploadCloud
            className={`h-5 w-5 sm:h-5.5 sm:w-5.5 ${
              track.is_published ? 'text-amber-400' : 'text-primary'
            }`}
          />
        }
        label={track.is_published ? t('Pública') : t('Publicar')}
        onClick={() => setPublishModalOpen(true)}
        ariaLabel={t('Publicar canción')}
        pressed={Boolean(track.is_published)}
        activeColor="border-amber-400/40 bg-amber-400/20 text-amber-300"
      />

      <RailButton
        icon={<Shuffle className="h-5 w-5 sm:h-5.5 sm:w-5.5" />}
        label={shuffle ? t('Aleatorio') : t('En orden')}
        onClick={toggleShuffle}
        ariaLabel={t('Modo aleatorio')}
        pressed={shuffle}
        activeColor="border-primary/40 bg-primary/20 text-primary"
      />

      <TrackMenu
        track={track}
        onComments={onToggleComments}
        onShared={() => setShareBump((n) => n + 1)}
        buttonClassName="h-11 w-11 sm:h-12 sm:w-12 border border-white/12 bg-black/45 text-white backdrop-blur-md hover:bg-black/65 shadow-lg"
        iconClassName="h-5 w-5 sm:h-6 sm:w-6"
      />
    </>
  );

  const titles = (
    <div data-ev-id="ev_short_titles" className="flex min-w-0 flex-col gap-1.5">
      <div
        data-ev-id="ev_short_meta"
        className="flex flex-wrap items-center gap-2 text-xs font-bold"
      >
        {track.artist && (
          <Link
            data-ev-id="ev_short_artist"
            to={`/artista/${track.artist.slug}`}
            className="artist-badge font-extrabold text-white hover:text-primary hover:underline drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] text-sm sm:text-base"
          >
            @{track.artist.name}
          </Link>
        )}
        {track.genre && (
          <span
            data-ev-id="ev_short_genre"
            className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur-md shadow-sm"
          >
            {track.genre}
          </span>
        )}
        <span
          data-ev-id="ev_short_views"
          className="flex items-center gap-1 text-[11px] text-white/70 normal-case tracking-normal drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
        >
          <Eye className="h-3.5 w-3.5" /> {formatCount(track.plays)}
        </span>
      </div>

      <h2
        data-ev-id="ev_short_title"
        className="truncate text-xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] md:text-3xl"
      >
        {track.title}
      </h2>

      {track.genre && (
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          <span>#{track.genre.toLowerCase().replace(/\s+/g, '')}</span>
          <span>#qamuz</span>
          <span>#ai</span>
        </div>
      )}
    </div>
  );

  const controls = (
    <ShortControls
      isCurrent={isCurrent}
      playing={playing}
      fallbackDuration={track.duration_seconds}
      onPlay={handlePlay}
      onPrev={onPrev}
      onNext={onNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
      size={desktop ? 'lg' : 'sm'}
    />
  );

  return (
    <section
      data-ev-id="ev_short_section"
      data-index={index}
      className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-black select-none"
      aria-label={`${track.title} — ${track.artist?.name ?? ''}`}
    >
      {/* Background Media */}
      {canvas && canvasIsVideo && active ? (
        <video
          data-ev-id="ev_short_canvas_v"
          src={canvas}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover z-0"
        />
      ) : (
        <>
          {/* Ambient blurred backdrop: fills screen with cover atmosphere without distortion */}
          <div
            className="absolute -inset-10 overflow-hidden pointer-events-none z-0"
            aria-hidden="true"
          >
            <img
              data-ev-id="ev_short_bg"
              src={cover}
              alt=""
              className="w-full h-full object-cover filter blur-[52px] brightness-[0.22] saturate-[1.4] scale-125"
              draggable={false}
            />
            {/* Radial Darken Overlay */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 40%, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.65) 60%, rgba(0, 0, 0, 0.94) 100%)',
              }}
            />
          </div>
        </>
      )}

      {/* Cinematic media fade gradient */}
      <div
        data-ev-id="ev_short_shade"
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.22) 14%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0.68) 68%, rgba(0,0,0,0.92) 86%, rgba(0,0,0,0.98) 100%)',
        }}
      />

      {desktop ? (
        /* Desktop Stage Layout */
        <div
          data-ev-id="ev_short_desk"
          className="relative z-10 flex h-full items-center justify-center gap-8 px-8 py-20 lg:gap-12 lg:px-12"
        >
          {/* Left panel: Gloss Frame + info + controls */}
          <div
            data-ev-id="ev_short_desk_left"
            className="flex w-[min(46vh,440px)] flex-none flex-col gap-5"
          >
            <div className="flex items-center justify-center">
              <button
                data-ev-id="ev_short_desk_cover"
                type="button"
                onClick={handlePlay}
                aria-label={playing ? t('Pause') : t('Play')}
                className="gloss-frame-stage group relative w-full aspect-square overflow-hidden cursor-pointer active:scale-[0.98] transition-transform text-left"
              >
                <div className="relative w-full h-full rounded-[25px] overflow-hidden bg-[#0d0f12] flex items-center justify-center">
                  <img
                    data-ev-id="ev_short_desk_img"
                    src={cover}
                    width={440}
                    height={440}
                    alt={t('Cover of {title}', { title: track.title })}
                    className={`h-full w-full object-cover transition-transform duration-700 ${
                      playing ? 'scale-105' : 'scale-100'
                    }`}
                  />
                  <div className="gloss-sheen" aria-hidden="true" />
                  {!playing && (
                    <span
                      data-ev-id="ev_short_desk_play"
                      className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
                    >
                      <span
                        data-ev-id="ev_short_desk_playicon"
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur transition-transform group-hover:scale-110 shadow-2xl"
                      >
                        <Play className="h-9 w-9 translate-x-[2px] fill-current" />
                      </span>
                    </span>
                  )}
                </div>
              </button>
            </div>
            {titles}
            {controls}
          </div>

          {/* Lyrics beside the cover */}
          <div
            data-ev-id="ev_short_desk_lyrics"
            className="flex h-[min(72vh,660px)] min-w-0 max-w-[520px] flex-1 flex-col gap-3 rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-2xl"
          >
            <span
              data-ev-id="ev_short_desk_lyr_h"
              className="text-xs font-bold uppercase tracking-widest text-primary"
            >
              {t('Letras sincronizadas')}
            </span>
            <div data-ev-id="ev_short_desk_lyr_body" className="min-h-0 flex-1">
              {isCurrent ? <LyricsView trackId={track.id} variant="stage" align="left" /> : null}
            </div>
          </div>

          {/* Action rail */}
          <div data-ev-id="ev_short_rail_d" className="flex flex-none flex-col items-center gap-4">
            {rail}
          </div>
        </div>
      ) : (
        /* Mobile YouTube Shorts Layout */
        <div className="relative z-10 flex h-full w-full flex-col justify-between">
          {/* Central Square Gloss Frame with emerald-to-wine resplandor */}
          <div className="relative flex-1 flex items-center justify-center pt-[calc(56px+env(safe-area-inset-top))] pb-[calc(230px+env(safe-area-inset-bottom))] px-4 box-border">
            <button
              data-ev-id="ev_short_tap"
              type="button"
              onClick={handlePlay}
              aria-label={playing ? t('Pause') : t('Play')}
              className="gloss-frame-stage group relative w-[min(78vw,330px)] aspect-square max-h-[min(78vw,330px)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            >
              <div className="relative w-full h-full rounded-[25px] overflow-hidden bg-[#0d0f12] flex items-center justify-center">
                <img
                  data-ev-id="ev_short_img_m"
                  src={cover}
                  alt={track.title}
                  className={`w-full h-full object-cover rounded-[25px] transition-transform duration-700 ${
                    playing ? 'scale-105' : 'scale-100'
                  }`}
                />
                <div className="gloss-sheen" aria-hidden="true" />
                {!playing && (
                  <span
                    data-ev-id="ev_short_playicon"
                    className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px]"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur shadow-2xl transition-transform group-hover:scale-110">
                      <Play className="h-8 w-8 translate-x-[2px] fill-current" />
                    </span>
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Vertical Action Rail (Right) */}
          <div
            data-ev-id="ev_short_rail_m"
            className="absolute bottom-[calc(110px+env(safe-area-inset-bottom))] right-2 sm:right-4 z-20 flex flex-col items-center gap-3.5 pointer-events-auto"
          >
            {rail}
          </div>

          {/* Bottom Area: Metadata, Synchronized Lyrics, and Transport Controls */}
          <div
            data-ev-id="ev_short_bottom"
            className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 pr-20 pointer-events-auto"
          >
            {titles}

            {/* Subtitle-style synchronized lyrics box */}
            <div className="relative h-14 overflow-hidden rounded-xl border border-white/5 bg-black/30 px-3 py-1.5 backdrop-blur-md">
              {isCurrent ? (
                <LyricsView trackId={track.id} variant="stage" align="left" />
              ) : (
                <div className="flex h-full items-center text-xs italic text-white/50">
                  {t('Disfruta la música en QAMUZ AI')}
                </div>
              )}
            </div>

            {/* Transport scrubber + controls */}
            {controls}
          </div>
        </div>
      )}

      {sharing && (
        <ShareDialog
          track={track}
          onClose={() => setSharing(false)}
          onShared={() => setShareBump((n) => n + 1)}
        />
      )}

      <PublishModal
        track={track}
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        onUpdated={(updated) => {
          if (updated.title) track.title = updated.title;
          if (updated.genre !== undefined) track.genre = updated.genre;
          if (updated.cover_key) track.cover_key = updated.cover_key;
          if (updated.is_published !== undefined) track.is_published = updated.is_published;
        }}
      />
    </section>
  );
}
