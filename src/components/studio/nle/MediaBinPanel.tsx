import { useMemo, useState } from 'react';
import {
	Clapperboard,
	Film,
	FolderOpen,
	Image as ImageIcon,
	Loader2,
	Mic2,
	Music2,
	Palette,
	Plus,
	Search,
	Sparkles,
	Type,
	Upload,
	Wand2,
} from 'lucide-react';
import { CHARACTERS } from '@/lib/characters';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { audioDuration, uploadMedia } from '@/lib/media';
import {
	AUTEUR_DIRECTORS,
	FILM_GENRES,
	MV_BACKGROUNDS,
	MV_CAMERA_MOTIONS,
	MV_LIP_SYNC_MODES,
	MV_STYLES,
	buildMusicVideoPrompt,
} from '@/lib/music-video/presets';
import { COLOR_GRADE_PRESETS } from '@/lib/storyboard';
import type { Creation, ProviderInfo, StudioSong } from '@/lib/studio';
import { magicEnhancePrompt } from '@/lib/nle/maestroDirector';
import {
	NLE_TRANSITIONS,
	type NleAspectRatio,
	type NleMediaAsset,
	type NleProjectFx,
	type NleTransition,
} from '@/lib/nle/types';

export type BinTab = 'media' | 'ai' | 'fx' | 'titles';

interface Props {
	userId: string;
	songs: StudioSong[];
	creations: Creation[];
	localAssets: NleMediaAsset[];
	videoProvider: ProviderInfo | null;
	credits: number | null;
	aspect: NleAspectRatio;
	fx: NleProjectFx;
	selectedClipId: string | null;
	onAddLocalAsset: (asset: NleMediaAsset) => void;
	onInsertAsset: (asset: NleMediaAsset) => void;
	onPreviewInSource: (asset: NleMediaAsset) => void;
	onOpenMaestro: (songKey?: string) => void;
	onMagicDetectTitles: () => Promise<void>;
	onInsertTextPreset: (preset: {
		title: string;
		text: string;
		position: 'top' | 'center' | 'bottom';
		fontSize: number;
		fontWeight: 'medium' | 'bold' | 'black';
		bgOpacity: number;
	}) => void;
	onGenerateAiVideo: (prompt: string, options: Record<string, unknown>) => Promise<void>;
	onUpdateFx: (next: Partial<NleProjectFx>) => void;
	onApplyTransitionToSelected: (transition: NleTransition) => void;
}

const TITLE_PRESETS = [
	{
		id: 'title-hero',
		title: 'Título Cinematográfico',
		desc: 'Centro pantalla · Tipografía gruesa',
		text: 'TÍTULO DEL PROYECTO',
		position: 'center' as const,
		fontSize: 44,
		fontWeight: 'black' as const,
		bgOpacity: 0,
	},
	{
		id: 'title-lower',
		title: 'Crédito / Artista',
		desc: 'Tercio inferior · Con placa oscura',
		text: 'Dirigido por Qamuz AI Studio',
		position: 'bottom' as const,
		fontSize: 28,
		fontWeight: 'bold' as const,
		bgOpacity: 0.72,
	},
	{
		id: 'title-lyric',
		title: 'Subtítulo / Letra',
		desc: 'Parte inferior · Estilo lyric video',
		text: 'Escribe aquí tu verso o diálogo...',
		position: 'bottom' as const,
		fontSize: 32,
		fontWeight: 'bold' as const,
		bgOpacity: 0.65,
	},
	{
		id: 'title-hook',
		title: 'Gancho Superior',
		desc: 'Cabecera · Ideal Reels / Shorts',
		text: 'ESTRENO OFICIAL',
		position: 'top' as const,
		fontSize: 34,
		fontWeight: 'black' as const,
		bgOpacity: 0.78,
	},
];

function videoFileDuration(url: string): Promise<number> {
	return new Promise((resolve) => {
		const v = document.createElement('video');
		v.preload = 'metadata';
		v.onloadedmetadata = () => {
			resolve(Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration) : 8);
		};
		v.onerror = () => resolve(8);
		v.src = url;
	});
}

