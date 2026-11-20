import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Pause,
	Play,
	Scissors,
	SkipBack,
	SkipForward,
	StepBack,
	StepForward,
	Volume2,
	VolumeX,
} from 'lucide-react';
import { formatTime } from '@/lib/format';
import { buildCssFilter } from '@/lib/nle/renderer';
import type {
	NleAspectRatio,
	NleClip,
	NleProjectFx,
	NleTrack,
} from '@/lib/nle/types';

interface Props {
	tracks: NleTrack[];
	fx: NleProjectFx;
	aspect: NleAspectRatio;
	playhead: number;
	totalDuration: number;
	isPlaying: boolean;
	masterMuted: boolean;
	seekVersion?: number;
	onRegisterAudioClock?: (getter: (() => number | null) | null) => void;
	onTogglePlay: () => void;
	onSeek: (time: number) => void;
	onToggleMasterMute: () => void;
	onSplitAtPlayhead: () => void;
}

function activeClipInTrack(track: NleTrack, t: number): NleClip | null {
	if (track.clips.length === 0) return null;
	const exact = track.clips.find(
		(c) => t >= c.startTime && t < c.startTime + c.duration
	);
	if (exact) return exact;

	// Bridge floating-point or tiny edit micro-gaps (<= 0.08s) so cuts never drop to black
	const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
	for (let i = 0; i < sorted.length; i++) {
		const c = sorted[i];
		const end = c.startTime + c.duration;
		const next = sorted[i + 1];
		if (next && t >= end - 0.001 && t < next.startTime && next.startTime - end <= 0.08) {
			return next;
		}
	}
	const last = sorted[sorted.length - 1];
	if (last && t >= last.startTime && t <= last.startTime + last.duration + 0.08) {
		return last;
	}
	return null;
}

function findPreviousClipInTrack(track: NleTrack, current: NleClip): NleClip | null {
	return (
		track.clips
			.filter((c) => c.id !== current.id && c.startTime < current.startTime)
			.sort((a, b) => b.startTime + b.duration - (a.startTime + a.duration))[0] ?? null
	);
}

function findUpcomingClipsInTrack(track: NleTrack, t: number, count = 3): NleClip[] {
	return track.clips
		.filter((c) => c.startTime > t && c.startTime - t <= 10)
		.sort((a, b) => a.startTime - b.startTime)
		.slice(0, count);
}

function getMotionTransform(clip: NleClip, t: number): string {
	const ratio = Math.max(0, Math.min(1, (t - clip.startTime) / Math.max(0.1, clip.duration)));
	if (clip.cameraMotion === 'zoom-in') {
		return `translate3d(0, 0, 0) scale(${(1 + ratio * 0.045).toFixed(4)})`;
	}
	if (clip.cameraMotion === 'zoom-out') {
		return `translate3d(0, 0, 0) scale(${(1.045 - ratio * 0.045).toFixed(4)})`;
	}
	if (clip.cameraMotion === 'pan-left') {
		return `translate3d(${(-ratio * 1.8).toFixed(3)}%, 0, 0) scale(1.04)`;
	}
	if (clip.cameraMotion === 'pan-right') {
		return `translate3d(${(ratio * 1.8).toFixed(3)}%, 0, 0) scale(1.04)`;
	}
	return 'translate3d(0, 0, 0) scale(1)';
}

function getTransitionOpacity(clip: NleClip, t: number, hasOutgoingUnderlay: boolean): number {
	const localT = Math.max(0, t - clip.startTime);
	const transDur = Math.min(0.28, Math.max(0.14, clip.duration * 0.2));
	if (clip.transitionIn === 'fade-black' && transDur > 0.05 && localT < transDur) {
		return clip.opacity * Math.max(0, localT / transDur);
	}
	if (clip.transitionIn === 'cross-dissolve' && hasOutgoingUnderlay && transDur > 0.05 && localT < transDur) {
		return clip.opacity * Math.max(0, localT / transDur);
	}
	return clip.opacity;
}

