import { supabase } from '@/integrations/supabase/client';
import type { TrackWithArtist } from '@/types/music';
import {
	checkModalHealth,
	createLocalModalCreation,
	getLocalModalCreation,
	getLocalModalCreations,
	isLocalModalId,
	refreshLocalModalCreation,
} from '@/lib/modalClient';

export type CreationKind = 'music' | 'video' | 'image';

export interface Creation {
	id: string;
	kind: CreationKind;
	prompt: string;
	options: Record<string, unknown>;
	status: 'queued' | 'generating' | 'ready' | 'error';
	provider_slug: string | null;
	title: string | null;
	result_urls: string[];
	thumbnail_url: string | null;
	duration_seconds: number | null;
	error_message: string | null;
	credits_spent: number;
	published_track_id: string | null;
	items: CreationItem[] | null;
	created_at: string;
}

/** One generated song inside a music creation (Suno returns two per request). */
export interface CreationItem {
	id?: string | null;
	audio_url: string;
	image_url: string | null;
	title: string | null;
	duration: number | null;
	lyrics: string | null;
	tags?: string | null;
	liked?: boolean;
	disliked?: boolean;
	published_track_id?: string | null;
}

/** The song a video was made from (stored in the video creation's options). */
export interface VideoSource {
	song_key: string | null;
	audio_url: string;
	title: string;
	cover_url: string | null;
	duration: number;
}

/** A single playable song shown as its own row in the Studio. */
export interface StudioSong {
	key: string;
	trackId: string;
	origin: 'ai' | 'upload';
	creationId: string;
	index: number;
	version: number | null;
	title: string;
	audioUrl: string;
	coverUrl: string | null;
	duration: number;
	lyrics: string | null;
	style: string | null;
	liked: boolean;
	disliked?: boolean;
	publishedTrackId: string | null;
	createdAt: string;
	bpm?: number;
}

export interface ProviderInfo {
	id: string;
	slug: string;
	name: string;
	kind: CreationKind;
	secret_name: string | null;
	model: string | null;
	is_active: boolean;
	is_default: boolean;
	credit_cost: number;
	notes: string | null;
}

const CREATION_SELECT =
	'id, kind, prompt, options, status, provider_slug, title, result_urls, thumbnail_url, duration_seconds, error_message, credits_spent, published_track_id, items, created_at';

export async function invokeStudio<T>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
	if (!supabase) return { error: 'El backend no está conectado' };
	const { data, error } = await supabase.functions.invoke('ai-studio', { body });
	if (error) {
		let message = error.message;
		const ctx = (error as { context?: Response }).context;
		if (ctx && typeof ctx.json === 'function') {
			try {
				const parsed = (await ctx.json()) as { error?: string };
				if (parsed?.error) message = parsed.error;
			} catch {
				/* keep default message */
			}
		}
		return { error: message };
	}
	return { data: data as T };
}

export async function createCreation(kind: CreationKind, prompt: string, options: Record<string, unknown>) {
	if (kind === 'image' || kind === 'video') {
		const modalHealth = await checkModalHealth();
		if (modalHealth.visionConfigured && modalHealth.visionAuthOk) {
			return createLocalModalCreation(kind, prompt, options);
		}
	}
	return invokeStudio<{ id: string }>({ action: 'create', kind, prompt, options });
}

export function saveTrimmedCreation(payload: {
	title: string;
	audio_url: string;
	thumbnail_url?: string | null;
	duration: number;
	options: Record<string, unknown>;
	items?: CreationItem[];
}) {
	return invokeStudio<{ id: string }>({ action: 'save_trimmed', ...payload });
}

export function saveRenderedVideo(payload: {
	title: string;
	video_url: string;
	thumbnail_url?: string | null;
	duration: number;
	prompt?: string;
	options: Record<string, unknown>;
}) {
	return invokeStudio<{ id: string }>({ action: 'save_rendered_video', ...payload });
}

export function refreshCreation(id: string) {
	if (isLocalModalId(id)) return refreshLocalModalCreation(id);
	return invokeStudio<{ ok: boolean }>({ action: 'status', id });
}

export function fetchProvidersStatus() {
	return invokeStudio<{ status: Record<string, { configured: boolean; supported: boolean }> }>({ action: 'providers_status' });
}

