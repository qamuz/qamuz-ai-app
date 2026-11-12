import { supabase } from '@/integrations/supabase/client';
import type { Album, Artist, LyricLine, Playlist, TrackWithArtist } from '@/types/music';
import { buildStructuredTimedLyrics } from '@/lib/lyrics-sync';

const TRACK_SELECT =
	'id, title, audio_url, cover_key, duration_seconds, genre, plays, album_id, is_published, likes_count, comments_count, shares_count, canvas_url, short_start_seconds, lyrics, artist:artists(id, name, slug)';
const PLAYLIST_SELECT = 'id, title, description, cover_key, is_public, is_featured, user_id';
const ARTIST_SELECT = 'id, slug, name, bio, avatar_key, banner_key, monthly_listeners, social_links';

function asTracks(rows: unknown): TrackWithArtist[] {
	return (rows as TrackWithArtist[] | null) ?? [];
}

export async function fetchFeaturedPlaylists(): Promise<Playlist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('playlists').select(PLAYLIST_SELECT).eq('is_featured', true).order('created_at', { ascending: true });
	return (data as Playlist[] | null) ?? [];
}

export async function fetchUserPlaylists(userId: string): Promise<Playlist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('playlists').select(PLAYLIST_SELECT).eq('user_id', userId).order('created_at', { ascending: false });
	return (data as Playlist[] | null) ?? [];
}

export async function fetchNewReleases(limit = 8): Promise<TrackWithArtist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('tracks').select(TRACK_SELECT).eq('is_published', true).order('created_at', { ascending: false }).limit(limit);
	return asTracks(data);
}

export async function fetchPopularTracks(limit = 6): Promise<TrackWithArtist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('tracks').select(TRACK_SELECT).eq('is_published', true).order('plays', { ascending: false }).limit(limit);
	return asTracks(data);
}

/** Songs ranked by recent views, likes, comments and shares. */
export async function fetchTrending(limit = 50, genre?: string | null): Promise<TrackWithArtist[]> {
	if (!supabase) return [];
	let query = supabase.from('tracks').select(TRACK_SELECT).eq('is_published', true);
	if (genre) query = query.eq('genre', genre);
	const { data } = await query.order('trending_score', { ascending: false }).order('plays', { ascending: false }).limit(limit);
	return asTracks(data);
}

export async function fetchTrack(id: string): Promise<TrackWithArtist | null> {
	if (!supabase) return null;
	const { data } = await supabase.from('tracks').select(TRACK_SELECT).eq('id', id).maybeSingle();
	return (data as TrackWithArtist | null) ?? null;
}

export async function fetchArtists(): Promise<Artist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('artists').select(ARTIST_SELECT).order('monthly_listeners', { ascending: false });
	return (data as Artist[] | null) ?? [];
}

export async function fetchArtistBySlug(slug: string): Promise<Artist | null> {
	if (!supabase) return null;
	const { data } = await supabase.from('artists').select(ARTIST_SELECT).eq('slug', slug).maybeSingle();
	return (data as Artist | null) ?? null;
}

export async function fetchArtistTracks(artistId: string): Promise<TrackWithArtist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('tracks').select(TRACK_SELECT).eq('artist_id', artistId).eq('is_published', true).order('plays', { ascending: false });
	return asTracks(data);
}

export async function fetchArtistAlbums(artistId: string): Promise<Album[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('albums').select('id, title, cover_key, release_date').eq('artist_id', artistId).order('release_date', { ascending: false });
	return (data as Album[] | null) ?? [];
}

export async function fetchPlaylist(id: string): Promise<Playlist | null> {
	if (!supabase) return null;
	const { data } = await supabase.from('playlists').select(PLAYLIST_SELECT).eq('id', id).maybeSingle();
	return (data as Playlist | null) ?? null;
}

export async function fetchPlaylistTracks(playlistId: string): Promise<TrackWithArtist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('playlist_tracks').select(`position, track:tracks(${TRACK_SELECT})`).eq('playlist_id', playlistId).order('position', { ascending: true });
	const rows = (data as { position: number; track: TrackWithArtist | null }[] | null) ?? [];
	return rows.map((row) => row.track).filter((t): t is TrackWithArtist => Boolean(t));
}

export async function fetchLikedTracks(userId: string): Promise<TrackWithArtist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('liked_tracks').select(`created_at, track:tracks(${TRACK_SELECT})`).eq('user_id', userId).order('created_at', { ascending: false });
	const rows = (data as { track: TrackWithArtist | null }[] | null) ?? [];
	return rows.map((row) => row.track).filter((t): t is TrackWithArtist => Boolean(t));
}

export async function fetchRecentlyPlayed(userId: string, limit = 6): Promise<TrackWithArtist[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('play_history').select(`played_at, track:tracks(${TRACK_SELECT})`).eq('user_id', userId).order('played_at', { ascending: false }).limit(30);
	const rows = (data as { track: TrackWithArtist | null }[] | null) ?? [];
	const seen = new Set<string>();
	const unique: TrackWithArtist[] = [];
	for (const row of rows) {
		if (row.track && !seen.has(row.track.id)) {
			seen.add(row.track.id);
			unique.push(row.track);
		}
	}
	return unique.slice(0, limit);
}

export async function fetchLyrics(trackId: string): Promise<LyricLine[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('lyric_lines').select('id, time_ms, text').eq('track_id', trackId).order('time_ms', { ascending: true });
	if (data && data.length > 0) {
		return data as LyricLine[];
	}

	// Fallback to track lyrics (with LRC timestamps or musical structure-aware timing)
	const { data: trackData } = await supabase.from('tracks').select('lyrics, duration_seconds').eq('id', trackId).maybeSingle();
	if (trackData?.lyrics && trackData.lyrics.trim()) {
		const duration = trackData.duration_seconds || 180;
		const timed = buildStructuredTimedLyrics(trackData.lyrics, duration);
		if (timed.length > 0) {
			return timed.map((t, idx) => ({
				id: `auto-${trackId}-${idx}`,
				time_ms: Math.round(t.start * 1000),
				text: t.text,
			}));
		}
	}

	return [];
}

export async function searchCatalog(term: string): Promise<{ tracks: TrackWithArtist[]; artists: Artist[]; playlists: Playlist[] }> {
	if (!supabase || !term.trim()) return { tracks: [], artists: [], playlists: [] };
	const pattern = `%${term.trim()}%`;
	const [tracksRes, artistsRes, playlistsRes] = await Promise.all([
		supabase.from('tracks').select(TRACK_SELECT).eq('is_published', true).ilike('title', pattern).limit(20),
		supabase.from('artists').select(ARTIST_SELECT).ilike('name', pattern).limit(10),
		supabase.from('playlists').select(PLAYLIST_SELECT).eq('is_public', true).ilike('title', pattern).limit(10),
	]);
	return {
		tracks: asTracks(tracksRes.data),
		artists: (artistsRes.data as Artist[] | null) ?? [],
		playlists: (playlistsRes.data as Playlist[] | null) ?? [],
	};
}
