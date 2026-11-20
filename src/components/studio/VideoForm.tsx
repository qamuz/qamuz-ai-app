import { useEffect, useState } from 'react';
import {
	Check,
	Clapperboard,
	Image as ImageIcon,
	Layers,
	Loader2,
	Mic2,
	Music2,
	Sliders,
	Sparkles,
	Upload,
	UserCheck,
	Volume2,
	Wand2,
	Zap,
} from 'lucide-react';
import { inputClass } from '@/lib/ui';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { audioDuration, uploadMedia } from '@/lib/media';
import { type Creation, type StudioSong, type VideoSource } from '@/lib/studio';
import type { ProviderInfo } from '@/components/studio/StudioForm';
import { CHARACTERS } from '@/lib/characters';
import { CinematicTimelineEditor } from '@/components/studio/CinematicTimelineEditor';
import { magicEnhancePromptDetailed } from '@/lib/nle/maestroDirector';
import {
	AUTEUR_DIRECTORS,
	FILM_GENRES,
	MV_ACTOR_EXPRESSIONS,
	MV_ACTOR_FRAMINGS,
	MV_BACKGROUNDS,
	MV_CAMERA_MOTIONS,
	MV_LIP_SYNC_MODES,
	MV_SFX_PRESETS,
	MV_STYLES,
	MV_VIBES,
	buildMusicVideoPrompt,
	deriveRecommendedMotion,
	type MusicVideoKind,
	type MusicVideoMode,
} from '@/lib/music-video/presets';

interface Props {
	songs: StudioSong[];
	creations?: Creation[];
	initialKey: string | null;
	initialExtra?: string;
	userId: string;
	provider: ProviderInfo | null;
	credits: number | null;
	submitting: boolean;
	onSubmit: (prompt: string, options: Record<string, unknown>) => void;
	onWorkspaceUpdated?: () => void;
}

type TabSection = 'audio' | 'actor' | 'visuals' | 'cinema' | 'direction';
type ProductionCategory = 'artistic' | 'cinema';

const compactSelect =
	'h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary';

