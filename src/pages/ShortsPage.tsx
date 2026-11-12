import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, ChevronDown, ChevronUp, X } from 'lucide-react';
import { ShortCard } from '@/components/shorts/ShortCard';
import { TrackComments } from '@/components/TrackComments';
import { QamuzMark } from '@/components/QamuzMark';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { useMediaQuery } from '@/hooks/use-media-query';
import { fetchTrack, fetchTrending } from '@/lib/queries';
import type { TrackWithArtist } from '@/types/music';

export default function ShortsPage() {
  const [params] = useSearchParams();
  const startId = params.get('t');
  const { playFrom, current, toggle } = usePlayer();
  const { t } = useI18n();
  const desktop = useMediaQuery('(min-width: 768px)');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shorts, setShorts] = useState<TrackWithArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void Promise.all([fetchTrending(40), startId ? fetchTrack(startId) : Promise.resolve(null)]).then(([list, first]) => {
      if (!alive) return;
      setShorts(first ? [first, ...list.filter((s) => s.id !== first.id)] : list);
      setActive(0);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [startId]);

  // Which short is on screen.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || shorts.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.65 }
    );
    root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [shorts, desktop]);

  const playActive = useCallback(() => {
    const track = shorts[active];
    if (track) playFrom(shorts, active, track.short_start_seconds ?? 0);
  }, [shorts, active, playFrom]);

  // Play the short on screen.
  useEffect(() => {
    if (!loading) playActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loading, shorts]);

  const scrollTo = useCallback((index: number) => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // When a song ends and the player moves on, follow it in the feed.
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    const idx = shorts.findIndex((s) => s.id === currentId);
    if (idx >= 0 && idx !== active) scrollTo(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) || target.isContentEditable)) {
        if (e.key !== 'Escape' && target.tagName !== 'BUTTON') return;
        if (target.tagName === 'BUTTON' && e.key === ' ') return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollTo(Math.min(shorts.length - 1, active + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollTo(Math.max(0, active - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape') {
        setCommentsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, shorts.length, scrollTo, toggle]);

  const activeTrack = shorts[active] ?? null;

  const header = (
    <header
      data-ev-id="ev_shorts_header"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="flex items-center gap-3">
        <Link
          data-ev-id="ev_shorts_back"
          to="/"
          aria-label={t('Back to home')}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-foreground backdrop-blur-md transition-colors hover:bg-black/60 shadow-lg active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span
          data-ev-id="ev_shorts_brand"
          className="flex items-center gap-2 text-lg font-black tracking-tight drop-shadow-[0_1px_6px_#000000cc]"
        >
          <QamuzMark className="h-5 w-5 text-primary" />
          <h1 data-ev-id="ev_shorts_h1">{t('Shorts')}</h1>
        </span>
      </div>

      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-3 py-1 backdrop-blur-md shadow-lg">
        <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)] animate-pulse" />
        <span className="text-[10px] font-extrabold tracking-widest text-white/90">NOW PLAYING</span>
      </div>
    </header>
  );


  if (loading) {
    return (
      <div data-ev-id="ev_shorts_loading" className="fixed inset-0 z-40 bg-black">
        {header}
        <div data-ev-id="ev_shorts_skel" className="h-full w-full animate-pulse bg-surface" />
      </div>);

  }

  if (shorts.length === 0) {
    return (
      <div data-ev-id="ev_shorts_emptywrap" className="fixed inset-0 z-40 flex items-center justify-center bg-black px-6">
        {header}
        <p data-ev-id="ev_shorts_empty" className="text-center text-sm text-muted-foreground">{t('No Shorts yet. Published songs will show up here.')}</p>
      </div>);

  }

  const commentsHead = activeTrack &&
  <div data-ev-id="ev_shorts_cm_head" className="flex items-center justify-between gap-3">
      <div data-ev-id="ev_shorts_cm_titles" className="flex min-w-0 flex-col">
        <h2 data-ev-id="ev_shorts_cm_h" className="text-lg font-bold">{t('Comments')}</h2>
        <p data-ev-id="ev_shorts_cm_track" className="truncate text-xs text-muted-foreground">{activeTrack.title}</p>
      </div>
      <button data-ev-id="ev_shorts_cm_close" type="button" onClick={() => setCommentsOpen(false)} aria-label={t('Close')} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground">
        <X className="h-5 w-5" />
      </button>
    </div>;


  return (
    <div data-ev-id="ev_shorts_page" className="fixed inset-0 z-40 flex bg-black text-foreground">
      <div data-ev-id="ev_shorts_main" className="relative min-w-0 flex-1">
        {header}
        <div data-ev-id="ev_shorts_feed" ref={containerRef} className="no-scrollbar h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain">
          {shorts.map((track, i) =>
          <ShortCard
            key={track.id}
            track={track}
            index={i}
            active={i === active}
            desktop={desktop}
            commentsOpen={commentsOpen}
            hasPrev={i > 0}
            hasNext={i < shorts.length - 1}
            onActivate={() => i === active ? playActive() : scrollTo(i)}
            onToggleComments={() => setCommentsOpen((o) => !o)}
            onPrev={() => scrollTo(Math.max(0, i - 1))}
            onNext={() => scrollTo(Math.min(shorts.length - 1, i + 1))} />

          )}
        </div>

        <div data-ev-id="ev_shorts_nav" className="absolute right-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 xl:flex">
          <button data-ev-id="ev_shorts_prev" type="button" onClick={() => scrollTo(Math.max(0, active - 1))} disabled={active === 0} aria-label={t('Previous short')} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-foreground backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-30">
            <ChevronUp className="h-6 w-6" />
          </button>
          <button data-ev-id="ev_shorts_next" type="button" onClick={() => scrollTo(Math.min(shorts.length - 1, active + 1))} disabled={active === shorts.length - 1} aria-label={t('Next short')} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-foreground backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-30">
            <ChevronDown className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Desktop: comments panel that slides open beside the feed */}
      {desktop &&
      <aside data-ev-id="ev_shorts_cm_side" aria-label={t('Comments')} aria-hidden={!commentsOpen} className={`flex-none overflow-hidden border-white/10 bg-surface transition-[width] duration-300 ease-out ${commentsOpen ? 'w-[400px] border-l' : 'w-0'}`}>
          <div data-ev-id="ev_shorts_cm_side_in" className="flex h-full w-[400px] flex-col gap-4 p-5 pt-6">
            {commentsOpen && activeTrack &&
          <>
                {commentsHead}
                <TrackComments key={activeTrack.id} trackId={activeTrack.id} fill />
              </>
          }
          </div>
        </aside>
      }

      {/* Mobile: bottom sheet */}
      {!desktop &&
      <>
          <div data-ev-id="ev_shorts_cm_backdrop" aria-hidden="true" onClick={() => setCommentsOpen(false)} className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${commentsOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
          <aside data-ev-id="ev_shorts_cm_sheet" role="dialog" aria-modal="true" aria-label={t('Comments')} aria-hidden={!commentsOpen} className={`fixed inset-x-0 bottom-0 z-50 flex h-[70dvh] flex-col gap-4 rounded-t-3xl border-t border-white/10 bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out ${commentsOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <span data-ev-id="ev_shorts_cm_grip" aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-full bg-foreground/20" />
            {commentsOpen && activeTrack &&
          <>
                {commentsHead}
                <TrackComments key={activeTrack.id} trackId={activeTrack.id} fill />
              </>
          }
          </aside>
        </>
      }
    </div>);

}
