import { useEffect, useMemo, useRef } from 'react';
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
	// Include final frame inclusive only at exact clip end when no next clip starts
	const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
	const last = sorted[sorted.length - 1];
	if (last && t >= last.startTime && t <= last.startTime + last.duration + 0.04) {
		return last;
	}
	return null;
}

function getMotionTransform(clip: NleClip, t: number): string {
	const ratio = Math.max(0, Math.min(1, (t - clip.startTime) / Math.max(0.1, clip.duration)));
	if (clip.cameraMotion === 'zoom-in') {
		return `translate3d(0, 0, 0) scale(${(1 + ratio * 0.08).toFixed(4)})`;
	}
	if (clip.cameraMotion === 'zoom-out') {
		return `translate3d(0, 0, 0) scale(${(1.09 - ratio * 0.08).toFixed(4)})`;
	}
	if (clip.cameraMotion === 'pan-left') {
		return `translate3d(${(-ratio * 3).toFixed(3)}%, 0, 0) scale(1.08)`;
	}
	if (clip.cameraMotion === 'pan-right') {
		return `translate3d(${(ratio * 3).toFixed(3)}%, 0, 0) scale(1.08)`;
	}
	return 'translate3d(0, 0, 0) scale(1)';
}

function getTransitionOpacity(clip: NleClip, t: number): number {
	const localT = Math.max(0, t - clip.startTime);
	const transDur = Math.min(0.45, clip.duration * 0.18);
	if (
		(clip.transitionIn === 'cross-dissolve' || clip.transitionIn === 'fade-black') &&
		transDur > 0.05 &&
		localT < transDur
	) {
		return clip.opacity * Math.max(0.15, localT / transDur);
	}
	return clip.opacity;
}

function wrappedDistance(a: number, b: number, period: number): number {
	if (!Number.isFinite(period) || period <= 0.2) return Math.abs(a - b);
	const d = Math.abs((a % period) - (b % period));
	return Math.min(d, period - d);
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
}: {
	clip: NleClip;
	fx: NleProjectFx;
	playhead: number;
	isPlaying: boolean;
	masterMuted: boolean;
	trackMuted: boolean;
	trackVolume: number;
	seekVersion: number;
}) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const lastSeekVersionRef = useRef(seekVersion);
	const effLut = clip.lutId !== 'inherit' ? clip.lutId : fx.lutId;
	const filter = buildCssFilter(effLut, clip.colorAdjust);
	const transform = getMotionTransform(clip, playhead);
	const opacity = getTransitionOpacity(clip, playhead);

	useEffect(() => {
		const vid = videoRef.current;
		if (!vid || clip.type !== 'video') return;
		vid.muted = masterMuted || trackMuted || clip.volume === 0;
		vid.volume = Math.max(0, Math.min(1, clip.volume * trackVolume));
		vid.playbackRate = clip.speed;
		vid.loop = true;

		const rawOffset = Math.max(0, clip.trimStart + (playhead - clip.startTime) * clip.speed);
		const dur = Number.isFinite(vid.duration) && vid.duration > 0.4 ? vid.duration : 0;
		const srcTarget = dur > 0 ? rawOffset % dur : rawOffset;
		const userSeeked = lastSeekVersionRef.current !== seekVersion;
		lastSeekVersionRef.current = seekVersion;

		// Only seek on manual scrub, when paused, or if playback drifted past threshold (never thrash mid-buffer)
		const drift = dur > 0 ? wrappedDistance(vid.currentTime, srcTarget, dur) : Math.abs(vid.currentTime - srcTarget);
		if (!vid.seeking && vid.readyState >= 1 && (userSeeked || !isPlaying || drift > 0.9)) {
			if (Math.abs(vid.currentTime - srcTarget) > 0.12) {
				try {
					vid.currentTime = srcTarget;
				} catch {
					// ignore until metadata loads
				}
			}
		}

		if (isPlaying && vid.paused) {
			void vid.play().catch(() => undefined);
		} else if (!isPlaying && !vid.paused) {
			vid.pause();
		}
	}, [clip, playhead, isPlaying, masterMuted, trackMuted, trackVolume, seekVersion]);

	if (clip.type === 'video' && clip.sourceUrl) {
		return (
			<video
				ref={videoRef}
				src={clip.sourceUrl}
				loop
				playsInline
				preload="auto"
				style={{
					opacity,
					filter: filter !== 'none' ? filter : undefined,
					transform,
				}}
				className="absolute inset-0 h-full w-full object-cover will-change-transform"
			/>
		);
	}

	if (clip.sourceUrl) {
		return (
			<img
				src={clip.sourceUrl}
				alt={clip.title}
				decoding="async"
				style={{
					opacity,
					filter: filter !== 'none' ? filter : undefined,
					transform,
				}}
				className="absolute inset-0 h-full w-full object-cover will-change-transform"
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

	const visualLayers = useMemo(() => {
		return tracks
			.filter((t) => t.kind === 'video' && !t.hidden)
			.slice()
			.reverse()
			.map((t) => ({ track: t, clip: activeClipInTrack(t, playhead) }))
			.filter((x): x is { track: NleTrack; clip: NleClip } => Boolean(x.clip));
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
						{visualLayers[visualLayers.length - 1]?.clip.title ?? 'Sin clip en cabezal'}
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
					{visualLayers.length === 0 ? (
						<div className="flex flex-col items-center justify-center text-center p-4 text-xs text-muted-foreground">
							<Play className="h-7 w-7 mb-1.5 opacity-40" />
							<span>Coloca clips en V1 o genera escenas IA</span>
						</div>
					) : (
						visualLayers.map(({ track, clip }) => (
							<VisualLayer
								key={clip.id}
								clip={clip}
								fx={fx}
								playhead={playhead}
								isPlaying={isPlaying}
								masterMuted={masterMuted}
								trackMuted={track.muted}
								trackVolume={track.volume}
								seekVersion={seekVersion}
							/>
						))
					)}

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
