import { ChevronDown, SearchX } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

export function MoreButton({ onClick }: { onClick: () => void }) {
	const { t } = useI18n();
	return (
		<button data-ev-id="ev_more_btn" type="button" onClick={onClick} className="mx-auto inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-6 text-sm font-bold text-foreground transition-colors hover:bg-surface-2">
			{t('More')} <ChevronDown className="h-4 w-4" />
		</button>
	);
}

/** Shown when a tab has nothing yet, or the search finds nothing. */
export function EmptyNote({ searching, text }: { searching: boolean; text: string }) {
	const { t } = useI18n();
	return (
		<div data-ev-id="ev_empty_note" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
			<SearchX className="h-6 w-6 text-muted-foreground" />
			<p data-ev-id="ev_empty_text" className="text-sm text-muted-foreground">{searching ? t('No results for this search') : text}</p>
		</div>
	);
}
