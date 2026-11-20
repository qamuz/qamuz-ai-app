import { useEffect, useRef, useState } from 'react';
import {
	AudioWaveform,
	Brain,
	CheckCircle2,
	Clapperboard,
	Film,
	Image as ImageIcon,
	Loader2,
	Mic2,
	Music2,
	Play,
	Sparkles,
	Tv,
	Upload,
	Wand2,
	X,
} from 'lucide-react';
import { CHARACTERS } from '@/lib/characters';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { audioDuration, uploadMedia } from '@/lib/media';
import { MV_STYLES, deriveRecommendedMotion } from '@/lib/music-video/presets';
import {
	buildMaestroDirectorPlan,
	magicEnhancePrompt,
	magicEnhancePromptDetailed,
	magicExpandStoryIdea,
	type MaestroFormat,
	type MaestroPlan,
	type MaestroScene,
} from '@/lib/nle/maestroDirector';
import type { NleAspectRatio } from '@/lib/nle/types';
import {
	createCreation,
	fetchCreation,
	refreshCreation,
	type StudioSong,
} from '@/lib/studio';

interface Props {
	open: boolean;
	userId: string;
	songs: StudioSong[];
	initialSongKey?: string | null;
	aspect: NleAspectRatio;
	onClose: () => void;
	onAssemblePlanToTimeline: (plan: MaestroPlan) => void;
	onWorkspaceUpdated: () => void;
}

const FORMAT_CARDS: { id: MaestroFormat; label: string; desc: string; icon: typeof Music2 }[] = [
	{
		id: 'music-video',
		label: 'Videoclip Musical',
		desc: 'Sincronía de voz, lip-sync y coros',
		icon: Music2,
	},
	{
		id: 'short-film',
		label: 'Película / Corto',
		desc: 'Narrativa anamórfica por actos',
		icon: Clapperboard,
	},
	{
		id: 'mini-series',
		label: 'Mini-Serie',
		desc: 'Capítulos y giros dramáticos',
		icon: Tv,
	},
	{
		id: 'commercial-promo',
		label: 'Eslogan / Spot',
		desc: 'Cortes al beat y texto de impacto',
		icon: Sparkles,
	},
];