export function MediaBinPanel({
	userId,
	songs,
	creations,
	localAssets,
	videoProvider,
	credits,
	aspect,
	fx,
	selectedClipId,
	onAddLocalAsset,
	onInsertAsset,
	onPreviewInSource,
	onOpenMaestro,
	onMagicDetectTitles,
	onInsertTextPreset,
	onGenerateAiVideo,
	onUpdateFx,
	onApplyTransitionToSelected,
}: Props) {
	const [tab, setTab] = useState<BinTab>('media');
	const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');
	const [search, setSearch] = useState('');
	const [uploadingMedia, setUploadingMedia] = useState(false);
	const [detectingTitles, setDetectingTitles] = useState(false);
	const [titlesError, setTitlesError] = useState<string | null>(null);

	// Compact AI Generator state
	const [aiCategory, setAiCategory] = useState<'artistic' | 'cinema'>('artistic');
	const [aiSongKey, setAiSongKey] = useState<string>(songs[0]?.key ?? 'visual');
	const [aiChar, setAiChar] = useState<string>(CHARACTERS[0]?.name ?? 'Mateo');
	const [aiStyle, setAiStyle] = useState<string>(MV_STYLES[0].id);
	const [aiBg, setAiBg] = useState<string>(MV_BACKGROUNDS[0].name);
	const [aiMotion, setAiMotion] = useState<string>(MV_CAMERA_MOTIONS[0]);
	const [aiLipSync, setAiLipSync] = useState(true);
	const [aiLipMode, setAiLipMode] = useState<'phoneme' | 'expressive' | 'natural'>('phoneme');
	const [aiGenre, setAiGenre] = useState<string>(FILM_GENRES[0]);
	const [aiDirector, setAiDirector] = useState<string>(AUTEUR_DIRECTORS[1].name);
	const [aiStartImg, setAiStartImg] = useState<string | null>(null);
	const [aiPromptExtra, setAiPromptExtra] = useState('');
	const [wandLoading, setWandLoading] = useState(false);
	const [submittingAi, setSubmittingAi] = useState(false);
	const [aiMsg, setAiMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

	const allAssets = useMemo<NleMediaAsset[]>(() => {
		const list: NleMediaAsset[] = [...localAssets];

		for (const c of creations) {
			if (c.kind === 'video' && (c.status === 'ready' || c.status === 'generating')) {
				list.push({
					id: `cre-v-${c.id}`,
					kind: 'video',
					title: c.title || c.prompt.slice(0, 42) || 'Clip Video IA',
					url: c.result_urls?.[0] || '',
					thumbnailUrl: c.thumbnail_url,
					duration: c.duration_seconds ?? 6,
					subtitle: c.status === 'generating' ? 'Generando IA...' : c.provider_slug || 'Video IA',
					creationId: c.id,
					status: c.status,
				});
			}
			if (c.kind === 'image' && c.status === 'ready' && (c.result_urls?.[0] || c.thumbnail_url)) {
				list.push({
					id: `cre-i-${c.id}`,
					kind: 'image',
					title: c.title || c.prompt.slice(0, 40) || 'Imagen IA',
					url: c.result_urls?.[0] || c.thumbnail_url || '',
					thumbnailUrl: c.result_urls?.[0] || c.thumbnail_url,
					duration: 6,
					subtitle: 'Imagen IA',
					creationId: c.id,
					status: 'ready',
				});
			}
		}

		for (const s of songs) {
			list.push({
				id: `song-${s.key}`,
				kind: 'song',
				title: s.title,
				url: s.audioUrl,
				thumbnailUrl: coverUrl(s.coverUrl),
				duration: s.duration || 45,
				subtitle: s.style || 'Canción Qamuz',
				songRef: s,
				status: 'ready',
			});
		}

		return list;
	}, [localAssets, creations, songs]);

	const filteredAssets = useMemo(() => {
		const q = search.trim().toLowerCase();
		return allAssets.filter((a) => {
			if (mediaFilter === 'video' && a.kind !== 'video') return false;
			if (mediaFilter === 'audio' && a.kind !== 'audio' && a.kind !== 'song') return false;
			if (mediaFilter === 'image' && a.kind !== 'image') return false;
			if (q && !`${a.title} ${a.subtitle ?? ''}`.toLowerCase().includes(q)) return false;
			return true;
		});
	}, [allAssets, mediaFilter, search]);

	const readyImages = useMemo(
		() => allAssets.filter((a) => a.kind === 'image' && a.url),
		[allAssets]
	);

	async function handleImportFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		setUploadingMedia(true);
		try {
			for (const file of Array.from(files)) {
				const isVid = file.type.startsWith('video/');
				const isAud = file.type.startsWith('audio/');
				const isImg = file.type.startsWith('image/');
				if (!isVid && !isAud && !isImg) continue;

				const localUrl = URL.createObjectURL(file);
				const dur = isAud
					? await audioDuration(file)
					: isVid
					? await videoFileDuration(localUrl)
					: 6;

				const folder = isVid ? 'videos' : isAud ? 'uploads' : 'covers';
				const uploaded = await uploadMedia(userId, file, folder);
				const finalUrl = uploaded.url || localUrl;

				const newAsset: NleMediaAsset = {
					id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
					kind: isVid ? 'video' : isAud ? 'audio' : 'image',
					title: file.name.replace(/\.[^.]+$/, '').slice(0, 48),
					url: finalUrl,
					thumbnailUrl: isImg ? finalUrl : null,
					duration: Math.max(2, dur || 6),
					subtitle: isVid ? 'Video local' : isAud ? 'Audio local' : 'Imagen local',
					status: 'ready',
				};
				onAddLocalAsset(newAsset);
				onInsertAsset(newAsset);
			}
		} finally {
			setUploadingMedia(false);
		}
	}

	async function handleAiSubmit(e: React.FormEvent) {
		e.preventDefault();
		const selectedSong = songs.find((s) => s.key === aiSongKey) ?? null;
		const title = selectedSong?.title || aiPromptExtra.trim().slice(0, 44) || `${aiStyle} Scene`;
		const compiled = buildMusicVideoPrompt({
			title,
			lyrics: selectedSong?.lyrics,
			extraPrompt: aiPromptExtra,
			videoType: aiCategory === 'cinema' ? 'short-film' : 'music-video',
			is30sViralHook: false,
			character: aiChar,
			background: aiBg,
			style: aiStyle,
			vibeTags: [],
			videoGenMode: 'one-click',
			cameraMotion: aiMotion,
			lipSync: aiLipSync,
			lipSyncMode: aiLipMode,
			filmGenre: aiCategory === 'cinema' ? aiGenre : undefined,
			auteurDirector: aiCategory === 'cinema' ? aiDirector : undefined,
			cinematicRatio: aspect,
		});

		setSubmittingAi(true);
		setAiMsg(null);
		try {
			await onGenerateAiVideo(compiled, {
				style: aiStyle,
				aspect: aspect === '21:9' ? '16:9' : aspect,
				cinematicRatio: aspect,
				videoKind: aiCategory === 'cinema' ? 'short-film' : 'music-video',
				character: aiChar,
				background: aiBg,
				cameraMotion: aiMotion,
				lipSync: aiLipSync,
				lipSyncMode: aiLipMode,
				filmGenre: aiGenre,
				auteurDirector: aiDirector,
				reference_image_url: aiStartImg,
				source: selectedSong
					? {
							song_key: selectedSong.key,
							audio_url: selectedSong.audioUrl,
							title: selectedSong.title,
							cover_url: selectedSong.coverUrl,
							duration: selectedSong.duration,
					  }
					: null,
			});
			setAiMsg({ type: 'ok', text: 'Clip IA en proceso. Aparecerá en Medios.' });
		} catch (err) {
			setAiMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error al generar clip' });
		} finally {
			setSubmittingAi(false);
		}
	}

	const selectedSongObj = songs.find((s) => s.key === aiSongKey) ?? songs[0] ?? null;
	const providerActive = Boolean(videoProvider?.is_active);
	const cost = videoProvider?.credit_cost ?? 0;
	const enoughCredits = credits === null || credits >= cost;

	return (
		<div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface overflow-hidden">
			{/* Bin Tab Rail */}
			<div className="grid grid-cols-4 border-b border-border bg-[#0e0e12] p-1 gap-1 flex-none">
				{(
					[
						{ id: 'media', label: 'Medios', icon: FolderOpen },
						{ id: 'ai', label: 'IA Clip', icon: Sparkles },
						{ id: 'fx', label: 'FX / LUT', icon: Palette },
						{ id: 'titles', label: 'Títulos', icon: Type },
					] as const
				).map((t) => {
					const Icon = t.icon;
					const on = tab === t.id;
					return (
						<button
							key={t.id}
							type="button"
							onClick={() => setTab(t.id)}
							className={`flex h-8 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
								on
									? 'bg-surface-3 text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<Icon className={`h-3.5 w-3.5 flex-none ${on ? 'text-primary' : ''}`} />
							<span className="truncate">{t.label}</span>
						</button>
					);
				})}
			</div>

			{/* TAB 1: MEDIA BIN */}
			{tab === 'media' && (
				<div className="flex min-h-0 flex-1 flex-col p-2.5 gap-2">
					<div className="flex items-center gap-1.5">
						<label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 focus-within:border-primary">
							<Search className="h-3.5 w-3.5 flex-none text-muted-foreground" />
							<input
								type="search"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Buscar video, audio, imagen..."
								className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
							/>
						</label>

						<label
							title="Importar MP4, JPG, PNG o MP3 desde tu equipo"
							className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground hover:brightness-110 flex-none whitespace-nowrap"
						>
							{uploadingMedia ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Upload className="h-3.5 w-3.5" />
							)}
							<span>Importar</span>
							<input
								type="file"
								accept="video/*,image/*,audio/*"
								multiple
								className="sr-only"
								onChange={(e) => void handleImportFiles(e.target.files)}
							/>
						</label>
					</div>

					{/* Filter tabs */}
					<div className="grid grid-cols-4 gap-1 rounded-lg bg-surface-2 p-0.5 flex-none">
						{(
							[
								{ id: 'all', label: 'Todo' },
								{ id: 'video', label: 'Video' },
								{ id: 'audio', label: 'Audio' },
								{ id: 'image', label: 'Img' },
							] as const
						).map((f) => (
							<button
								key={f.id}
								type="button"
								onClick={() => setMediaFilter(f.id)}
								className={`h-6 rounded-md text-[10px] font-bold transition-colors ${
									mediaFilter === f.id
										? 'bg-surface-3 text-foreground'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								{f.label}
							</button>
						))}
					</div>

					{/* Bin Grid / List */}
					<div className="no-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
						{filteredAssets.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
								<Film className="h-6 w-6 mb-1.5 opacity-60" />
								<p>Importa clips MP4/MP3/PNG o crea escenas con IA en la pestaña "IA Clip".</p>
							</div>
						) : (
							filteredAssets.map((asset) => {
								const isGenerating = asset.status === 'generating';
								const isSong = asset.kind === 'song';
								return (
									<div
										key={asset.id}
										onClick={() => {
											if (!isGenerating && asset.url) onPreviewInSource(asset);
										}}
										onDoubleClick={() => {
											if (!isGenerating && asset.url) onInsertAsset(asset);
										}}
										title="Clic para abrir en Monitor de Origen (recortar) · Doble clic para insertar directo"
										className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-surface-2 p-1.5 hover:border-primary/50 transition-colors"
									>
										{/* Thumbnail */}
										<div className="relative h-11 w-16 flex-none overflow-hidden rounded bg-black flex items-center justify-center">
											{asset.kind === 'video' && asset.url ? (
												<video
													src={asset.url}
													muted
													playsInline
													className="h-full w-full object-cover"
												/>
											) : asset.thumbnailUrl ? (
												<img
													src={asset.thumbnailUrl}
													alt=""
													className="h-full w-full object-cover"
												/>
											) : isSong || asset.kind === 'audio' ? (
												<Music2 className="h-4 w-4 text-emerald-400" />
											) : (
												<ImageIcon className="h-4 w-4 text-cyan-400" />
											)}
											<span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[9px] font-mono tabular-nums text-white">
												{formatTime(asset.duration)}
											</span>
										</div>

										{/* Meta */}
										<div className="min-w-0 flex-1">
											<p className="truncate text-xs font-semibold text-foreground">
												{asset.title}
											</p>
											<p className="truncate text-[10px] text-muted-foreground">
												{asset.subtitle}
											</p>
										</div>

										{/* Actions */}
										<div
											className="flex items-center gap-1 flex-none"
											onClick={(e) => e.stopPropagation()}
										>
											{isSong && asset.songRef && (
												<button
													type="button"
													title="Abrir en Maestro Director IA"
													onClick={() => onOpenMaestro(asset.songRef?.key)}
													className="flex h-7 items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-1.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-colors"
												>
													<Wand2 className="h-3 w-3" />
													<span>Maestro</span>
												</button>
											)}
											<button
												type="button"
												disabled={isGenerating || !asset.url}
												title="Añadir al Timeline en el cabezal"
												onClick={() => onInsertAsset(asset)}
												className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-3 text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-40 transition-colors"
											>
												{isGenerating ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
												) : (
													<Plus className="h-3.5 w-3.5" />
												)}
											</button>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}

			{/* TAB 2: REAL AI VIDEO CLIP GENERATOR */}
			{tab === 'ai' && (
				<form
					onSubmit={(e) => void handleAiSubmit(e)}
					className="no-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 p-2.5 text-xs"
				>
					<div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
						<button
							type="button"
							onClick={() => setAiCategory('artistic')}
							className={`h-7 rounded-md text-[11px] font-bold transition-colors ${
								aiCategory === 'artistic'
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Arte Musical
						</button>
						<button
							type="button"
							onClick={() => setAiCategory('cinema')}
							className={`h-7 rounded-md text-[11px] font-bold transition-colors ${
								aiCategory === 'cinema'
									? 'bg-cyan-500 text-black'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							Cine / Corto
						</button>
					</div>

					{/* Song link or Visual */}
					<div className="flex flex-col gap-1">
						<label className="text-[11px] font-bold text-muted-foreground">Pista base / Contexto</label>
						<select
							value={aiSongKey}
							onChange={(e) => setAiSongKey(e.target.value)}
							className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs text-foreground outline-none focus:border-primary"
						>
							<option value="visual">Solo visual IA (Sin pista vinculada)</option>
							{songs.map((s) => (
								<option key={s.key} value={s.key}>
									{s.title} ({formatTime(s.duration)})
								</option>
							))}
						</select>
						{selectedSongObj && aiSongKey !== 'visual' && (
							<button
								type="button"
								onClick={() => onOpenMaestro(selectedSongObj.key)}
								className="mt-0.5 flex h-7 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-colors"
							>
								<Clapperboard className="h-3.5 w-3.5" />
								<span>Abrir en Maestro Director IA</span>
							</button>
						)}
					</div>

					{/* Style & Background */}
					<div className="grid grid-cols-2 gap-1.5">
						<div className="flex flex-col gap-1">
							<label className="text-[11px] font-bold text-muted-foreground">Estilo visual</label>
							<select
								value={aiStyle}
								onChange={(e) => setAiStyle(e.target.value)}
								className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
							>
								{MV_STYLES.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name}
									</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-[11px] font-bold text-muted-foreground">Escenario</label>
							<select
								value={aiBg}
								onChange={(e) => setAiBg(e.target.value)}
								className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
							>
								{MV_BACKGROUNDS.map((b) => (
									<option key={b.id} value={b.name}>
										{b.name}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Actor & Camera */}
					<div className="grid grid-cols-2 gap-1.5">
						<div className="flex flex-col gap-1">
							<label className="text-[11px] font-bold text-muted-foreground">Protagonista</label>
							<select
								value={aiChar}
								onChange={(e) => setAiChar(e.target.value)}
								className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
							>
								<option value="Sin personaje (Atmósfera & Entorno)">Solo entorno</option>
								{CHARACTERS.map((c) => (
									<option key={c.id} value={c.name}>
										{c.name}
									</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-[11px] font-bold text-muted-foreground">Cámara</label>
							<select
								value={aiMotion}
								onChange={(e) => setAiMotion(e.target.value)}
								className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
							>
								{MV_CAMERA_MOTIONS.map((m) => (
									<option key={m} value={m}>
										{m}
									</option>
								))}
							</select>
						</div>
					</div>

					{aiCategory === 'cinema' && (
						<div className="grid grid-cols-2 gap-1.5">
							<div className="flex flex-col gap-1">
								<label className="text-[11px] font-bold text-muted-foreground">Género</label>
								<select
									value={aiGenre}
									onChange={(e) => setAiGenre(e.target.value)}
									className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
								>
									{FILM_GENRES.map((g) => (
										<option key={g} value={g}>
											{g}
										</option>
									))}
								</select>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-[11px] font-bold text-muted-foreground">Director</label>
								<select
									value={aiDirector}
									onChange={(e) => setAiDirector(e.target.value)}
									className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs text-foreground outline-none"
								>
									{AUTEUR_DIRECTORS.map((d) => (
										<option key={d.id} value={d.name}>
											{d.name}
										</option>
									))}
								</select>
							</div>
						</div>
					)}

					{/* Lip Sync toggle */}
					<div className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-2 px-2.5 py-1.5">
						<span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
							<Mic2 className="h-3.5 w-3.5 text-primary" />
							Lip Sync
						</span>
						<div className="flex items-center gap-2">
							{aiLipSync && (
								<select
									value={aiLipMode}
									onChange={(e) =>
										setAiLipMode(e.target.value as 'phoneme' | 'expressive' | 'natural')
									}
									className="h-6 rounded border border-border bg-surface px-1.5 text-[10px]"
								>
									{MV_LIP_SYNC_MODES.map((m) => (
										<option key={m.id} value={m.id}>
											{m.id}
										</option>
									))}
								</select>
							)}
							<input
								type="checkbox"
								checked={aiLipSync}
								onChange={(e) => setAiLipSync(e.target.checked)}
								className="accent-primary"
							/>
						</div>
					</div>

					{/* Optional start frame picker */}
					{readyImages.length > 0 && (
						<div className="flex flex-col gap-1">
							<div className="flex items-center justify-between">
								<span className="text-[11px] font-bold text-muted-foreground">
									Frame inicial (Image-to-Video)
								</span>
								{aiStartImg && (
									<button
										type="button"
										onClick={() => setAiStartImg(null)}
										className="text-[10px] font-semibold text-destructive hover:underline"
									>
										Quitar
									</button>
								)}
							</div>
							<div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
								{readyImages.slice(0, 8).map((img) => {
									const on = aiStartImg === img.url;
									return (
										<button
											key={img.id}
											type="button"
											onClick={() => setAiStartImg(on ? null : img.url)}
											className={`h-9 w-12 flex-none overflow-hidden rounded border ${
												on ? 'border-primary ring-1 ring-primary' : 'border-border'
											}`}
										>
											<img src={img.url} alt="" className="h-full w-full object-cover" />
										</button>
									);
								})}
							</div>
						</div>
					)}

					<div className="flex flex-col gap-1">
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-bold text-muted-foreground">Descripción IA</span>
							<button
								type="button"
								disabled={wandLoading}
								onClick={async () => {
									setWandLoading(true);
									setAiMsg(null);
									try {
										const enhanced = await magicEnhancePrompt(
											aiPromptExtra || `${aiStyle} en ${aiBg}`,
											{
												style: aiStyle,
												character: aiChar,
												format: aiCategory === 'cinema' ? 'short-film' : 'music-video',
												songTitle: selectedSongObj?.title,
											}
										);
										setAiPromptExtra(enhanced.slice(0, 400));
									} catch (err) {
										setAiMsg({
											type: 'err',
											text: err instanceof Error ? err.message : 'No se pudo mejorar el prompt con IA.',
										});
									} finally {
										setWandLoading(false);
									}
								}}
								className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
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
							maxLength={400}
							value={aiPromptExtra}
							onChange={(e) => setAiPromptExtra(e.target.value)}
							placeholder="Acción de la escena: cámara siguiendo al protagonista bajo neón y lluvia..."
							className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-foreground outline-none focus:border-primary resize-none"
						/>
					</div>

					{aiMsg && (
						<p
							className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
								aiMsg.type === 'ok'
									? 'bg-primary/10 text-primary'
									: 'bg-destructive/15 text-destructive'
							}`}
						>
							{aiMsg.text}
						</p>
					)}

					<button
						type="submit"
						disabled={!providerActive || submittingAi || !enoughCredits}
						className="mt-auto inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:brightness-110 disabled:opacity-40"
					>
						{submittingAi ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Sparkles className="h-3.5 w-3.5" />
						)}
						<span>Generar Clip IA ({cost} cr)</span>
					</button>
				</form>
			)}

			{/* TAB 3: EFFECTS, LUTS & TRANSITIONS */}
			{tab === 'fx' && (
				<div className="no-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-2.5 text-xs">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
							Color Grading (LUTs)
						</p>
						<div className="grid grid-cols-2 gap-1.5">
							{COLOR_GRADE_PRESETS.map((lut) => {
								const on = fx.lutId === lut.id;
								return (
									<button
										key={lut.id}
										type="button"
										onClick={() => onUpdateFx({ lutId: lut.id })}
										className={`rounded-lg border p-2 text-left transition-colors ${
											on
												? 'border-primary bg-primary/10 text-foreground'
												: 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
										}`}
									>
										<span className="block truncate text-[11px] font-bold">{lut.name}</span>
										<span className="block truncate text-[10px] opacity-70">{lut.desc}</span>
									</button>
								);
							})}
						</div>
					</div>

					<div className="border-t border-border/60 pt-2.5">
						<p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
							Capas de Óptica y Cine
						</p>
						<div className="grid grid-cols-2 gap-1.5">
							<button
								type="button"
								onClick={() => onUpdateFx({ letterbox: !fx.letterbox })}
								className={`h-8 rounded-lg border px-2 text-[11px] font-bold transition-colors ${
									fx.letterbox
										? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								Letterbox 2.39:1
							</button>
							<button
								type="button"
								onClick={() => onUpdateFx({ grain: !fx.grain })}
								className={`h-8 rounded-lg border px-2 text-[11px] font-bold transition-colors ${
									fx.grain
										? 'border-purple-400 bg-purple-500/15 text-purple-300'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								Grano 35mm
							</button>
							<button
								type="button"
								onClick={() => onUpdateFx({ lightLeak: !fx.lightLeak })}
								className={`h-8 rounded-lg border px-2 text-[11px] font-bold transition-colors ${
									fx.lightLeak
										? 'border-amber-400 bg-amber-500/15 text-amber-300'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								Light Leaks
							</button>
							<button
								type="button"
								onClick={() => onUpdateFx({ vignette: !fx.vignette })}
								className={`h-8 rounded-lg border px-2 text-[11px] font-bold transition-colors ${
									fx.vignette
										? 'border-primary bg-primary/15 text-primary'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								Viñeta Óptica
							</button>
						</div>
					</div>

					<div className="border-t border-border/60 pt-2.5">
						<p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
							Transición al Clip Seleccionado
						</p>
						{!selectedClipId ? (
							<p className="text-[11px] text-muted-foreground">
								Selecciona un clip de video o imagen en la línea de tiempo para aplicarle transición.
							</p>
						) : (
							<div className="grid grid-cols-2 gap-1.5">
								{NLE_TRANSITIONS.map((tr) => (
									<button
										key={tr.id}
										type="button"
										onClick={() => onApplyTransitionToSelected(tr.id)}
										className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-[11px] font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
									>
										{tr.label}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			{/* TAB 4: TITLES & TEXT OVERLAYS */}
			{tab === 'titles' && (
				<div className="no-scrollbar flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-2.5">
					<button
						type="button"
						disabled={detectingTitles}
						onClick={async () => {
							setDetectingTitles(true);
							setTitlesError(null);
							try {
								await onMagicDetectTitles();
							} catch (err) {
								setTitlesError(
									err instanceof Error
										? err.message
										: 'No se pudo sincronizar la letra o diálogo con el audio.'
								);
							} finally {
								setDetectingTitles(false);
							}
						}}
						className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40 transition-colors"
					>
						{detectingTitles ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Wand2 className="h-3.5 w-3.5" />
						)}
						<span>
							{detectingTitles
								? 'Escuchando audio y sincronizando...'
								: 'Varita IA: Sincronizar Letras y Eslogans'}
						</span>
					</button>

					{titlesError && (
						<p className="rounded-lg border border-destructive/30 bg-destructive/15 px-2.5 py-1.5 text-[11px] text-destructive">
							{titlesError}
						</p>
					)}

					<p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
						Plantillas de Títulos (Pista T1)
					</p>
					{TITLE_PRESETS.map((tp) => (
						<button
							key={tp.id}
							type="button"
							onClick={() =>
								onInsertTextPreset({
									title: tp.title,
									text: tp.text,
									position: tp.position,
									fontSize: tp.fontSize,
									fontWeight: tp.fontWeight,
									bgOpacity: tp.bgOpacity,
								})
							}
							className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 p-2.5 text-left hover:border-primary transition-colors"
						>
							<div className="min-w-0">
								<p className="text-xs font-bold text-foreground">{tp.title}</p>
								<p className="text-[10px] text-muted-foreground">{tp.desc}</p>
							</div>
							<span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-surface-3 text-primary">
								<Plus className="h-3.5 w-3.5" />
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