function VisualLayer({
	clip,
	fx,
	playhead,
	isPlaying,
	masterMuted,
	trackMuted,
	trackVolume,
	seekVersion,
	mode,
	hasOutgoingUnderlay,
}: {
	clip: NleClip;
	fx: NleProjectFx;
	playhead: number;
	isPlaying: boolean;
	masterMuted: boolean;
	trackMuted: boolean;
	trackVolume: number;
	seekVersion: number;
	mode: 'active' | 'outgoing' | 'preload';
	hasOutgoingUnderlay: boolean;
}) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const lastSeekVersionRef = useRef(seekVersion);
	const prevModeRef = useRef<string>(mode);
	const needsInitialSyncRef = useRef<boolean>(true);
	const [videoFrameReady, setVideoFrameReady] = useState(false);
	const effLut = clip.lutId !== 'inherit' ? clip.lutId : fx.lutId;
	const filter = buildCssFilter(effLut, clip.colorAdjust);

	// Reset ready flag only if the underlying video URL changes
	useEffect(() => {
		setVideoFrameReady(false);
	}, [clip.sourceUrl]);

	// Pre-decode thumbnail/image into GPU bitmap cache to eliminate first-frame paint flicker
	useEffect(() => {
		const url = clip.type === 'video' ? clip.thumbnailUrl : clip.sourceUrl;
		if (!url) return;
		const img = new Image();
		img.decoding = 'async';
		img.src = url;
		if (typeof img.decode === 'function') {
			void img.decode().catch(() => undefined);
		}
	}, [clip.type, clip.sourceUrl, clip.thumbnailUrl]);

	const clampedTime =
		mode === 'outgoing'
			? clip.startTime + clip.duration
			: mode === 'preload'
			? clip.startTime
			: playhead;
	const transform = getMotionTransform(clip, clampedTime);
	const opacity =
		mode === 'preload'
			? 0
			: mode === 'outgoing'
			? clip.opacity
			: getTransitionOpacity(clip, playhead, hasOutgoingUnderlay);

	useEffect(() => {
		const vid = videoRef.current;
		if (!vid || clip.type !== 'video') return;
		vid.muted = mode === 'preload' || masterMuted || trackMuted || clip.volume === 0;
		vid.volume = Math.max(0, Math.min(1, clip.volume * trackVolume));
		vid.playbackRate = clip.speed;

		const dur = Number.isFinite(vid.duration) && vid.duration > 0.4 ? vid.duration : 0;
		// Avoid snapping short (~2s) SVD videos back to frame 0 mid-cut: only loop when the clip is much longer than the source file.
		const shouldLoop = dur > 0 ? clip.duration * clip.speed > dur + 0.35 : false;
		vid.loop = shouldLoop;

		if (vid.readyState >= 2 && !vid.seeking) {
			setVideoFrameReady(true);
		}

		const userSeeked = lastSeekVersionRef.current !== seekVersion;
		lastSeekVersionRef.current = seekVersion;
		const wasPreload = prevModeRef.current === 'preload';
		const justBecameActive = prevModeRef.current !== 'active' && mode === 'active';
		prevModeRef.current = mode;

		if (userSeeked || (justBecameActive && !wasPreload)) {
			needsInitialSyncRef.current = true;
		}

		if (mode === 'preload') {
			if (!vid.paused) vid.pause();
			// Position preloaded video cleanly at trimStart ahead of the cut so activation needs ZERO seek!
			if (!vid.seeking && vid.readyState >= 1 && Math.abs(vid.currentTime - clip.trimStart) > 0.08) {
				try {
					vid.currentTime = clip.trimStart;
				} catch {
					// ignore before metadata
				}
			}
			return;
		}

		const rawOffset = Math.max(0, clip.trimStart + (clampedTime - clip.startTime) * clip.speed);
		const srcTarget =
			dur > 0
				? shouldLoop
					? rawOffset % dur
					: Math.min(rawOffset, Math.max(0, dur - 0.06))
				: rawOffset;

		// Seek ONLY when paused, user explicitly scrubbed, or on first un-preloaded activation.
		// When handing off from 'preload' -> 'active' while playing, avoid seeking within 0.45s
		// so the hardware video decoder never flushes its frame buffer and flashes black!
		const drift = Math.abs(vid.currentTime - srcTarget);
		const shouldSyncTime =
			!isPlaying ||
			userSeeked ||
			(needsInitialSyncRef.current && (!wasPreload || drift > 0.45));

		if (shouldSyncTime && !vid.seeking && vid.readyState >= 1) {
			if (drift > 0.08) {
				try {
					vid.currentTime = srcTarget;
				} catch {
					// ignore until metadata loads
				}
			}
			needsInitialSyncRef.current = false;
		} else if (wasPreload && justBecameActive) {
			needsInitialSyncRef.current = false;
		}

		const nearSafeEnd = !shouldLoop && dur > 0 && vid.currentTime >= dur - 0.06;
		if (mode === 'active' && isPlaying && !nearSafeEnd && vid.paused) {
			void vid.play().catch(() => undefined);
		} else if ((!isPlaying || mode === 'outgoing' || nearSafeEnd) && !vid.paused) {
			vid.pause();
		}
	}, [clip, clampedTime, isPlaying, masterMuted, trackMuted, trackVolume, seekVersion, mode]);

	const zClass = mode === 'preload' ? 'z-0 pointer-events-none' : mode === 'outgoing' ? 'z-[1]' : 'z-[2]';
	const filterStyle = filter !== 'none' ? filter : undefined;

	if (clip.type === 'video' && clip.sourceUrl) {
		const markReady = () => {
			const v = videoRef.current;
			if (v && v.readyState >= 2) setVideoFrameReady(true);
		};
		return (
			<div
				aria-hidden={mode === 'preload'}
				style={{ opacity }}
				className={`absolute inset-0 h-full w-full overflow-hidden ${zClass}`}
			>
				{clip.thumbnailUrl && (
					<img
						src={clip.thumbnailUrl}
						alt=""
						decoding="async"
						style={{ filter: filterStyle, transform }}
						className="absolute inset-0 h-full w-full object-cover will-change-transform"
					/>
				)}
				<video
					ref={videoRef}
					src={clip.sourceUrl}
					playsInline
					preload="auto"
					onLoadedData={markReady}
					onCanPlay={markReady}
					onPlaying={markReady}
					onSeeked={markReady}
					style={{
						filter: filterStyle,
						transform,
						opacity: videoFrameReady ? 1 : 0,
					}}
					className="absolute inset-0 h-full w-full object-cover will-change-transform"
				/>
			</div>
		);
	}

	if (clip.sourceUrl) {
		return (
			<img
				aria-hidden={mode === 'preload'}
				src={clip.sourceUrl}
				alt={mode === 'preload' ? '' : clip.title}
				decoding="async"
				style={{
					opacity,
					filter: filterStyle,
					transform,
				}}
				className={`absolute inset-0 h-full w-full object-cover will-change-transform ${zClass}`}
			/>
		);
	}

	return null;
}