export function MaestroDirectorModal({
	open,
	userId,
	songs,
	initialSongKey,
	aspect,
	onClose,
	onAssemblePlanToTimeline,
	onWorkspaceUpdated,
}: Props) {
	const [selectedSongKey, setSelectedSongKey] = useState<string>(
		initialSongKey || songs[0]?.key || 'upload'
	);
	const [uploadedAudio, setUploadedAudio] = useState<{
		title: string;
		url: string;
		duration: number;
	} | null>(null);
	const [uploadingAudio, setUploadingAudio] = useState(false);

	const [format, setFormat] = useState<MaestroFormat>('music-video');
	const [style, setStyle] = useState<string>(MV_STYLES[0].id);
	const [character, setCharacter] = useState<string>(CHARACTERS[0]?.name ?? 'Mateo');
	const [storyIdea, setStoryIdea] = useState('');
	const [customLyrics, setCustomLyrics] = useState('');

	const [wandExpanding, setWandExpanding] = useState(false);
	const [enhancingSceneId, setEnhancingSceneId] = useState<string | null>(null);

	const [analyzing, setAnalyzing] = useState(false);
	const [liveStageMsg, setLiveStageMsg] = useState('');
	const [liveThought, setLiveThought] = useState('');
	const [showFullThought, setShowFullThought] = useState(false);

	const [plan, setPlan] = useState<MaestroPlan | null>(null);
	const planRef = useRef<MaestroPlan | null>(null);
	planRef.current = plan;

	const [batchState, setBatchState] = useState<{
		active: boolean;
		stepLabel: string;
		done: number;
		total: number;
	} | null>(null);
	const [globalError, setGlobalError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		if (initialSongKey && songs.some((s) => s.key === initialSongKey)) {
			setSelectedSongKey(initialSongKey);
			return;
		}
		if (selectedSongKey === 'upload' && !uploadedAudio && songs[0]?.key) {
			setSelectedSongKey(songs[0].key);
		}
	}, [open, initialSongKey, songs, selectedSongKey, uploadedAudio]);

	if (!open) return null;

	const chosenSong = songs.find((s) => s.key === selectedSongKey) ?? null;

	async function handleAudioUpload(file: File | undefined) {
		if (!file || !file.type.startsWith('audio/')) return;
		setUploadingAudio(true);
		setGlobalError(null);
		try {
			const [res, dur] = await Promise.all([
				uploadMedia(userId, file, 'uploads'),
				audioDuration(file),
			]);
			const url = res.url || URL.createObjectURL(file);
			setUploadedAudio({
				title: file.name.replace(/\.[^.]+$/, '').slice(0, 64),
				url,
				duration: Math.max(12, dur || 45),
			});
			setSelectedSongKey('upload');
		} finally {
			setUploadingAudio(false);
		}
	}

	async function handleExpandStoryWithWand() {
		setWandExpanding(true);
		setGlobalError(null);
		try {
			const expanded = await magicExpandStoryIdea(
				storyIdea,
				chosenSong?.title || uploadedAudio?.title || 'Historia IA',
				format,
				{
					style,
					character,
					lyrics: customLyrics.trim() || chosenSong?.lyrics || '',
				}
			);
			setStoryIdea(expanded);
		} catch (err) {
			setGlobalError(err instanceof Error ? err.message : 'Error ejecutando Varita IA');
		} finally {
			setWandExpanding(false);
		}
	}

	async function handleEnhanceSceneWithWand(sc: MaestroScene) {
		if (!plan) return;
		setEnhancingSceneId(sc.id);
		setGlobalError(null);
		try {
			const sceneIdx = plan.scenes.findIndex((s) => s.id === sc.id);
			const prevScene = sceneIdx > 0 ? plan.scenes[sceneIdx - 1] : null;
			const nextScene =
				sceneIdx >= 0 && sceneIdx < plan.scenes.length - 1
					? plan.scenes[sceneIdx + 1]
					: null;
			const previousVideos = plan.scenes
				.filter((s) => s.id !== sc.id && (Boolean(s.videoUrl) || s.sceneNumber < sc.sceneNumber))
				.slice(-5)
				.map((s) => `Scene #${s.sceneNumber} (${s.title}): ${s.visualPrompt}`.slice(0, 190));

			const sceneContext = `${sc.sectionTag} (${formatTime(sc.startTime)}-${formatTime(sc.endTime)}). Shot: ${sc.shotType}. Action: ${sc.narrativeAction}. Spoken cue: ${sc.spokenCue}`;

			const [improvedVisual, improvedMotion] = await Promise.all([
				magicEnhancePrompt(sc.visualPrompt, {
					mode: 'enhance-prompt',
					style: plan.style,
					character: plan.character,
					format: plan.format,
					songTitle: plan.title,
					visualBible: plan.visualBible,
					previousVideos,
					previousScenePrompt: prevScene?.visualPrompt || '',
					nextScenePrompt: nextScene?.visualPrompt || '',
					cameraMotion: sc.cameraMotion,
					sceneContext,
				}),
				magicEnhancePromptDetailed(sc.videoMotionPrompt || sc.visualPrompt, {
					mode: 'video-prompt',
					style: plan.style,
					character: plan.character,
					format: plan.format,
					songTitle: plan.title,
					visualBible: plan.visualBible,
					previousVideos,
					previousScenePrompt: prevScene?.videoMotionPrompt || prevScene?.visualPrompt || '',
					nextScenePrompt: nextScene?.visualPrompt || '',
					cameraMotion: sc.cameraMotion,
					hasStartImage: true,
					sceneContext,
				}),
			]);

			updateScene(sc.id, (s) => ({
				...s,
				visualPrompt: improvedVisual,
				videoMotionPrompt: improvedMotion.prompt,
				errorMessage: undefined,
			}));
		} catch (err) {
			updateScene(sc.id, (s) => ({
				...s,
				errorMessage: err instanceof Error ? err.message : 'No se pudo mejorar la escena con IA',
			}));
		} finally {
			setEnhancingSceneId(null);
		}
	}

	async function handleBuildPlan(): Promise<MaestroPlan | null> {
		setAnalyzing(true);
		setGlobalError(null);
		setLiveStageMsg('Conectando con el Maestro Director IA...');
		setLiveThought('');
		setShowFullThought(false);
		try {
			const built = await buildMaestroDirectorPlan({
				song: chosenSong,
				audioUrl: chosenSong?.audioUrl || uploadedAudio?.url || '',
				audioTitle: chosenSong?.title || uploadedAudio?.title || 'Historia Audiovisual IA',
				durationHint: chosenSong?.duration || uploadedAudio?.duration || 45,
				lyrics: customLyrics.trim() || chosenSong?.lyrics || null,
				format,
				style,
				character,
				storyIdea,
				onStage: (_stage, msg) => setLiveStageMsg(msg),
				onThought: (txt) => setLiveThought(txt),
			});
			setPlan(built);
			return built;
		} catch (err) {
			setGlobalError(err instanceof Error ? err.message : 'No se pudo analizar el audio con IA');
			return null;
		} finally {
			setAnalyzing(false);
		}
	}

	function updateScene(sceneId: string, updater: (s: MaestroScene) => MaestroScene) {
		setPlan((prev) => {
			if (!prev) return prev;
			const next: MaestroPlan = {
				...prev,
				scenes: prev.scenes.map((sc) => (sc.id === sceneId ? updater(sc) : sc)),
			};
			planRef.current = next;
			return next;
		});
	}

	async function generateSingleImage(
		scene: MaestroScene,
		activePlan?: MaestroPlan | null
	): Promise<string | null> {
		const ctxPlan = activePlan ?? planRef.current;
		updateScene(scene.id, (s) => ({ ...s, status: 'generating_image', errorMessage: undefined }));
		const size = aspect === '9:16' ? '1024x1536' : '1536x1024';

		// Put shot composition & unique scene framing right at token 1 so FLUX creates realistic, consistent frames
		const distinctPrompt = `${scene.shotType || `Scene ${scene.sceneNumber}`}: ${scene.visualPrompt}${
			ctxPlan?.visualBible ? `. Visual continuity: ${ctxPlan.visualBible}` : ''
		}. Photorealistic live-action 35mm cinema still, natural skin texture, realistic motivated lighting, shallow depth of field, no text, no watermark`
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 950);

		const res = await createCreation('image', distinctPrompt, {
			size,
			style: ctxPlan?.style || style,
		});
		if (res.error || !res.data?.id) {
			updateScene(scene.id, (s) => ({
				...s,
				status: 'error',
				errorMessage: res.error || 'No se pudo iniciar la generación de imagen IA',
			}));
			return null;
		}
		for (let i = 0; i < 48; i++) {
			await new Promise((r) => setTimeout(r, 2500));
			await refreshCreation(res.data.id);
			const created = await fetchCreation(res.data.id);
			if (created?.status === 'ready' && (created.result_urls?.[0] || created.thumbnail_url)) {
				const url = created.result_urls?.[0] || created.thumbnail_url || '';
				updateScene(scene.id, (s) => ({ ...s, imageUrl: url, status: 'image_ready' }));
				onWorkspaceUpdated();
				return url;
			}
			if (created?.status === 'error') {
				updateScene(scene.id, (s) => ({
					...s,
					status: 'error',
					errorMessage: created.error_message || 'Error generando imagen IA',
				}));
				return null;
			}
		}
		updateScene(scene.id, (s) => ({
			...s,
			status: 'error',
			errorMessage: 'Tiempo de espera agotado esperando la GPU de imágenes. Revisa tu historial de creaciones.',
		}));
		return null;
	}

	async function generateSingleVideo(
		scene: MaestroScene,
		imageOverride?: string,
		activePlan?: MaestroPlan | null
	): Promise<string | null> {
		const ctxPlan = activePlan ?? planRef.current;
		const freshScene = ctxPlan?.scenes.find((s) => s.id === scene.id) ?? scene;
		let refImage = imageOverride || freshScene.imageUrl;
		const hasUsableRefImage =
			Boolean(refImage) && /^(https?:\/\/|blob:|data:image\/)/i.test(refImage);
		if (!hasUsableRefImage) {
			const generated = await generateSingleImage(freshScene, ctxPlan);
			if (!generated) return null;
			refImage = generated;
		}

		updateScene(scene.id, (s) => ({ ...s, status: 'generating_video', errorMessage: undefined }));
		const baseMotionPrompt = (freshScene.videoMotionPrompt || freshScene.visualPrompt || '')
			.replace(/\s+/g, ' ')
			.trim();
		const finalMotionPrompt =
			`${baseMotionPrompt}. Single unbroken stabilized live-action 35mm take, natural continuous physics and breathing micro-motion, preserve exact subject face and wardrobe, no jump cuts, no flicker, no morphing`
				.replace(/\.\s*\./g, '.')
				.slice(0, 950);
		const calibratedMotion = deriveRecommendedMotion(freshScene.cameraMotion, freshScene.shotType);

		// Never pass song cover_url as fallback so each scene video exclusively animates its own unique reference image
		const res = await createCreation('video', finalMotionPrompt, {
			aspect: aspect === '21:9' ? '16:9' : aspect,
			style: ctxPlan?.style || style,
			cameraMotion: freshScene.cameraMotion,
			motion: calibratedMotion,
			noise_aug_strength: 0.015,
			fps: 12,
			num_frames: 25,
			reference_image_url: refImage,
			source: chosenSong
				? {
						song_key: chosenSong.key,
						audio_url: chosenSong.audioUrl,
						title: `${chosenSong.title} · Escena ${freshScene.sceneNumber}`,
						cover_url: null,
						duration: chosenSong.duration,
				  }
				: null,
		});
		if (res.error || !res.data?.id) {
			updateScene(scene.id, (s) => ({
				...s,
				status: 'error',
				errorMessage: res.error || 'No se pudo iniciar la conversión a video IA',
			}));
			return null;
		}
		onWorkspaceUpdated();
		for (let i = 0; i < 65; i++) {
			await new Promise((r) => setTimeout(r, 3000));
			await refreshCreation(res.data.id);
			const created = await fetchCreation(res.data.id);
			if (created?.status === 'ready' && created.result_urls?.[0]) {
				const videoUrl = created.result_urls[0];
				updateScene(scene.id, (s) => ({ ...s, videoUrl, status: 'video_ready' }));
				onWorkspaceUpdated();
				return videoUrl;
			}
			if (created?.status === 'error') {
				updateScene(scene.id, (s) => ({
					...s,
					status: 'error',
					errorMessage: created.error_message || 'Error generando video IA',
				}));
				return null;
			}
		}
		updateScene(scene.id, (s) => ({
			...s,
			status: 'error',
			errorMessage: 'El render en GPU tardó más de lo previsto. Revisa tu biblioteca en unos instantes.',
		}));
		return null;
	}

	async function handleGenerateAllImages(targetPlan = planRef.current) {
		if (!targetPlan) return {};
		setGlobalError(null);
		setBatchState({
			active: true,
			stepLabel: 'Creando imágenes reales únicas del Storyboard en GPU',
			done: 0,
			total: targetPlan.scenes.length,
		});
		const updatedUrls: Record<string, string> = {};
		for (let i = 0; i < targetPlan.scenes.length; i++) {
			const sc = planRef.current?.scenes[i] ?? targetPlan.scenes[i];
			const url = await generateSingleImage(sc, planRef.current ?? targetPlan);
			if (url) updatedUrls[sc.id] = url;
			setBatchState({
				active: true,
				stepLabel: 'Creando imágenes reales únicas del Storyboard en GPU',
				done: i + 1,
				total: targetPlan.scenes.length,
			});
		}
		setBatchState(null);
		return updatedUrls;
	}

	async function handleConvertAllToVideos(
		targetPlan = planRef.current,
		imageUrlsMap?: Record<string, string>
	) {
		if (!targetPlan) return;
		setGlobalError(null);
		setBatchState({
			active: true,
			stepLabel: 'Animando cada imagen a Video Real IA en GPU',
			done: 0,
			total: targetPlan.scenes.length,
		});
		for (let i = 0; i < targetPlan.scenes.length; i++) {
			const sc = planRef.current?.scenes[i] ?? targetPlan.scenes[i];
			await generateSingleVideo(
				sc,
				imageUrlsMap?.[sc.id] || sc.imageUrl,
				planRef.current ?? targetPlan
			);
			setBatchState({
				active: true,
				stepLabel: 'Animando cada imagen a Video Real IA en GPU',
				done: i + 1,
				total: targetPlan.scenes.length,
			});
		}
		setBatchState(null);
	}

	async function handleFullAutopilot() {
		const built = planRef.current || (await handleBuildPlan());
		if (!built) return;
		planRef.current = built;
		const imgMap = await handleGenerateAllImages(built);
		await handleConvertAllToVideos(planRef.current ?? built, imgMap);
	}

	const readyVisualCount =
		plan?.scenes.filter((s) => Boolean(s.videoUrl || s.imageUrl)).length ?? 0;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5">
			<div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
				{/* Header */}
				<header className="flex items-center justify-between gap-3 border-b border-border bg-[#0e0e12] px-5 py-3 flex-none">
					<div className="flex items-center gap-3 min-w-0">
						<div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary text-primary-foreground">
							<Brain className="h-5 w-5" />
						</div>
						<div className="min-w-0">
							<h2 className="text-sm font-bold text-foreground">
								Maestro Director & Editor IA Real
							</h2>
							<p className="truncate text-xs text-muted-foreground">
								Escucha de Audio → Pensamiento IA → Guion & Storyboard → Imágenes Reales → Videos IA → Timeline
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Cerrar"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
					>
						<X className="h-4 w-4" />
					</button>
				</header>

				{/* Body */}
				<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[340px_1fr] overflow-hidden">
					{/* LEFT COLUMN: Brief, Song & Format Setup */}
					<div className="no-scrollbar flex flex-col gap-3 overflow-y-auto border-b lg:border-b-0 lg:border-r border-border bg-[#111116] p-4 text-xs">
						{/* 1. Audio Source */}
						<div className="flex flex-col gap-1.5">
							<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
								1. Audio o Canción Maestro
							</span>
							<select
								value={selectedSongKey}
								onChange={(e) => setSelectedSongKey(e.target.value)}
								className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-foreground outline-none focus:border-primary"
							>
								{songs.map((s) => (
									<option key={s.key} value={s.key}>
										{s.title} ({formatTime(s.duration)})
									</option>
								))}
								<option value="upload">
									{uploadedAudio ? uploadedAudio.title : 'Subir archivo MP3 / WAV'}
								</option>
							</select>

							{selectedSongKey === 'upload' && (
								<label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-2 px-3 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground">
									{uploadingAudio ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
									) : (
										<Upload className="h-3.5 w-3.5" />
									)}
									<span>{uploadedAudio ? uploadedAudio.title : 'Seleccionar MP3 / WAV'}</span>
									<input
										type="file"
										accept="audio/*"
										className="sr-only"
										onChange={(e) => void handleAudioUpload(e.target.files?.[0])}
									/>
								</label>
							)}
						</div>

						{/* 2. Format Picker */}
						<div className="flex flex-col gap-1.5">
							<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
								2. Formato de Producción
							</span>
							<div className="grid grid-cols-2 gap-1.5">
								{FORMAT_CARDS.map((fc) => {
									const Icon = fc.icon;
									const on = format === fc.id;
									return (
										<button
											key={fc.id}
											type="button"
											onClick={() => setFormat(fc.id)}
											className={`flex flex-col gap-0.5 rounded-lg border p-2 text-left transition-colors ${
												on
													? 'border-primary bg-primary/10 text-foreground'
													: 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
											}`}
										>
											<span className="flex items-center gap-1 text-[11px] font-bold">
												<Icon className={`h-3.5 w-3.5 ${on ? 'text-primary' : ''}`} />
												{fc.label}
											</span>
											<span className="text-[10px] opacity-75 leading-tight">{fc.desc}</span>
										</button>
									);
								})}
							</div>
						</div>

						{/* 3. Cast & Visual Aesthetic */}
						<div className="grid grid-cols-2 gap-2">
							<label className="flex flex-col gap-1">
								<span className="text-[11px] font-bold text-muted-foreground">Protagonista</span>
								<select
									value={character}
									onChange={(e) => setCharacter(e.target.value)}
									className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
								>
									<option value="Sin personaje (Atmósfera & Entorno)">Solo entorno</option>
									{CHARACTERS.map((c) => (
										<option key={c.id} value={c.name}>
											{c.name}
										</option>
									))}
								</select>
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-[11px] font-bold text-muted-foreground">Estilo visual</span>
								<select
									value={style}
									onChange={(e) => setStyle(e.target.value)}
									className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs"
								>
									{MV_STYLES.map((s) => (
										<option key={s.id} value={s.id}>
											{s.name}
										</option>
									))}
								</select>
							</label>
						</div>

						{/* 4. Story / Script / Slogan Input + Real AI Magic Wand */}
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between">
								<span className="text-[11px] font-bold text-muted-foreground">
									Historia / Guion / Eslogan
								</span>
								<button
									type="button"
									disabled={wandExpanding}
									onClick={() => void handleExpandStoryWithWand()}
									className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-colors"
								>
									{wandExpanding ? (
										<Loader2 className="h-3 w-3 animate-spin" />
									) : (
										<Wand2 className="h-3 w-3" />
									)}
									<span>{wandExpanding ? 'Pensando...' : 'Varita Mágica'}</span>
								</button>
							</div>
							<textarea
								rows={3}
								value={storyIdea}
								onChange={(e) => setStoryIdea(e.target.value)}
								placeholder="Describe la historia, trama de la mini-serie o eslogan clave..."
								className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-foreground outline-none focus:border-primary resize-none"
							/>
						</div>

						{/* Optional Custom Lyrics / Spoken Cue */}
						<div className="flex flex-col gap-1">
							<span className="text-[11px] font-bold text-muted-foreground">
								Letra o Frases Vocales (opcional)
							</span>
							<textarea
								rows={2}
								value={customLyrics}
								onChange={(e) => setCustomLyrics(e.target.value)}
								placeholder={
									chosenSong?.lyrics
										? 'Se enviará la letra real de tu canción + el audio al Director IA...'
										: 'Opcional: pega frases/eslóganes; la IA también escuchará el audio...'
								}
								className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-foreground outline-none focus:border-primary resize-none"
							/>
						</div>

						{globalError && (
							<p className="rounded-lg bg-destructive/15 border border-destructive/30 px-2.5 py-2 text-xs text-destructive">
								{globalError}
							</p>
						)}

						<div className="mt-auto flex flex-col gap-2 pt-2 border-t border-border">
							<button
								type="button"
								disabled={analyzing || (!chosenSong && !uploadedAudio)}
								onClick={() => void handleBuildPlan()}
								className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground hover:brightness-110 disabled:opacity-40"
							>
								{analyzing ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<AudioWaveform className="h-4 w-4" />
								)}
								<span>{analyzing ? 'Pensando y Escuchando...' : 'Analizar Audio y Pensar Guion IA'}</span>
							</button>

							<button
								type="button"
								disabled={analyzing || batchState?.active || (!chosenSong && !uploadedAudio)}
								onClick={() => void handleFullAutopilot()}
								className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 text-xs font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black disabled:opacity-40 transition-colors"
							>
								<Sparkles className="h-3.5 w-3.5" />
								<span>Piloto Automático Real: Todo el Flujo</span>
							</button>
						</div>
					</div>

					{/* RIGHT COLUMN: Live Thinking Console, Analysis Map, Real Script, Images & Video Synthesis */}
					<div className="flex min-h-0 flex-col bg-[#0c0c10] overflow-hidden">
						{analyzing ? (
							<div className="flex flex-1 flex-col gap-4 p-6 overflow-y-auto no-scrollbar">
								<div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
									<Loader2 className="h-6 w-6 flex-none animate-spin text-primary" />
									<div>
										<h3 className="text-sm font-bold text-foreground">
											Maestro Director IA Razonando...
										</h3>
										<p className="text-xs text-primary mt-0.5">{liveStageMsg}</p>
									</div>
								</div>

								<div className="flex-1 rounded-xl border border-border bg-[#111116] p-4 flex flex-col gap-2 min-h-[200px]">
									<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
										<Brain className="h-3.5 w-3.5" />
										<span>Pensamiento en Tiempo Real del Director</span>
									</div>
									<div className="flex-1 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
										{liveThought ||
											'Procesando espectro de audio, entrada vocal, tempo, historia y encuadres cinematográficos...'}
									</div>
								</div>
							</div>
						) : !plan ? (
							<div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
								<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
									<Clapperboard className="h-7 w-7" />
								</div>
								<h3 className="text-base font-bold text-foreground">
									Maestro Director IA (Sin Demos)
								</h3>
								<p className="mt-1 max-w-md text-xs text-muted-foreground leading-relaxed">
									Elige tu canción o sube un audio a la izquierda y presiona{' '}
									<strong className="text-foreground">“Analizar Audio y Pensar Guion IA”</strong>.
									La IA escuchará el audio real, razonará en vivo la historia, detectará la entrada de voz y diseñará cada toma para generar imágenes y videos reales.
								</p>
							</div>
						) : (
							<>
								{/* Acoustic & Director Thinking Summary Banner */}
								<div className="border-b border-border bg-[#121218] px-4 py-3 flex-none">
									<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
										<div className="flex items-center gap-2 min-w-0">
											{chosenSong?.coverUrl && (
												<img
													src={coverUrl(chosenSong.coverUrl)}
													alt=""
													className="h-8 w-8 rounded object-cover flex-none"
												/>
											)}
											<div className="min-w-0">
												<p className="truncate text-xs font-bold text-foreground">
													{plan.title}{' '}
													{plan.detectedMood && (
														<span className="ml-1 text-[10px] font-semibold text-cyan-300">
															· {plan.detectedMood}
														</span>
													)}
												</p>
												<p className="text-[11px] text-muted-foreground font-mono tabular-nums">
													{plan.analysis.estimatedBpm} BPM · Voz entra en{' '}
													<span className="text-primary font-bold">
														{formatTime(plan.analysis.vocalEntryTime)}
													</span>{' '}
													· Hook{' '}
													<span className="text-cyan-300 font-bold">
														{formatTime(plan.analysis.peakHookStart)}–{formatTime(plan.analysis.peakHookEnd)}
													</span>
												</p>
											</div>
										</div>

										<div className="flex flex-wrap items-center gap-1.5">
											<button
												type="button"
												disabled={batchState?.active}
												onClick={() => void handleGenerateAllImages()}
												className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40 transition-colors"
											>
												<ImageIcon className="h-3.5 w-3.5" />
												<span>1. Generar Imágenes</span>
											</button>
											<button
												type="button"
												disabled={batchState?.active}
												onClick={() => void handleConvertAllToVideos()}
												className="inline-flex h-8 items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black disabled:opacity-40 transition-colors"
											>
												<Film className="h-3.5 w-3.5" />
												<span>2. Pasar a Videos IA</span>
											</button>
											<button
												type="button"
												disabled={readyVisualCount === 0}
												title={
													readyVisualCount === 0
														? 'Genera primero al menos una imagen o video real IA'
														: 'Montar escenas generadas y audio sincronizado al Timeline'
												}
												onClick={() => {
													onAssemblePlanToTimeline(plan);
													onClose();
												}}
												className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:brightness-110 disabled:opacity-40"
											>
												<Play className="h-3.5 w-3.5" />
												<span>Montar en Timeline ({readyVisualCount}/{plan.scenes.length})</span>
											</button>
										</div>
									</div>

									{/* Waveform Energy Envelope Visual */}
									<div className="flex h-6 items-end gap-0.5 rounded-lg bg-black/50 px-2 py-1">
										{plan.analysis.energyBins.map((val, i) => {
											const barTime = (i / plan.analysis.energyBins.length) * plan.analysis.duration;
											const isHook =
												barTime >= plan.analysis.peakHookStart &&
												barTime <= plan.analysis.peakHookEnd;
											return (
												<div
													key={i}
													style={{ height: `${Math.max(18, Math.round(val * 100))}%` }}
													className={`flex-1 rounded-t-sm ${
														isHook ? 'bg-cyan-400' : 'bg-primary/65'
													}`}
												/>
											);
										})}
									</div>

									{/* Director Rationale & Visual Bible Continuity + Collapsible Thought Log */}
									{(plan.storySummary || plan.visualBible || plan.directorThought) && (
										<div className="mt-2 rounded-lg border border-border/70 bg-surface-2 px-3 py-2 text-[11px]">
											<div className="flex items-center justify-between gap-2">
												<span className="font-semibold text-foreground line-clamp-2">
													{plan.storySummary}
												</span>
												{plan.directorThought && (
													<button
														type="button"
														onClick={() => setShowFullThought((v) => !v)}
														className="inline-flex flex-none items-center gap-1 text-[10px] font-bold text-cyan-300 hover:underline whitespace-nowrap"
													>
														<Brain className="h-3 w-3" />
														<span>{showFullThought ? 'Ocultar pensamiento' : 'Ver pensamiento IA'}</span>
													</button>
												)}
											</div>
											{plan.visualBible && (
												<p className="mt-1 text-[10px] text-cyan-300/90 leading-snug">
													<strong className="text-cyan-200">Biblia Visual:</strong> {plan.visualBible}
												</p>
											)}
											{showFullThought && plan.directorThought && (
												<p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap border-t border-border/50 pt-2 font-mono text-[10px] text-muted-foreground">
													{plan.directorThought}
												</p>
											)}
										</div>
									)}

									{batchState?.active && (
										<div className="mt-2 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-1.5 text-[11px]">
											<Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
											<span className="font-semibold text-cyan-200 flex-1">
												{batchState.stepLabel} ({batchState.done}/{batchState.total})
											</span>
										</div>
									)}
								</div>

								{/* Synchronized Scenes Storyboard Cards */}
								<div className="no-scrollbar flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
									{plan.scenes.map((sc) => {
										const isWandBusy = enhancingSceneId === sc.id;
										return (
											<div
												key={sc.id}
												className="flex flex-col sm:flex-row gap-3 rounded-xl border border-border bg-surface p-3"
											>
												{/* Visual Preview: Real Video if ready, else Real AI Image, else clean Script Frame (NO demo images) */}
												<div className="relative aspect-video sm:w-52 flex-none overflow-hidden rounded-lg bg-[#09090d] border border-border flex items-center justify-center">
													{sc.videoUrl ? (
														<video
															src={sc.videoUrl}
															autoPlay
															loop
															muted
															playsInline
															className="h-full w-full object-cover"
														/>
													) : sc.imageUrl ? (
														<img
															src={sc.imageUrl}
															alt={sc.title}
															className="h-full w-full object-cover"
														/>
													) : (
														<div className="flex flex-col items-center justify-center p-3 text-center text-[10px] text-muted-foreground gap-1">
															<ImageIcon className="h-5 w-5 opacity-40" />
															<span className="font-semibold text-foreground/80">Guion IA listo</span>
															<span>Genera la imagen real para esta escena</span>
														</div>
													)}

													{(sc.status === 'generating_image' || sc.status === 'generating_video') && (
														<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-[11px] font-bold text-primary gap-1">
															<Loader2 className="h-5 w-5 animate-spin" />
															<span>
																{sc.status === 'generating_video'
																	? 'Renderizando Video IA...'
																	: 'Creando Imagen IA...'}
															</span>
														</div>
													)}

													<span className="absolute top-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
														#{sc.sceneNumber}
													</span>
													<span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
														{formatTime(sc.startTime)}–{formatTime(sc.endTime)}
													</span>
												</div>

												{/* Scene Script + Vocal Sync + Prompts + Per-Scene Wand */}
												<div className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
													<div className="flex flex-wrap items-center justify-between gap-2">
														<div className="flex items-center gap-2 min-w-0">
															<h4 className="truncate font-bold text-foreground">{sc.title}</h4>
															<span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
																{sc.sectionTag}
															</span>
															{sc.videoUrl ? (
																<span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
																	<CheckCircle2 className="h-3 w-3" /> Video IA listo
																</span>
															) : sc.imageUrl ? (
																<span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
																	<CheckCircle2 className="h-3 w-3" /> Imagen IA lista
																</span>
															) : null}
														</div>

														<div className="flex items-center gap-1">
															<button
																type="button"
																disabled={isWandBusy}
																title="Varita Mágica IA: profundizar guion visual"
																onClick={() => void handleEnhanceSceneWithWand(sc)}
																className="inline-flex h-7 items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 text-[10px] font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
															>
																{isWandBusy ? (
																	<Loader2 className="h-3 w-3 animate-spin" />
																) : (
																	<Wand2 className="h-3 w-3" />
																)}
																<span>{isWandBusy ? 'Pensando...' : 'Varita'}</span>
															</button>
															<button
																type="button"
																disabled={sc.status === 'generating_image' || sc.status === 'generating_video'}
																onClick={() => void generateSingleImage(sc)}
																className="inline-flex h-7 items-center gap-1 rounded border border-border bg-surface-2 px-2 text-[10px] font-bold text-foreground hover:border-primary disabled:opacity-40"
															>
																<ImageIcon className="h-3 w-3" />
																<span>{sc.imageUrl ? 'Regenerar Img' : 'Imagen IA'}</span>
															</button>
															<button
																type="button"
																disabled={sc.status === 'generating_video' || sc.status === 'generating_image'}
																onClick={() => void generateSingleVideo(sc)}
																className="inline-flex h-7 items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black disabled:opacity-40"
															>
																<Film className="h-3 w-3" />
																<span>A Video IA</span>
															</button>
														</div>
													</div>

													{sc.narrativeAction && (
														<p className="text-[11px] text-muted-foreground leading-snug">
															{sc.narrativeAction}
														</p>
													)}

													{/* Synchronized Spoken / Lyric / Slogan Cue */}
													<div className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1">
														<Mic2 className="h-3.5 w-3.5 flex-none text-amber-400" />
														<input
															type="text"
															value={sc.spokenCue}
															onChange={(e) =>
																updateScene(sc.id, (s) => ({ ...s, spokenCue: e.target.value }))
															}
															placeholder="Letra / eslogan sincronizado en este punto..."
															className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-foreground outline-none"
														/>
													</div>

													{/* Visual Prompt */}
													<textarea
														rows={2}
														value={sc.visualPrompt}
														onChange={(e) =>
															updateScene(sc.id, (s) => ({ ...s, visualPrompt: e.target.value }))
														}
														placeholder="Prompt visual de la escena (encuadre, sujeto, luz real)..."
														className="rounded-lg border border-border bg-surface-2 p-2 text-[11px] text-muted-foreground focus:text-foreground outline-none focus:border-primary resize-none"
													/>

													{/* Video Motion Prompt (Image-to-Video direction) */}
													<div className="flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-surface-2 px-2.5 py-1">
														<Film className="h-3.5 w-3.5 flex-none text-cyan-400" />
														<input
															type="text"
															value={sc.videoMotionPrompt}
															onChange={(e) =>
																updateScene(sc.id, (s) => ({
																	...s,
																	videoMotionPrompt: e.target.value,
																}))
															}
															placeholder="Dirección de movimiento suave para Video IA (sin saltos)..."
															className="min-w-0 flex-1 bg-transparent text-[11px] text-cyan-100/85 focus:text-foreground outline-none"
														/>
													</div>

													{sc.errorMessage && (
														<p className="rounded bg-destructive/15 px-2 py-1 text-[11px] text-destructive">
															{sc.errorMessage}
														</p>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
