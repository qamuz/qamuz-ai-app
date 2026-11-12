import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ModulesContext, type AppModule, type ModuleKey } from '@/contexts/modules-context';

export function ModulesProvider({ children }: { children: ReactNode }) {
	const [modules, setModules] = useState<AppModule[]>([]);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		if (!supabase) {
			setLoading(false);
			return;
		}
		const { data } = await supabase.from('app_modules').select('key, name, description, enabled, sort').order('sort');
		setModules((data as AppModule[] | null) ?? []);
		setLoading(false);
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const isEnabled = useCallback(
		(key: ModuleKey) => {
			const found = modules.find((m) => m.key === key);
			return found ? found.enabled : true;
		},
		[modules],
	);

	return <ModulesContext.Provider value={{ modules, loading, isEnabled, refresh }}>{children}</ModulesContext.Provider>;
}