export async function fetchCreations(userId: string): Promise<Creation[]> {
	let dbRows: Creation[] = [];
	if (supabase) {
		const { data } = await supabase.from('ai_creations').select(CREATION_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
		dbRows = (data as unknown as Creation[] | null) ?? [];
	}
	const existingIds = new Set(dbRows.map((c) => c.id));
	const localRows = getLocalModalCreations(existingIds);
	return localRows.length > 0 ? [...localRows, ...dbRows] : dbRows;
}

export async function fetchCreation(id: string): Promise<Creation | null> {
	if (isLocalModalId(id)) return getLocalModalCreation(id);
	if (!supabase) return null;
	const { data } = await supabase.from('ai_creations').select(CREATION_SELECT).eq('id', id).maybeSingle();
	return (data as unknown as Creation | null) ?? null;
}

export async function fetchProviders(): Promise<ProviderInfo[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('ai_providers')
		.select('id, slug, name, kind, secret_name, model, is_active, is_default, credit_cost, notes')
		.order('kind')
		.order('created_at');
	const list = (data as ProviderInfo[] | null) ?? [];

	// Prefer Modal (modal-image / modal-video) locally when present without issuing write side-effects
	const hasModalImage = list.some((p) => p.slug === 'modal-image');
	const hasActiveVideo = list.some((p) => p.kind === 'video' && p.is_active);
	for (const p of list) {
		if (p.slug === 'modal-image' && (!p.is_active || !p.is_default)) {
			p.is_active = true;
			p.is_default = true;
		}
		if (!hasActiveVideo && p.slug === 'modal-video') {
			p.is_active = true;
			p.is_default = true;
		}
		if (hasModalImage && p.slug === 'openai-image' && (p.is_active || p.is_default)) {
			p.is_active = false;
			p.is_default = false;
		}
	}

	return list;
}

export function itemsOf(c: Creation): CreationItem[] {
	if (c.items && c.items.length > 0) return c.items;
	return c.result_urls.map((url, i) => ({
		audio_url: url,
		image_url: c.thumbnail_url,
		title: c.title,
		duration: c.duration_seconds,
		lyrics: null,
		published_track_id: i === 0 ? c.published_track_id : null,
	}));
}

export function songsFromCreation(c: Creation): StudioSong[] {
	if (c.kind !== 'music') return [];
	const items = itemsOf(c);
	const fallback = c.title || c.prompt.slice(0, 48);
	return items.map((it, i) => ({
		key: `${c.id}:${it.id ?? i}`,
		trackId: `ai-${c.id}-${i}`,
		origin: 'ai',
		creationId: c.id,
		index: i,
		version: items.length > 1 ? i + 1 : null,
		title: it.title || fallback,
		audioUrl: it.audio_url,
		coverUrl: it.image_url ?? c.thumbnail_url,
		duration: Math.round(it.duration ?? c.duration_seconds ?? 0),
		lyrics: it.lyrics ?? null,
		style: (it.tags as string | null) || ((c.options.style as string | undefined) ?? null),
		liked: Boolean(it.liked),
		disliked: Boolean(it.disliked),
		publishedTrackId: it.published_track_id ?? null,
		createdAt: c.created_at,
	}));
}

export function videoSourceOf(c: Creation): VideoSource | null {
	const src = c.options?.source as VideoSource | undefined;
	return src && typeof src.audio_url === 'string' ? src : null;
}

/** A song that only exists as the soundtrack of a video (uploaded file, or its AI song was deleted). */
export function songFromVideo(c: Creation, src: VideoSource): StudioSong {
	return {
		key: `video:${c.id}`,
		trackId: `ai-v-${c.id}`,
		origin: 'upload',
		creationId: c.id,
		index: 0,
		version: null,
		title: src.title,
		audioUrl: src.audio_url,
		coverUrl: src.cover_url,
		duration: src.duration,
		lyrics: null,
		style: null,
		liked: false,
		publishedTrackId: null,
		createdAt: c.created_at,
	};
}

export function songToTrack(song: StudioSong, artist: { id: string; name: string; slug: string } | null): TrackWithArtist {
	return {
		id: song.trackId,
		title: song.title,
		audio_url: song.audioUrl,
		cover_key: song.coverUrl,
		duration_seconds: song.duration,
		genre: null,
		plays: 0,
		album_id: null,
		artist: artist ? { id: artist.id, name: artist.name, slug: artist.slug } : null,
	};
}

/** Lyric lines without section tags like [Verse] or (Chorus). */
export function lyricLines(text: string | null): string[] {
	if (!text) return [];
	return text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !/^\[.*\]$/.test(l) && !/^\(.*\)$/.test(l));
}

