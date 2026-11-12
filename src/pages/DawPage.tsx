import { useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ModuleDisabled } from '@/components/ModuleDisabled';
import { DawEditor } from '@/components/daw/DawEditor';
import { useModules } from '@/hooks/useModules';
import { useI18n } from '@/hooks/useI18n';

export default function DawPage() {
	const { isEnabled } = useModules();
	const { t } = useI18n();

	useEffect(() => {
		const previous = document.title;
		document.title = `${t('Studio')} · Qamuz AI`;
		return () => {
			document.title = previous;
		};
	}, [t]);

	return (
		<AppLayout>
			{isEnabled('daw') ? (
				<ProtectedRoute>
					<DawEditor />
				</ProtectedRoute>
			) : (
				<ModuleDisabled name={t('Studio')} />
			)}
		</AppLayout>
	);
}
