import { PowerOff } from 'lucide-react';
import { Link } from 'react-router';
import { useI18n } from '@/hooks/useI18n';

export function ModuleDisabled({ name }: {name: string;}) {
  const { t } = useI18n();
  return (
    <div data-ev-id="ev_1080f9d292" className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center">
			<span data-ev-id="ev_699b934533" className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground">
				<PowerOff className="h-5 w-5" />
			</span>
			<h1 data-ev-id="ev_bc95bbcb73" className="text-xl font-bold">{t('{name} is not available', { name: t(name) })}</h1>
			<p data-ev-id="ev_c9747ab786" className="text-sm text-pretty text-muted-foreground">{t('This module has been turned off by the platform administrator.')}</p>
			<Link data-ev-id="ev_71676e92d7" to="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
				{t('Back to home')}
			</Link>
		</div>);

}