export function VideoForm({
	songs,
	creations = [],
	initialKey,
	initialExtra = '',
	userId,
	provider,
	credits,
	submitting,
	onSubmit,
	onWorkspaceUpdated,
}: Props) {
	const { t } = useI18n();
	const [activeSection, setActiveSection] = useState<TabSection>('audio');
	const [productionCategory, setProductionCategory] = useState<ProductionCategory>('artistic');
	const [showTimelineStudio, setShowTimelineStudio] = useState(false);
	const [pick, setPick] = useState<string | null>(initialKey ?? songs[0]?.key ?? 'visual');
	const [upload, setUpload] = useState<VideoSource | null>(null);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	// Optional initial frame image (Frame-to-Video)
	const [startImageUrl, setStartImageUrl] = useState<string | null>(null);
	const [startImageUploading, setStartImageUploading] = useState(false);

	// SFX audio layer (upload or AI preset)
	const [sfxEnabled, setSfxEnabled] = useState(false);
	const [sfxPreset, setSfxPreset] = useState<string>('sfx-none');
	const [sfxUpload, setSfxUpload] = useState<{ name: string; url: string } | null>(null);
	const [sfxUploading, setSfxUploading] = useState(false);
	const [sfxMixLevel, setSfxMixLevel] = useState<number>(35);

	// Lip Sync & Performance
	const [lipSync, setLipSync] = useState(true);
	const [lipSyncMode, setLipSyncMode] = useState<'phoneme' | 'expressive' | 'natural'>('phoneme');
	const [actorFraming, setActorFraming] = useState<'close-up' | 'medium' | 'wide'>('medium');
	const [actorExpression, setActorExpression] = useState<string>(MV_ACTOR_EXPRESSIONS[0]);
	const [actorConsistency, setActorConsistency] = useState(true);

	// Production Kind (Artistic vs Cinema/Film)
	const [videoKind, setVideoKind] = useState<MusicVideoKind>('music-video');
	const [videoMode] = useState<MusicVideoMode>('one-click');
	const [aspect, setAspect] = useState<'16:9' | '9:16' | '21:9'>('16:9');
	const [is30sViralHook, setIs30sViralHook] = useState(false);
	const [selectedStyle, setSelectedStyle] = useState<string>(MV_STYLES[0].id);
	const [selectedChar, setSelectedChar] = useState<string>(CHARACTERS[0]?.name ?? 'Mateo');
	const [selectedBg, setSelectedBg] = useState<string>(MV_BACKGROUNDS[0].name);
	const [selectedVibes, setSelectedVibes] = useState<string[]>(['Energetic & Dance']);
	const [cameraMotion, setCameraMotion] = useState<string>(MV_CAMERA_MOTIONS[0]);
	const [extra, setExtra] = useState(initialExtra);
	const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
	const [enhanceError, setEnhanceError] = useState<string | null>(null);
	const [recommendedMotion, setRecommendedMotion] = useState<number | null>(null);
	const [continuityHint, setContinuityHint] = useState<string | null>(null);

	// Cinema / Film specific options
	const [filmGenre, setFilmGenre] = useState<string>(FILM_GENRES[0]);
	const [auteurDirector, setAuteurDirector] = useState<string>(AUTEUR_DIRECTORS[1].name);
	const [scriptScene, setScriptScene] = useState<string>('');

	const song = songs.find((s) => s.key === pick) ?? null;

	useEffect(() => {
		if (initialKey) {
			setPick(initialKey);
		} else if (pick === 'visual' && songs.length > 0 && !extra && !scriptScene) {
			setPick(songs[0].key);
		}
	}, [initialKey, songs]); // eslint-disable-line react-hooks/exhaustive-deps

	const pastImages = creations
		.filter((c) => c.kind === 'image' && c.status === 'ready' && (c.result_urls?.[0] || c.thumbnail_url))
		.map((c) => ({
			url: c.result_urls?.[0] || c.thumbnail_url || '',
			title: c.title || c.prompt.slice(0, 24),
		}))
		.filter((x) => Boolean(x.url))
		.slice(0, 6);

	const source: VideoSource | null =
		pick === 'upload'
			? upload
			: pick === 'visual'
			? null
			: song
			? {
					song_key: song.key,
					audio_url: song.audioUrl,
					title: song.title,
					cover_url: song.coverUrl,
					duration: song.duration,
			  }
			: null;

	const timelineSong: StudioSong = song
		? song
		: source
		? {
				key: source.song_key ?? `upload-${Date.now()}`,
				trackId: source.song_key ?? 'upload',
				origin: 'upload',
				creationId: 'upload',
				index: 0,
				version: null,
				title: source.title,
				audioUrl: source.audio_url,
				coverUrl: source.cover_url,
				duration: source.duration,
				lyrics: null,
				style: selectedStyle,
				liked: false,
				publishedTrackId: null,
				createdAt: new Date().toISOString(),
		  }
		: {
				key: 'visual-storyboard',
				trackId: 'visual-storyboard',
				origin: 'upload',
				creationId: 'visual-storyboard',
				index: 0,
				version: null,
				title: scriptScene.trim().slice(0, 48) || extra.trim().slice(0, 48) || 'Producción Cinematográfica IA',
				audioUrl: '',
				coverUrl: startImageUrl,
				duration: 45,
				lyrics: null,
				style: selectedStyle,
				liked: false,
				publishedTrackId: null,
				createdAt: new Date().toISOString(),
		  };

	const available = Boolean(provider?.is_active);
	const cost = provider?.credit_cost ?? 0;
	const notEnough = credits !== null && credits < cost;
	const hasIdea = Boolean(source || extra.trim().length >= 3 || scriptScene.trim().length >= 3 || startImageUrl);

	async function handleStartImage(file: File | undefined) {
		if (!file || !file.type.startsWith('image/')) return;
		setStartImageUploading(true);
		const res = await uploadMedia(userId, file, 'covers');
		setStartImageUploading(false);
		if (res.url) {
			setStartImageUrl(res.url);
		}
	}

	async function handleFile(file: File | undefined) {
		if (!file) return;
		setUploadError(null);
		if (!file.type.startsWith('audio/')) {
			setUploadError(t('Choose an audio file (MP3, WAV…)'));
			return;
		}
		setUploading(true);
		const [res, dur] = await Promise.all([
			uploadMedia(userId, file, 'uploads'),
			audioDuration(file),
		]);
		setUploading(false);
		if (res.error || !res.url) {
			setUploadError(t('Could not upload the file'));
			return;
		}
		setUpload({
			song_key: null,
			audio_url: res.url,
			title: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
			cover_url: null,
			duration: dur,
		});
		setPick('upload');
	}

	async function handleSfxFile(file: File | undefined) {
		if (!file) return;
		if (!file.type.startsWith('audio/')) return;
		setSfxUploading(true);
		const res = await uploadMedia(userId, file, 'uploads');
		setSfxUploading(false);
		if (res.url) {
			setSfxUpload({ name: file.name, url: res.url });
			setSfxEnabled(true);
			setSfxPreset('sfx-none');
		}
	}

	function toggleVibe(v: string) {
		setSelectedVibes((prev) =>
			prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
		);
	}

	function handleCategoryChange(cat: ProductionCategory) {
		setProductionCategory(cat);
		if (cat === 'artistic') {
			setVideoKind('music-video');
			if (activeSection === 'cinema') setActiveSection('audio');
		} else {
			setVideoKind('short-film');
			setAspect('21:9');
			setActiveSection('cinema');
		}
	}

	async function handleEnhancePrompt() {
		if (isEnhancingPrompt) return;
		setIsEnhancingPrompt(true);
		setEnhanceError(null);
		setContinuityHint(null);
		try {
			const previousVideos = creations
				.filter((c) => c.kind === 'video' && (c.status === 'ready' || c.status === 'generating'))
				.slice(0, 6)
				.map((c) => `${c.title ? `${c.title}: ` : ''}${c.prompt}`.slice(0, 200))
				.filter(Boolean);

			const enhanced = await magicEnhancePromptDetailed(
				extra.trim() || scriptScene.trim() || `${selectedStyle} scene in ${selectedBg}`,
				{
					mode: 'video-prompt',
					style: selectedStyle,
					character: selectedChar,
					format: productionCategory === 'cinema' ? 'short-film' : 'music-video',
					songTitle: song?.title || upload?.title || '',
					cameraMotion,
					hasStartImage: Boolean(startImageUrl),
					previousVideos,
					sceneContext: [
						`Category: ${productionCategory}`,
						`Background: ${selectedBg}`,
						`Camera motion: ${cameraMotion}`,
						`Framing: ${actorFraming}`,
						productionCategory === 'cinema' ? `Director aesthetic: ${auteurDirector}, genre: ${filmGenre}` : '',
					]
						.filter(Boolean)
						.join('. '),
				}
			);
			setExtra(enhanced.prompt.slice(0, 500));
			if (typeof enhanced.recommendedMotion === 'number') {
				setRecommendedMotion(enhanced.recommendedMotion);
			}
			if (enhanced.continuityNote) {
				setContinuityHint(enhanced.continuityNote);
			} else if (previousVideos.length > 0) {
				setContinuityHint(`Continuidad calibrada con ${previousVideos.length} video(s) previo(s).`);
			}
		} catch (err) {
			setEnhanceError(err instanceof Error ? err.message : 'No se pudo mejorar el prompt con IA.');
		} finally {
			setIsEnhancingPrompt(false);
		}
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!hasIdea) return;

		const lyrics = song && pick !== 'upload' && pick !== 'visual' ? song.lyrics : null;
		const effectiveTitle =
			source?.title ||
			scriptScene.trim().slice(0, 48) ||
			extra.trim().slice(0, 48) ||
			`${selectedStyle} Scene`;

		const compiledPrompt = buildMusicVideoPrompt({
			title: effectiveTitle,
			lyrics,
			extraPrompt: extra,
			videoType: videoKind,
			is30sViralHook: productionCategory === 'artistic' ? is30sViralHook : false,
			character: selectedChar,
			background: selectedBg,
			style: selectedStyle,
			vibeTags: selectedVibes,
			videoGenMode: videoMode,
			cameraMotion,
			lipSync,
			lipSyncMode,
			sfxEnabled,
			sfxPreset: sfxPreset !== 'sfx-none' ? sfxPreset : null,
			sfxAudioName: sfxUpload?.name ?? null,
			sfxMixLevel,
			actorFraming,
			actorExpression,
			actorConsistency,
			filmGenre: productionCategory === 'cinema' ? filmGenre : undefined,
			auteurDirector: productionCategory === 'cinema' ? auteurDirector : undefined,
			cinematicRatio: aspect,
			scriptScene: productionCategory === 'cinema' ? scriptScene : undefined,
		});

		const calibratedMotion = recommendedMotion ?? deriveRecommendedMotion(cameraMotion, actorFraming);

		onSubmit(compiledPrompt, {
			style: selectedStyle,
			aspect: aspect === '21:9' ? '16:9' : aspect,
			cinematicRatio: aspect,
			videoKind,
			videoMode,
			is30sViralHook,
			character: selectedChar,
			background: selectedBg,
			cameraMotion,
			motion: calibratedMotion,
			noise_aug_strength: 0.015,
			fps: 12,
			num_frames: 25,
			lipSync,
			lipSyncMode,
			sfxEnabled,
			sfxPreset,
			sfxMixLevel,
			actorFraming,
			actorExpression,
			actorConsistency,
			filmGenre,
			auteurDirector,
			reference_image_url: startImageUrl,
			source,
		});
	}

	const tabs: { id: TabSection; label: string; icon: typeof Music2 }[] = [
		{ id: 'audio', label: 'Pista', icon: Music2 },
		{ id: 'actor', label: 'Actor', icon: UserCheck },
		{ id: 'visuals', label: 'Estilo', icon: Layers },
		...(productionCategory === 'cinema'
			? [{ id: 'cinema' as const, label: 'Cine', icon: Clapperboard }]
			: []),
		{ id: 'direction', label: 'Director', icon: Wand2 },
	];

	return (
		<form
			data-ev-id="ev_vf_form"
			onSubmit={handleSubmit}
			className="flex flex-col gap-3"
		>
			{/* Compact Production Mode Switcher (matches StudioForm Simple/Custom style) */}
			<div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
				<div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
					<button
						type="button"
						onClick={() => handleCategoryChange('artistic')}
						className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-bold transition-colors ${
							productionCategory === 'artistic'
								? 'bg-primary text-primary-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						<Music2 className="h-3.5 w-3.5 flex-none" />
						<span className="truncate">Arte Musical</span>
					</button>
					<button
						type="button"
						onClick={() => handleCategoryChange('cinema')}
						className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-bold transition-colors ${
							productionCategory === 'cinema'
								? 'bg-cyan-500 text-black shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						<Clapperboard className="h-3.5 w-3.5 flex-none" />
						<span className="truncate">Cine / Corto</span>
					</button>
				</div>

				{/* Compact Format Sub-Type Segmented Row */}
				{productionCategory === 'artistic' ? (
					<div className="grid grid-cols-3 gap-1">
						{(
							[
								{ id: 'music-video', label: 'Music Video' },
								{ id: 'art-visualizer', label: 'Visualizer' },
								{ id: 'lyrics-video', label: 'Letras' },
							] as const
						).map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => setVideoKind(item.id)}
								className={`h-7 truncate rounded-md border px-2 text-[11px] font-semibold transition-colors ${
									videoKind === item.id
										? 'border-primary/60 bg-primary/15 text-primary'
										: 'border-border/60 bg-surface text-muted-foreground hover:text-foreground'
								}`}
							>
								{item.label}
							</button>
						))}
					</div>
				) : (
					<div className="grid grid-cols-2 gap-1">
						{(
							[
								{ id: 'short-film', label: 'Cortometraje' },
								{ id: 'film-trailer', label: 'Tráiler / Teaser' },
							] as const
						).map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => setVideoKind(item.id)}
								className={`h-7 truncate rounded-md border px-2 text-[11px] font-semibold transition-colors ${
									videoKind === item.id
										? 'border-cyan-400/60 bg-cyan-950/50 text-cyan-300'
										: 'border-border/60 bg-surface text-muted-foreground hover:text-foreground'
								}`}
							>
								{item.label}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Compact Section Tabs — always single row, clean underline or pill segments */}
			<div
				role="tablist"
				className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl bg-surface-2 p-1"
			>
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const on = activeSection === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => setActiveSection(tab.id)}
							className={`inline-flex h-8 flex-1 min-w-[64px] items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-colors ${
								on
									? 'bg-surface-3 text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<Icon className={`h-3 w-3 flex-none ${on ? 'text-primary' : ''}`} />
							<span className="truncate">{tab.label}</span>
						</button>
					);
				})}
			</div>

			{/* SECTION 1: AUDIO, SONG PICKER, TIMELINE LAUNCHER & SFX */}
			{activeSection === 'audio' && (
				<div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
					<div data-ev-id="ev_vf_pick" className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-2">
							<span data-ev-id="ev_vf_pick_l" className="text-xs font-bold text-foreground">
								{productionCategory === 'cinema' ? 'Audio / Escena' : 'Fuente del Video'}
							</span>
							<button
								type="button"
								onClick={() => setShowTimelineStudio(true)}
								className="inline-flex h-7 items-center gap-1 rounded-md bg-cyan-500/15 border border-cyan-500/40 px-2.5 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-colors cursor-pointer"
							>
								<Sparkles className="h-3 w-3 flex-none" />
								<span>Timeline IA</span>
							</button>
						</div>

						<div className="grid grid-cols-2 gap-1.5">
							<button
								type="button"
								onClick={() => setPick('visual')}
								className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
									pick === 'visual'
										? 'border-cyan-400 bg-cyan-950/40 text-cyan-300'
										: 'border-border bg-surface text-muted-foreground hover:text-foreground'
								}`}
							>
								<Sparkles className="h-3.5 w-3.5 flex-none" />
								<span className="truncate">Solo visual IA</span>
							</button>

							<label
								data-ev-id="ev_vf_upload"
								className={`flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 text-[11px] font-semibold transition-colors ${
									pick === 'upload'
										? 'border-primary bg-primary/10 text-primary'
										: 'border-border text-muted-foreground hover:text-foreground'
								}`}
							>
								{uploading ? (
									<Loader2 className="h-3.5 w-3.5 flex-none animate-spin" />
								) : pick === 'upload' ? (
									<Check className="h-3.5 w-3.5 flex-none" />
								) : (
									<Upload className="h-3.5 w-3.5 flex-none" />
								)}
								<span data-ev-id="ev_vf_upload_t" className="truncate">
									{uploading ? t('Uploading…') : upload ? upload.title : 'Subir MP3/WAV'}
								</span>
								<input
									data-ev-id="ev_vf_file"
									type="file"
									accept="audio/*"
									className="sr-only"
									onChange={(e) => void handleFile(e.target.files?.[0])}
								/>
							</label>
						</div>
						{uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

						{songs.length > 0 && (
							<ul className="no-scrollbar flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg bg-surface p-1">
								{songs.map((s) => {
									const on = pick === s.key;
									return (
										<li key={s.key}>
											<button
												type="button"
												onClick={() => setPick(s.key)}
												aria-pressed={on}
												className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
													on ? 'bg-primary/15' : 'hover:bg-surface-2'
												}`}
											>
												<img
													src={coverUrl(s.coverUrl)}
													alt=""
													width={32}
													height={32}
													loading="lazy"
													className="h-8 w-8 flex-none rounded object-cover"
												/>
												<span className="flex min-w-0 flex-1 flex-col">
													<span
														className={`truncate text-xs font-semibold ${
															on ? 'text-primary' : 'text-foreground'
														}`}
													>
														{s.title}
													</span>
													<span className="truncate text-[10px] text-muted-foreground">
														{[
															s.version ? t('Version {n}', { n: s.version }) : null,
															s.duration ? formatTime(s.duration) : null,
														]
															.filter(Boolean)
															.join(' · ')}
													</span>
												</span>
												{on && <Check className="h-3.5 w-3.5 flex-none text-primary" />}
											</button>
										</li>
									);
								})}
							</ul>
						)}

						{/* Optional Start Image (Image-to-Video) */}
						<div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
									<ImageIcon className="h-3.5 w-3.5 text-primary" />
									Imagen inicial (opcional)
								</span>
								{startImageUrl && (
									<button
										type="button"
										onClick={() => setStartImageUrl(null)}
										className="text-[10px] font-semibold text-destructive hover:underline"
									>
										Quitar
									</button>
								)}
							</div>

							{startImageUrl ? (
								<div className="flex items-center gap-2 rounded-lg bg-surface p-1.5">
									<img src={startImageUrl} alt="" className="h-9 w-12 rounded object-cover" />
									<span className="text-[11px] font-semibold text-primary truncate flex-1">
										Frame inicial activo para animar
									</span>
								</div>
							) : (
								<div className="flex items-center gap-1.5">
									<label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface px-2 text-[11px] text-muted-foreground hover:border-primary hover:text-foreground">
										{startImageUploading ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<Upload className="h-3.5 w-3.5" />
										)}
										<span>{startImageUploading ? 'Subiendo...' : 'Subir foto o usar generada'}</span>
										<input
											type="file"
											accept="image/*"
											className="sr-only"
											onChange={(e) => void handleStartImage(e.target.files?.[0])}
										/>
									</label>
								</div>
							)}

							{pastImages.length > 0 && !startImageUrl && (
								<div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
									{pastImages.map((img, idx) => (
										<button
											key={idx}
											type="button"
											onClick={() => setStartImageUrl(img.url)}
											title={img.title}
											className="flex-none overflow-hidden rounded-md border border-border hover:border-primary"
										>
											<img src={img.url} alt="" className="h-8 w-8 object-cover" />
										</button>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Format + Viral Hook compact row */}
					<div className="flex flex-col gap-2 pt-1 border-t border-border/50">
						<span className="text-[11px] font-bold text-muted-foreground">Formato de video</span>
						<div className="grid grid-cols-3 gap-1.5">
							{(
								[
									{ id: '16:9', label: '16:9 HD' },
									{ id: '9:16', label: '9:16 Reels' },
									{ id: '21:9', label: '21:9 Cine' },
								] as const
							).map((f) => (
								<button
									key={f.id}
									type="button"
									onClick={() => setAspect(f.id)}
									className={`h-8 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
										aspect === f.id
											? 'border-primary bg-primary/10 text-primary'
											: 'border-border bg-surface text-muted-foreground hover:text-foreground'
									}`}
								>
									{f.label}
								</button>
							))}
						</div>

						{productionCategory === 'artistic' && (
							<button
								type="button"
								onClick={() => setIs30sViralHook((v) => !v)}
								className={`flex h-8 items-center justify-between rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
									is30sViralHook
										? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
										: 'border-border bg-surface text-muted-foreground hover:text-foreground'
								}`}
							>
								<span className="flex items-center gap-1.5 truncate">
									<Zap className="h-3.5 w-3.5 text-amber-400 flex-none" />
									<span className="truncate">Gancho 30s TikTok / Reels</span>
								</span>
								<span className="text-[10px] font-mono">{is30sViralHook ? 'ON' : 'OFF'}</span>
							</button>
						)}
					</div>

					{/* Compact SFX / Foley Layer */}
					<div className="flex flex-col gap-2 pt-2 border-t border-border/50">
						<div className="flex items-center justify-between">
							<span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
								<Volume2 className="h-3.5 w-3.5 text-cyan-400" />
								Efectos de Sonido (SFX)
							</span>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={sfxEnabled}
									onChange={(e) => setSfxEnabled(e.target.checked)}
									className="sr-only peer"
								/>
								<span className="relative h-5 w-9 rounded-full bg-surface-3 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-cyan-500 peer-checked:after:translate-x-4" />
							</label>
						</div>

						{sfxEnabled && (
							<div className="flex flex-col gap-2">
								<select
									value={sfxUpload ? 'custom' : sfxPreset}
									onChange={(e) => {
										if (e.target.value !== 'custom') {
											setSfxUpload(null);
											setSfxPreset(e.target.value);
										}
									}}
									className={compactSelect}
								>
									{MV_SFX_PRESETS.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
									{sfxUpload && <option value="custom">Archivo: {sfxUpload.name}</option>}
								</select>

								<div className="flex items-center gap-2">
									<label className="flex h-8 flex-1 items-center justify-between rounded-lg border border-dashed border-border px-2.5 text-[11px] cursor-pointer hover:border-cyan-400">
										<span className="truncate text-muted-foreground">
											{sfxUploading
												? 'Subiendo SFX...'
												: sfxUpload
												? sfxUpload.name
												: 'Subir SFX (MP3/WAV)'}
										</span>
										<Upload className="h-3.5 w-3.5 text-muted-foreground ml-1.5 flex-none" />
										<input
											type="file"
											accept="audio/*"
											className="sr-only"
											onChange={(e) => void handleSfxFile(e.target.files?.[0])}
										/>
									</label>
									{sfxUpload && (
										<button
											type="button"
											onClick={() => setSfxUpload(null)}
											className="h-8 px-2 text-[11px] font-semibold text-destructive hover:underline"
										>
											Quitar
										</button>
									)}
								</div>

								<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
									<Sliders className="h-3 w-3 flex-none" />
									<span>Mezcla</span>
									<input
										type="range"
										min={10}
										max={80}
										value={sfxMixLevel}
										onChange={(e) => setSfxMixLevel(Number(e.target.value))}
										className="flex-1 accent-cyan-400 h-1 bg-surface-3 rounded"
									/>
									<span className="font-mono text-cyan-400 w-7 text-right">{sfxMixLevel}%</span>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* SECTION 2: ACTORS, LIP SYNC & PERFORMANCE */}
			{activeSection === 'actor' && (
				<div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
					{/* Lip Sync Control */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
								<Mic2 className="h-3.5 w-3.5 text-primary" />
								{productionCategory === 'cinema' ? 'Lip Sync de Diálogo' : 'Sincronización Labial'}
							</span>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={lipSync}
									onChange={(e) => setLipSync(e.target.checked)}
									className="sr-only peer"
								/>
								<span className="relative h-5 w-9 rounded-full bg-surface-3 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4" />
							</label>
						</div>

						{lipSync && (
							<select
								value={lipSyncMode}
								onChange={(e) =>
									setLipSyncMode(e.target.value as 'phoneme' | 'expressive' | 'natural')
								}
								className={compactSelect}
							>
								{MV_LIP_SYNC_MODES.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name} — {m.desc}
									</option>
								))}
							</select>
						)}
					</div>

					{/* Lead Performer / Actor Runway Selector (clean 2-column grid) */}
					<div className="flex flex-col gap-2 pt-2 border-t border-border/50">
						<div className="flex items-center justify-between gap-2">
							<span className="text-xs font-bold text-foreground">Actor / Protagonista</span>
							<label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
								<input
									type="checkbox"
									checked={actorConsistency}
									onChange={(e) => setActorConsistency(e.target.checked)}
									className="rounded border-border accent-primary"
								/>
								<span>Rostro fijo</span>
							</label>
						</div>

						<div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto no-scrollbar rounded-lg bg-surface p-1">
							<button
								type="button"
								onClick={() => setSelectedChar('Sin personaje (Atmósfera & Entorno)')}
								className={`flex h-10 items-center gap-2 rounded-md border px-2 text-left transition-colors ${
									selectedChar === 'Sin personaje (Atmósfera & Entorno)'
										? 'border-primary bg-primary/10 text-primary'
										: 'border-transparent bg-surface-2 text-muted-foreground hover:text-foreground'
								}`}
							>
								<span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-3 text-[9px] font-bold">
									OFF
								</span>
								<span className="truncate text-[11px] font-semibold">Solo entorno</span>
							</button>

							{CHARACTERS.map((char) => {
								const on = selectedChar === char.name;
								return (
									<button
										key={char.id}
										type="button"
										onClick={() => setSelectedChar(char.name)}
										className={`flex h-10 items-center gap-2 rounded-md border px-2 text-left transition-colors ${
											on
												? 'border-primary bg-primary/15 text-foreground'
												: 'border-transparent bg-surface-2 text-muted-foreground hover:text-foreground'
										}`}
									>
										<img
											src={char.image}
											alt=""
											className="h-6 w-6 flex-none rounded-full object-cover"
										/>
										<span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
											{char.name}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Actor Framing & Expression */}
					<div className="flex flex-col gap-2 pt-2 border-t border-border/50">
						<span className="text-[11px] font-bold text-muted-foreground">Encuadre y expresión</span>
						<div className="grid grid-cols-3 gap-1">
							{MV_ACTOR_FRAMINGS.map((f) => {
								const on = actorFraming === f.id;
								const shortLabel =
									f.id === 'close-up' ? 'Primer plano' : f.id === 'medium' ? 'Plano medio' : 'General';
								return (
									<button
										key={f.id}
										type="button"
										onClick={() => setActorFraming(f.id as 'close-up' | 'medium' | 'wide')}
										className={`h-7 truncate rounded-md border px-1.5 text-[11px] font-semibold transition-colors ${
											on
												? 'border-cyan-400 bg-cyan-950/40 text-cyan-300'
												: 'border-border bg-surface text-muted-foreground hover:text-foreground'
										}`}
									>
										{shortLabel}
									</button>
								);
							})}
						</div>

						<select
							id="actor-expression-sel"
							value={actorExpression}
							onChange={(e) => setActorExpression(e.target.value)}
							className={compactSelect}
						>
							{MV_ACTOR_EXPRESSIONS.map((exp) => (
								<option key={exp} value={exp}>
									{exp}
								</option>
							))}
						</select>
					</div>
				</div>
			)}

			{/* SECTION 3: VISUALS, BACKGROUNDS & STYLES */}
			{activeSection === 'visuals' && (
				<div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
					{/* Visual Styles Grid (2 columns max) */}
					<div className="flex flex-col gap-1.5">
						<span className="text-xs font-bold text-foreground">Estilo visual</span>
						<div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto no-scrollbar">
							{MV_STYLES.map((st) => {
								const on = selectedStyle === st.id;
								return (
									<button
										key={st.id}
										type="button"
										onClick={() => setSelectedStyle(st.id)}
										className={`relative flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors ${
											on
												? 'border-cyan-400 bg-cyan-950/30 text-foreground'
												: 'border-border/70 bg-surface text-muted-foreground hover:text-foreground'
										}`}
									>
										<img
											src={st.img}
											alt=""
											className="h-8 w-8 flex-none rounded object-cover"
										/>
										<span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
											{st.name}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Stage Background Environment (2 columns max) */}
					<div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
						<span className="text-xs font-bold text-foreground">Escenario</span>
						<div className="grid grid-cols-2 gap-1.5">
							{MV_BACKGROUNDS.map((bg) => {
								const on = selectedBg === bg.name;
								return (
									<button
										key={bg.id}
										type="button"
										onClick={() => setSelectedBg(bg.name)}
										className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors ${
											on
												? 'border-primary bg-primary/10 text-foreground'
												: 'border-border/70 bg-surface text-muted-foreground hover:text-foreground'
										}`}
									>
										<img src={bg.img} alt="" className="h-7 w-7 flex-none rounded object-cover" />
										<span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
											{bg.name}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Camera Motion & Vibes */}
					<div className="flex flex-col gap-2 pt-2 border-t border-border/50">
						<label htmlFor="cam-motion-sel-2" className="text-xs font-bold text-foreground">
							Movimiento de cámara
						</label>
						<select
							id="cam-motion-sel-2"
							value={cameraMotion}
							onChange={(e) => setCameraMotion(e.target.value)}
							className={compactSelect}
						>
							{MV_CAMERA_MOTIONS.map((cm) => (
								<option key={cm} value={cm}>
									{cm}
								</option>
							))}
						</select>

						<span className="text-[11px] font-bold text-muted-foreground">Vibra</span>
						<div className="flex flex-wrap gap-1">
							{MV_VIBES.map((v) => {
								const on = selectedVibes.includes(v);
								return (
									<button
										key={v}
										type="button"
										onClick={() => toggleVibe(v)}
										className={`h-6 rounded-md border px-2 text-[10px] font-semibold transition-colors ${
											on
												? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
												: 'border-border bg-surface text-muted-foreground hover:text-foreground'
										}`}
									>
										{v}
									</button>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* SECTION 4: CINEMA & AUTEUR DIRECTION */}
			{activeSection === 'cinema' && productionCategory === 'cinema' && (
				<div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
					<div className="flex flex-col gap-1.5">
						<label htmlFor="film-genre-sel" className="text-xs font-bold text-foreground">
							Género cinematográfico
						</label>
						<select
							id="film-genre-sel"
							value={filmGenre}
							onChange={(e) => setFilmGenre(e.target.value)}
							className={compactSelect}
						>
							{FILM_GENRES.map((g) => (
								<option key={g} value={g}>
									{g}
								</option>
							))}
						</select>
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor="auteur-dir-sel" className="text-xs font-bold text-foreground">
							Visión de dirección
						</label>
						<select
							id="auteur-dir-sel"
							value={auteurDirector}
							onChange={(e) => setAuteurDirector(e.target.value)}
							className={compactSelect}
						>
							{AUTEUR_DIRECTORS.map((d) => (
								<option key={d.id} value={d.name}>
									{d.name} — {d.desc}
								</option>
							))}
						</select>
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor="script-scene-text" className="text-xs font-bold text-foreground">
							Guion de la escena (opcional)
						</label>
						<textarea
							id="script-scene-text"
							value={scriptScene}
							onChange={(e) => setScriptScene(e.target.value)}
							rows={3}
							maxLength={400}
							placeholder="Escena nocturna: El protagonista descubre una transmisión oculta..."
							className={`${inputClass} text-xs leading-relaxed resize-none`}
						/>
					</div>
				</div>
			)}

			{/* SECTION 5: AI DIRECTION & PROMPT ENHANCER */}
			{activeSection === 'direction' && (
				<div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3.5">
					<div className="flex items-center justify-between gap-2">
						<span className="text-xs font-bold text-foreground">Instrucciones de dirección</span>
						<button
							type="button"
							onClick={() => void handleEnhancePrompt()}
							disabled={isEnhancingPrompt}
							className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
						>
							{isEnhancingPrompt ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<Sparkles className="h-3 w-3" />
							)}
							<span>{isEnhancingPrompt ? 'Pensando...' : 'Pulir con IA'}</span>
						</button>
					</div>
					{enhanceError && (
						<p className="text-[11px] text-destructive">{enhanceError}</p>
					)}
					{continuityHint && !enhanceError && (
						<p className="text-[11px] text-cyan-300">{continuityHint}</p>
					)}

					<textarea
						value={extra}
						onChange={(e) => setExtra(e.target.value)}
						rows={4}
						maxLength={500}
						placeholder={
							productionCategory === 'cinema'
								? 'Plano secuencia de apertura, luz anamórfica azul, música in crescendo...'
								: 'Luces de neón azul y magenta, lluvia en cámara lenta, mirada intensa en el coro...'
						}
						className={`${inputClass} resize-none leading-relaxed text-xs`}
					/>

					<p className="text-[11px] text-muted-foreground truncate">
						{productionCategory === 'cinema' ? 'Cine' : 'Musical'} · {selectedChar} ·{' '}
						{lipSync ? `Lip Sync (${lipSyncMode})` : 'Sin Lip Sync'} · {aspect}
					</p>
				</div>
			)}

			{!available && (
				<p
					data-ev-id="ev_vf_noprov"
					className="rounded-xl border border-border px-3.5 py-2.5 text-xs text-pretty text-muted-foreground"
				>
					{t(
						'There is no active provider for creating {what} yet. The administrator can enable it in the dashboard.',
						{ what: t('videos') }
					)}
				</p>
			)}

			{/* Sticky Submit & Credit Footer */}
			<div
				data-ev-id="ev_vf_foot"
				className="sticky bottom-0 z-10 flex flex-col gap-1.5 bg-background pb-1 pt-2"
			>
				{!hasIdea && (
					<p className="text-[11px] text-amber-300 px-1">
						Elige una canción, sube un frame inicial o describe la escena en Cine/Director para generar el video.
					</p>
				)}
				<button
					data-ev-id="ev_vf_submit"
					type="submit"
					disabled={!available || submitting || notEnough || !hasIdea || uploading || startImageUploading}
					className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
				>
					{submitting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Sparkles className="h-4 w-4" />
					)}
					{productionCategory === 'cinema'
						? videoKind === 'short-film'
							? 'Generar Cortometraje'
							: 'Generar Tráiler'
						: videoKind === 'lyrics-video'
						? 'Generar Lyrics Video'
						: 'Generar Video Real con IA'}
				</button>
				<div data-ev-id="ev_vf_cost" className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
					<span>
						{provider
							? `${provider.name} · ${t('{count} credits', { count: cost })}`
							: t('No provider')}
					</span>
					{notEnough && (
						<span data-ev-id="ev_vf_notenough" className="text-destructive font-semibold">
							{t("You don't have enough credits")}
						</span>
					)}
				</div>
			</div>

			{showTimelineStudio && (
				<CinematicTimelineEditor
					song={timelineSong}
					userId={userId}
					style={selectedStyle}
					category={productionCategory}
					director={auteurDirector}
					characterName={selectedChar}
					onClose={() => setShowTimelineStudio(false)}
					onPublished={() => {
						onWorkspaceUpdated?.();
						setShowTimelineStudio(false);
					}}
				/>
			)}
		</form>
	);
}
