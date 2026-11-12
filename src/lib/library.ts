import { songFromVideo, songsFromCreation, videoSourceOf, type Creation, type StudioSong } from '@/lib/studio';

export interface LibraryData {
	songs: StudioSong[];
	videoBySong: Map<string, string>;
	videos: Creation[];
	creationById: Map<string, Creation>;
}

/** Turns the user's creations into the Library lists: ready songs, which songs have a video, and ready videos. */
export function buildLibrary(creations: Creation[]): LibraryData {
	const creationById = new Map(creations.map((c) => [c.id, c]));
	const aiSongs = creations.filter((c) => c.status === 'ready').flatMap(songsFromCreation);
	const keys = new Set(aiSongs.map((s) => s.key));
	const videoBySong = new Map<string, string>();
	const extra: StudioSong[] = [];
	for (const c of creations) {
		if (c.kind !== 'video') continue;
		const src = videoSourceOf(c);
		if (!src) continue;
		const ready = c.status === 'ready' && c.result_urls[0];
		if (src.song_key && keys.has(src.song_key)) {
			if (ready && !videoBySong.has(src.song_key)) videoBySong.set(src.song_key, c.result_urls[0]);
		} else {
			extra.push(songFromVideo(c, src));
			if (ready) videoBySong.set(`video:${c.id}`, c.result_urls[0]);
		}
	}
	const videos = creations.filter((c) => c.kind === 'video' && c.status === 'ready' && c.result_urls[0]);
	return { songs: [...aiSongs, ...extra], videoBySong, videos, creationById };
}

export function songPath(song: Pick<StudioSong, 'creationId' | 'index'>): string {
	return `/cancion/${song.creationId}/${song.index}`;
}

/** "2026-03-13 14:26" */
export function formatStamp(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
