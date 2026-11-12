import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PlayerContext, type RepeatMode } from '@/contexts/player-context';
import type { TrackWithArtist } from '@/types/music';
import { trackEvent } from '@/lib/engagement';

export function PlayerProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const audioRef = useRef<HTMLAudioElement | null>(null);
	if (audioRef.current === null && typeof window !== 'undefined') {
		audioRef.current = new Audio();
	}

	const [queue, setQueue] = useState<TrackWithArtist[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolumeState] = useState(0.8);
	const [shuffle, setShuffle] = useState(false);
	const [sequential, setSequential] = useState(true);
	const [repeat, setRepeat] = useState<RepeatMode>('off');
	const [expanded, setExpanded] = useState(false);
	const [nowPlayingTab, setNowPlayingTab] = useState<'lyrics' | 'queue' | 'comments'>('lyrics');
	const [sidePanelOpen, setSidePanelOpen] = useState(false);
	const isSidePanelVisible = expanded || sidePanelOpen;
	const endedRef = useRef<() => void>(() => undefined);
	const pendingSeekRef = useRef<number | null>(null);
	const playListenersRef = useRef(new Set<() => void>());

	const current = queue[currentIndex] ?? null;

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		const onTime = () => setProgress(audio.currentTime);
		const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
		const onPlay = () => {
			setIsPlaying(true);
			playListenersRef.current.forEach((stop) => stop());
		};
		const onPause = () => setIsPlaying(false);
		const onEnded = () => endedRef.current();
		audio.addEventListener('timeupdate', onTime);
		audio.addEventListener('loadedmetadata', onMeta);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('ended', onEnded);
		return () => {
			audio.removeEventListener('timeupdate', onTime);
			audio.removeEventListener('loadedmetadata', onMeta);
			audio.removeEventListener('play', onPlay);
			audio.removeEventListener('pause', onPause);
			audio.removeEventListener('ended', onEnded);
			audio.pause();
		};
	}, []);

	useEffect(() => {
		const audio = audioRef.current;
		if (audio) audio.volume = volume;
	}, [volume]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio || !current) return;
		if (audio.src !== current.audio_url) {
			audio.src = current.audio_url;
			setProgress(0);
			setDuration(current.duration_seconds || 0);
		}
		const seekTo = pendingSeekRef.current;
		pendingSeekRef.current = null;
		if (seekTo !== null && seekTo > 0) {
			const apply = () => {
				audio.currentTime = seekTo;
				setProgress(seekTo);
			};
			if (audio.readyState >= 1) apply();
			else audio.addEventListener('loadedmetadata', apply, { once: true });
		}
		void audio.play().catch(() => undefined);
	}, [current]);

	// Public view counter (also for visitors who aren't signed in).
	const currentId = current?.id;
	useEffect(() => {
		if (!currentId) return;
		void trackEvent(currentId, 'view');
	}, [currentId]);

	// Listening history for the signed-in user.
	useEffect(() => {
		if (!supabase || !user || !current) return;
		void supabase.from('play_history').insert({ user_id: user.id, track_id: current.id });
	}, [current, user]);

	const advance = useCallback(
		(auto: boolean) => {
			setCurrentIndex((prev) => {
				if (queue.length === 0) return prev;
				if (shuffle && queue.length > 1) {
					let candidate = prev;
					while (candidate === prev) candidate = Math.floor(Math.random() * queue.length);
					return candidate;
				}
				if (prev + 1 < queue.length) return prev + 1;
				if (repeat === 'all') return 0;
				if (auto) {
					audioRef.current?.pause();
					return prev;
				}
				return 0;
			});
		},
		[queue.length, shuffle, repeat],
	);

	endedRef.current = () => {
		const audio = audioRef.current;
		if (repeat === 'one' && audio) {
			audio.currentTime = 0;
			void audio.play().catch(() => undefined);
			return;
		}
		advance(true);
	};

	const previous = useCallback(() => {
		const audio = audioRef.current;
		if (audio && audio.currentTime > 4) {
			audio.currentTime = 0;
			return;
		}
		setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
	}, []);

	const playTracks = useCallback(
		(tracks: TrackWithArtist[], startIndex = 0) => {
			if (tracks.length === 0) return;
			const target = tracks[startIndex] ?? tracks[0];
			if (current && target.id === current.id) {
				const audio = audioRef.current;
				if (!audio) return;
				if (audio.paused) void audio.play().catch(() => undefined);
				else audio.pause();
				return;
			}
			setQueue(tracks);
			setCurrentIndex(startIndex);
		},
		[current],
	);

	const playFrom = useCallback(
		(tracks: TrackWithArtist[], index: number, startAt = 0) => {
			const target = tracks[index];
			if (!target) return;
			const audio = audioRef.current;
			setQueue(tracks);
			setCurrentIndex(index);
			if (current && target.id === current.id) {
				if (audio?.paused) void audio.play().catch(() => undefined);
				return;
			}
			pendingSeekRef.current = startAt;
		},
		[current],
	);

	const getTime = useCallback(() => audioRef.current?.currentTime ?? 0, []);

	const toggle = useCallback(() => {
		const audio = audioRef.current;
		if (!audio || !current) return;
		if (audio.paused) void audio.play().catch(() => undefined);
		else audio.pause();
	}, [current]);

	const pause = useCallback(() => {
		const audio = audioRef.current;
		if (audio && !audio.paused) audio.pause();
	}, []);

	const onGlobalPlay = useCallback((stop: () => void) => {
		playListenersRef.current.add(stop);
		return () => {
			playListenersRef.current.delete(stop);
		};
	}, []);

	const seek = useCallback((seconds: number) => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.currentTime = seconds;
		setProgress(seconds);
	}, []);

	const setVolume = useCallback((value: number) => setVolumeState(Math.min(1, Math.max(0, value))), []);
	const toggleShuffle = useCallback(() => {
		setShuffle((s) => {
			const next = !s;
			if (next) setSequential(false);
			return next;
		});
	}, []);
	const toggleSequential = useCallback(() => {
		setSequential((s) => {
			const next = !s;
			if (next) setShuffle(false);
			return next;
		});
	}, []);
	const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), []);
	const jumpTo = useCallback((index: number) => setCurrentIndex(index), []);
	const next = useCallback(() => advance(false), [advance]);

	return (
		<PlayerContext.Provider
			value={{
				queue,
				current,
				currentIndex,
				isPlaying,
				progress,
				duration,
				volume,
				shuffle,
				sequential,
				repeat,
				expanded,
				nowPlayingTab,
				sidePanelOpen,
				isSidePanelVisible,
				playTracks,
				playFrom,
				getTime,
				toggle,
				pause,
				onGlobalPlay,
				next,
				previous,
				seek,
				setVolume,
				toggleShuffle,
				toggleSequential,
				cycleRepeat,
				setExpanded,
				setNowPlayingTab,
				setSidePanelOpen,
				jumpTo,
			}}
		>
			{children}
		</PlayerContext.Provider>
	);
}
