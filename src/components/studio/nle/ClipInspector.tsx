import { useState } from 'react';
import {
	Clapperboard,
	Copy,
	Film,
	Loader2,
	RotateCcw,
	Scissors,
	Sliders,
	Sparkles,
	Trash2,
	Wand2,
} from 'lucide-react';
import { formatTime } from '@/lib/format';
import { magicEnhancePrompt } from '@/lib/nle/maestroDirector';
import { COLOR_GRADE_PRESETS } from '@/lib/storyboard';
import {
	DEFAULT_COLOR_ADJUST,
	NLE_MOTIONS,
	NLE_TRANSITIONS,
	type NleCameraMotion,
	type NleClip,
	type NleTrack,
	type NleTransition,
} from '@/lib/nle/types';

interface Props {
	tracks: NleTrack[];
	selectedClip: NleClip | null;
	playhead: number;
	onSelectClip: (clipId: string) => void;
	onSeek: (time: number) => void;
	onUpdateClip: (clipId: string, updater: (clip: NleClip) => NleClip) => void;
	onDuplicateClip: (clipId: string) => void;
	onSplitClip: (clipId: string) => void;
	onDeleteClip: (clipId: string) => void;
	onRegenerateClipImage: (clip: NleClip, prompt: string) => Promise<void>;
	onAnimateClipToVideo: (clip: NleClip, prompt: string) => Promise<void>;
}

