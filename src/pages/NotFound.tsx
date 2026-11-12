import { Link } from 'react-router';
import { useI18n } from '@/hooks/useI18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main data-ev-id="ev_01065b1f43" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
			<h1 data-ev-id="ev_c5646534b1" className="text-5xl font-black tracking-tight">404</h1>
			<p data-ev-id="ev_cbeb275d1a" className="text-sm text-muted-foreground">{t("We couldn't find this page.")}</p>
			<Link data-ev-id="ev_cf3052034e" to="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
				{t('Back to home')}
			</Link>
		</main>);

}