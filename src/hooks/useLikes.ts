import { useContext } from 'react';
import { LikesContext } from '@/contexts/likes-context';

export function useLikes() {
	const ctx = useContext(LikesContext);
	if (!ctx) throw new Error('useLikes debe usarse dentro de LikesProvider');
	return ctx;
}