export function ProgramMonitor({
	tracks,
	fx,
	aspect,
	playhead,
	totalDuration,
	isPlaying,
	masterMuted,
	seekVersion = 0,
	onRegisterAudioClock,
	onTogglePlay,
	onSeek,
	onToggleMasterMute,
	onSplitAtPlayhead,
}: Props) {
	const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
	const lastSeekVersionRef = useRef(seekVersion);
	const tracksRef = useRef(tracks);
	tracksRef.current = tracks;

	const { visualLayers, activeHeadlineClip } = useMemo(() => {
		const layers: {
			key: string;
			track: NleTrack;
			clip: NleClip;
			mode: 'active' | 'outgoing' | 'preload';
			hasOutgoingUnderlay: boolean;
		}[] = [];
		let topActive: NleClip | null = null;

		const visibleVideoTracks = tracks
			.filter((t) => t.kind === 'video' && !t.hidden)
			.slice()
			.reverse();

		for (const track of visibleVideoTracks) {
			const active = activeClipInTrack(track, playhead);
			if (active) {
				topActive = active;
				const localT = Math.max(0, playhead - active.startTime);
				const transDur = Math.min(0.28, Math.max(0.14, active.duration * 0.2));
				// Keep previous clip as a solid underlay during cross-dissolve AND for the first 180ms
				// of any hard cut so the viewport NEVER flashes black while the incoming clip paints.
				const needsOutgoingUnderlay =
					(active.transitionIn === 'cross-dissolve' && localT < transDur) ||
					(active.transitionIn !== 'fade-black' && localT < 0.18);
				const prevClip = needsOutgoingUnderlay
					? findPreviousClipInTrack(track, active)
					: null;

				if (prevClip) {
					layers.push({
						key: `${track.id}-${prevClip.id}`,
						track,
						clip: prevClip,
						mode: 'outgoing',
						hasOutgoingUnderlay: false,
					});
				}
				layers.push({
					key: `${track.id}-${active.id}`,
					track,
					clip: active,
					mode: 'active',
					hasOutgoingUnderlay: Boolean(prevClip),
				});
			}

			const upcoming = findUpcomingClipsInTrack(track, playhead, 3);
			for (const up of upcoming) {
				if (layers.some((l) => l.key === `${track.id}-${up.id}`)) continue;
				layers.push({
					key: `${track.id}-${up.id}`,
					track,
					clip: up,
					mode: 'preload',
					hasOutgoingUnderlay: false,
				});
			}
		}

		return { visualLayers: layers, activeHeadlineClip: topActive };
	}, [tracks, playhead]);

	const activeTexts = useMemo(() => {
		return tracks
			.filter((t) => t.kind === 'text' && !t.hidden)
			.map((t) => activeClipInTrack(t, playhead))
			.filter((c): c is NleClip => Boolean(c?.textData?.text));
	}, [tracks, playhead]);

	const audioTracks = useMemo(
		() => tracks.filter((t) => t.kind === 'audio'),
		[tracks]
	);

	// Register hardware audio clock getter so playhead stays locked 1:1 to real audio output
	useEffect(() => {
		if (!onRegisterAudioClock) return;
		onRegisterAudioClock(() => {
			const currentAudioTracks = tracksRef.current.filter((t) => t.kind === 'audio');
			for (const track of currentAudioTracks) {
				for (const clip of track.clips) {
					if (!clip.sourceUrl) continue;
					const el = audioRefs.current.get(clip.id);
					if (!el || el.paused || el.seeking || el.readyState < 2) continue;
					const timelineT = clip.startTime + (el.currentTime - clip.trimStart) / Math.max(0.25, clip.speed);
					if (
						Number.isFinite(timelineT) &&
						timelineT >= clip.startTime &&
						timelineT <= clip.startTime + clip.duration
					) {
						return timelineT;
					}
				}
			}
			return null;
		});
		return () => onRegisterAudioClock(null);
	}, [onRegisterAudioClock]);

	// Synchronize real audio tracks playback cleanly without thrashing decoder while playing
	useEffect(() => {
		const userSeeked = lastSeekVersionRef.current !== seekVersion;
		lastSeekVersionRef.current = seekVersion;

		for (const track of audioTracks) {
			for (const clip of track.clips) {
				if (!clip.sourceUrl) continue;
				const el = audioRefs.current.get(clip.id);
				if (!el) continue;

				const inside = playhead >= clip.startTime && playhead < clip.startTime + clip.duration;
				el.muted = masterMuted || track.muted;
				el.volume = Math.max(0, Math.min(1, clip.volume * track.volume));
				el.playbackRate = clip.speed;

				if (inside) {
					const target = Math.max(0, clip.trimStart + (playhead - clip.startTime) * clip.speed);
					const drift = Math.abs(el.currentTime - target);
					// Seek ONLY on explicit user scrub/jump, when paused, or if severe drift (>1.0s) when buffered
					if (!el.seeking && (userSeeked || !isPlaying || (el.readyState >= 2 && drift > 1.0))) {
						if (drift > 0.08) {
							try {
								el.currentTime = target;
							} catch {
								// ignore until metadata loads
							}
						}
					}
					if (isPlaying && el.paused) {
						void el.play().catch(() => undefined);
					} else if (!isPlaying && !el.paused) {
						el.pause();
					}
				} else if (!el.paused) {
					el.pause();
				}
			}
		}
	}, [audioTracks, playhead, isPlaying, masterMuted, seekVersion]);

	const aspectBoxClass =
		aspect === '9:16'
			? 'aspect-[9/16] h-full max-h-full'
			: aspect === '21:9'
			? 'aspect-[21/9] w-full max-w-full'
			: 'aspect-video w-full max-w-full max-h-full';

	return (
		<div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface overflow-hidden">
			{/* Hidden managed audio elements for all audio clips */}
			<div className="hidden" aria-hidden="true">
				{audioTracks.flatMap((t) =>
					t.clips
						.filter((c) => Boolean(c.sourceUrl))
						.map((c) => (
							<audio
								key={c.id}
								src={c.sourceUrl}
								preload="auto"
								ref={(node) => {
									if (node) audioRefs.current.set(c.id, node);
									else audioRefs.current.delete(c.id);
								}}
							/>
						))
				)}
			</div>

			{/* Monitor Header Strip */}
			<div className="flex items-center justify-between border-b border-border bg-[#0e0e12] px-3 py-1.5 flex-none">
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
						Monitor de Programa
					</span>
					<span className="truncate text-[11px] text-foreground/80">
						{activeHeadlineClip?.title ?? 'Sin clip en cabezal'}
					</span>
				</div>
				<span className="font-mono text-[11px] tabular-nums text-cyan-400">
					{aspect} · 24 fps
				</span>
			</div>

			{/* Dark Cinema Viewport */}
			<div className="flex min-h-0 flex-1 items-center justify-center bg-[#070709] p-2.5 overflow-hidden">
				<div
					onClick={onTogglePlay}
					className={`relative flex items-center justify-center overflow-hidden rounded-md bg-black border border-white/10 shadow-2xl cursor-pointer ${aspectBoxClass}`}
				>
					{!visualLayers.some((l) => l.mode === 'active') && (
						<div className="relative z-[3] flex flex-col items-center justify-center text-center p-4 text-xs text-muted-foreground">
							<Play className="h-7 w-7 mb-1.5 opacity-40" />
							<span>Coloca clips en V1 o genera escenas IA</span>
						</div>
					)}
					{visualLayers.map(({ key, track, clip, mode, hasOutgoingUnderlay }) => (
						<VisualLayer
							key={key}
							clip={clip}
							fx={fx}
							playhead={playhead}
							isPlaying={isPlaying}
							masterMuted={masterMuted}
							trackMuted={track.muted}
							trackVolume={track.volume}
							seekVersion={seekVersion}
							mode={mode}
							hasOutgoingUnderlay={hasOutgoingUnderlay}
						/>
					))}

					{/* GPU-composited Cinema Overlays */}
					{fx.lightLeak && (
						<div className="pointer-events-none absolute inset-0 z-10 transform-gpu bg-gradient-to-tr from-amber-500/20 via-transparent to-cyan-500/20 mix-blend-screen" />
					)}
					{fx.vignette && (
						<div className="pointer-events-none absolute inset-0 z-10 transform-gpu shadow-[inset_0_0_70px_rgba(0,0,0,0.75)]" />
					)}
					{fx.grain && (
						<div
							className="pointer-events-none absolute inset-0 z-10 transform-gpu opacity-[0.08]"
							style={{
								backgroundImage:
									'repeating-radial-gradient(circle at 17% 32%, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)',
								backgroundSize: '4px 4px',
							}}
						/>
					)}
					{fx.letterbox && (
						<>
							<div className="pointer-events-none absolute top-0 left-0 right-0 h-[10%] bg-black z-20" />
							<div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[10%] bg-black z-20" />
						</>
					)}

					{/* Text Track (T1) Overlays */}
					{activeTexts.map((tc) => {
						const td = tc.textData!;
						const posClass =
							td.position === 'top'
								? 'top-[13%]'
								: td.position === 'center'
								? 'top-1/2 -translate-y-1/2'
								: fx.letterbox
								? 'bottom-[15%]'
								: 'bottom-[9%]';
						return (
							<div
								key={tc.id}
								className={`pointer-events-none absolute left-4 right-4 z-30 flex justify-center ${posClass}`}
							>
								<span
									style={{
										color: td.color,
										fontSize: `${Math.max(12, Math.round(td.fontSize * 0.45))}px`,
										backgroundColor:
											td.bgOpacity > 0 ? `rgba(8,8,12,${td.bgOpacity})` : 'transparent',
									}}
									className={`max-w-[90%] rounded px-3 py-1 text-center leading-tight ${
										td.fontWeight === 'black'
											? 'font-black'
											: td.fontWeight === 'bold'
											? 'font-bold'
											: 'font-medium'
									}`}
								>
									{td.text}
								</span>
							</div>
						);
					})}
				</div>
			</div>

			{/* Premiere Transport Strip */}
			<div className="flex items-center justify-between gap-2 border-t border-border bg-[#0e0e12] px-3 py-1.5 flex-none">
				<span className="font-mono text-xs font-bold tabular-nums text-primary">
					{formatTime(playhead)}
				</span>

				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => onSeek(0)}
						title="Ir al inicio"
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
					>
						<SkipBack className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={() => onSeek(Math.max(0, playhead - 1))}
						title="Retroceder 1s"
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
					>
						<StepBack className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={onTogglePlay}
						title="Reproducir / Pausar (Espacio)"
						className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:brightness-110 transition-transform active:scale-95"
					>
						{isPlaying ? (
							<Pause className="h-4 w-4" />
						) : (
							<Play className="h-4 w-4 translate-x-0.5" />
						)}
					</button>
					<button
						type="button"
						onClick={() => onSeek(Math.min(totalDuration, playhead + 1))}
						title="Avanzar 1s"
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
					>
						<StepForward className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onClick={() => onSeek(totalDuration)}
						title="Ir al final"
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
					>
						<SkipForward className="h-3.5 w-3.5" />
					</button>
				</div>

				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={onSplitAtPlayhead}
						title="Dividir clip en el cabezal (C)"
						className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 text-[11px] font-semibold text-foreground hover:border-primary hover:text-primary"
					>
						<Scissors className="h-3 w-3" />
						<span className="hidden sm:inline">Cortar</span>
					</button>
					<button
						type="button"
						onClick={onToggleMasterMute}
						title={masterMuted ? 'Activar audio' : 'Silenciar monitor'}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
					>
						{masterMuted ? (
							<VolumeX className="h-3.5 w-3.5 text-destructive" />
						) : (
							<Volume2 className="h-3.5 w-3.5" />
						)}
					</button>
					<span className="font-mono text-[11px] tabular-nums text-muted-foreground">
						{formatTime(totalDuration)}
					</span>
				</div>
			</div>
		</div>
	);
}
