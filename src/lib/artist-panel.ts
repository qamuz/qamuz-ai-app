import { supabase } from '@/integrations/supabase/client';
import type { OwnedArtist } from '@/contexts/account-context';
import type { Album, TrackWithArtist } from '@/types/music';

export interface OwnTrack {
	id: string;
	title: string;
	audio_url: string;
	cover_key: string | null;
	duration_seconds: number;
	genre: string | null;
	plays: number;
	is_published: boolean;
	album_id: string | null;
}

export async function fetchOwnTracks(artistId: string): Promise<OwnTrack[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('tracks')
		.select('id, title, audio_url, cover_key, duration_seconds, genre, plays, is_published, album_id')
		.eq('artist_id', artistId)
		.order('created_at', { ascending: false });
	return (data as OwnTrack[] | null) ?? [];
}

export async function fetchOwnAlbums(artistId: string): Promise<Album[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('albums').select('id, title, cover_key, release_date').eq('artist_id', artistId).order('created_at', { ascending: false });
	return (data as Album[] | null) ?? [];
}

export function toPlayable(track: OwnTrack, artist: OwnedArtist): TrackWithArtist {
	return { ...track, artist: { id: artist.id, name: artist.name, slug: artist.slug } };
}
