import { Search, X } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

export type HomeTab = 'templates' | 'discover' | 'qv' | 'character' | 'creators';

// eslint-disable-next-line react-refresh/only-export-components
export const HOME_TABS: { id: HomeTab; label: string }[] = [
	{ id: 'templates', label: 'Template' },
	{ id: 'discover', label: 'Discover' },
	{ id: 'qv', label: 'QV' },
	{ id: 'character', label: 'Character' },
	{ id: 'creators', label: 'Creator' },
];

interface Props {
	tab: HomeTab;
	onTab: (tab: HomeTab) => void;
	query: string;
	onQuery: (q: string) => void;
}

/** Home section menu (sticky under the banner) with a search box that filters the open tab. */
export function HomeTabs({ tab, onTab, query, onQuery }: Props) {
	const { t } = useI18n();
	return (
		<div data-ev-id="ev_ht_root" id="home-tabs" className="sticky top-0 z-20 -mx-4 flex scroll-mt-0 flex-col gap-3 border-b border-border bg-background/95 px-4 pt-2 backdrop-blur md:mx-0 md:flex-row md:items-center md:justify-between md:px-0">
			<div data-ev-id="ev_ht_tabs" role="tablist" aria-label={t('Home sections')} className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
				{HOME_TABS.map((item) => {
					const on = item.id === tab;
					return (
						<button
							data-ev-id="ev_ht_tab"
							key={item.id}
							type="button"
							role="tab"
							id={`home-tab-${item.id}`}
							aria-selected={on}
							aria-controls="home-panel"
							onClick={() => onTab(item.id)}
							className={`h-12 flex-none border-b-2 px-4 text-sm font-bold transition-colors ${on ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
						>
							{t(item.label)}
						</button>
					);
				})}
			</div>
			<label data-ev-id="ev_ht_search" className="mb-3 flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-accent md:mb-0 md:w-80">
				<Search className="h-4 w-4 flex-none text-muted-foreground" />
				<input
					data-ev-id="ev_ht_input"
					type="search"
					value={query}
					onChange={(e) => onQuery(e.target.value)}
					placeholder={t('Search songs, templates, creators')}
					aria-label={t('Search songs, templates, creators')}
					className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
				/>
				{query && (
					<button data-ev-id="ev_ht_clear" type="button" onClick={() => onQuery('')} aria-label={t('Clear search')} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground">
						<X className="h-4 w-4" />
					</button>
				)}
			</label>
		</div>
	);
}
