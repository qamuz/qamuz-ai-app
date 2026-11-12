import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Pause, Play, Users, Wand2 } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { usePaged, matchesQuery } from '@/hooks/usePaged';
import type { TrackWithArtist } from '@/types/music';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { coverUrl } from '@/lib/covers';
import { formatCount } from '@/lib/format';
import { fetchTemplates, styleLabel, requestTemplate, type SongTemplate } from '@/lib/home';
import { EmptyNote, MoreButton } from '@/components/home/MoreButton';

const PAGE = 12;

/** Songs published by other users whose prompt anyone can reuse; the counter shows how many users used it. */
export function TemplatesSection({ query }: { query: string }) {
	const { t } = useI18n();
	const { user } = useAuth();
	const navigate = useNavigate();
	const player = usePlayer();
	const [items, setItems] = useState<SongTemplate[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void fetchTemplates(200).then((list) => {
			setItems(list);
			setLoaded(true);
		});
	}, []);

	const filtered = useMemo(() => items.filter((x) => matchesQuery(query, x.title, x.prompt, x.style, x.genre, x.artist?.name)), [items, query]);
	const { shown, hasMore, more } = usePaged(filtered, PAGE, query);

	async function use(item: SongTemplate) {
		if (!user) return navigate('/login');
		setBusy(item.id);
		setError(null);
		const { data, error: err } = await requestTemplate(item.id);
		setBusy(null);
		if (err || !data) return setError(t(err ?? 'Something went wrong'));
		setItems((list) => list.map((x) => (x.id === item.id ? { ...x, template_uses: data.count } : x)));
		const style = data.style && !data.prompt.toLowerCase().includes(data.style.toLowerCase().slice(0, 20)) ? `${data.style}. ` : '';
		navigate(`/estudio?prompt=${encodeURIComponent(`${style}${data.prompt}`.slice(0, 450))}`);
	}

	const isCurrent = (id: string) => player.current?.id === id;

	function toggle(item: SongTemplate) {
		if (isCurrent(item.id)) return player.toggle();
		player.playTracks(filtered as unknown as TrackWithArtist[], filtered.indexOf(item));
	}

	if (!loaded) return null;
	if (filtered.length === 0) return <EmptyNote searching={Boolean(query.trim())} text={t('No templates published yet. Publish a song from the Studio to share it.')} />;

	return (
		<div data-ev-id="ev_tp_root" className="flex flex-col gap-6">
			{error && <p data-ev-id="ev_tp_err" role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
			<div data-ev-id="ev_tp_grid" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{shown.map((item) => {
					const label = styleLabel(item);
					const playing = isCurrent(item.id) && player.isPlaying;
					return (
						<article data-ev-id="ev_tp_card" key={item.id} className="flex gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-foreground/20">
							<div data-ev-id="ev_tp_cover_wrap" className="group/cover relative h-24 w-24 flex-none sm:h-28 sm:w-28">
								<img data-ev-id="ev_tp_cover" src={coverUrl(item.cover_key || item.artist?.avatar_key)} width={112} height={112} loading="lazy" alt={t('Cover of {title}', { title: item.title })} className="h-full w-full rounded-lg object-cover" />
								<button
									data-ev-id="ev_tp_play"
									type="button"
									onClick={() => toggle(item)}
									aria-label={playing ? t('Pause') : t('Play {title}', { title: item.title })}
									className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 transition-colors hover:bg-black/45"
								>
									<span data-ev-id="ev_tp_play_b" className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/40 transition-transform group-hover/cover:scale-110">
										{playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
									</span>
								</button>
							</div>
							<div data-ev-id="ev_tp_body" className="flex min-w-0 flex-1 flex-col gap-1">
								<h3 data-ev-id="ev_tp_title" className="truncate text-sm font-bold">{item.title}</h3>
								{label && <span data-ev-id="ev_tp_style" className="truncate text-xs font-semibold text-primary">{label}</span>}
								<p data-ev-id="ev_tp_prompt" className="line-clamp-2 text-xs text-pretty text-muted-foreground">{item.prompt}</p>
								<div data-ev-id="ev_tp_foot" className="mt-auto flex flex-wrap items-center gap-2 pt-1">
									<button data-ev-id="ev_tp_use" type="button" onClick={() => void use(item)} disabled={busy === item.id} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-60">
										{busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
										{t('Use template')}
									</button>
									<span data-ev-id="ev_tp_uses" className="flex items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground" title={t('Users who used this template')}>
										<Users className="h-3.5 w-3.5" /> {t('{count} users', { count: formatCount(item.template_uses) })}
									</span>
								</div>
							</div>
						</article>
					);
				})}
			</div>
			{hasMore && <MoreButton onClick={more} />}
		</div>
	);
}
