import { useContext } from 'react';
import { ModulesContext } from '@/contexts/modules-context';

export function useModules() {
	const ctx = useContext(ModulesContext);
	if (!ctx) throw new Error('useModules must be used within ModulesProvider');
	return ctx;
}
