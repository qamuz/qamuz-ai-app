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

export type AlbumMarketFormat = 'LP' | 'EP' | 'Single' | 'Mixtape' | 'Deluxe' | 'OST';

export interface AlbumMarketConfig {
	id: AlbumMarketFormat;
	name: string;
	minTracks: number;
	maxTracks: number;
	badge: string;
	description: string;
}

export const ALBUM_MARKET_FORMATS: AlbumMarketConfig[] = [
	{
		id: 'LP',
		name: 'LP / Álbum Completo',
		minTracks: 8,
		maxTracks: 16,
		badge: 'LP Completo',
		description: 'Formato discográfico estándar para lanzamientos completos (8 a 16 canciones)',
	},
	{
		id: 'EP',
		name: 'EP / Extended Play',
		minTracks: 4,
		maxTracks: 7,
		badge: 'EP Conceptual',
		description: 'Lanzamiento mediano ideal para proyectos temáticos o temporadas (4 a 7 canciones)',
	},
	{
		id: 'Single',
		name: 'Maxi-Single / Sencillo',
		minTracks: 1,
		maxTracks: 3,
		badge: 'Maxi-Single',
		description: 'Pistas individuales con versión remix, acústica o instrumental (1 a 3 canciones)',
	},
	{
		id: 'OST',
		name: 'Banda Sonora Original / OST de Película',
		minTracks: 4,
		maxTracks: 16,
		badge: 'OST de Cine',
		description: 'Banda sonora cinematográfica, música incidental o temas para películas y cortometrajes (hasta 16 pistas)',
	},
	{
		id: 'Mixtape',
		name: 'Mixtape / Compilación',
		minTracks: 4,
		maxTracks: 16,
		badge: 'Mixtape Urbano',
		description: 'Colección de canciones colaborativas o material exclusivo (hasta 16 canciones)',
	},
	{
		id: 'Deluxe',
		name: 'Edición Deluxe / Especial',
		minTracks: 10,
		maxTracks: 16,
		badge: 'Deluxe Edition',
		description: 'Versión definitiva con bonus tracks y versiones inéditas (hasta 16 canciones)',
	},
];

export async function fetchAlbumTracks(albumId: string): Promise<OwnTrack[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('tracks')
		.select('id, title, audio_url, cover_key, duration_seconds, genre, plays, is_published, album_id')
		.eq('album_id', albumId)
		.order('created_at', { ascending: true });
	return (data as OwnTrack[] | null) ?? [];
}

export async function saveAlbumWithTracks({
	artistId,
	albumId,
	title,
	releaseDate,
	coverKey,
	trackIds,
}: {
	artistId: string;
	albumId?: string | null;
	title: string;
	releaseDate?: string | null;
	coverKey?: string | null;
	trackIds: string[];
}): Promise<{ album?: Album; error?: string }> {
	if (!supabase) return { error: 'Database not connected' };

	let savedAlbum: Album | null = null;

	if (albumId) {
		const { data, error } = await supabase
			.from('albums')
			.update({
				title: title.trim(),
				release_date: releaseDate || null,
				cover_key: coverKey,
			})
			.eq('id', albumId)
			.select('id, title, cover_key, release_date')
			.single();

		if (error) return { error: error.message };
		savedAlbum = data as Album;

		// Unlink removed tracks
		if (trackIds.length > 0) {
			await supabase.from('tracks').update({ album_id: null }).eq('album_id', albumId).not('id', 'in', `(${trackIds.join(',')})`);
		} else {
			await supabase.from('tracks').update({ album_id: null }).eq('album_id', albumId);
		}
	} else {
		const { data, error } = await supabase
			.from('albums')
			.insert({
				artist_id: artistId,
				title: title.trim(),
				release_date: releaseDate || null,
				cover_key: coverKey,
			})
			.select('id, title, cover_key, release_date')
			.single();

		if (error) return { error: error.message };
		savedAlbum = data as Album;
	}

	if (!savedAlbum) return { error: 'Could not save album' };

	// Link selected tracks
	if (trackIds.length > 0) {
		const patch: { album_id: string; cover_key?: string } = { album_id: savedAlbum.id };
		if (coverKey) patch.cover_key = coverKey;
		await supabase.from('tracks').update(patch).in('id', trackIds);
	}

	return { album: savedAlbum };
}

export function toPlayable(track: OwnTrack, artist: OwnedArtist): TrackWithArtist {
	return { ...track, artist: { id: artist.id, name: artist.name, slug: artist.slug } };
}
