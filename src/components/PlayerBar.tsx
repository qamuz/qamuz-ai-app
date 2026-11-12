import { ChevronUp, FileText, Heart, ListMusic, ListOrdered, PanelRight, Pause, Play, Repeat, Repeat1, Share2, Shuffle, SkipBack, SkipForward, UploadCloud, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePlayer } from '@/hooks/usePlayer';
import { useLikes } from '@/hooks/useLikes';
import { useAuth } from '@/hooks/useAuth';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { TrackMenu } from '@/components/TrackMenu';
import { ShareDialog } from '@/components/ShareDialog';
import { PublishModal } from '@/components/PublishModal';
import { useI18n } from '@/hooks/useI18n';

export function PlayerBar() {
  const {
    current,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    sequential,
    repeat,
    expanded,
    nowPlayingTab,
    isSidePanelVisible,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    toggleSequential,
    cycleRepeat,
    setExpanded,
    setNowPlayingTab
  } = usePlayer();
  const { isLiked, toggleLike } = useLikes();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  if (!current) return null;

  const total = duration || current.duration_seconds || 0;
  const liked = isLiked(current.id);
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  function handleQueueToggle() {
    if (expanded && nowPlayingTab === 'queue') {
      setExpanded(false);
    } else {
      setNowPlayingTab('queue');
      setExpanded(true);
    }
  }

  const heartBtn =
  <button
    data-ev-id="ev_2a9c5ee841"
    type="button"
    onClick={() => void toggleLike(current.id)}
    aria-label={liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')}
    title={liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')}
    aria-pressed={liked}
    className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-transform active:scale-125 ${
    liked ? 'text-primary' : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`
    }>
    
      <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
    </button>;


  return (
    <footer
      data-ev-id="ev_425ae53995"
      className={`fixed z-40 rounded-2xl border border-border/80 bg-surface/95 shadow-2xl shadow-black/70 backdrop-blur-xl transition-[left,right,transform] duration-300 ease-in-out
        bottom-[64px] left-2 right-2
        sm:left-4 sm:right-4
        lg:bottom-4 lg:left-[280px]
        ${isSidePanelVisible ? 'lg:right-[404px]' : 'lg:right-4 xl:right-6'}
      `}>
      
      <div data-ev-id="ev_334a533174" className="flex flex-col gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5">
        <div data-ev-id="ev_835669a93d" className="grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)_minmax(0,1.5fr)]">
          {/* Track info */}
          <div data-ev-id="ev_34cf21aa7f" className="flex min-w-0 items-center gap-3">
            <button
              data-ev-id="ev_ccef218dc0"
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? t('Close Now Playing') : t('Open Now Playing')}
              className="group/cover relative flex-none">
              
              <img
                data-ev-id="ev_83da392df8"
                src={coverUrl(current.cover_key)}
                width={56}
                height={56}
                alt=""
                className="h-11 w-11 rounded-lg object-cover shadow-sm sm:h-12 sm:w-12 md:h-13 md:w-13" />
              
              <span data-ev-id="ev_08fb4fb10f" className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover/cover:opacity-100">
                <ChevronUp className="h-5 w-5 text-foreground" />
              </span>
            </button>
            <div data-ev-id="ev_5ffc68d6e5" className="flex min-w-0 flex-col">
              <button
                data-ev-id="ev_37fca2849b"
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="truncate text-left text-sm font-semibold text-foreground transition-colors hover:text-primary">
                
                {current.title}
              </button>
              {current.artist &&
              <Link
                data-ev-id="ev_c10e047bcb"
                to={`/artista/${current.artist.slug}`}
                className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline">
                
                  {current.artist.name}
                </Link>
              }
            </div>
          </div>

          {/* Center Playback Controls */}
          <div data-ev-id="ev_e16bc9acf1" className="flex flex-col items-center gap-1">
            <div data-ev-id="ev_e0a8c48299" className="flex items-center gap-2 md:gap-3 lg:gap-4">
              <span data-ev-id="ev_pb_heart_m" className="md:hidden">{heartBtn}</span>
              <button
                data-ev-id="ev_50f1d16bf0"
                type="button"
                onClick={toggleShuffle}
                aria-label={t('Shuffle')}
                title={shuffle ? `${t('Shuffle')} (${t('Activado')})` : t('Shuffle')}
                className={`hidden md:block transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                
                <Shuffle className="h-4 w-4" />
              </button>
              <button
                data-ev-id="ev_1fea829617"
                type="button"
                onClick={previous}
                aria-label={t('Previous')}
                className="text-muted-foreground transition-colors hover:text-foreground">
                
                <SkipBack className="h-5 w-5 fill-current" />
              </button>
              <button
                data-ev-id="ev_ccc0b95b91"
                type="button"
                onClick={toggle}
                aria-label={isPlaying ? t('Pause') : t('Play')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95">
                
                {isPlaying ?
                <Pause className="h-5 w-5 fill-current" /> :

                <Play className="h-5 w-5 translate-x-[1px] fill-current" />
                }
              </button>
              <button
                data-ev-id="ev_7fd4a9d707"
                type="button"
                onClick={next}
                aria-label={t('Next')}
                className="text-muted-foreground transition-colors hover:text-foreground">
                
                <SkipForward className="h-5 w-5 fill-current" />
              </button>
              <button
                data-ev-id="ev_b90066a194"
                type="button"
                onClick={cycleRepeat}
                aria-label={t('Repeat')}
                title={repeat === 'one' ? t('Repeat one') : repeat === 'all' ? t('Repeat all') : t('Repeat off')}
                className={`hidden md:block transition-colors ${repeat !== 'off' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                
                {repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>
              <button data-ev-id="ev_ef744fff4f"
              type="button"
              onClick={() => setSharing(true)}
              aria-label={t('Share')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground md:hidden">
                
                <Share2 className="h-4 w-4" />
              </button>
              <button data-ev-id="ev_edf80e0a02"
              type="button"
              onClick={() => setPublishModalOpen(true)}
              aria-label={current.is_published ? t('Publicada') : t('Publicar')}
              title={current.is_published ? t('Editar publicación') : t('Publicar')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-primary md:hidden">
                
                <UploadCloud className={`h-4 w-4 ${current.is_published ? 'text-amber-400' : 'text-primary'}`} />
              </button>
              <button data-ev-id="ev_729ae34990"
              type="button"
              onClick={handleQueueToggle}
              aria-label={t('Queue')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground md:hidden">
                
                <ListMusic className="h-4 w-4" />
              </button>
              <span data-ev-id="ev_pb_menu_m" className="md:hidden">
                <TrackMenu track={current} onComments={() => {setNowPlayingTab('comments');setExpanded(true);}} />
              </span>
            </div>

            {/* Desktop progress bar */}
            <div data-ev-id="ev_7ba5bfb114" className="hidden w-full items-center gap-2 md:flex">
              <span data-ev-id="ev_17153d2e1c" className="w-9 text-right text-[10px] tabular-nums text-muted-foreground">
                {formatTime(progress)}
              </span>
              <input
                data-ev-id="ev_3295204275"
                type="range"
                min={0}
                max={total || 1}
                step={1}
                value={Math.min(progress, total)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label={t('Progress')}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary" />
              
              <span data-ev-id="ev_c282d04e3c" className="w-9 text-[10px] tabular-nums text-muted-foreground">
                {formatTime(total)}
              </span>
            </div>
          </div>

          {/* Right Action Buttons + Volume */}
          <div data-ev-id="ev_7e3397dded" className="hidden items-center justify-end gap-1 md:flex">
            {/* 1. Botón Corazón de Me Gusta */}
            {heartBtn}

            {/* 2. Botón Compartir */}
            <button
              data-ev-id="ev_pb_share"
              type="button"
              onClick={() => setSharing(true)}
              aria-label={t('Share')}
              title={t('Share')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
              
              <Share2 className="h-4 w-4" />
            </button>

            {/* 2b. Botón Modo Letras Sincronizadas */}
            <button data-ev-id="ev_b30d8d51c7"
            type="button"
            onClick={() => navigate(`/karaoke/${current.id}`)}
            aria-label={t('Letras sincronizadas')}
            title={t('Letras sincronizadas (Pantalla Completa / TV)')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-cyan-500/15 hover:text-cyan-400">
              
              <FileText className="h-4 w-4" />
            </button>

            {/* 2c. Botón Publicar canción (Abre ventana flotante de publicación) */}
            <button
              data-ev-id="ev_pb_publish"
              type="button"
              onClick={() => setPublishModalOpen(true)}
              aria-label={current.is_published ? t('Publicada') : t('Publicar')}
              title={
              current.is_published ?
              t('Editar publicación (Canción ya publicada en el feed)') :
              t('Publicar canción en el feed')
              }
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              current.is_published ?
              'text-amber-400 hover:bg-amber-400/15' :
              'text-muted-foreground hover:bg-primary/15 hover:text-primary'}`
              }>
              
              <UploadCloud className="h-4 w-4" />
            </button>

            {/* 3. Botón de Cola (Queue) */}
            <button data-ev-id="ev_09d393c8da"
            type="button"
            onClick={handleQueueToggle}
            aria-label={t('Queue')}
            title={t('Queue')}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            expanded && nowPlayingTab === 'queue' ?
            'bg-primary/20 text-primary' :
            'text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`
            }>
              
              <ListMusic className="h-4 w-4" />
            </button>

            {/* 4. Botón de Reproducción Secuencial */}
            <button data-ev-id="ev_e64a56c911"
            type="button"
            onClick={toggleSequential}
            aria-label={sequential ? 'Reproducción secuencial activada' : 'Reproducción secuencial desactivada'}
            title={sequential ? 'Reproducción secuencial (Activada)' : 'Reproducción secuencial (Desactivada)'}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            sequential ?
            'bg-primary/20 text-primary' :
            'text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`
            }>
              
              <ListOrdered className="h-4 w-4" />
            </button>

            {/* 5. Menú contextual ⋯ */}
            <TrackMenu track={current} onComments={() => {setNowPlayingTab('comments');setExpanded(true);}} />

            {/* 6. Toggle Panel Lateral NowPlaying */}
            <button data-ev-id="ev_e7100f277c"
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? t('Close Now Playing') : t('Open Now Playing')}
            title={expanded ? t('Close Now Playing') : t('Open Now Playing')}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            expanded ?
            'bg-primary/20 text-primary' :
            'text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`
            }>
              
              <PanelRight className="h-4 w-4" />
            </button>

            {/* 7. Control de Volumen */}
            <VolumeIcon className="ml-1 h-4 w-4 flex-none text-muted-foreground" />
            <input
              data-ev-id="ev_7bac90f216"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label={t('Volume')}
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary xl:w-20" />
            
          </div>
        </div>

        {/* Mobile progress */}
        <input
          data-ev-id="ev_f049f58980"
          type="range"
          min={0}
          max={total || 1}
          step={1}
          value={Math.min(progress, total)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t('Progress')}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary md:hidden" />
        
      </div>

      {sharing && <ShareDialog track={current} onClose={() => setSharing(false)} />}

      <PublishModal
        track={current}
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        onUpdated={(updated) => {
          if (updated.title) current.title = updated.title;
          if (updated.genre !== undefined) current.genre = updated.genre;
          if (updated.cover_key) current.cover_key = updated.cover_key;
          if (updated.is_published !== undefined) current.is_published = updated.is_published;
        }} />
      
    </footer>);

}