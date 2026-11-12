import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { fetchCreations, itemsOf, songFromVideo, songsFromCreation, videoSourceOf } from '@/lib/studio';

/** A song the signed-in user owns: an AI Studio song, an uploaded soundtrack, or a track on their artist profile. */
export interface OwnSong {
	id: string;
	title: string;
	audioUrl: string;
	coverUrl: string | null;
	duration: number;
	creationId: string | null;
	index: number;
	/** Any owned song with audio can be split; AI songs must be finished. */
	stemmable: boolean;
	/** Where the server finds this song for stem separation. */
	stemSource: { creation_id: string; index: number } | { track_id: string } | null;
	/** Other ids that point at this song (its published track). */
	aliases: string[];
}

export function useOwnSongs() {
	const { user } = useAuth();
	const { artist } = useAccount();
	const artistId = artist?.id ?? null;
	const [songs, setSongs] = useState<OwnSong[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		if (!user || !supabase) {
			setSongs([]);
			setLoading(false);
			return;
		}
		const creations = await fetchCreations(user.id);
		const list: OwnSong[] = [];
		const published = new Set<string>();
		const keys = new Set<string>();
		const urls = new Set<string>();

		for (const c of creations) {
			if (c.kind !== 'music' || c.status === 'error') continue;
			const items = itemsOf(c);
			for (const s of songsFromCreation(c)) {
				if (!s.audioUrl) continue;
				keys.add(s.key);
				urls.add(s.audioUrl);
				if (s.publishedTrackId) published.add(s.publishedTrackId);
				list.push({
					id: s.trackId,
					title: s.title,
					audioUrl: s.audioUrl,
					coverUrl: s.coverUrl,
					duration: s.duration,
					creationId: c.id,
					index: s.index,
					stemmable: c.status === 'ready' && Boolean(items[s.index]?.audio_url || s.audioUrl),
					stemSource: { creation_id: c.id, index: s.index },
					aliases: s.publishedTrackId ? [s.publishedTrackId] : [],
				});
			}
		}

		for (const c of creations) {
			if (c.kind !== 'video') continue;
			const src = videoSourceOf(c);
			if (!src || (src.song_key && keys.has(src.song_key)) || urls.has(src.audio_url)) continue;
			urls.add(src.audio_url);
			const s = songFromVideo(c, src);
			list.push({ id: s.trackId, title: s.title, audioUrl: s.audioUrl, coverUrl: s.coverUrl, duration: s.duration, creationId: null, index: 0, stemmable: true, stemSource: { creation_id: c.id, index: 0 }, aliases: [] });
		}

		if (artistId) {
			const { data } = await supabase.from('tracks').select('id, title, audio_url, cover_key, duration_seconds').eq('artist_id', artistId).limit(100);
			for (const tr of data ?? []) {
				if (published.has(tr.id) || urls.has(tr.audio_url)) continue;
				list.push({ id: tr.id, title: tr.title, audioUrl: tr.audio_url, coverUrl: tr.cover_key, duration: tr.duration_seconds ?? 0, creationId: null, index: 0, stemmable: Boolean(tr.audio_url), stemSource: { track_id: tr.id }, aliases: [] });
			}
		}

		setSongs(list);
		setLoading(false);
	}, [user, artistId]);

	useEffect(() => {
		void load();
	}, [load]);

	return { songs, loading, reload: load };
}
