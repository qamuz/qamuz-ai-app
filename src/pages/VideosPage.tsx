import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Film, Loader2, Play, Search, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { ModuleDisabled } from '@/components/ModuleDisabled';
import { VideoTheater } from '@/components/videos/VideoTheater';
import { useModules } from '@/hooks/useModules';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { fetchMusicVideos, type MusicVideo } from '@/lib/videos';

function VideoCard({ video, onOpen }: {video: MusicVideo;onOpen: () => void;}) {
  const { t } = useI18n();
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <li data-ev-id="ev_c76839f334">
			<button data-ev-id="ev_a5d5fa6567"
      type="button"
      onClick={onOpen}
      onMouseEnter={() => void ref.current?.play().catch(() => undefined)}
      onMouseLeave={() => {
        const v = ref.current;
        if (!v) return;
        v.pause();
        v.currentTime = 0;
      }}
      aria-label={t('Watch {title}', { title: video.title })}
      className="group flex w-full flex-col gap-2 text-left">
        
				<span data-ev-id="ev_3dddb88687" className="relative block aspect-video overflow-hidden rounded-xl bg-surface-2">
					<video data-ev-id="ev_9b614674ef" ref={ref} src={video.video_url} poster={video.cover_url ? coverUrl(video.cover_url) : undefined} muted loop playsInline preload="metadata" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
					<span data-ev-id="ev_b7d5fc3523" className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
						<span data-ev-id="ev_67eb9f6c3f" className="flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-xl transition-all group-hover:scale-100 group-hover:opacity-100">
							<Play className="h-5 w-5 translate-x-[1px] fill-current" />
						</span>
					</span>
					{video.duration_seconds > 0 && <span data-ev-id="ev_77a00babf7" className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">{formatTime(video.duration_seconds)}</span>}
				</span>
				<span data-ev-id="ev_898911e636" className="flex flex-col px-0.5">
					<span data-ev-id="ev_e299f0c7e8" className="truncate text-sm font-semibold text-foreground">{video.title}</span>
					<span data-ev-id="ev_efec6ebba2" className="truncate text-xs text-muted-foreground">{video.artist?.name ?? 'Qamuz AI'}</span>
				</span>
			</button>
		</li>);

}

function VideoGallery() {
  const { t } = useI18n();
  const [videos, setVideos] = useState<MusicVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [params, setParams] = useSearchParams();
  const openId = params.get('v');

  useEffect(() => {
    let alive = true;
    void fetchMusicVideos().then((list) => {
      if (!alive) return;
      setVideos(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const close = useCallback(() => setParams({}, { replace: true }), [setParams]);
  const query = q.trim().toLowerCase();
  const visible = query ? videos.filter((v) => `${v.title} ${v.artist?.name ?? ''}`.toLowerCase().includes(query)) : videos;
  const open = videos.find((v) => v.id === openId) ?? null;

  return (
    <div data-ev-id="ev_2f1fb81224" className="flex flex-col gap-6 p-4 sm:p-6">
			<header data-ev-id="ev_a8e14d0548" className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div data-ev-id="ev_f1d2a15837" className="flex items-center gap-3">
					<span data-ev-id="ev_531eb4631b" className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
						<Film className="h-5 w-5" />
					</span>
					<div data-ev-id="ev_a8f52f6bd6" className="flex flex-col">
						<h1 data-ev-id="ev_4febbf3c68" className="text-2xl font-black tracking-tight text-balance">{t('Music videos')}</h1>
						<p data-ev-id="ev_38ed61e0e6" className="text-sm text-pretty text-muted-foreground">{t('Videos made by Qamuz AI artists, set to their songs.')}</p>
					</div>
				</div>
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
					<label data-ev-id="ev_fd0555da65" className="flex h-10 w-full items-center gap-2 rounded-lg bg-surface-2 px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-primary/50 sm:w-72">
						<Search className="h-4 w-4 flex-none" />
						<input data-ev-id="ev_27fd1535ff" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search videos or artists')} aria-label={t('Search videos or artists')} className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
					</label>
					<Link
						to="/estudio?kind=video"
						className="flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 px-4 text-xs font-bold text-black shadow-lg shadow-cyan-500/20 transition-all flex-none"
					>
						<Sparkles className="h-4 w-4" />
						{t('Crear Video')}
					</Link>
				</div>
			</header>

			{loading ?
      <div data-ev-id="ev_1ab10bda12" className="flex justify-center py-16 text-muted-foreground">
					<Loader2 className="h-6 w-6 animate-spin" />
				</div> :
      visible.length === 0 ?
      <div data-ev-id="ev_4a2437b6ac" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center">
					<Film className="h-7 w-7 text-muted-foreground" />
					<p data-ev-id="ev_445a04d0e8" className="text-sm font-semibold">{query ? t('No videos match your search') : t('No music videos yet')}</p>
					{!query && <p data-ev-id="ev_a316b784aa" className="max-w-sm text-xs text-pretty text-muted-foreground">{t('Create a video from any song in AI Studio and publish it here.')}</p>}
				</div> :

      <ul data-ev-id="ev_28e7dcaae1" className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
					{visible.map((v) =>
        <VideoCard key={v.id} video={v} onOpen={() => setParams({ v: v.id })} />
        )}
				</ul>
      }

			{open &&
      <VideoTheater
        video={open}
        onClose={close}
        onRemoved={(id) => {
          setVideos((list) => list.filter((v) => v.id !== id));
          close();
        }} />

      }
		</div>);

}

export default function VideosPage() {
  const { isEnabled } = useModules();
  const { t } = useI18n();

  useEffect(() => {
    const previous = document.title;
    document.title = `${t('Music videos')} · Qamuz AI`;
    return () => {
      document.title = previous;
    };
  }, [t]);

  return <AppLayout>{isEnabled('videos') ? <VideoGallery /> : <ModuleDisabled name={t('Music videos')} />}</AppLayout>;
}