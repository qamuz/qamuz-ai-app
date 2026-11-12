import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LikesContext } from '@/contexts/likes-context';
import { trackEvent } from '@/lib/engagement';

export function LikesProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
	const [deltas, setDeltas] = useState<Record<string, number>>({});

	useEffect(() => {
		setDeltas({});
		if (!supabase || !user) {
			setLikedIds(new Set());
			return;
		}
		let active = true;
		void supabase
			.from('liked_tracks')
			.select('track_id')
			.eq('user_id', user.id)
			.then(({ data }) => {
				if (!active) return;
				const rows = (data as { track_id: string }[] | null) ?? [];
				setLikedIds(new Set(rows.map((r) => r.track_id)));
			});
		return () => {
			active = false;
		};
	}, [user]);

	const isLiked = useCallback((trackId: string) => likedIds.has(trackId), [likedIds]);
	const likeDelta = useCallback((trackId: string) => deltas[trackId] ?? 0, [deltas]);

	const toggleLike = useCallback(
		async (trackId: string) => {
			if (!supabase || !user) return;
			const liked = likedIds.has(trackId);
			setLikedIds((prev) => {
				const copy = new Set(prev);
				if (liked) copy.delete(trackId);
				else copy.add(trackId);
				return copy;
			});
			setDeltas((prev) => ({ ...prev, [trackId]: (prev[trackId] ?? 0) + (liked ? -1 : 1) }));
			if (liked) {
				await supabase.from('liked_tracks').delete().eq('user_id', user.id).eq('track_id', trackId);
			} else {
				await supabase.from('liked_tracks').insert({ user_id: user.id, track_id: trackId });
			}
			void trackEvent(trackId, 'sync');
		},
		[likedIds, user],
	);

	return <LikesContext.Provider value={{ likedIds, isLiked, toggleLike, likeDelta }}>{children}</LikesContext.Provider>;
}
