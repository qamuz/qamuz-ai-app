import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Eye, Music2, Plus, UserCheck } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { usePaged, matchesQuery } from '@/hooks/usePaged';
import { coverUrl } from '@/lib/covers';
import { formatCount } from '@/lib/format';
import { fetchCreators, fetchFollowing, setFollow, type Creator } from '@/lib/home';
import { EmptyNote, MoreButton } from '@/components/home/MoreButton';

const PAGE = 18;

/** Qamuz users who publish music: songs, total views and a follow button. */
export function CreatorsSection({ query }: { query: string }) {
	const { t } = useI18n();
	const { user } = useAuth();
	const navigate = useNavigate();
	const [creators, setCreators] = useState<Creator[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [following, setFollowing] = useState<Set<string>>(new Set());

	useEffect(() => {
		void fetchCreators(500).then((list) => {
			setCreators(list);
			setLoaded(true);
		});
	}, []);

	const ids = creators.map((c) => c.id).join(',');
	useEffect(() => {
		if (!user || !ids) return setFollowing(new Set());
		void fetchFollowing(user.id, ids.split(',')).then(setFollowing);
	}, [user, ids]);

	const filtered = useMemo(() => creators.filter((c) => matchesQuery(query, c.name)), [creators, query]);
	const { shown, hasMore, more } = usePaged(filtered, PAGE, query);

	async function toggle(id: string) {
		if (!user) return navigate('/login');
		const next = !following.has(id);
		const update = (on: boolean) =>
			setFollowing((s) => {
				const copy = new Set(s);
				if (on) copy.add(id);
				else copy.delete(id);
				return copy;
			});
		update(next);
		if (!(await setFollow(user.id, id, next))) update(!next);
	}

	if (!loaded) return null;
	if (filtered.length === 0) return <EmptyNote searching={Boolean(query.trim())} text={t('No creators yet.')} />;

	return (
		<div data-ev-id="ev_cr_root" className="flex flex-col gap-6">
			<div data-ev-id="ev_cr_grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
				{shown.map((c) => {
					const on = following.has(c.id);
					return (
						<article data-ev-id="ev_cr_card" key={c.id} className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-4 text-center">
							<Link data-ev-id="ev_cr_link" to={`/artista/${c.slug}`} className="flex flex-col items-center gap-2">
								<img data-ev-id="ev_cr_avatar" src={coverUrl(c.avatar_key)} width={96} height={96} loading="lazy" alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-border" />
								<span data-ev-id="ev_cr_name" className="line-clamp-1 text-sm font-bold">{c.name}</span>
							</Link>
							<div data-ev-id="ev_cr_stats" className="flex items-center gap-3 text-[11px] font-semibold tabular-nums text-muted-foreground">
								<span data-ev-id="ev_cr_songs" className="flex items-center gap-1" title={t('Songs')}><Music2 className="h-3 w-3" /> {formatCount(c.songs)}</span>
								<span data-ev-id="ev_cr_views" className="flex items-center gap-1" title={t('Views')}><Eye className="h-3 w-3" /> {formatCount(c.views)}</span>
							</div>
							<button
								data-ev-id="ev_cr_follow"
								type="button"
								onClick={() => void toggle(c.id)}
								aria-pressed={on}
								className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors ${on ? 'border border-border text-foreground hover:bg-surface-2' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
							>
								{on ? <UserCheck className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
								{on ? t('Following') : t('Follow')}
							</button>
						</article>
					);
				})}
			</div>
			{hasMore && <MoreButton onClick={more} />}
		</div>
	);
}
