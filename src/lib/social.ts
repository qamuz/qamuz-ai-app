import { supabase } from '@/integrations/supabase/client';
import { getLang } from '@/i18n/core';

export interface TrackComment {
	id: string;
	track_id: string;
	user_id: string;
	author_name: string | null;
	body: string;
	created_at: string;
}

export interface AppNotification {
	id: string;
	type: 'follow' | 'comment' | 'like' | 'system';
	title: string;
	body: string | null;
	meta: Record<string, string> | null;
	link: string | null;
	read_at: string | null;
	created_at: string;
}

export interface ArtistMedia {
	id: string;
	artist_id: string;
	creation_id: string | null;
	kind: 'image' | 'video';
	url: string;
	thumbnail_url: string | null;
	title: string | null;
	is_published: boolean;
	created_at: string;
}

export async function fetchComments(trackId: string): Promise<TrackComment[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('track_comments')
		.select('id, track_id, user_id, author_name, body, created_at')
		.eq('track_id', trackId)
		.order('created_at', { ascending: false })
		.limit(100);
	return (data as TrackComment[] | null) ?? [];
}

export async function addComment(trackId: string, userId: string, body: string): Promise<string | null> {
	if (!supabase) return 'Backend is not connected';
	const { error } = await supabase.from('track_comments').insert({ track_id: trackId, user_id: userId, body });
	return error ? error.message : null;
}

export async function deleteComment(id: string): Promise<void> {
	if (!supabase) return;
	await supabase.from('track_comments').delete().eq('id', id);
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('notifications')
		.select('id, type, title, body, meta, link, read_at, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(30);
	return (data as AppNotification[] | null) ?? [];
}

export async function markAllRead(userId: string): Promise<void> {
	if (!supabase) return;
	await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
}

export async function fetchArtistMedia(artistId: string, onlyPublished = true): Promise<ArtistMedia[]> {
	if (!supabase) return [];
	let query = supabase
		.from('artist_media')
		.select('id, artist_id, creation_id, kind, url, thumbnail_url, title, is_published, created_at')
		.eq('artist_id', artistId)
		.order('created_at', { ascending: false });
	if (onlyPublished) query = query.eq('is_published', true);
	const { data } = await query;
	return (data as ArtistMedia[] | null) ?? [];
}

const formatters = new Map<string, Intl.RelativeTimeFormat>();

/** "5 minutes ago", "yesterday"... in the current UI language. */
export function timeAgo(iso: string): string {
	const lang = getLang();
	let rtf = formatters.get(lang);
	if (!rtf) {
		rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
		formatters.set(lang, rtf);
	}
	const diff = (new Date(iso).getTime() - Date.now()) / 1000;
	const steps: [number, Intl.RelativeTimeFormatUnit][] = [
		[60, 'second'],
		[60, 'minute'],
		[24, 'hour'],
		[7, 'day'],
		[4.35, 'week'],
		[12, 'month'],
	];
	let value = diff;
	for (const [size, unit] of steps) {
		if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
		value /= size;
	}
	return rtf.format(Math.round(value), 'year');
}