export function ClipInspector({
	tracks,
	selectedClip,
	playhead,
	onSelectClip,
	onSeek,
	onUpdateClip,
	onDuplicateClip,
	onSplitClip,
	onDeleteClip,
	onRegenerateClipImage,
	onAnimateClipToVideo,
}: Props) {
	const [tab, setTab] = useState<'props' | 'scenes'>('props');
	const [wandLoading, setWandLoading] = useState(false);
	const [regenLoading, setRegenLoading] = useState(false);
	const [animateLoading, setAnimateLoading] = useState(false);
	const [aiError, setAiError] = useState<string | null>(null);

	const v1Track = tracks.find((t) => t.id === 'track-v1') ?? tracks.find((t) => t.kind === 'video');
	const v1Clips = v1Track?.clips ?? [];

	async function handleRegenerate() {
		if (!selectedClip) return;
		const prompt = (selectedClip.aiPrompt || selectedClip.title).trim();
		if (!prompt) return;
		setRegenLoading(true);
		setAiError(null);
		try {
			await onRegenerateClipImage(selectedClip, prompt);
		} catch (err) {
			setAiError(err instanceof Error ? err.message : 'No se pudo regenerar la escena');
		} finally {
			setRegenLoading(false);
		}
	}

	async function handleAnimate() {
		if (!selectedClip) return;
		const prompt = (selectedClip.aiPrompt || selectedClip.title).trim();
		if (!prompt) return;
		setAnimateLoading(true);
		setAiError(null);
		try {
			await onAnimateClipToVideo(selectedClip, prompt);
		} catch (err) {
			setAiError(err instanceof Error ? err.message : 'No se pudo animar la escena a video');
		} finally {
			setAnimateLoading(false);
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface overflow-hidden">
			{/* Inspector Tabs */}
			<div className="grid grid-cols-2 border-b border-border bg-[#0e0e12] p-1 gap-1 flex-none">
				<button
					type="button"
					onClick={() => setTab('props')}
					className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition-colors ${
						tab === 'props'
							? 'bg-surface-3 text-foreground'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<Sliders className="h-3.5 w-3.5 text-primary" />
					<span>Inspector</span>
				</button>
				<button
					type="button"
					onClick={() => setTab('scenes')}
					className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition-colors ${
						tab === 'scenes'
							? 'bg-surface-3 text-foreground'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<Clapperboard className="h-3.5 w-3.5 text-cyan-400" />
					<span>Escenas ({v1Clips.length})</span>
				</button>
			</div>

			{/* TAB 1: CLIP PROPERTIES */}
			{tab === 'props' && (
				<div className="no-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-3 text-xs">
					{!selectedClip ? (
						<div className="flex flex-1 flex-col items-center justify-center text-center p-4 text-muted-foreground">
							<Sliders className="h-6 w-6 mb-2 opacity-50" />
							<p className="font-semibold text-foreground/80">Ningún clip seleccionado</p>
							<p className="text-[11px] mt-1">
								Haz clic en cualquier clip del Timeline para ajustar tiempo, color Lumetri, movimiento, texto o recrearlo con IA.
							</p>
						</div>
					) : (
						<>
							{/* Clip Title + Quick Actions */}
							<div className="flex flex-col gap-1.5">
								<div className="flex items-center justify-between gap-1">
									<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
										Clip ({selectedClip.type})
									</span>
									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => onSplitClip(selectedClip.id)}
											title="Dividir en el cabezal"
											className="flex h-6 w-6 items-center justify-center rounded bg-surface-2 text-muted-foreground hover:text-primary"
										>
											<Scissors className="h-3 w-3" />
										</button>
										<button
											type="button"
											onClick={() => onDuplicateClip(selectedClip.id)}
											title="Duplicar clip"
											className="flex h-6 w-6 items-center justify-center rounded bg-surface-2 text-muted-foreground hover:text-foreground"
										>
											<Copy className="h-3 w-3" />
										</button>
										<button
											type="button"
											onClick={() => onDeleteClip(selectedClip.id)}
											title="Eliminar clip"
											className="flex h-6 w-6 items-center justify-center rounded bg-surface-2 text-muted-foreground hover:text-destructive"
										>
											<Trash2 className="h-3 w-3" />
										</button>
									</div>
								</div>
								<input
									type="text"
									value={selectedClip.title}
									onChange={(e) =>
										onUpdateClip(selectedClip.id, (c) => ({ ...c, title: e.target.value }))
									}
									className="h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
								/>
							</div>

							{/* Timing Numeric Strip */}
							<div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2.5">
								<label className="flex flex-col gap-1">
									<span className="text-[10px] font-bold text-muted-foreground">Inicio (s)</span>
									<input
										type="number"
										min={0}
										step={0.5}
										value={selectedClip.startTime}
										onChange={(e) => {
											const val = Math.max(0, Number(e.target.value) || 0);
											onUpdateClip(selectedClip.id, (c) => ({ ...c, startTime: val }));
										}}
										className="h-7 rounded border border-border bg-surface-2 px-2 font-mono text-xs tabular-nums outline-none focus:border-primary"
									/>
								</label>
								<label className="flex flex-col gap-1">
									<span className="text-[10px] font-bold text-muted-foreground">Duración (s)</span>
									<input
										type="number"
										min={0.5}
										step={0.5}
										value={selectedClip.duration}
										onChange={(e) => {
											const val = Math.max(0.5, Number(e.target.value) || 0.5);
											onUpdateClip(selectedClip.id, (c) => ({ ...c, duration: val }));
										}}
										className="h-7 rounded border border-border bg-surface-2 px-2 font-mono text-xs tabular-nums outline-none focus:border-primary"
									/>
								</label>
							</div>

							{/* Speed & Volume / Opacity */}
							<div className="flex flex-col gap-2 border-t border-border/60 pt-2.5">
								{selectedClip.type !== 'audio' && (
									<div className="flex items-center gap-2">
										<span className="w-16 text-[11px] text-muted-foreground">Opacidad</span>
										<input
											type="range"
											min={0}
											max={100}
											value={Math.round(selectedClip.opacity * 100)}
											onChange={(e) =>
												onUpdateClip(selectedClip.id, (c) => ({
													...c,
													opacity: Number(e.target.value) / 100,
												}))
											}
											className="flex-1 accent-primary"
										/>
										<span className="w-9 text-right font-mono text-[11px] tabular-nums">
											{Math.round(selectedClip.opacity * 100)}%
										</span>
									</div>
								)}

								{(selectedClip.type === 'audio' || selectedClip.type === 'video') && (
									<>
										<div className="flex items-center gap-2">
											<span className="w-16 text-[11px] text-muted-foreground">Volumen</span>
											<input
												type="range"
												min={0}
												max={100}
												value={Math.round(selectedClip.volume * 100)}
												onChange={(e) =>
													onUpdateClip(selectedClip.id, (c) => ({
														...c,
														volume: Number(e.target.value) / 100,
													}))
												}
												className="flex-1 accent-emerald-400"
											/>
											<span className="w-9 text-right font-mono text-[11px] tabular-nums">
												{Math.round(selectedClip.volume * 100)}%
											</span>
										</div>

										<div className="flex items-center gap-2">
											<span className="w-16 text-[11px] text-muted-foreground">Velocidad</span>
											<input
												type="range"
												min={50}
												max={200}
												step={10}
												value={Math.round(selectedClip.speed * 100)}
												onChange={(e) =>
													onUpdateClip(selectedClip.id, (c) => ({
														...c,
														speed: Number(e.target.value) / 100,
													}))
												}
												className="flex-1 accent-cyan-400"
											/>
											<span className="w-9 text-right font-mono text-[11px] tabular-nums">
												{selectedClip.speed.toFixed(1)}x
											</span>
										</div>
									</>
								)}
							</div>

							{/* TEXT OVERLAY EDITOR */}
							{selectedClip.type === 'text' && selectedClip.textData && (
								<div className="flex flex-col gap-2 border-t border-border/60 pt-2.5">
									<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
										Texto en Pantalla
									</span>
									<textarea
										rows={2}
										value={selectedClip.textData.text}
										onChange={(e) =>
											onUpdateClip(selectedClip.id, (c) => ({
												...c,
												textData: { ...c.textData!, text: e.target.value },
											}))
										}
										className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-foreground outline-none focus:border-primary resize-none"
									/>
									<div className="grid grid-cols-3 gap-1">
										{(['top', 'center', 'bottom'] as const).map((pos) => (
											<button
												key={pos}
												type="button"
												onClick={() =>
													onUpdateClip(selectedClip.id, (c) => ({
														...c,
														textData: { ...c.textData!, position: pos },
													}))
												}
												className={`h-7 rounded border text-[10px] font-bold ${
													selectedClip.textData?.position === pos
														? 'border-primary bg-primary/15 text-primary'
														: 'border-border bg-surface-2 text-muted-foreground'
												}`}
											>
												{pos === 'top' ? 'Arriba' : pos === 'center' ? 'Centro' : 'Abajo'}
											</button>
										))}
									</div>
									<div className="flex items-center gap-2">
										<span className="text-[11px] text-muted-foreground">Tamaño</span>
										<input
											type="range"
											min={20}
											max={60}
											value={selectedClip.textData.fontSize}
											onChange={(e) =>
												onUpdateClip(selectedClip.id, (c) => ({
													...c,
													textData: { ...c.textData!, fontSize: Number(e.target.value) },
												}))
											}
											className="flex-1 accent-primary"
										/>
										<input
											type="color"
											value={selectedClip.textData.color}
											onChange={(e) =>
												onUpdateClip(selectedClip.id, (c) => ({
													...c,
													textData: { ...c.textData!, color: e.target.value },
												}))
											}
											aria-label="Color del texto"
											className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
										/>
									</div>
								</div>
							)}

							{/* VISUAL CLIP CONTROLS: MOTION, TRANSITION, LUMETRI COLOR, AI */}
							{(selectedClip.type === 'image' || selectedClip.type === 'video') && (
								<>
									<div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2.5">
										<label className="flex flex-col gap-1">
											<span className="text-[10px] font-bold text-muted-foreground">
												Movimiento
											</span>
											<select
												value={selectedClip.cameraMotion}
												onChange={(e) =>
													onUpdateClip(selectedClip.id, (c) => ({
														...c,
														cameraMotion: e.target.value as NleCameraMotion,
													}))
												}
												className="h-7 rounded border border-border bg-surface-2 px-1.5 text-[11px]"
											>
												{NLE_MOTIONS.map((m) => (
													<option key={m.id} value={m.id}>
														{m.label}
													</option>
												))}
											</select>
										</label>

										<label className="flex flex-col gap-1">
											<span className="text-[10px] font-bold text-muted-foreground">
												Transición
											</span>
											<select
												value={selectedClip.transitionIn}
												onChange={(e) =>
													onUpdateClip(selectedClip.id, (c) => ({
														...c,
														transitionIn: e.target.value as NleTransition,
													}))
												}
												className="h-7 rounded border border-border bg-surface-2 px-1.5 text-[11px]"
											>
												{NLE_TRANSITIONS.map((t) => (
													<option key={t.id} value={t.id}>
														{t.label}
													</option>
												))}
											</select>
										</label>
									</div>

									{/* Lumetri Clip Color */}
									<div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
										<div className="flex items-center justify-between">
											<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
												Lumetri Color del Clip
											</span>
											<button
												type="button"
												onClick={() =>
													onUpdateClip(selectedClip.id, (c) => ({
														...c,
														lutId: 'inherit',
														colorAdjust: { ...DEFAULT_COLOR_ADJUST },
													}))
												}
												className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
											>
												<RotateCcw className="h-2.5 w-2.5" />
												Reset
											</button>
										</div>

										<select
											value={selectedClip.lutId}
											onChange={(e) =>
												onUpdateClip(selectedClip.id, (c) => ({
													...c,
													lutId: e.target.value,
												}))
											}
											className="h-7 rounded border border-border bg-surface-2 px-2 text-[11px]"
										>
											<option value="inherit">LUT Global del Proyecto</option>
											{COLOR_GRADE_PRESETS.map((l) => (
												<option key={l.id} value={l.id}>
													{l.name}
												</option>
											))}
										</select>

										{(
											[
												{ key: 'brightness', label: 'Brillo' },
												{ key: 'contrast', label: 'Contraste' },
												{ key: 'saturate', label: 'Saturación' },
											] as const
										).map((ch) => (
											<div key={ch.key} className="flex items-center gap-2">
												<span className="w-16 text-[11px] text-muted-foreground">
													{ch.label}
												</span>
												<input
													type="range"
													min={50}
													max={160}
													value={selectedClip.colorAdjust[ch.key]}
													onChange={(e) => {
														const v = Number(e.target.value);
														onUpdateClip(selectedClip.id, (c) => ({
															...c,
															colorAdjust: { ...c.colorAdjust, [ch.key]: v },
														}));
													}}
													className="flex-1 accent-primary"
												/>
												<span className="w-9 text-right font-mono text-[10px] tabular-nums">
													{selectedClip.colorAdjust[ch.key]}%
												</span>
											</div>
										))}
									</div>

									{/* AI Prompt & Re-creation */}
									<div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
										<div className="flex items-center justify-between gap-2">
											<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
												Director IA de Escena
											</span>
											<button
												type="button"
												disabled={wandLoading}
												onClick={async () => {
													const clip = selectedClip;
													setWandLoading(true);
													setAiError(null);
													try {
														const improved = await magicEnhancePrompt(clip.aiPrompt || clip.title, {
															sceneContext: `Clip de ${clip.duration.toFixed(1)}s en timeline`,
														});
														onUpdateClip(clip.id, (c) => ({
															...c,
															aiPrompt: improved,
														}));
													} catch (err) {
														setAiError(
															err instanceof Error
																? err.message
																: 'No se pudo mejorar el prompt con IA.'
														);
													} finally {
														setWandLoading(false);
													}
												}}
												className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-colors"
											>
												{wandLoading ? (
													<Loader2 className="h-2.5 w-2.5 animate-spin" />
												) : (
													<Wand2 className="h-2.5 w-2.5" />
												)}
												<span>{wandLoading ? 'Pensando...' : 'Varita IA'}</span>
											</button>
										</div>
										<textarea
											rows={2}
											value={selectedClip.aiPrompt ?? ''}
											onChange={(e) =>
												onUpdateClip(selectedClip.id, (c) => ({
													...c,
													aiPrompt: e.target.value,
												}))
											}
											placeholder="Describe qué quieres cambiar en esta escena..."
											className="rounded-lg border border-border bg-surface-2 p-2 text-[11px] text-foreground outline-none focus:border-primary resize-none"
										/>
										{aiError && (
											<p className="text-[11px] text-destructive">{aiError}</p>
										)}
										<div className="grid grid-cols-2 gap-1.5">
											<button
												type="button"
												disabled={regenLoading}
												onClick={() => void handleRegenerate()}
												className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40 transition-colors"
											>
												{regenLoading ? (
													<Loader2 className="h-3 w-3 animate-spin" />
												) : (
													<Wand2 className="h-3 w-3" />
												)}
												<span>Recrear Img</span>
											</button>
											<button
												type="button"
												disabled={animateLoading}
												onClick={() => void handleAnimate()}
												className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black disabled:opacity-40 transition-colors"
											>
												{animateLoading ? (
													<Loader2 className="h-3 w-3 animate-spin" />
												) : (
													<Film className="h-3 w-3" />
												)}
												<span>Animar Video</span>
											</button>
										</div>
									</div>
								</>
							)}
						</>
					)}
				</div>
			)}

			{/* TAB 2: SCENE BREAKDOWN */}
			{tab === 'scenes' && (
				<div className="no-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 p-2.5">
					{v1Clips.length === 0 ? (
						<p className="p-4 text-center text-xs text-muted-foreground">
							Sin escenas en V1 aún.
						</p>
					) : (
						v1Clips.map((sc, idx) => {
							const active =
								playhead >= sc.startTime && playhead <= sc.startTime + sc.duration;
							const selected = selectedClip?.id === sc.id;
							return (
								<button
									key={sc.id}
									type="button"
									onClick={() => {
										onSelectClip(sc.id);
										onSeek(sc.startTime);
									}}
									className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors ${
										selected
											? 'border-primary bg-primary/10'
											: active
											? 'border-cyan-500/50 bg-cyan-500/5'
											: 'border-border/70 bg-surface-2 hover:border-border'
									}`}
								>
									<div className="relative h-10 w-16 flex-none overflow-hidden rounded bg-black">
										{sc.thumbnailUrl || sc.sourceUrl ? (
											sc.type === 'video' ? (
												<video
													src={sc.sourceUrl}
													muted
													className="h-full w-full object-cover"
												/>
											) : (
												<img
													src={sc.thumbnailUrl || sc.sourceUrl}
													alt=""
													className="h-full w-full object-cover"
												/>
											)
										) : (
											<Sparkles className="m-auto h-4 w-4 text-muted-foreground" />
										)}
										<span className="absolute top-0.5 left-0.5 rounded bg-black/80 px-1 text-[9px] font-mono font-bold text-primary">
											#{idx + 1}
										</span>
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-xs font-semibold text-foreground">
											{sc.title}
										</p>
										<p className="font-mono text-[10px] tabular-nums text-muted-foreground">
											{formatTime(sc.startTime)} · {sc.duration.toFixed(1)}s
										</p>
									</div>
								</button>
							);
						})
					)}
				</div>
			)}
		</div>
	);
}
