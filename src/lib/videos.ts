import { supabase } from '@/integrations/supabase/client';
import { videoSourceOf, type Creation } from '@/lib/studio';
import type { ArtistSummary } from '@/types/music';

export interface MusicVideo {
	id: string;
	user_id: string;
	creation_id: string;
	title: string;
	video_url: string;
	audio_url: string;
	cover_url: string | null;
	duration_seconds: number;
	created_at: string;
	artist: ArtistSummary | null;
}

const SELECT = 'id, user_id, creation_id, title, video_url, audio_url, cover_url, duration_seconds, created_at, artist:artists(id, name, slug)';

export async function fetchMusicVideos(): Promise<MusicVideo[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('music_videos').select(SELECT).order('created_at', { ascending: false }).limit(90);
	return (data as unknown as MusicVideo[] | null) ?? [];
}

/** Publish a finished video creation (with its soundtrack) to the public gallery. */
export async function publishMusicVideo(c: Creation, userId: string, artistId: string | null): Promise<'ok' | 'exists' | 'error'> {
	if (!supabase) return 'error';
	const src = videoSourceOf(c);
	const url = c.result_urls[0];
	if (!src || !url || c.status !== 'ready') return 'error';
	const { error } = await supabase.from('music_videos').insert({
		user_id: userId,
		creation_id: c.id,
		artist_id: artistId,
		title: (src.title || c.title || c.prompt).slice(0, 120),
		video_url: url,
		audio_url: src.audio_url,
		cover_url: c.thumbnail_url ?? src.cover_url,
		duration_seconds: Math.round(src.duration || 0),
	});
	if (error?.code === '23505') return 'exists';
	return error ? 'error' : 'ok';
}

export async function unpublishMusicVideo(id: string): Promise<boolean> {
	if (!supabase) return false;
	const { error } = await supabase.from('music_videos').delete().eq('id', id);
	return !error;
}
