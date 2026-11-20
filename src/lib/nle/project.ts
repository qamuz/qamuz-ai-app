import type { StudioSong } from '@/lib/studio';
import type { MusicalCutSlot } from '@/lib/nle/audioAnalyzer';
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

export interface BeatCutSourceItem {
	title: string;
	type: 'video' | 'image';
	sourceUrl: string;
	thumbnailUrl?: string | null;
	startTime: number;
	endTime: number;
	aiPrompt?: string;
}

/**
 * Dynamically maps and cuts visual sources onto contiguous, beat-locked 1–2s compás slots.
 * Preserves chronological narrative continuity (never teleports randomly to distant acts),
 * disables CSS Ken Burns on real AI video clips so camera movement never double-jumps,
 * keeps trimStart = 0 on short video clips to prevent EOF loop snaps, and blends scene changes smoothly.
 */
export function buildDynamicBeatClips(
	sources: BeatCutSourceItem[],
	slots: MusicalCutSlot[],
	trackId = 'track-v1'
): NleClip[] {
	if (sources.length === 0 || slots.length === 0) return [];

	const orderedSources = [...sources].sort((a, b) => a.startTime - b.startTime);
	const uniquePool: BeatCutSourceItem[] = [];
	const seenUrls = new Set<string>();
	for (const s of orderedSources) {
		if (!s.sourceUrl || seenUrls.has(s.sourceUrl)) continue;
		seenUrls.add(s.sourceUrl);
		uniquePool.push(s);
	}
	if (uniquePool.length === 0) return [];

	const imageMotions: NleClip['cameraMotion'][] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];
	const maxEnd = Math.max(1, orderedSources[orderedSources.length - 1]?.endTime ?? 45);
	let lastUrl = '';
	let lastPoolIdx = -1;
	let consecutiveSameUrl = 0;

	return slots.map((slot) => {
		const mid = (slot.startTime + slot.endTime) / 2;
		let primaryIdx = orderedSources.findIndex((s) => mid >= s.startTime && mid <= s.endTime);
		if (primaryIdx < 0) {
			primaryIdx = Math.min(
				orderedSources.length - 1,
				Math.floor((mid / maxEnd) * orderedSources.length)
			);
		}
		const primary = orderedSources[primaryIdx] ?? uniquePool[0];
		const primaryPoolIdx = Math.max(
			0,
			uniquePool.findIndex((u) => u.sourceUrl === primary.sourceUrl)
		);

		// Stay strictly chronological: anchor to primary scene, only gently peek forward to the
		// immediate next scene (+1) when a shot has played twice or on a chorus peak, and never jump > 1 scene.
		let chosenPoolIdx = primaryPoolIdx;
		if (uniquePool.length > 1) {
			if (
				uniquePool[chosenPoolIdx].sourceUrl === lastUrl &&
				(consecutiveSameUrl >= 2 || slot.isHighEnergy)
			) {
				chosenPoolIdx =
					primaryPoolIdx + 1 < uniquePool.length
						? primaryPoolIdx + 1
						: Math.max(0, primaryPoolIdx - 1);
			}
			if (lastPoolIdx >= 0 && Math.abs(chosenPoolIdx - lastPoolIdx) > 1) {
				chosenPoolIdx = lastPoolIdx + Math.sign(chosenPoolIdx - lastPoolIdx);
			}
		}

		const chosen = uniquePool[chosenPoolIdx] ?? primary;
		const isSceneChange = Boolean(lastUrl) && chosen.sourceUrl !== lastUrl;
		if (chosen.sourceUrl === lastUrl) {
			consecutiveSameUrl += 1;
		} else {
			consecutiveSameUrl = 1;
		}
		lastUrl = chosen.sourceUrl;
		lastPoolIdx = chosenPoolIdx;

		const cleanTitle = chosen.title.replace(/\s*·\s*C\d+$/i, '');

		return {
			id: makeClipId(chosen.type === 'video' ? 'vid' : 'img'),
			trackId,
			type: chosen.type,
			title: `${cleanTitle} · C${slot.cutIndex + 1}`,
			sourceUrl: chosen.sourceUrl,
			thumbnailUrl: chosen.thumbnailUrl ?? undefined,
			startTime: slot.startTime,
			duration: slot.duration,
			// Always start short AI videos at 0 so they never hit EOF mid-cut and snap back to frame 0
			trimStart: 0,
			opacity: 1,
			speed: 1,
			volume: 0,
			lutId: 'inherit',
			colorAdjust: { ...DEFAULT_COLOR_ADJUST },
			// Never stack artificial CSS Ken Burns on top of already-moving AI video clips
			cameraMotion:
				chosen.type === 'video' ? 'none' : imageMotions[slot.cutIndex % imageMotions.length],
			// Smooth short cross-dissolve whenever transitioning between two different scenes
			transitionIn: isSceneChange || slot.isVocalEntryBoundary ? 'cross-dissolve' : 'none',
			aiPrompt: chosen.aiPrompt,
		};
	});
}

