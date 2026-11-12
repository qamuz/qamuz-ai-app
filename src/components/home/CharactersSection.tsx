import { useMemo } from 'react';
import { Link } from 'react-router';
import { Mic } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { usePaged, matchesQuery } from '@/hooks/usePaged';
import { CHARACTERS } from '@/lib/characters';
import { EmptyNote, MoreButton } from '@/components/home/MoreButton';

const PAGE = 16;

/** AI singer characters; each card opens the Studio with that voice selected. */
export function CharactersSection({ query }: { query: string }) {
	const { t } = useI18n();
	const filtered = useMemo(() => CHARACTERS.filter((c) => matchesQuery(query, c.name, c.label, c.genre, t(c.label))), [query, t]);
	const { shown, hasMore, more } = usePaged(filtered, PAGE, query);

	return (
		<div data-ev-id="ev_ch_root" className="flex flex-col gap-6">
			<div data-ev-id="ev_ch_head" className="flex flex-wrap items-center justify-between gap-3">
				<p data-ev-id="ev_ch_intro" className="text-sm text-pretty text-muted-foreground">{t('Pick a singer and create a song with that voice style.')}</p>
				<Link data-ev-id="ev_ch_own" to="/estudio" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-surface-2">
					<Mic className="h-3.5 w-3.5" /> {t('Create your own voice')}
				</Link>
			</div>
			{filtered.length === 0 ? (
				<EmptyNote searching text="" />
			) : (
				<div data-ev-id="ev_ch_grid" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
					{shown.map((c) => (
						<Link data-ev-id="ev_ch_card" key={c.id} to={`/estudio?character=${c.id}`} aria-label={t('Create a song with {name}', { name: c.name })} className="group relative overflow-hidden rounded-2xl border border-border bg-surface">
							<img data-ev-id="ev_ch_img" src={c.image} width={768} height={1024} loading="lazy" alt="" className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
							<span data-ev-id="ev_ch_shade" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" aria-hidden="true" />
							<span data-ev-id="ev_ch_text" className="absolute inset-x-0 bottom-0 flex flex-col p-3">
								<span data-ev-id="ev_ch_name" className="truncate text-sm font-black text-white">{c.name}</span>
								<span data-ev-id="ev_ch_label" className="truncate text-[11px] text-white/75">{t(c.label)}</span>
							</span>
						</Link>
					))}
				</div>
			)}
			{hasMore && <MoreButton onClick={more} />}
		</div>
	);
}
