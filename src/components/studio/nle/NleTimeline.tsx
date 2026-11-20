import { useMemo, useRef, useState } from 'react';
import {
	Copy,
	Eye,
	EyeOff,
	Grid3x3,
	Lock,
	Magnet,
	MousePointer2,
	Music2,
	Plus,
	Scissors,
	Trash2,
	Type,
	Unlock,
	Video,
	Volume2,
	VolumeX,
	Wand2,
	Zap,
	ZoomIn,
	ZoomOut,
} from 'lucide-react';
import { formatTime } from '@/lib/format';
import type { MusicalCutSlot } from '@/lib/nle/audioAnalyzer';
import { buildCompasGridMarkers, snapToNearestGridMarker } from '@/lib/nle/project';
import type { StudioSong } from '@/lib/studio';
import type { NleClip, NleToolMode, NleTrack } from '@/lib/nle/types';

interface Props {
	tracks: NleTrack[];
	songs: StudioSong[];
	playhead: number;
	totalDuration: number;
	selectedClipId: string | null;
	toolMode: NleToolMode;
	beatBpm?: number | null;
	beatCutSlots?: MusicalCutSlot[];
	beatTimes?: number[];
	barTimes?: number[];
	vocalEntryTime?: number | null;
	peakHookStart?: number | null;
	peakHookEnd?: number | null;
	autoBeatSync?: boolean;
	snapToGrid?: boolean;
	onToggleAutoBeatSync?: () => void;
	onToggleSnapToGrid?: () => void;
	onSnapTrackToGrid?: (trackId?: string) => void;
	onGridTrimClip?: (
		trackId: string,
		clipId: string,
		mode: 'trim-left' | 'trim-right',
		targetTime: number
	) => void;
	onToolModeChange: (m: NleToolMode) => void;
	onSelectClip: (clipId: string | null) => void;
	onSeek: (time: number) => void;
	onUpdateClip: (clipId: string, updater: (clip: NleClip) => NleClip) => void;
	onToggleTrackProp: (trackId: string, prop: 'muted' | 'hidden' | 'locked') => void;
	onSplitAtPlayhead: () => void;
	onSplitClipAtTime: (clipId: string, at: number) => void;
	onDuplicateSelected: () => void;
	onDeleteSelected: () => void;
	onAddTrack: (kind: 'video' | 'audio') => void;
	onAutoBuildFromSong: (song: StudioSong) => void;
	onBeatCutTimeline?: () => void | Promise<void>;
}

type DragState =
	| {
			mode: 'move' | 'trim-left' | 'trim-right';
			clipId: string;
			startClientX: number;
			origStart: number;
			origDuration: number;
			origTrimStart: number;
	  }
	| null;

const TRACK_HEADER_W = 118;

