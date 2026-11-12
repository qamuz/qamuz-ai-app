import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { usePaged, matchesQuery } from '@/hooks/usePaged';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { fetchMusicVideos, type MusicVideo } from '@/lib/videos';
import { EmptyNote, MoreButton } from '@/components/home/MoreButton';

const PAGE = 12;

/** QV: music videos that creators made public. */
export function QvSection({ query }: { query: string }) {
	const { t } = useI18n();
	const [videos, setVideos] = useState<MusicVideo[]>([]);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		void fetchMusicVideos().then((list) => {
			setVideos(list);
			setLoaded(true);
		});
	}, []);

	const filtered = useMemo(() => videos.filter((v) => matchesQuery(query, v.title, v.artist?.name)), [videos, query]);
	const { shown, hasMore, more } = usePaged(filtered, PAGE, query);

	if (!loaded) return null;
	if (filtered.length === 0) return <EmptyNote searching={Boolean(query.trim())} text={t('No public videos yet.')} />;

	return (
		<div data-ev-id="ev_qv_root" className="flex flex-col gap-6">
			<div data-ev-id="ev_qv_grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{shown.map((v) => (
					<Link data-ev-id="ev_qv_card" key={v.id} to={`/videos?v=${v.id}`} className="group flex flex-col gap-2">
						<div data-ev-id="ev_qv_thumb" className="relative overflow-hidden rounded-xl border border-border bg-surface">
							<img data-ev-id="ev_qv_img" src={coverUrl(v.cover_url)} width={480} height={270} loading="lazy" alt={t('Cover of {title}', { title: v.title })} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" />
							<span data-ev-id="ev_qv_play" className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
								<span data-ev-id="ev_qv_play_b" className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Play className="h-5 w-5 fill-current" /></span>
							</span>
							{v.duration_seconds > 0 && <span data-ev-id="ev_qv_dur" className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">{formatTime(v.duration_seconds)}</span>}
						</div>
						<span data-ev-id="ev_qv_text" className="flex min-w-0 flex-col">
							<span data-ev-id="ev_qv_title" className="truncate text-sm font-bold">{v.title}</span>
							{v.artist && <span data-ev-id="ev_qv_artist" className="truncate text-xs text-muted-foreground">{v.artist.name}</span>}
						</span>
					</Link>
				))}
			</div>
			{hasMore && <MoreButton onClick={more} />}
		</div>
	);
}