/**
 * Finds the exact musical compás slot containing `time` (or the nearest following slot)
 * so newly inserted visual clips automatically lock to 1–2s compás timing.
 */
export function alignTimeToBeatSlot(
	time: number,
	slots: MusicalCutSlot[]
): { startTime: number; duration: number } | null {
	if (slots.length === 0) return null;
	const exact = slots.find((s) => time >= s.startTime - 0.05 && time < s.endTime - 0.05);
	if (exact) {
		return { startTime: exact.startTime, duration: exact.duration };
	}
	const last = slots[slots.length - 1];
	return { startTime: last.startTime, duration: last.duration };
}

/**
 * Builds a sorted, deduplicated list of musical compás/beat grid timestamps
 * used for strict snap-to-grid quantization of video clips.
 */
export function buildCompasGridMarkers(params: {
	totalDuration: number;
	beatTimes?: number[];
	barTimes?: number[];
	beatCutSlots?: MusicalCutSlot[];
	vocalEntryTime?: number | null;
}): number[] {
	const maxT = Math.max(4, Number(params.totalDuration) || 45);
	const raw: number[] = [0];

	if (params.barTimes) {
		for (const t of params.barTimes) {
			if (Number.isFinite(t) && t >= 0 && t <= maxT + 0.25) raw.push(t);
		}
	}
	if (params.beatTimes) {
		for (const t of params.beatTimes) {
			if (Number.isFinite(t) && t >= 0 && t <= maxT + 0.25) raw.push(t);
		}
	}
	if (params.beatCutSlots) {
		for (const s of params.beatCutSlots) {
			if (Number.isFinite(s.startTime) && s.startTime >= 0) raw.push(s.startTime);
			if (Number.isFinite(s.endTime) && s.endTime >= 0) raw.push(s.endTime);
		}
	}
	if (
		typeof params.vocalEntryTime === 'number' &&
		Number.isFinite(params.vocalEntryTime) &&
		params.vocalEntryTime > 0 &&
		params.vocalEntryTime <= maxT
	) {
		raw.push(params.vocalEntryTime);
	}

	// Fallback 0.5s grid if no musical analysis markers exist yet
	if (raw.length <= 2) {
		for (let t = 0.5; t <= maxT; t += 0.5) {
			raw.push(Number(t.toFixed(3)));
		}
	}
	raw.push(Number(maxT.toFixed(3)));

	raw.sort((a, b) => a - b);
	const deduped: number[] = [];
	for (const t of raw) {
		const rounded = Number(Math.max(0, t).toFixed(3));
		if (deduped.length === 0 || rounded - deduped[deduped.length - 1] >= 0.06) {
			deduped.push(rounded);
		}
	}
	return deduped;
}

/**
 * Strictly snaps a raw timestamp onto the closest compás grid marker >= minTime.
 */
export function snapToNearestGridMarker(
	rawTime: number,
	gridMarkers: number[],
	minTime = 0
): number {
	const safeMin = Math.max(0, minTime);
	if (gridMarkers.length === 0) {
		return Number(Math.max(safeMin, Math.round(rawTime * 2) / 2).toFixed(3));
	}

	let best = -1;
	let bestDist = Infinity;
	for (const m of gridMarkers) {
		if (m < safeMin - 0.001) continue;
		const dist = Math.abs(rawTime - m);
		if (dist < bestDist) {
			bestDist = dist;
			best = m;
		}
	}

	if (best >= 0) return Number(best.toFixed(3));

	// Beyond the last known grid marker: extrapolate using the last interval
	const last = gridMarkers[gridMarkers.length - 1] ?? 0;
	const prev = gridMarkers.length >= 2 ? gridMarkers[gridMarkers.length - 2] : Math.max(0, last - 0.5);
	const step = Math.max(0.4, last - prev);
	const stepsBeyond = Math.max(1, Math.ceil((Math.max(safeMin, rawTime) - last) / step));
	return Number((last + stepsBeyond * step).toFixed(3));
}

/**
 * Forces every video clip's start and end onto the nearest compás grid marker,
 * guaranteeing strictly contiguous clips with ZERO empty gaps and ZERO overlaps.
 */
export function snapVideoTrackClipsToCompasGrid(
	clips: NleClip[],
	gridMarkers: number[],
	minClipDuration = 0.45
): NleClip[] {
	if (clips.length === 0) return clips;

	const sorted = [...clips].sort((a, b) => {
		if (Math.abs(a.startTime - b.startTime) > 0.01) return a.startTime - b.startTime;
		return a.startTime + a.duration - (b.startTime + b.duration);
	});

	const result: NleClip[] = [];
	let cursor = 0;

	for (let i = 0; i < sorted.length; i++) {
		const clip = sorted[i];
		const rawEnd = clip.startTime + Math.max(minClipDuration, clip.duration);

		// First clip snaps to 0 if near start (<= 0.5s), otherwise to nearest compás marker;
		// all subsequent clips start strictly at the previous clip's snapped end (0 gaps, 0 overlaps).
		const snappedStart =
			i === 0
				? clip.startTime <= 0.5
					? 0
					: snapToNearestGridMarker(clip.startTime, gridMarkers, 0)
				: cursor;

		const desiredEnd = Math.max(snappedStart + minClipDuration, rawEnd);
		let snappedEnd = snapToNearestGridMarker(
			desiredEnd,
			gridMarkers,
			snappedStart + minClipDuration
		);
		if (snappedEnd - snappedStart < minClipDuration) {
			snappedEnd = snapToNearestGridMarker(
				snappedStart + minClipDuration,
				gridMarkers,
				snappedStart + minClipDuration
			);
		}

		const nextDuration = Number((snappedEnd - snappedStart).toFixed(3));
		result.push({
			...clip,
			startTime: Number(snappedStart.toFixed(3)),
			duration: Math.max(minClipDuration, nextDuration),
		});
		cursor = Number(snappedEnd.toFixed(3));
	}

	return result;
}