/** Estimated start time (seconds) of each lyric line, spread across the song. */
export function lyricTimes(count: number, duration: number): number[] {
	const start = duration * 0.07;
	const span = duration * 0.86;
	return Array.from({ length: count }, (_, i) => start + (span * i) / Math.max(count, 1));
}

const MEDIA_PATH = '/storage/v1/object/public/media/';

/** Storage paths inside the user's own media folder (external provider URLs are skipped). */
export function ownMediaPaths(c: Creation, userId: string): string[] {
	const urls = [...c.result_urls, c.kind === 'video' ? null : c.thumbnail_url].filter((u): u is string => Boolean(u));
	return urls
		.map((u) => {
			const at = u.indexOf(MEDIA_PATH);
			return at >= 0 ? decodeURIComponent(u.slice(at + MEDIA_PATH.length).split('?')[0]) : null;
		})
		.filter((p): p is string => Boolean(p && p.startsWith(`${userId}/`)));
}

async function saveItems(c: Creation, items: CreationItem[], extra: Record<string, unknown> = {}): Promise<string | null> {
	if (!supabase) return 'not connected';
	const { error } = await supabase
		.from('ai_creations')
		.update({ items: JSON.parse(JSON.stringify(items)), ...extra })
		.eq('id', c.id);
	return error?.message ?? null;
}

export function toggleDraftDislike(c: Creation, index: number): Promise<string | null> {
	const items = itemsOf(c).map((it, i) => (i === index ? { ...it, disliked: !it.disliked } : it));
	return saveItems(c, items);
}

export function toggleDraftLike(c: Creation, index: number): Promise<string | null> {
	const items = itemsOf(c).map((it, i) => (i === index ? { ...it, liked: !it.liked } : it));
	return saveItems(c, items);
}

/** Publish one song to the artist profile, with its lyrics spread over the song. */
export async function publishSong(c: Creation, song: StudioSong, artistId: string): Promise<{ trackId?: string; error?: string }> {
	if (!supabase) return { error: 'not connected' };
	const { data, error } = await supabase
		.from('tracks')
		.insert({
			artist_id: artistId,
			title: song.title,
			audio_url: song.audioUrl,
			cover_key: song.coverUrl,
			duration_seconds: song.duration,
			genre: (song.style ?? 'AI').split(',')[0].slice(0, 40),
			prompt: c.kind === 'music' && c.prompt ? c.prompt.slice(0, 500) : null,
			style: song.style ? song.style.slice(0, 200) : null,
			is_published: true,
		})
		.select('id')
		.single();
	if (error || !data) return { error: error?.message ?? 'publish failed' };
	const lines = lyricLines(song.lyrics);
	if (lines.length > 0) {
		const times = lyricTimes(lines.length, song.duration);
		await supabase.from('lyric_lines').insert(lines.map((text, i) => ({ track_id: data.id, time_ms: Math.round(times[i] * 1000), text })));
	}
	const items = itemsOf(c).map((it, i) => (i === song.index ? { ...it, published_track_id: data.id } : it));
	await saveItems(c, items, c.published_track_id ? {} : { published_track_id: data.id });
	return { trackId: data.id };
}

/** Delete one song; when it is the last song of its creation, the whole creation goes. */
export async function deleteSong(c: Creation, index: number, userId: string): Promise<string | null> {
	if (!supabase) return 'not connected';
	const items = itemsOf(c);
	if (items.length > 1) return saveItems(c, items.filter((_, i) => i !== index));
	const { error } = await supabase.from('ai_creations').delete().eq('id', c.id).eq('user_id', userId);
	if (error) return error.message;
	const paths = ownMediaPaths(c, userId);
	if (paths.length > 0) void supabase.storage.from('media').remove(paths);
	return null;
}

export const KIND_LABEL: Record<CreationKind, string> = { music: 'Música', video: 'Video', image: 'Imagen' };

export const STATUS_LABEL: Record<Creation['status'], string> = {
	queued: 'En cola',
	generating: 'Generando',
	ready: 'Lista',
	error: 'Error',
};
