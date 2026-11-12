import { useEffect, useState } from 'react';

/** Shows `size` items at first and `size` more on each call to `more()`; resets when `resetKey` changes (e.g. a search). */
export function usePaged<T>(items: T[], size: number, resetKey = '') {
	const [visible, setVisible] = useState(size);
	useEffect(() => setVisible(size), [resetKey, size]);
	return {
		shown: items.slice(0, visible),
		hasMore: visible < items.length,
		more: () => setVisible((v) => v + size),
	};
}

/** Case- and accent-insensitive text match across several fields. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
	const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
	const q = norm(query.trim());
	if (!q) return true;
	return fields.some((f) => f && norm(f).includes(q));
}
