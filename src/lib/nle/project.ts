import type { StudioSong } from '@/lib/studio';
import {
	DEFAULT_COLOR_ADJUST,
	type NleClip,
	type NleTrack,
} from '@/lib/nle/types';

export function makeClipId(prefix = 'clip'): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Initializes a clean multitrack Premiere/Filmora timeline.
 * Only places the user's real song audio on A1 when provided — zero demo stock images.
 */
export function createInitialTracksFromSong(song: StudioSong | null): NleTrack[] {
	const totalDur = Math.max(15, Math.min(song?.duration || 45, 240));

	const a1Clips: NleClip[] =
		song && song.audioUrl
			? [
					{
						id: makeClipId('a1'),
						trackId: 'track-a1',
						type: 'audio',
						title: song.title,
						sourceUrl: song.audioUrl,
						thumbnailUrl: song.coverUrl,
						startTime: 0,
						duration: totalDur,
						trimStart: 0,
						opacity: 1,
						speed: 1,
						volume: 1,
						lutId: 'inherit',
						colorAdjust: { ...DEFAULT_COLOR_ADJUST },
						cameraMotion: 'none',
						transitionIn: 'none',
					},
			  ]
			: [];

	return [
		{
			id: 'track-t1',
			channelLabel: 'T1',
			name: 'Títulos y Letras',
			kind: 'text',
			muted: false,
			hidden: false,
			locked: false,
			volume: 1,
			clips: [],
		},
		{
			id: 'track-v2',
			channelLabel: 'V2',
			name: 'B-Roll / Superposición',
			kind: 'video',
			muted: false,
			hidden: false,
			locked: false,
			volume: 1,
			clips: [],
		},
		{
			id: 'track-v1',
			channelLabel: 'V1',
			name: 'Video Principal',
			kind: 'video',
			muted: false,
			hidden: false,
			locked: false,
			volume: 1,
			clips: [],
		},
		{
			id: 'track-a1',
			channelLabel: 'A1',
			name: 'Música Principal',
			kind: 'audio',
			muted: false,
			hidden: false,
			locked: false,
			volume: 1,
			clips: a1Clips,
		},
		{
			id: 'track-a2',
			channelLabel: 'A2',
			name: 'SFX & Ambiente',
			kind: 'audio',
			muted: false,
			hidden: false,
			locked: false,
			volume: 0.85,
			clips: [],
		},
	];
}

export function computeTimelineDuration(tracks: NleTrack[]): number {
	let maxEnd = 0;
	for (const track of tracks) {
		for (const clip of track.clips) {
			const end = clip.startTime + clip.duration;
			if (end > maxEnd) maxEnd = end;
		}
	}
	return Math.max(15, Math.ceil(maxEnd));
}

export function splitClipAtTime(tracks: NleTrack[], clipId: string, splitAt: number): NleTrack[] {
	return tracks.map((track) => {
		if (track.locked) return track;
		const idx = track.clips.findIndex((c) => c.id === clipId);
		if (idx < 0) return track;
		const clip = track.clips[idx];
		const offset = splitAt - clip.startTime;
		if (offset < 0.5 || clip.duration - offset < 0.5) return track;

		const leftPart: NleClip = {
			...clip,
			duration: Number(offset.toFixed(2)),
		};
		const rightPart: NleClip = {
			...clip,
			id: makeClipId(clip.type),
			title: `${clip.title} (2)`,
			startTime: Number(splitAt.toFixed(2)),
			duration: Number((clip.duration - offset).toFixed(2)),
			trimStart: Number((clip.trimStart + offset * clip.speed).toFixed(2)),
			transitionIn: 'none',
		};
		const nextClips = [...track.clips];
		nextClips.splice(idx, 1, leftPart, rightPart);
		return { ...track, clips: nextClips };
	});
}

export function deleteClipFromTracks(tracks: NleTrack[], clipId: string): NleTrack[] {
	return tracks.map((track) => {
		if (track.locked) return track;
		return {
			...track,
			clips: track.clips.filter((c) => c.id !== clipId),
		};
	});
}