/**
 * Performs a gap-free, overlap-free compás-locked trim (rolling edit at shared boundaries)
 * on a single video track so dragging left/right clip edges always lands on exact compás markers.
 */
export function applyGridTrimToTrack(
	clips: NleClip[],
	clipId: string,
	mode: 'trim-left' | 'trim-right',
	targetTime: number,
	gridMarkers: number[],
	minClipDuration = 0.45
): NleClip[] {
	const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
	const idx = sorted.findIndex((c) => c.id === clipId);
	if (idx < 0) return clips;

	const current = sorted[idx];
	const nextClips = sorted.map((c) => ({ ...c }));

	if (mode === 'trim-right') {
		const snappedEnd = snapToNearestGridMarker(
			targetTime,
			gridMarkers,
			current.startTime + minClipDuration
		);
		nextClips[idx].duration = Number((snappedEnd - current.startTime).toFixed(3));

		const rightNeighbor = nextClips[idx + 1];
		if (rightNeighbor) {
			const rightOrigEnd = rightNeighbor.startTime + rightNeighbor.duration;
			// Rolling edit if boundary stays strictly before right neighbor's end
			if (rightOrigEnd - snappedEnd >= minClipDuration) {
				const delta = snappedEnd - rightNeighbor.startTime;
				rightNeighbor.startTime = Number(snappedEnd.toFixed(3));
				rightNeighbor.duration = Number((rightOrigEnd - snappedEnd).toFixed(3));
				rightNeighbor.trimStart = Math.max(
					0,
					Number((rightNeighbor.trimStart + delta).toFixed(3))
				);
			} else {
				// Cascade subsequent clips forward onto compás markers so nothing overlaps
				let cur = snappedEnd;
				for (let j = idx + 1; j < nextClips.length; j++) {
					const origDur = Math.max(minClipDuration, nextClips[j].duration);
					const endJ = snapToNearestGridMarker(
						cur + origDur,
						gridMarkers,
						cur + minClipDuration
					);
					nextClips[j].startTime = Number(cur.toFixed(3));
					nextClips[j].duration = Number((endJ - cur).toFixed(3));
					cur = endJ;
				}
			}
		}
		return nextClips;
	}

	// mode === 'trim-left'
	const currentEnd = current.startTime + current.duration;
	const maxAllowedStart = currentEnd - minClipDuration;
	const leftNeighbor = idx > 0 ? nextClips[idx - 1] : null;
	const minAllowedStart = leftNeighbor ? leftNeighbor.startTime + minClipDuration : 0;

	const clampedTarget = Math.max(minAllowedStart, Math.min(maxAllowedStart, targetTime));
	let snappedStart = snapToNearestGridMarker(clampedTarget, gridMarkers, minAllowedStart);
	if (snappedStart > maxAllowedStart) {
		// Pick the largest marker <= maxAllowedStart
		const candidates = gridMarkers.filter(
			(m) => m >= minAllowedStart - 0.001 && m <= maxAllowedStart + 0.001
		);
		snappedStart = candidates.length > 0 ? candidates[candidates.length - 1] : minAllowedStart;
	}

	const deltaStart = snappedStart - current.startTime;
	nextClips[idx].startTime = Number(snappedStart.toFixed(3));
	nextClips[idx].duration = Number((currentEnd - snappedStart).toFixed(3));
	nextClips[idx].trimStart = Math.max(0, Number((current.trimStart + deltaStart).toFixed(3)));

	if (leftNeighbor) {
		leftNeighbor.duration = Number((snappedStart - leftNeighbor.startTime).toFixed(3));
	}

	return nextClips;
}

/**
 * Quantizes all unlocked video tracks (or a single target track) strictly onto the compás grid,
 * eliminating any empty gaps or clip overlaps.
 */
export function snapVideoTracksToGrid(
	tracks: NleTrack[],
	gridMarkers: number[],
	targetTrackId?: string
): NleTrack[] {
	return tracks.map((track) => {
		if (track.locked || track.kind !== 'video') return track;
		if (targetTrackId && track.id !== targetTrackId) return track;
		if (track.clips.length === 0) return track;
		return {
			...track,
			clips: snapVideoTrackClipsToCompasGrid(track.clips, gridMarkers),
		};
	});
}


