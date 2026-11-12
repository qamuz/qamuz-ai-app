import { invokeStudio } from '@/lib/studio';

export interface LastfmTag {
	name: string;
	count: number;
	reach: number;
}

export interface LastfmTrack {
	name: string;
	artist: string;
	duration: number;
	image: string | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(`qamuz_lastfm_${key}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { data: T; timestamp: number };
		if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
			localStorage.removeItem(`qamuz_lastfm_${key}`);
			return null;
		}
		return parsed.data;
	} catch {
		return null;
	}
}

function setCache<T>(key: string, data: T) {
	try {
		localStorage.setItem(`qamuz_lastfm_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
	} catch {
		/* ignore quota errors */
	}
}

const FALLBACK_TOP_TAGS: LastfmTag[] = [
	{ name: 'electronic', count: 0, reach: 262929 },
	{ name: 'reggaeton', count: 0, reach: 184200 },
	{ name: 'trap', count: 0, reach: 198500 },
	{ name: 'synthwave', count: 0, reach: 112400 },
	{ name: 'lo-fi', count: 0, reach: 145000 },
	{ name: 'latin', count: 0, reach: 178000 },
	{ name: 'pop', count: 0, reach: 234310 },
	{ name: 'rock', count: 0, reach: 403461 },
	{ name: 'indie', count: 0, reach: 260905 },
	{ name: 'hip-hop', count: 0, reach: 215000 },
	{ name: 'afrobeat', count: 0, reach: 98400 },
	{ name: 'techno', count: 0, reach: 120500 },
	{ name: 'rnb', count: 0, reach: 135000 },
	{ name: 'ambient', count: 0, reach: 110000 },
	{ name: 'bachata', count: 0, reach: 89000 },
];

let liveStatus: boolean | null = null;

/** Last.fm listener tags that describe habits, not sound; useless as a music style. */
const NON_MUSICAL_TAGS = new Set(['seen live', 'favorites', 'favourites', 'favorite', 'albums i own', 'under 2000 listeners', 'awesome', 'beautiful', 'love', 'my favorite', 'spotify']);

/** True when the last top-tags fetch came from Last.fm, false when it used the built-in sample list. */
export function lastfmIsLive(): boolean | null {
	return liveStatus;
}

/** Fetch top global musical tags/genres from Last.fm (cached for 1h). */
export async function fetchLastfmTopTags(limit = 30): Promise<LastfmTag[]> {
	const cacheKey = `top_tags_${limit}`;
	const cached = getCached<LastfmTag[]>(cacheKey);
	if (cached && cached.length > 0) {
		liveStatus = true;
		return cached;
	}

	try {
		const res = await invokeStudio<{ tags?: LastfmTag[]; error?: string }>({
			action: 'lastfm_top_tags',
			num: limit,
		});

		if (res.data?.tags && res.data.tags.length > 0) {
			const musical = res.data.tags.filter((t) => !NON_MUSICAL_TAGS.has(t.name.toLowerCase()));
			setCache(cacheKey, musical);
			liveStatus = true;
			return musical;
		}
	} catch (e) {
		console.warn('Failed to fetch Last.fm top tags:', e);
	}

	liveStatus = false;
	return FALLBACK_TOP_TAGS.slice(0, limit);
}

/** Fetch top tracks globally for a specific Last.fm tag/genre. */
export async function fetchLastfmTagTracks(tag: string, limit = 15): Promise<LastfmTrack[]> {
	const safeTag = tag.trim().toLowerCase();
	if (!safeTag) return [];

	const cacheKey = `tag_tracks_${safeTag}_${limit}`;
	const cached = getCached<LastfmTrack[]>(cacheKey);
	if (cached) return cached;

	try {
		const res = await invokeStudio<{ tracks?: LastfmTrack[]; error?: string }>({
			action: 'lastfm_tag_tracks',
			tag: safeTag,
			num: limit,
		});

		if (res.data?.tracks) {
			setCache(cacheKey, res.data.tracks);
			return res.data.tracks;
		}
	} catch (e) {
		console.warn(`Failed to fetch Last.fm tracks for tag ${safeTag}:`, e);
	}

	return [];
}

/** Fetch similar tracks based on Last.fm collaborative filtering algorithm. */
export async function fetchLastfmSimilar(track: string, artist: string): Promise<LastfmTrack[]> {
	if (!track.trim() || !artist.trim()) return [];

	const cacheKey = `similar_${encodeURIComponent(track)}_${encodeURIComponent(artist)}`;
	const cached = getCached<LastfmTrack[]>(cacheKey);
	if (cached) return cached;

	try {
		const res = await invokeStudio<{ similar?: LastfmTrack[]; error?: string }>({
			action: 'lastfm_similar',
			track: track.trim(),
			artist: artist.trim(),
		});

		if (res.data?.similar) {
			setCache(cacheKey, res.data.similar);
			return res.data.similar;
		}
	} catch (e) {
		console.warn(`Failed to fetch similar tracks for ${track}:`, e);
	}

	return [];
}

