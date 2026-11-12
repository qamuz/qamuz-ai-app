import { ChevronDown, Expand, FileText, Heart, ListMusic, MessageCircle, Mic2, Pause, Play, Repeat, Repeat1, Share2, Shuffle, SkipBack, SkipForward, UploadCloud, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePlayer } from '@/hooks/usePlayer';
import { useLikes } from '@/hooks/useLikes';
import { useAuth } from '@/hooks/useAuth';
import { coverUrl } from '@/lib/covers';
import { formatCount, formatTime } from '@/lib/format';
import { LyricsView } from '@/components/LyricsView';
import { TrackComments } from '@/components/TrackComments';
import { TrackMenu } from '@/components/TrackMenu';
import { ShareDialog } from '@/components/ShareDialog';
import { PublishModal } from '@/components/PublishModal';
import { useI18n } from '@/hooks/useI18n';

export function NowPlaying() {
  const {
    current,
    queue,
    currentIndex,
    isPlaying,
    progress,
    duration,
    shuffle,
    repeat,
    expanded,
    toggle,
    next,
    previous,
    seek,
    toggleShuffle,
    cycleRepeat,
    setExpanded,
    jumpTo,
    nowPlayingTab,
    setNowPlayingTab
  } = usePlayer();
  const { isLiked, toggleLike, likeDelta } = useLikes();
  const { user } = useAuth();
  const tab = nowPlayingTab;
  const setTab = setNowPlayingTab;
  const [sharing, setSharing] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [shareBump, setShareBump] = useState<Record<string, number>>({});
  const { t } = useI18n();
  const navigate = useNavigate();

  // Close side panel with Escape key
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, setExpanded]);

  if (!expanded || !current) return null;

  const total = duration || current.duration_seconds || 0;
  const liked = isLiked(current.id);
  const cover = coverUrl(current.cover_key);
  const canComment = !current.id.startsWith('ai-');
  const activeTab = tab === 'comments' && !canComment ? 'lyrics' : tab;
  const likeCount = Math.max(0, (current.likes_count ?? 0) + likeDelta(current.id));
  const shareCount = (current.shares_count ?? 0) + (shareBump[current.id] ?? 0);
  const actionClass = 'flex h-10 items-center gap-2 rounded-full bg-surface-2/80 px-3.5 text-xs font-semibold tabular-nums transition-colors hover:bg-surface-3';

  return (
    <>
      {/* =========================================================================
           DESKTOP RIGHT-SIDE FLOATING PANEL (lg:flex)
           Opens on the side and leaves the rest of the workspace and floating player intact.
          ========================================================================= */}
      <aside
        data-ev-id="ev_np_side_panel"
        aria-label={t('Now playing')}
        className="fixed top-3 right-3 bottom-4 z-40 hidden w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl shadow-black/70 backdrop-blur-xl animate-in slide-in-from-right duration-300 lg:flex">
        
        {/* Side Panel Header */}
        <div data-ev-id="ev_9e7c6e1a90" className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div data-ev-id="ev_45ba4a55a1" className="flex items-center gap-2">
            <span data-ev-id="ev_2c1e78a32c" className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            <p data-ev-id="ev_f186b5bd8f" className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">
              {t('Now playing')}
            </p>
          </div>
          <button data-ev-id="ev_ad256d3547"
          type="button"
          onClick={() => setExpanded(false)}
          aria-label={t('Close')}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
            
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Side Panel Scrollable Body */}
        <div data-ev-id="ev_8a7ab6b0a9" className="no-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Cover Art */}
          <div data-ev-id="ev_d4bd85be81" className="relative overflow-hidden rounded-xl bg-surface-3 shadow-lg shadow-black/40">
            <img data-ev-id="ev_354c668621"
            src={cover}
            alt={t('Cover of {title}', { title: current.title })}
            width={380}
            height={380}
            className="aspect-square w-full object-cover" />
            
          </div>

          {/* Title & Artist */}
          <div data-ev-id="ev_1ef1be209f" className="flex items-start justify-between gap-2">
            <div data-ev-id="ev_8f77e0b8df" className="min-w-0 flex-1">
              <h2 data-ev-id="ev_ef4e3efc5f" className="truncate text-base font-black text-foreground">{current.title}</h2>
              {current.artist &&
              <p data-ev-id="ev_e98e14503b" className="truncate text-xs text-muted-foreground">{current.artist.name}</p>
              }
            </div>
            {user && canComment &&
            <button data-ev-id="ev_5474a32e0d"
            type="button"
            onClick={() => void toggleLike(current.id)}
            aria-pressed={liked}
            aria-label={liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')}
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-transform active:scale-90 ${
            liked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
            }>
              
                <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              </button>
            }
          </div>

          {/* Progress Bar & Timestamps */}
          <div data-ev-id="ev_60dd569a2e" className="flex flex-col gap-1">
            <input data-ev-id="ev_ac233c3b35"
            type="range"
            min={0}
            max={total || 1}
            step={1}
            value={Math.min(progress, total)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label={t('Progress')}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary" />
            
            <div data-ev-id="ev_5bfad1b2df" className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
              <span data-ev-id="ev_71001448d6">{formatTime(progress)}</span>
              <span data-ev-id="ev_6c8be23ef9">{formatTime(total)}</span>
            </div>
          </div>

          {/* Controls */}
          <div data-ev-id="ev_1c4119e271" className="flex items-center justify-center gap-4 py-0.5">
            <button data-ev-id="ev_15a4b691e7"
            type="button"
            onClick={toggleShuffle}
            aria-label={t('Shuffle')}
            className={`transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              
              <Shuffle className="h-4 w-4" />
            </button>
            <button data-ev-id="ev_0bb9e9fec7"
            type="button"
            onClick={previous}
            aria-label={t('Previous')}
            className="text-foreground transition-colors hover:text-primary">
              
              <SkipBack className="h-5 w-5 fill-current" />
            </button>
            <button data-ev-id="ev_eea41c94c6"
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? t('Pause') : t('Play')}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95">
              
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current" />}
            </button>
            <button data-ev-id="ev_4c0a550304"
            type="button"
            onClick={next}
            aria-label={t('Next')}
            className="text-foreground transition-colors hover:text-primary">
              
              <SkipForward className="h-5 w-5 fill-current" />
            </button>
            <button data-ev-id="ev_f632facf17"
            type="button"
            onClick={cycleRepeat}
            aria-label={t('Repeat')}
            className={`transition-colors ${repeat !== 'off' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              
              {repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>
          </div>

          {/* Actions: Comments, Share, Menu */}
          <div data-ev-id="ev_58ddcd8c67" className="flex items-center justify-center gap-2">
            {canComment &&
            <>
                <button data-ev-id="ev_39cbc9c146"
              type="button"
              onClick={() => setTab('comments')}
              aria-label={t('Comments')}
              className={actionClass}>
                
                  <MessageCircle className="h-3.5 w-3.5" />
                  {formatCount(current.comments_count ?? 0)}
                </button>
                <button data-ev-id="ev_2da4426c92"
              type="button"
              onClick={() => setSharing(true)}
              aria-label={t('Share')}
              className={actionClass}>
                
                  <Share2 className="h-3.5 w-3.5" />
                  {formatCount(shareCount)}
                </button>
              </>
            }
            <button data-ev-id="ev_5fc9351264"
            type="button"
            onClick={() => setPublishModalOpen(true)}
            aria-label={t('Publicar')}
            title={current.is_published ? t('Editar publicación') : t('Publicar canción')}
            className={actionClass}>
              
              <UploadCloud className={`h-3.5 w-3.5 ${current.is_published ? 'text-amber-400' : 'text-primary'}`} />
              {current.is_published ? t('Publicada') : t('Publicar')}
            </button>
            <TrackMenu
              track={current}
              onComments={canComment ? () => setTab('comments') : undefined}
              onShared={() => setShareBump((p) => ({ ...p, [current.id]: (p[current.id] ?? 0) + 1 }))}
              buttonClassName="h-10 w-10 bg-surface-2/80"
              iconClassName="h-4 w-4" />
            
          </div>

          {/* Tabs: Lyrics / Queue / Comments */}
          <div data-ev-id="ev_c2f07aa5bf" className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/60 p-3">
            <div data-ev-id="ev_29db33423d" className="flex items-center gap-1.5 border-b border-border/60 pb-2">
              <button data-ev-id="ev_8f6959fd12"
              type="button"
              onClick={() => setTab('lyrics')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              activeTab === 'lyrics' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`
              }>
                
                <Mic2 className="h-3.5 w-3.5" /> {t('Lyrics')}
              </button>
              <button data-ev-id="ev_b78c92187f"
              type="button"
              onClick={() => setTab('queue')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              activeTab === 'queue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`
              }>
                
                <ListMusic className="h-3.5 w-3.5" /> {t('Queue')}
              </button>
              {canComment &&
              <button data-ev-id="ev_8f885dff54"
              type="button"
              onClick={() => setTab('comments')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              activeTab === 'comments' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`
              }>
                
                  <MessageCircle className="h-3.5 w-3.5" /> {t('Comments')}
                </button>
              }
              {activeTab === 'lyrics' &&
              <button data-ev-id="ev_37b4edc478"
              type="button"
              onClick={() => {
                setExpanded(false);
                navigate(`/karaoke/${current.id}`);
              }}
              title={t('Abrir letras en pantalla completa / TV')}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors">
                
                  <Expand className="h-3 w-3" />
                  <span data-ev-id="ev_979685de78">Pantalla Completa</span>
                </button>
              }
            </div>

            {activeTab === 'comments' ?
            <div data-ev-id="ev_ee8108d788" className="no-scrollbar max-h-60 overflow-y-auto">
                <TrackComments trackId={current.id} />
              </div> :
            activeTab === 'lyrics' ?
            <div data-ev-id="ev_efb5b1f52b" className="no-scrollbar max-h-60 overflow-y-auto">
                <LyricsView trackId={current.id} />
              </div> :

            <div data-ev-id="ev_8641ea162f" className="no-scrollbar flex max-h-60 flex-col gap-1 overflow-y-auto">
                {queue.map((track, i) =>
              <button data-ev-id="ev_dd54d7dc9b"
              key={`${track.id}-${i}`}
              type="button"
              onClick={() => jumpTo(i)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-3 ${
              i === currentIndex ? 'bg-surface-3 font-semibold text-primary' : 'text-foreground'}`
              }>
                
                    <img data-ev-id="ev_0056516e27"
                src={coverUrl(track.cover_key)}
                width={32}
                height={32}
                alt=""
                className="h-8 w-8 flex-none rounded object-cover" />
                
                    <div data-ev-id="ev_b4b14f3ac4" className="min-w-0 flex-1">
                      <p data-ev-id="ev_98ac977b82" className="truncate text-xs">{track.title}</p>
                      <p data-ev-id="ev_b3b35b4f8a" className="truncate text-[10px] text-muted-foreground">{track.artist?.name}</p>
                    </div>
                  </button>
              )}
              </div>
            }
          </div>
        </div>
      </aside>

      {/* =========================================================================
           MOBILE FULL-SCREEN MODAL (lg:hidden)
           Immersive experience for phones and small tablets.
          ========================================================================= */}
      <div data-ev-id="ev_832a724b62" className="fixed inset-0 z-50 overflow-y-auto bg-background lg:hidden">
        <div data-ev-id="ev_b6b92877b7" className="absolute inset-0 opacity-40 blur-3xl" style={{ backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }} aria-hidden="true" />
        <div data-ev-id="ev_adb0ef81a3" className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/90 to-background" aria-hidden="true" />

        <div data-ev-id="ev_4239ca169e" className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-5 md:px-8">
          <div data-ev-id="ev_86fed894a4" className="flex items-center justify-between">
            <button data-ev-id="ev_9b64e7686e" type="button" onClick={() => setExpanded(false)} aria-label={t('Close')} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-surface-3">
              <ChevronDown className="h-5 w-5" />
            </button>
            <p data-ev-id="ev_5a6aa5b6f4" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('Now playing')}</p>
            <div data-ev-id="ev_a48904d9c3" className="h-10 w-10" />
          </div>

          <div data-ev-id="ev_172a2adf1f" className="grid flex-1 gap-8 md:grid-cols-2 md:items-center">
            <div data-ev-id="ev_d53e04083e" className="flex flex-col gap-6">
              <img data-ev-id="ev_4eef6e8cdb" src={cover} width={520} height={520} alt={t('Cover of {title}', { title: current.title })} className="mx-auto aspect-square w-full max-w-sm rounded-2xl object-cover shadow-2xl shadow-black/60" />
              <div data-ev-id="ev_fb6c26d17d" className="flex flex-col gap-1 text-center md:text-left">
                <h1 data-ev-id="ev_b90d2f2919" className="text-3xl font-black tracking-tight text-balance text-foreground">{current.title}</h1>
                <p data-ev-id="ev_806f33b2a5" className="text-sm text-muted-foreground">{current.artist?.name}</p>
              </div>

              <div data-ev-id="ev_db994215eb" className="flex flex-col gap-2">
                <input data-ev-id="ev_f833a369ff" type="range" min={0} max={total || 1} step={1} value={Math.min(progress, total)} onChange={(e) => seek(Number(e.target.value))} aria-label={t('Progress')} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary" />
                <div data-ev-id="ev_68214e283d" className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
                  <span data-ev-id="ev_08ec276675">{formatTime(progress)}</span>
                  <span data-ev-id="ev_88854a7315">{formatTime(total)}</span>
                </div>
              </div>

              <div data-ev-id="ev_41faa4a9d0" className="flex items-center justify-center gap-6">
                <button data-ev-id="ev_c8eff40da2" type="button" onClick={toggleShuffle} aria-label={t('Shuffle')} className={shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>
                  <Shuffle className="h-5 w-5" />
                </button>
                <button data-ev-id="ev_0fb42ae5d5" type="button" onClick={previous} aria-label={t('Previous')} className="text-foreground">
                  <SkipBack className="h-7 w-7 fill-current" />
                </button>
                <button data-ev-id="ev_24a86b505f" type="button" onClick={toggle} aria-label={isPlaying ? t('Pause') : t('Play')} className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105">
                  {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 translate-x-[2px] fill-current" />}
                </button>
                <button data-ev-id="ev_a424a12977" type="button" onClick={next} aria-label={t('Next')} className="text-foreground">
                  <SkipForward className="h-7 w-7 fill-current" />
                </button>
                <button data-ev-id="ev_4740f14bd8" type="button" onClick={cycleRepeat} aria-label={t('Repeat')} className={repeat !== 'off' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>
                  {repeat === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                </button>
              </div>

              <div data-ev-id="ev_0e614631f2" className="flex flex-wrap items-center justify-center gap-2">
                {user && canComment &&
                <button data-ev-id="ev_a82511b7b2" type="button" onClick={() => void toggleLike(current.id)} aria-pressed={liked} aria-label={liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')} className={`flex h-11 items-center gap-2 rounded-full bg-surface-2/80 px-4 text-sm font-semibold tabular-nums transition-colors hover:bg-surface-3 ${liked ? 'text-primary' : 'text-foreground'}`}>
                    <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
                    {formatCount(likeCount)}
                  </button>
                }
                {canComment &&
                <>
                    <button data-ev-id="ev_np_comments" type="button" onClick={() => setTab('comments')} aria-label={t('Comments')} className="flex h-11 items-center gap-2 rounded-full bg-surface-2/80 px-4 text-sm font-semibold tabular-nums transition-colors hover:bg-surface-3">
                      <MessageCircle className="h-4 w-4" />
                      {formatCount(current.comments_count ?? 0)}
                    </button>
                    <button data-ev-id="ev_np_share" type="button" onClick={() => setSharing(true)} aria-label={t('Share')} className="flex h-11 items-center gap-2 rounded-full bg-surface-2/80 px-4 text-sm font-semibold tabular-nums transition-colors hover:bg-surface-3">
                      <Share2 className="h-4 w-4" />
                      {formatCount(shareCount)}
                    </button>
                  </>
                }
                <button data-ev-id="ev_bf82b5409e"
                type="button"
                onClick={() => setPublishModalOpen(true)}
                aria-label={t('Publicar')}
                title={current.is_published ? t('Editar publicación') : t('Publicar canción')}
                className="flex h-11 items-center gap-2 rounded-full bg-surface-2/80 px-4 text-sm font-semibold tabular-nums transition-colors hover:bg-surface-3">
                  
                  <UploadCloud className={`h-4 w-4 ${current.is_published ? 'text-amber-400' : 'text-primary'}`} />
                  {current.is_published ? t('Publicada') : t('Publicar')}
                </button>
                <TrackMenu track={current} onComments={canComment ? () => setTab('comments') : undefined} onShared={() => setShareBump((p) => ({ ...p, [current.id]: (p[current.id] ?? 0) + 1 }))} buttonClassName="h-11 w-11 bg-surface-2/80" iconClassName="h-5 w-5" />
              </div>
            </div>

            <div data-ev-id="ev_c38a170b87" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur">
              <div data-ev-id="ev_d7ad58a0dc" className="flex gap-2">
                <button data-ev-id="ev_c589f17f41" type="button" onClick={() => setTab('lyrics')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'lyrics' ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}>
                  <FileText className="h-4 w-4" /> {t('Lyrics')}
                </button>
                <button data-ev-id="ev_a1217ec3f7" type="button" onClick={() => setTab('queue')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'queue' ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}>
                  <ListMusic className="h-4 w-4" /> {t('Queue')}
                </button>
                {canComment &&
                <button data-ev-id="ev_q_comtab1" type="button" onClick={() => setTab('comments')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'comments' ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}>
                    <MessageCircle className="h-4 w-4" /> {t('Comments')}
                  </button>
                }
              </div>

              {activeTab === 'comments' ?
              <TrackComments trackId={current.id} /> :
              activeTab === 'lyrics' ?
              <LyricsView trackId={current.id} /> :

              <div data-ev-id="ev_e565c30f03" className="no-scrollbar flex max-h-[55vh] flex-col gap-1 overflow-y-auto">
                  {queue.map((track, i) =>
                <button data-ev-id="ev_ecd872e485" key={`${track.id}-${i}`} type="button" onClick={() => jumpTo(i)} className={`flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-2 ${i === currentIndex ? 'bg-surface-2' : ''}`}>
                      <img data-ev-id="ev_cddb32542e" src={coverUrl(track.cover_key)} width={36} height={36} alt="" className="h-9 w-9 rounded object-cover" />
                      <span data-ev-id="ev_bb100513be" className="flex min-w-0 flex-col">
                        <span data-ev-id="ev_aa1451a68b" className={`truncate text-sm ${i === currentIndex ? 'text-primary' : 'text-foreground'}`}>{track.title}</span>
                        <span data-ev-id="ev_b6837a5711" className="truncate text-xs text-muted-foreground">{track.artist?.name}</span>
                      </span>
                    </button>
                )}
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      {sharing && <ShareDialog track={current} onClose={() => setSharing(false)} onShared={() => setShareBump((p) => ({ ...p, [current.id]: (p[current.id] ?? 0) + 1 }))} />}

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
      
    </>);

}