import { supabase } from '@/integrations/supabase/client';
import { invokeStudio } from '@/lib/studio';

export interface SongTemplate {
	id: string;
	title: string;
	audio_url: string;
	duration_seconds: number;
	cover_key: string | null;
	genre: string | null;
	style: string | null;
	prompt: string;
	template_uses: number;
	artist: { id: string; name: string; slug: string; avatar_key: string | null } | null;
}

export interface Creator {
	id: string;
	slug: string;
	name: string;
	avatar_key: string | null;
	songs: number;
	views: number;
}

/** Published songs that keep their prompt: most used first. */
export async function fetchTemplates(limit = 12): Promise<SongTemplate[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('tracks')
		.select('id, title, audio_url, duration_seconds, plays, album_id, is_published, likes_count, comments_count, shares_count, cover_key, genre, style, prompt, template_uses, artist:artists(id, name, slug, avatar_key)')
		.eq('is_published', true)
		.not('prompt', 'is', null)
		.order('template_uses', { ascending: false })
		.order('created_at', { ascending: false })
		.limit(limit);
	return (data as unknown as SongTemplate[] | null) ?? [];
}

/** "R&B, pop, smooth" → "R&B - Pop" (first two parts). */
export function styleLabel(t: Pick<SongTemplate, 'style' | 'genre'>): string {
	const parts = (t.style || t.genre || '')
		.split(/[,/|]/)
		.map((s) => s.trim())
		.filter(Boolean)
		.slice(0, 2)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
	return parts.join(' - ');
}

/** Records that the signed-in user used this template (counted once per user) and returns its prompt. */
export function requestTemplate(trackId: string) {
	return invokeStudio<{ count: number; prompt: string; style: string | null }>({ action: 'template_use', track_id: trackId });
}

/** Artists run by Qamuz users, with their published songs and total views. */
export async function fetchCreators(limit = 12): Promise<Creator[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('artists')
		.select('id, slug, name, avatar_key, tracks(plays)')
		.not('owner_id', 'is', null)
		.order('monthly_listeners', { ascending: false })
		.limit(Math.max(limit, 40));
	const rows = (data as unknown as { id: string; slug: string; name: string; avatar_key: string | null; tracks: { plays: number }[] | null }[] | null) ?? [];
	return rows
		.map((a) => ({
			id: a.id,
			slug: a.slug,
			name: a.name,
			avatar_key: a.avatar_key,
			songs: a.tracks?.length ?? 0,
			views: (a.tracks ?? []).reduce((sum, t) => sum + (t.plays ?? 0), 0),
		}))
		.filter((a) => a.songs > 0)
		.sort((x, y) => y.views - x.views || y.songs - x.songs)
		.slice(0, limit);
}

/** Ids of the given artists that the user follows. */
export async function fetchFollowing(userId: string, artistIds: string[]): Promise<Set<string>> {
	if (!supabase || artistIds.length === 0) return new Set();
	const { data } = await supabase.from('follows').select('artist_id').eq('user_id', userId).in('artist_id', artistIds);
	return new Set(((data ?? []) as { artist_id: string }[]).map((r) => r.artist_id));
}

export async function setFollow(userId: string, artistId: string, follow: boolean): Promise<boolean> {
	if (!supabase) return false;
	const { error } = follow
		? await supabase.from('follows').insert({ user_id: userId, artist_id: artistId })
		: await supabase.from('follows').delete().eq('user_id', userId).eq('artist_id', artistId);
	return !error;
}
