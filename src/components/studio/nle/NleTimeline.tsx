import { useRef, useState } from 'react';
import {
	Copy,
	Eye,
	EyeOff,
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
	ZoomIn,
	ZoomOut,
} from 'lucide-react';
import { formatTime } from '@/lib/format';
import type { StudioSong } from '@/lib/studio';
import type { NleClip, NleToolMode, NleTrack } from '@/lib/nle/types';

interface Props {
	tracks: NleTrack[];
	songs: StudioSong[];
	playhead: number;
	totalDuration: number;
	selectedClipId: string | null;
	toolMode: NleToolMode;
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
}: Props) {
	const [pxPerSec, setPxPerSec] = useState(22);
	const [snapEnabled, setSnapEnabled] = useState(true);
	const [dragState, setDragState] = useState<DragState>(null);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	const timelineWidth = Math.max(760, Math.ceil((totalDuration + 10) * pxPerSec));

	function snapTime(raw: number, ignoreClipId: string): number {
		if (!snapEnabled) return Math.max(0, Number(raw.toFixed(2)));
		const snapPoints = [0, playhead];
		for (const tr of tracks) {
			for (const c of tr.clips) {
				if (c.id === ignoreClipId) continue;
				snapPoints.push(c.startTime, c.startTime + c.duration);
			}
		}
		const threshold = 10 / pxPerSec;
		for (const sp of snapPoints) {
			if (Math.abs(raw - sp) <= threshold) return Math.max(0, Number(sp.toFixed(2)));
		}
		return Math.max(0, Number(raw.toFixed(2)));
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

		if (toolMode === 'razor' && mode === 'move') {
			const lane = (e.currentTarget as HTMLElement).parentElement;
			if (lane) {
				const at = timeFromClientX(e.clientX, lane);
				onSplitClipAtTime(clip.id, at);
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
			onUpdateClip(clip.id, (c) => {
				if (mode === 'move') {
					const snapped = snapTime(origStart + deltaSec, clip.id);
					return { ...c, startTime: snapped };
				}
				if (mode === 'trim-right') {
					const nextEnd = snapTime(origStart + origDuration + deltaSec, clip.id);
					const nextDur = Math.max(0.5, Number((nextEnd - origStart).toFixed(2)));
					return { ...c, duration: nextDur };
				}
				// trim-left
				const maxShift = origDuration - 0.5;
				const shift = Math.min(maxShift, Math.max(-origStart, deltaSec));
				const nextStart = snapTime(origStart + shift, clip.id);
				const applied = nextStart - origStart;
				return {
					...c,
					startTime: nextStart,
					duration: Math.max(0.5, Number((origDuration - applied).toFixed(2))),
					trimStart: Math.max(0, Number((origTrimStart + applied).toFixed(2))),
				};
			});
		};

		const onUp = () => {
			setDragState(null);
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

				{/* Right Toolbar: Auto Storyboard + Snap + Zoom */}
				<div className="flex items-center gap-2">
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
						onClick={() => setSnapEnabled((v) => !v)}
						title="Imán de ajuste entre clips (Snap)"
						className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
							snapEnabled
								? 'border-primary/50 bg-primary/15 text-primary'
								: 'border-border bg-surface-2 text-muted-foreground'
						}`}
					>
						<Magnet className="h-3.5 w-3.5" />
					</button>

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
					<div className="sticky top-0 z-30 flex h-6 border-b border-border bg-[#111116]">
						<div
							style={{ width: TRACK_HEADER_W }}
							className="sticky left-0 z-40 flex-none border-r border-border bg-[#111116] px-2.5 flex items-center text-[10px] font-mono tabular-nums text-primary"
						>
							{formatTime(playhead)}
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

					{/* Track Lanes */}
					<div className="relative flex flex-col divide-y divide-border/50">
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
