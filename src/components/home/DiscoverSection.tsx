import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { TrendingUp } from 'lucide-react';
import { MediaCard } from '@/components/MediaCard';
import { useI18n } from '@/hooks/useI18n';
import { usePlayer } from '@/hooks/usePlayer';
import { usePaged, matchesQuery } from '@/hooks/usePaged';
import { formatCount } from '@/lib/format';
import { fetchLastfmTopTags, type LastfmTag } from '@/lib/lastfm';
import { fetchNewReleases } from '@/lib/queries';
import type { TrackWithArtist } from '@/types/music';
import { EmptyNote, MoreButton } from '@/components/home/MoreButton';

const PAGE = 18;

/** Discover: global trends (top styles worldwide) on top, then the newest published songs. */
export function DiscoverSection({ query }: { query: string }) {
	const { t } = useI18n();
	const { playTracks } = usePlayer();
	const [tags, setTags] = useState<LastfmTag[]>([]);
	const [tracks, setTracks] = useState<TrackWithArtist[]>([]);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		void fetchLastfmTopTags(30).then((list) => setTags(list.slice(0, 12)));
		void fetchNewReleases(300).then((list) => {
			setTracks(list);
			setLoaded(true);
		});
	}, []);

	const filtered = useMemo(() => tracks.filter((x) => matchesQuery(query, x.title, x.artist?.name, x.genre)), [tracks, query]);
	const { shown, hasMore, more } = usePaged(filtered, PAGE, query);

	return (
		<div data-ev-id="ev_dc_root" className="flex flex-col gap-8">
			{tags.length > 0 && !query.trim() && (
				<section data-ev-id="ev_gt_root" className="flex flex-col gap-3">
					<div data-ev-id="ev_gt_head" className="flex items-end justify-between gap-4">
						<h2 data-ev-id="ev_gt_title" className="text-lg font-bold tracking-tight">{t('Global trends')}</h2>
						<Link data-ev-id="ev_gt_all" to="/trending?source=global" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">{t('See all')}</Link>
					</div>
					<ol data-ev-id="ev_gt_list" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
						{tags.map((tag, i) => (
							<li data-ev-id="ev_gt_item" key={tag.name}>
								<Link data-ev-id="ev_gt_link" to={`/trending?source=global&tag=${encodeURIComponent(tag.name)}`} className="flex h-full items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary/50 hover:bg-surface-2">
									<span data-ev-id="ev_gt_rank" className="w-6 flex-none text-lg font-black tabular-nums text-primary">{i + 1}</span>
									<span data-ev-id="ev_gt_text" className="flex min-w-0 flex-col">
										<span data-ev-id="ev_gt_name" className="truncate text-sm font-bold capitalize">{tag.name}</span>
										<span data-ev-id="ev_gt_reach" className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
											<TrendingUp className="h-3 w-3" /> {t('{count} listeners', { count: formatCount(tag.reach) })}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ol>
				</section>
			)}

			<section data-ev-id="ev_dc_songs" className="flex flex-col gap-3">
				{!query.trim() && <h2 data-ev-id="ev_dc_title" className="text-lg font-bold tracking-tight">{t('New songs')}</h2>}
				{loaded && filtered.length === 0 ? (
					<EmptyNote searching={Boolean(query.trim())} text={t('No songs published yet.')} />
				) : (
					<div data-ev-id="ev_dc_grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
						{shown.map((track, i) => (
							<MediaCard key={track.id} to={track.artist ? `/artista/${track.artist.slug}` : '/'} title={track.title} subtitle={track.artist?.name} coverKey={track.cover_key} onPlay={() => playTracks(shown, i)} />
						))}
					</div>
				)}
				{hasMore && <MoreButton onClick={more} />}
			</section>
		</div>
	);
}
