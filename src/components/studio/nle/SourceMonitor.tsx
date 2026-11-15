import { useEffect, useRef, useState } from 'react';
import {
	ArrowDownToLine,
	CornerDownRight,
	Loader2,
	Music2,
	Pause,
	Play,
	Scissors,
	Wand2,
} from 'lucide-react';
import { formatTime } from '@/lib/format';
import { analyzeAudioTrack } from '@/lib/nle/audioAnalyzer';
import type { NleMediaAsset } from '@/lib/nle/types';

interface Props {
	asset: NleMediaAsset | null;
	onInsertAtPlayhead: (asset: NleMediaAsset, trimStart: number, duration: number) => void;
	onAppendToTrack: (asset: NleMediaAsset, trimStart: number, duration: number) => void;
}

export function SourceMonitor({ asset, onInsertAtPlayhead, onAppendToTrack }: Props) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [detectedDur, setDetectedDur] = useState<number | null>(null);
	const [markIn, setMarkIn] = useState(0);
	const [markOut, setMarkOut] = useState(asset?.duration ?? 6);
	const [detectingHook, setDetectingHook] = useState(false);

	const totalDur = Math.max(1, detectedDur || asset?.duration || 8);

	// Reset In/Out when switching source asset
	useEffect(() => {
		setIsPlaying(false);
		setCurrentTime(0);
		setDetectedDur(null);
		setMarkIn(0);
		setMarkOut(Math.max(1, asset?.duration || 8));
	}, [asset?.id, asset?.duration]);

	// Sync play/pause & time updates for video/audio source
	useEffect(() => {
		const media =
			asset?.kind === 'video'
				? videoRef.current
				: asset?.kind === 'audio' || asset?.kind === 'song'
				? audioRef.current
				: null;

		if (!media) {
			if (!isPlaying) return;
			let last = performance.now();
			let raf = 0;
			const step = (now: number) => {
				const dt = (now - last) / 1000;
				last = now;
				setCurrentTime((prev) => {
					const next = prev + dt;
					if (next >= markOut) {
						setIsPlaying(false);
						return markIn;
					}
					return next;
				});
				raf = requestAnimationFrame(step);
			};
			raf = requestAnimationFrame(step);
			return () => cancelAnimationFrame(raf);
		}

		const onTimeUpdate = () => {
			setCurrentTime(media.currentTime);
			if (media.currentTime >= markOut) {
				media.pause();
				setIsPlaying(false);
			}
		};
		const onEnded = () => setIsPlaying(false);
		media.addEventListener('timeupdate', onTimeUpdate);
		media.addEventListener('ended', onEnded);

		if (isPlaying) {
			if (media.currentTime < markIn || media.currentTime >= markOut) {
				media.currentTime = markIn;
			}
			void media.play().catch(() => undefined);
		} else {
			media.pause();
		}

		return () => {
			media.removeEventListener('timeupdate', onTimeUpdate);
			media.removeEventListener('ended', onEnded);
		};
	}, [asset, isPlaying, markIn, markOut]);

	function seekSource(t: number) {
		const clamped = Math.max(0, Math.min(totalDur, t));
		setCurrentTime(clamped);
		const media =
			asset?.kind === 'video'
				? videoRef.current
				: asset?.kind === 'audio' || asset?.kind === 'song'
				? audioRef.current
				: null;
		if (media) {
			try {
				media.currentTime = clamped;
			} catch {
				// ignore until metadata loads
			}
		}
	}

	async function handleSmartAutoTrim() {
		if (!asset) return;
		if (asset.kind === 'audio' || asset.kind === 'song') {
			setDetectingHook(true);
			try {
				const analysis = await analyzeAudioTrack(
					asset.url,
					totalDur,
					asset.songRef?.lyrics
				);
				setMarkIn(analysis.peakHookStart);
				setMarkOut(Math.max(analysis.peakHookStart + 2, analysis.peakHookEnd));
				seekSource(analysis.peakHookStart);
			} finally {
				setDetectingHook(false);
			}
		} else {
			const start = Number((totalDur * 0.15).toFixed(1));
			const end = Number(Math.max(start + 2, totalDur * 0.75).toFixed(1));
			setMarkIn(start);
			setMarkOut(end);
			seekSource(start);
		}
	}

	const selectedDur = Math.max(0.5, Number((markOut - markIn).toFixed(1)));
	const inPct = (markIn / totalDur) * 100;
	const outPct = (markOut / totalDur) * 100;
	const curPct = Math.min(100, Math.max(0, (currentTime / totalDur) * 100));

	return (
		<div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface overflow-hidden">
			{/* Header Strip */}
			<div className="flex items-center justify-between border-b border-border bg-[#0e0e12] px-3 py-1.5 flex-none">
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
						Origen
					</span>
					<span className="truncate text-[11px] text-foreground/80">
						{asset ? asset.title : 'Selecciona un clip de Medios'}
					</span>
				</div>
				{asset && (
					<span className="font-mono text-[10px] tabular-nums text-muted-foreground">
						In {formatTime(markIn)} · Out {formatTime(markOut)}
					</span>
				)}
			</div>

			{/* Viewport */}
			<div className="flex min-h-0 flex-1 items-center justify-center bg-[#070709] p-2 overflow-hidden">
				{!asset ? (
					<div className="flex flex-col items-center justify-center text-center p-4 text-xs text-muted-foreground">
						<Scissors className="h-6 w-6 mb-1.5 opacity-40" />
						<p className="font-semibold text-foreground/80">Monitor de Recorte Manual</p>
						<p className="text-[11px] mt-1">
							Haz clic en cualquier video, audio o imagen en "Medios" para marcar Entrada/Salida y lanzarlo al Timeline.
						</p>
					</div>
				) : asset.kind === 'video' && asset.url ? (
					<video
						ref={videoRef}
						src={asset.url}
						playsInline
						onLoadedMetadata={(e) => {
							const d = e.currentTarget.duration;
							if (Number.isFinite(d) && d > 0.5) {
								const clean = Number(d.toFixed(1));
								setDetectedDur(clean);
								setMarkOut(clean);
							}
						}}
						onClick={() => setIsPlaying((p) => !p)}
						className="max-h-full max-w-full rounded bg-black object-contain cursor-pointer"
					/>
				) : asset.kind === 'image' && asset.url ? (
					<img
						src={asset.url}
						alt={asset.title}
						className="max-h-full max-w-full rounded bg-black object-contain"
					/>
				) : (
					<div className="flex w-full h-full flex-col items-center justify-center gap-2 rounded-lg bg-[#0d0d13] p-4">
						{asset.url && (
							<audio
								ref={audioRef}
								src={asset.url}
								preload="auto"
								onLoadedMetadata={(e) => {
									const d = e.currentTarget.duration;
									if (Number.isFinite(d) && d > 0.5) {
										const clean = Number(d.toFixed(1));
										setDetectedDur(clean);
										setMarkOut(clean);
									}
								}}
							/>
						)}
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
							<Music2 className="h-6 w-6" />
						</div>
						<p className="truncate max-w-full text-xs font-bold text-foreground">{asset.title}</p>
						<p className="font-mono text-[11px] tabular-nums text-emerald-400">
							Selección: {formatTime(markIn)} → {formatTime(markOut)} ({selectedDur}s)
						</p>
					</div>
				)}
			</div>

			{/* Scrub Bar with Mark In/Out Range */}
			{asset && (
				<div className="border-t border-border/60 bg-[#0b0b0f] px-3 py-1.5 flex-none">
					<div
						onClick={(e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							const r = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
							seekSource(r * totalDur);
						}}
						className="relative h-4 w-full cursor-pointer rounded bg-surface-2 overflow-hidden"
					>
						<div
							style={{ left: `${inPct}%`, width: `${Math.max(2, outPct - inPct)}%` }}
							className="absolute top-0 bottom-0 bg-amber-500/30 border-x-2 border-amber-400"
						/>
						<div
							style={{ left: `${curPct}%` }}
							className="absolute top-0 bottom-0 w-0.5 bg-white"
						/>
					</div>
				</div>
			)}

			{/* Source Trim & Launch Strip */}
			<div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-border bg-[#0e0e12] px-2.5 py-1.5 flex-none">
				<div className="flex items-center gap-1">
					<button
						type="button"
						disabled={!asset}
						onClick={() => setIsPlaying((p) => !p)}
						title="Reproducir / Pausar Origen"
						className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-foreground hover:bg-surface-3 disabled:opacity-35"
					>
						{isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
					</button>
					<button
						type="button"
						disabled={!asset}
						onClick={() => {
							const nextIn = Number(Math.min(markOut - 0.5, currentTime).toFixed(1));
							setMarkIn(Math.max(0, nextIn));
						}}
						title="Marcar Entrada (Mark In)"
						className="h-7 rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] font-bold text-amber-300 hover:border-amber-400 disabled:opacity-35"
					>
						{'{ In'}
					</button>
					<button
						type="button"
						disabled={!asset}
						onClick={() => {
							const nextOut = Number(Math.max(markIn + 0.5, currentTime).toFixed(1));
							setMarkOut(Math.min(totalDur, nextOut));
						}}
						title="Marcar Salida (Mark Out)"
						className="h-7 rounded-md border border-border bg-surface-2 px-2 font-mono text-[11px] font-bold text-amber-300 hover:border-amber-400 disabled:opacity-35"
					>
						{'Out }'}
					</button>
					<button
						type="button"
						disabled={!asset || detectingHook}
						onClick={() => void handleSmartAutoTrim()}
						title="Varita IA: Auto-seleccionar mejor segmento / hook"
						className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-35 transition-colors"
					>
						{detectingHook ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Wand2 className="h-3.5 w-3.5" />
						)}
					</button>
				</div>

				<div className="flex items-center gap-1">
					<button
						type="button"
						disabled={!asset}
						onClick={() => asset && onInsertAtPlayhead(asset, markIn, selectedDur)}
						title="Lanzar recorte al Timeline en la posición del cabezal"
						className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-bold text-primary-foreground hover:brightness-110 disabled:opacity-35 whitespace-nowrap"
					>
						<ArrowDownToLine className="h-3 w-3" />
						<span>Insertar</span>
					</button>
					<button
						type="button"
						disabled={!asset}
						onClick={() => asset && onAppendToTrack(asset, markIn, selectedDur)}
						title="Añadir al final de la pista"
						className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 text-[11px] font-semibold text-foreground hover:border-cyan-400 disabled:opacity-35 whitespace-nowrap"
					>
						<CornerDownRight className="h-3 w-3 text-cyan-400" />
						<span>Al final</span>
					</button>
				</div>
			</div>
		</div>
	);
}