export function NleTimeline({
	tracks,
	songs,
	playhead,
	totalDuration,
	selectedClipId,
	toolMode,
	beatBpm = null,
	beatCutSlots = [],
	beatTimes = [],
	barTimes = [],
	vocalEntryTime = null,
	peakHookStart = null,
	peakHookEnd = null,
	autoBeatSync = true,
	snapToGrid,
	onToggleAutoBeatSync,
	onToggleSnapToGrid,
	onSnapTrackToGrid,
	onGridTrimClip,
	onToolModeChange,
	onSelectClip,
	onSeek,
	onUpdateClip,
	onToggleTrackProp,
	onSplitAtPlayhead,
	onSplitClipAtTime,
	onDuplicateSelected,
	onDeleteSelected,
	onAddTrack,
	onAutoBuildFromSong,
	onBeatCutTimeline,
}: Props) {
	const [pxPerSec, setPxPerSec] = useState(22);
	const [localSnapEnabled, setLocalSnapEnabled] = useState(true);
	const snapEnabled = snapToGrid ?? localSnapEnabled;
	const [showBeatGrid, setShowBeatGrid] = useState(true);
	const [dragState, setDragState] = useState<DragState>(null);
	const [activeSnapTime, setActiveSnapTime] = useState<number | null>(null);
	const [beatCutting, setBeatCutting] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const hasVisualClips = tracks.some(
		(tr) => tr.kind === 'video' && tr.clips.some((c) => Boolean(c.sourceUrl))
	);

	const timelineWidth = Math.max(760, Math.ceil((totalDuration + 10) * pxPerSec));

	// Consolidated compás/beat grid markers for strict video snap-to-grid
	const compasGridMarkers = useMemo(
		() =>
			buildCompasGridMarkers({
				totalDuration,
				beatTimes,
				barTimes,
				beatCutSlots,
				vocalEntryTime,
			}),
		[totalDuration, beatTimes, barTimes, beatCutSlots, vocalEntryTime]
	);

	// Compute current musical position (Compás.Tiempo) at the playhead for manual editing feedback
	const playheadBarBeat = useMemo(() => {
		if (barTimes.length === 0) return null;
		let barIdx = 0;
		for (let i = 0; i < barTimes.length; i++) {
			if (playhead >= barTimes[i] - 0.03) barIdx = i;
			else break;
		}
		const barStart = barTimes[barIdx] ?? 0;
		const beatSec = beatBpm && beatBpm > 0 ? 60 / beatBpm : 0.5;
		const beatInBar = Math.min(4, Math.max(1, Math.floor(Math.max(0, playhead - barStart) / beatSec) + 1));
		return { bar: barIdx + 1, beat: beatInBar };
	}, [barTimes, playhead, beatBpm]);

	// Determine label spacing so compás numbers (C1, C2...) stay crisp and never collide at any zoom
	const barLabelStep = useMemo(() => {
		if (barTimes.length < 2) return 1;
		const avgBarPx = (barTimes[1] - barTimes[0]) * pxPerSec;
		if (avgBarPx >= 36) return 1;
		if (avgBarPx >= 18) return 2;
		return 4;
	}, [barTimes, pxPerSec]);

	// Non-downbeat beat markers (beats 2, 3, 4 inside each 4/4 compás) for fine manual cuts
	const subBeatTimes = useMemo(() => {
		if (beatTimes.length === 0 || pxPerSec < 18) return [];
		return beatTimes.filter((_, idx) => idx % 4 !== 0);
	}, [beatTimes, pxPerSec]);

	function snapTime(raw: number, ignoreClipId: string, forceGrid = false): number {
		if (!snapEnabled) return Math.max(0, Number(raw.toFixed(2)));
		if (forceGrid && compasGridMarkers.length > 0) {
			return snapToNearestGridMarker(raw, compasGridMarkers, 0);
		}
		const snapPoints = [0, playhead];
		for (const tr of tracks) {
			for (const c of tr.clips) {
				if (c.id === ignoreClipId) continue;
				snapPoints.push(c.startTime, c.startTime + c.duration);
			}
		}
		for (const m of compasGridMarkers) {
			snapPoints.push(m);
		}

		const threshold = 10 / pxPerSec;
		let closest = raw;
		let minDist = threshold + 1;
		for (const sp of snapPoints) {
			const dist = Math.abs(raw - sp);
			if (dist <= threshold && dist < minDist) {
				minDist = dist;
				closest = sp;
			}
		}
		return Math.max(0, Number(closest.toFixed(2)));
	}

	function timeFromClientX(clientX: number, containerEl: HTMLElement): number {
		const rect = containerEl.getBoundingClientRect();
		const x = clientX - rect.left;
		return Math.max(0, Math.min(totalDuration + 6, x / pxPerSec));
	}

	function handleRulerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
		const el = e.currentTarget;
		onSeek(timeFromClientX(e.clientX, el));
		const onMove = (me: PointerEvent) => onSeek(timeFromClientX(me.clientX, el));
		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function beginClipDrag(
		e: React.PointerEvent,
		clip: NleClip,
		track: NleTrack,
		mode: 'move' | 'trim-left' | 'trim-right'
	) {
		e.stopPropagation();
		if (track.locked) return;

		const isStrictVideoGrid = snapEnabled && track.kind === 'video';

		if (toolMode === 'razor' && mode === 'move') {
			const lane = (e.currentTarget as HTMLElement).parentElement;
			if (lane) {
				const rawAt = timeFromClientX(e.clientX, lane);
				const cutAt = isStrictVideoGrid
					? snapToNearestGridMarker(rawAt, compasGridMarkers, clip.startTime + 0.45)
					: rawAt;
				onSplitClipAtTime(clip.id, cutAt);
				onToolModeChange('select');
			}
			return;
		}

		onSelectClip(clip.id);
		const startClientX = e.clientX;
		const origStart = clip.startTime;
		const origDuration = clip.duration;
		const origTrimStart = clip.trimStart;
		setDragState({ mode, clipId: clip.id, startClientX, origStart, origDuration, origTrimStart });

		const onMove = (me: PointerEvent) => {
			const deltaSec = (me.clientX - startClientX) / pxPerSec;

			// Strict Snap-to-Grid Rolling Trim on video tracks: locks edge to nearest compás marker
			// and adjusts adjacent clip cleanly so there are ZERO gaps and ZERO overlaps.
			if (isStrictVideoGrid && (mode === 'trim-left' || mode === 'trim-right') && onGridTrimClip) {
				const rawTarget =
					mode === 'trim-right'
						? origStart + origDuration + deltaSec
						: Math.max(0, origStart + deltaSec);
				const snappedTarget = snapToNearestGridMarker(
					rawTarget,
					compasGridMarkers,
					mode === 'trim-right' ? origStart + 0.45 : 0
				);
				setActiveSnapTime(snappedTarget);
				onGridTrimClip(track.id, clip.id, mode, snappedTarget);
				return;
			}

			onUpdateClip(clip.id, (c) => {
				if (mode === 'move') {
					const snapped = snapTime(origStart + deltaSec, clip.id, isStrictVideoGrid);
					if (isStrictVideoGrid) setActiveSnapTime(snapped);
					return { ...c, startTime: snapped };
				}
				if (mode === 'trim-right') {
					const nextEnd = snapTime(
						origStart + origDuration + deltaSec,
						clip.id,
						isStrictVideoGrid
					);
					if (isStrictVideoGrid) setActiveSnapTime(nextEnd);
					const nextDur = Math.max(0.45, Number((nextEnd - origStart).toFixed(3)));
					return { ...c, duration: nextDur };
				}
				// trim-left
				const maxShift = origDuration - 0.45;
				const shift = Math.min(maxShift, Math.max(-origStart, deltaSec));
				const nextStart = snapTime(origStart + shift, clip.id, isStrictVideoGrid);
				if (isStrictVideoGrid) setActiveSnapTime(nextStart);
				const applied = nextStart - origStart;
				return {
					...c,
					startTime: nextStart,
					duration: Math.max(0.45, Number((origDuration - applied).toFixed(3))),
					trimStart: Math.max(0, Number((origTrimStart + applied).toFixed(3))),
				};
			});
		};

		const onUp = () => {
			setDragState(null);
			setActiveSnapTime(null);
			// Enforce zero gaps & zero overlaps on the video track immediately upon release
			if (isStrictVideoGrid && onSnapTrackToGrid) {
				onSnapTrackToGrid(track.id);
			}
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	const rulerStep = pxPerSec >= 35 ? 2 : pxPerSec >= 20 ? 5 : 10;
	const markCount = Math.ceil((totalDuration + 10) / rulerStep) + 1;

	return (
		<div className="flex h-[248px] flex-none flex-col rounded-xl border border-border bg-surface overflow-hidden select-none">
			{/* Timeline Toolbar Strip */}
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[#0e0e12] px-3 py-1.5 flex-none">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => onToolModeChange('select')}
						title="Herramienta Selección (V)"
						className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold transition-colors ${
							toolMode === 'select'
								? 'bg-primary text-primary-foreground'
								: 'bg-surface-2 text-muted-foreground hover:text-foreground'
						}`}
					>
						<MousePointer2 className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Mover</span>
					</button>
					<button
						type="button"
						onClick={() => onToolModeChange(toolMode === 'razor' ? 'select' : 'razor')}
						title="Cuchilla para dividir clips con clic (C)"
						className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold transition-colors ${
							toolMode === 'razor'
								? 'bg-amber-400 text-black'
								: 'bg-surface-2 text-muted-foreground hover:text-foreground'
						}`}
					>
						<Scissors className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Cuchilla</span>
					</button>

					<span className="mx-1 h-4 w-px bg-border" />

					<button
						type="button"
						onClick={onSplitAtPlayhead}
						title="Dividir pista en cabezal"
						className="inline-flex h-7 items-center gap-1 rounded-md bg-surface-2 px-2 text-[11px] font-semibold text-foreground hover:bg-surface-3"
					>
						<Scissors className="h-3 w-3 text-cyan-400" />
						<span className="hidden md:inline">Dividir</span>
					</button>
					<button
						type="button"
						disabled={!selectedClipId}
						onClick={onDuplicateSelected}
						title="Duplicar clip seleccionado"
						className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-muted-foreground hover:text-foreground disabled:opacity-35"
					>
						<Copy className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						disabled={!selectedClipId}
						onClick={onDeleteSelected}
						title="Eliminar clip seleccionado (Del)"
						className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-muted-foreground hover:text-destructive disabled:opacity-35"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</button>

					<span className="mx-1 h-4 w-px bg-border" />

					<button
						type="button"
						onClick={() => onAddTrack('video')}
						className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
					>
						<Plus className="h-3 w-3 text-cyan-400" />
						<span>Pista V</span>
					</button>
					<button
						type="button"
						onClick={() => onAddTrack('audio')}
						className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
					>
						<Plus className="h-3 w-3 text-emerald-400" />
						<span>Pista A</span>
					</button>
				</div>

				{/* Right Toolbar: Auto-Compás + Beat-Cut 1-2s + Auto Storyboard + Snap + Zoom */}
				<div className="flex items-center gap-1.5">
					{beatBpm ? (
						<span
							title="Tempo detectado del audio principal para cortes cada 1–2 segundos"
							className="hidden lg:inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 font-mono text-[10px] font-bold tabular-nums text-cyan-300"
						>
							<Music2 className="h-3 w-3 text-primary" />
							<span>{Math.round(beatBpm)} BPM</span>
						</span>
					) : null}

					{onToggleAutoBeatSync && (
						<button
							type="button"
							onClick={onToggleAutoBeatSync}
							title="Ajuste dinámico automático: corta y alinea escenas al compás (1–2s) sin flasheos"
							className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-bold transition-colors ${
								autoBeatSync
									? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
									: 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
							}`}
						>
							<Music2 className="h-3 w-3" />
							<span className="hidden md:inline">
								{autoBeatSync ? 'Auto-Compás ON' : 'Auto-Compás OFF'}
							</span>
						</button>
					)}

					{onBeatCutTimeline && hasVisualClips && (
						<button
							type="button"
							disabled={beatCutting}
							onClick={async () => {
								setBeatCutting(true);
								try {
									await onBeatCutTimeline();
								} finally {
									setBeatCutting(false);
								}
							}}
							title="Cortar tomas de V1 cada 1–2s al ritmo exacto del compás (BPM)"
							className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-2.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
						>
							<Zap className="h-3 w-3" />
							<span className="hidden sm:inline">
								{beatCutting ? 'Sincronizando...' : 'Ritmo 1-2s'}
							</span>
						</button>
					)}

					{songs.length > 0 && (
						<button
							type="button"
							onClick={() => onAutoBuildFromSong(songs[0])}
							title="Sincronizar automáticamente escenas a la canción principal"
							className="inline-flex h-7 items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-colors"
						>
							<Wand2 className="h-3 w-3" />
							<span className="hidden sm:inline">Auto-Montaje IA</span>
						</button>
					)}

					<button
						type="button"
						onClick={() => setShowBeatGrid((v) => !v)}
						title={
							showBeatGrid
								? 'Ocultar rejilla visual de compases y tiempos'
								: 'Mostrar rejilla visual de compases y tiempos'
						}
						className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-bold transition-colors ${
							showBeatGrid
								? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
								: 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
						}`}
					>
						<Grid3x3 className="h-3.5 w-3.5" />
						<span className="hidden xl:inline">Compases</span>
					</button>

					<button
						type="button"
						onClick={() => {
							if (onToggleSnapToGrid) {
								onToggleSnapToGrid();
							} else {
								setLocalSnapEnabled((v) => !v);
							}
						}}
						title={
							snapEnabled
								? 'Ajuste a rejilla (Snap-to-Grid) ACTIVO: fuerza inicio y fin de cada clip al compás sin huecos ni solapamientos'
								: 'Activar ajuste a rejilla de compases (Snap-to-Grid)'
						}
						className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-bold transition-colors ${
							snapEnabled
								? 'border-primary/60 bg-primary/15 text-primary'
								: 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
						}`}
					>
						<Magnet className="h-3.5 w-3.5" />
						<span className="hidden lg:inline">
							{snapEnabled ? 'Rejilla ON' : 'Rejilla OFF'}
						</span>
					</button>

					{onSnapTrackToGrid && hasVisualClips && (
						<button
							type="button"
							onClick={() => onSnapTrackToGrid()}
							title="Alinear ahora todos los clips de video al marcador de compás más cercano (sin espacios vacíos ni solapamientos)"
							className="inline-flex h-7 items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-colors"
						>
							<Magnet className="h-3 w-3" />
							<span className="hidden xl:inline">Alinear</span>
						</button>
					)}

					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={() => setPxPerSec((p) => Math.max(10, p - 4))}
							aria-label="Alejar zoom"
							className="text-muted-foreground hover:text-foreground"
						>
							<ZoomOut className="h-3.5 w-3.5" />
						</button>
						<input
							type="range"
							min={10}
							max={60}
							value={pxPerSec}
							onChange={(e) => setPxPerSec(Number(e.target.value))}
							aria-label="Zoom de línea de tiempo"
							className="w-20 accent-primary"
						/>
						<button
							type="button"
							onClick={() => setPxPerSec((p) => Math.min(60, p + 4))}
							aria-label="Acercar zoom"
							className="text-muted-foreground hover:text-foreground"
						>
							<ZoomIn className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</div>

			{/* Scrollable Multi-Track Body */}
			<div
				ref={scrollContainerRef}
				className="relative flex-1 min-h-0 overflow-auto no-scrollbar bg-[#0b0b0f]"
			>
				<div style={{ width: `${TRACK_HEADER_W + timelineWidth}px` }} className="min-w-full">
					{/* Timecode Ruler Row */}
					<div className="sticky top-0 z-30 flex h-6 border-b border-border/80 bg-[#111116]">
						<div
							style={{ width: TRACK_HEADER_W }}
							className="sticky left-0 z-40 flex-none border-r border-border bg-[#111116] px-2.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-primary"
						>
							<span>{formatTime(playhead)}</span>
							{playheadBarBeat && (
								<span
									title="Compás y tiempo actual (4/4)"
									className="rounded bg-amber-400/15 px-1 text-[9px] font-bold text-amber-300"
								>
									C{playheadBarBeat.bar}.{playheadBarBeat.beat}
								</span>
							)}
						</div>
						<div
							onPointerDown={handleRulerPointerDown}
							className="relative flex-1 cursor-ew-resize"
						>
							{Array.from({ length: markCount }).map((_, i) => {
								const sec = i * rulerStep;
								return (
									<div
										key={i}
										style={{ left: `${sec * pxPerSec}px` }}
										className="pointer-events-none absolute top-0 bottom-0 border-l border-white/15 pl-1 text-[9px] font-mono tabular-nums text-muted-foreground"
									>
										{formatTime(sec)}
									</div>
								);
							})}

							{/* Playhead Cap */}
							<div
								style={{ left: `${playhead * pxPerSec}px` }}
								className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-primary"
							>
								<div className="h-2.5 w-2.5 -translate-x-[4px] rotate-45 bg-primary" />
							</div>
						</div>
					</div>

					{/* Dedicated Musical Compás & Beat Ruler Strip (4/4 bars, chorus hook & vocal onset) */}
					{showBeatGrid && (barTimes.length > 0 || beatCutSlots.length > 0) && (
						<div className="sticky top-6 z-30 flex h-5 border-b border-border bg-[#0d0d13]">
							<div
								style={{ width: TRACK_HEADER_W }}
								className="sticky left-0 z-40 flex-none border-r border-border bg-[#101017] px-2 flex items-center justify-between text-[9px] font-mono text-muted-foreground"
							>
								<span className="font-bold text-amber-300/90">COMPÁS</span>
								<span className="text-[8px] opacity-75">
									{beatBpm ? `${Math.round(beatBpm)} · 4/4` : '4/4'}
								</span>
							</div>

							<div
								onPointerDown={handleRulerPointerDown}
								className="relative flex-1 cursor-ew-resize overflow-hidden"
							>
								{/* Peak / Chorus Energy Zone Band */}
								{peakHookStart !== null &&
									peakHookEnd !== null &&
									peakHookEnd > peakHookStart && (
										<div
											style={{
												left: `${peakHookStart * pxPerSec}px`,
												width: `${(peakHookEnd - peakHookStart) * pxPerSec}px`,
											}}
											title={`Zona de Coro / Máxima Energía (${formatTime(peakHookStart)} – ${formatTime(peakHookEnd)})`}
											className="pointer-events-none absolute top-0 h-1 bg-cyan-400/75"
										/>
									)}

								{/* Alternating Compás Shading Bands */}
								{barTimes.map((barT, idx) => {
									const nextBarT =
										barTimes[idx + 1] ??
										(beatBpm ? barT + (60 / beatBpm) * 4 : barT + 2);
									if (idx % 2 !== 0) return null;
									return (
										<div
											key={`band-${idx}`}
											style={{
												left: `${barT * pxPerSec}px`,
												width: `${Math.max(4, (nextBarT - barT) * pxPerSec)}px`,
											}}
											className="pointer-events-none absolute top-0 bottom-0 bg-white/[0.03]"
										/>
									);
								})}

								{/* Sub-beat ticks (beats 2, 3, 4 within each compás) */}
								{subBeatTimes.map((bt, idx) => (
									<div
										key={`sub-${idx}`}
										style={{ left: `${bt * pxPerSec}px` }}
										className="pointer-events-none absolute bottom-0 h-1.5 w-px bg-white/25"
									/>
								))}

								{/* Numbered Compás Downbeat Markers (clickable to jump to exact compás) */}
								{barTimes.map((barT, idx) => {
									const showLabel = idx % barLabelStep === 0;
									return (
										<button
											key={`bar-${idx}`}
											type="button"
											onPointerDown={(e) => {
												e.stopPropagation();
												onSeek(barT);
											}}
											title={`Ir al Compás ${idx + 1} (${formatTime(barT)})`}
											style={{ left: `${barT * pxPerSec}px` }}
											className="absolute top-0 bottom-0 flex items-center border-l border-amber-400/70 pl-1 text-[9px] font-mono font-bold tabular-nums text-amber-300/90 hover:text-amber-200 hover:border-amber-300"
										>
											{showLabel ? `C${idx + 1}` : ''}
										</button>
									);
								})}

								{/* Vocal Entry Onset Flag */}
								{vocalEntryTime !== null && vocalEntryTime > 0.3 && (
									<button
										type="button"
										onPointerDown={(e) => {
											e.stopPropagation();
											onSeek(vocalEntryTime);
										}}
										title={`Entrada vocal detectada (${formatTime(vocalEntryTime)})`}
										style={{ left: `${vocalEntryTime * pxPerSec}px` }}
										className="absolute top-0 bottom-0 z-10 flex items-center border-l-2 border-emerald-400 pl-1 text-[8px] font-black tracking-wider text-emerald-300 bg-emerald-500/15 pr-1"
									>
										VOZ
									</button>
								)}

								{/* Active Snap-to-Grid Target Badge */}
								{activeSnapTime !== null && (
									<div
										style={{ left: `${activeSnapTime * pxPerSec}px` }}
										className="pointer-events-none absolute top-0 bottom-0 z-30 flex items-center border-l-2 border-cyan-300 bg-cyan-400/20 px-1 text-[8px] font-mono font-black text-cyan-200"
									>
										{formatTime(activeSnapTime)}
									</div>
								)}

								{/* Playhead Continuation across Compás Strip */}
								<div
									style={{ left: `${playhead * pxPerSec}px` }}
									className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-primary"
								/>
							</div>
						</div>
					)}

					{/* Track Lanes */}
					<div className="relative flex flex-col divide-y divide-border/50">
						{/* Full-Height Compás & Beat Visual Grid across all track lanes */}
						{showBeatGrid && (barTimes.length > 0 || beatCutSlots.length > 0) && (
							<div
								style={{ left: `${TRACK_HEADER_W}px` }}
								className="pointer-events-none absolute top-0 bottom-0 right-0 z-[1] overflow-hidden"
							>
								{/* Alternating Compás background bands across tracks */}
								{barTimes.map((barT, idx) => {
									if (idx % 2 !== 0) return null;
									const nextBarT =
										barTimes[idx + 1] ??
										(beatBpm ? barT + (60 / beatBpm) * 4 : barT + 2);
									return (
										<div
											key={`lband-${idx}`}
											style={{
												left: `${barT * pxPerSec}px`,
												width: `${Math.max(4, (nextBarT - barT) * pxPerSec)}px`,
											}}
											className="absolute top-0 bottom-0 bg-white/[0.018]"
										/>
									);
								})}

								{/* Sub-beat vertical lines when zoomed in */}
								{pxPerSec >= 24 &&
									subBeatTimes.map((bt, idx) => (
										<div
											key={`lsub-${idx}`}
											style={{ left: `${bt * pxPerSec}px` }}
											className="absolute top-0 bottom-0 border-l border-white/[0.05]"
										/>
									))}

								{/* Dynamic 1-2s Cut Slot Guides */}
								{beatCutSlots.map((slot) => (
									<div
										key={`lcut-${slot.cutIndex}`}
										style={{ left: `${slot.startTime * pxPerSec}px` }}
										className={`absolute top-0 bottom-0 border-l ${
											slot.isPeak
												? 'border-cyan-400/18'
												: 'border-white/[0.06]'
										}`}
									/>
								))}

								{/* Primary Compás Downbeat Lines (4/4 bar boundaries) */}
								{barTimes.map((barT, idx) => (
									<div
										key={`lbar-${idx}`}
										style={{ left: `${barT * pxPerSec}px` }}
										className="absolute top-0 bottom-0 border-l border-amber-400/30"
									/>
								))}

								{/* Vocal Entry Vertical Guide */}
								{vocalEntryTime !== null && vocalEntryTime > 0.3 && (
									<div
										style={{ left: `${vocalEntryTime * pxPerSec}px` }}
										className="absolute top-0 bottom-0 border-l border-dashed border-emerald-400/60"
									/>
								)}
							</div>
						)}

						{/* Live Active Snap-to-Grid Highlight Guide across lanes */}
						{activeSnapTime !== null && (
							<div
								style={{ left: `${TRACK_HEADER_W + activeSnapTime * pxPerSec}px` }}
								className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.85)]"
							/>
						)}

						{/* Playhead Vertical Line across lanes */}
						<div
							style={{ left: `${TRACK_HEADER_W + playhead * pxPerSec}px` }}
							className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-primary/90"
						/>

						{tracks.map((track) => {
							const TrackIcon =
								track.kind === 'text' ? Type : track.kind === 'video' ? Video : Music2;
							return (
								<div key={track.id} className="flex h-10 items-stretch bg-[#0e0e13]">
									{/* Sticky Track Header */}
									<div
										style={{ width: TRACK_HEADER_W }}
										className="sticky left-0 z-20 flex flex-none items-center justify-between gap-1 border-r border-border bg-[#131319] px-2"
									>
										<div className="flex items-center gap-1.5 min-w-0">
											<span
												className={`flex h-5 w-6 flex-none items-center justify-center rounded text-[10px] font-black ${
													track.kind === 'text'
														? 'bg-amber-500/20 text-amber-300'
														: track.kind === 'video'
														? 'bg-cyan-500/20 text-cyan-300'
														: 'bg-emerald-500/20 text-emerald-300'
												}`}
											>
												{track.channelLabel}
											</span>
											<TrackIcon className="h-3 w-3 flex-none text-muted-foreground" />
										</div>

										<div className="flex items-center gap-0.5">
											{track.kind !== 'audio' && (
												<button
													type="button"
													onClick={() => onToggleTrackProp(track.id, 'hidden')}
													title={track.hidden ? 'Mostrar pista' : 'Ocultar pista'}
													className={`flex h-6 w-6 items-center justify-center rounded hover:bg-surface-2 ${
														track.hidden ? 'text-destructive' : 'text-muted-foreground'
													}`}
												>
													{track.hidden ? (
														<EyeOff className="h-3 w-3" />
													) : (
														<Eye className="h-3 w-3" />
													)}
												</button>
											)}
											{track.kind !== 'text' && (
												<button
													type="button"
													onClick={() => onToggleTrackProp(track.id, 'muted')}
													title={track.muted ? 'Activar audio' : 'Silenciar pista'}
													className={`flex h-6 w-6 items-center justify-center rounded hover:bg-surface-2 ${
														track.muted ? 'text-destructive' : 'text-muted-foreground'
													}`}
												>
													{track.muted ? (
														<VolumeX className="h-3 w-3" />
													) : (
														<Volume2 className="h-3 w-3" />
													)}
												</button>
											)}
											<button
												type="button"
												onClick={() => onToggleTrackProp(track.id, 'locked')}
												title={track.locked ? 'Desbloquear pista' : 'Bloquear pista'}
												className={`flex h-6 w-6 items-center justify-center rounded hover:bg-surface-2 ${
													track.locked ? 'text-amber-400' : 'text-muted-foreground/60'
												}`}
											>
												{track.locked ? (
													<Lock className="h-3 w-3" />
												) : (
													<Unlock className="h-3 w-3" />
												)}
											</button>
										</div>
									</div>

									{/* Clips Lane */}
									<div
										onPointerDown={(e) => {
											if (e.target === e.currentTarget) {
												onSelectClip(null);
												onSeek(timeFromClientX(e.clientX, e.currentTarget));
											}
										}}
										className={`relative flex-1 ${
											toolMode === 'razor' ? 'cursor-crosshair' : 'cursor-default'
										} ${track.hidden || track.muted ? 'opacity-45' : ''}`}
									>
										{track.clips.map((clip) => {
											const isSel = selectedClipId === clip.id;
											const isDragging = dragState?.clipId === clip.id;
											const leftPx = clip.startTime * pxPerSec;
											const widthPx = Math.max(24, clip.duration * pxPerSec);

											const toneClass =
												clip.type === 'text'
													? 'bg-amber-950/90 border-amber-500/60 text-amber-100'
													: clip.type === 'audio'
													? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100'
													: clip.type === 'video'
													? 'bg-indigo-950/90 border-indigo-400/70 text-indigo-100'
													: 'bg-cyan-950/90 border-cyan-500/60 text-cyan-100';

											return (
												<div
													key={clip.id}
													style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
													onPointerDown={(e) => beginClipDrag(e, clip, track, 'move')}
													className={`group absolute top-1 bottom-1 flex items-center overflow-hidden rounded border px-1.5 text-[11px] font-semibold transition-shadow ${toneClass} ${
														isSel ? 'ring-2 ring-primary z-10 shadow-lg' : 'hover:brightness-110'
													} ${isDragging ? 'opacity-90' : ''}`}
												>
													{/* Left Trim Handle */}
													<div
														onPointerDown={(e) =>
															beginClipDrag(e, clip, track, 'trim-left')
														}
														title="Recortar inicio"
														className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-primary/80"
													/>

													{/* Thumbnail mini strip for visual clips */}
													{(clip.thumbnailUrl || (clip.type === 'image' && clip.sourceUrl)) &&
														widthPx > 54 && (
															<img
																src={clip.thumbnailUrl || clip.sourceUrl}
																alt=""
																className="mr-1.5 h-6 w-8 flex-none rounded-sm object-cover pointer-events-none"
															/>
														)}

													<span className="truncate flex-1 pointer-events-none">
														{clip.type === 'text'
															? clip.textData?.text || clip.title
															: clip.title}
													</span>

													{widthPx > 65 && (
														<span className="ml-1 flex-none font-mono text-[9px] tabular-nums opacity-75 pointer-events-none">
															{clip.duration.toFixed(1)}s
														</span>
													)}

													{/* Right Trim Handle */}
													<div
														onPointerDown={(e) =>
															beginClipDrag(e, clip, track, 'trim-right')
														}
														title="Ajustar duración"
														className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-primary/80"
													/>
												</div>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
