import { createContext } from 'react';
import type { TrackWithArtist } from '@/types/music';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerContextType {
	queue: TrackWithArtist[];
	current: TrackWithArtist | null;
	currentIndex: number;
	isPlaying: boolean;
	progress: number;
	duration: number;
	volume: number;
	shuffle: boolean;
	sequential: boolean;
	repeat: RepeatMode;
	expanded: boolean;
	sidePanelOpen: boolean;
	isSidePanelVisible: boolean;
	nowPlayingTab: 'lyrics' | 'queue' | 'comments';
	playTracks: (tracks: TrackWithArtist[], startIndex?: number) => void;
	/** Start a track from a given second without toggling pause (used by Shorts). */
	playFrom: (tracks: TrackWithArtist[], index: number, startAt?: number) => void;
	/** Precise playback position in seconds, read straight from the audio element. */
	getTime: () => number;
	toggle: () => void;
	/** Pause the main player (no-op if already paused). */
	pause: () => void;
	/** Run `stop` whenever the main player starts playing; returns an unsubscribe. Used so other audio (DAW, stems) never overlaps. */
	onGlobalPlay: (stop: () => void) => () => void;
	next: () => void;
	previous: () => void;
	seek: (seconds: number) => void;
	setVolume: (value: number) => void;
	toggleShuffle: () => void;
	toggleSequential: () => void;
	cycleRepeat: () => void;
	setExpanded: (value: boolean) => void;
	setSidePanelOpen: (value: boolean) => void;
	setNowPlayingTab: (tab: 'lyrics' | 'queue' | 'comments') => void;
	jumpTo: (index: number) => void;
}

export const PlayerContext = createContext<PlayerContextType | null>(null);
