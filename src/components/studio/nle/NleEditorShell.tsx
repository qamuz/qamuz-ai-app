import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	CheckCircle2,
	Coins,
	Columns2,
	Copy,
	Download,
	ExternalLink,
	Film,
	Image as ImageIcon,
	Loader2,
	Music2,
	Upload,
	Video,
	Wand2,
	X,
	Youtube,
} from 'lucide-react';
import { Link } from 'react-router';
import { useI18n } from '@/hooks/useI18n';
import { useModules } from '@/hooks/useModules';
import { uploadMedia } from '@/lib/media';
import {
	createCreation,
	fetchCreation,
	refreshCreation,
	saveRenderedVideo,
	type Creation,
	type CreationKind,
	type ProviderInfo,
	type StudioSong,
} from '@/lib/studio';
import { primaryButton } from '@/lib/ui';
import {
	computeTimelineDuration,
	createInitialTracksFromSong,
	deleteClipFromTracks,
	makeClipId,
	splitClipAtTime,
} from '@/lib/nle/project';
import { renderNleProject } from '@/lib/nle/renderer';
import {
	DEFAULT_COLOR_ADJUST,
	type NleAspectRatio,
	type NleClip,
	type NleMediaAsset,
	type NleProjectFx,
	type NleToolMode,
	type NleTrack,
	type NleTransition,
} from '@/lib/nle/types';
import {
	generateYoutubeSeo,
	transcribeAndSyncLyrics,
	type MaestroPlan,
} from '@/lib/nle/maestroDirector';
import { ClipInspector } from '@/components/studio/nle/ClipInspector';
import { MaestroDirectorModal } from '@/components/studio/nle/MaestroDirectorModal';
import { MediaBinPanel } from '@/components/studio/nle/MediaBinPanel';
import { NleTimeline } from '@/components/studio/nle/NleTimeline';
import { ProgramMonitor } from '@/components/studio/nle/ProgramMonitor';
import { SourceMonitor } from '@/components/studio/nle/SourceMonitor';

interface Props {
	kind: CreationKind;
	onChangeKind: (next: CreationKind) => void;
	userId: string;
	songs: StudioSong[];
	creations: Creation[];
	videoProvider: ProviderInfo | null;
	credits: number | null;
	initialSongKey: string | null;
	onWorkspaceUpdated: () => void;
}

const STUDIO_KINDS = [
	{ id: 'music' as const, label: 'Music', icon: Music2 },
	{ id: 'video' as const, label: 'Video', icon: Video },
	{ id: 'image' as const, label: 'Image', icon: ImageIcon },
];

export function NleEditorShell({
	kind,
	onChangeKind,
	userId,
	songs,
	creations,
	videoProvider,
	credits,
	initialSongKey,
	onWorkspaceUpdated,
}: Props) {
	const { t } = useI18n();
	const { isEnabled } = useModules();

	const initialSong = useMemo(() => {
		if (initialSongKey) {
			const match = songs.find((s) => s.key === initialSongKey);
			if (match) return match;
		}
		return songs[0] ?? null;
	}, [songs, initialSongKey]);

	const [projectTitle, setProjectTitle] = useState(
		initialSong?.title || 'Producción Video Studio'
	);
	const [aspect, setAspect] = useState<NleAspectRatio>('16:9');
	const [tracks, setTracks] = useState<NleTrack[]>(() =>
		createInitialTracksFromSong(initialSong)
	);
	const [fx, setFx] = useState<NleProjectFx>({
		lutId: 'teal-orange',
		letterbox: false,
		grain: true,
		lightLeak: false,
		vignette: true,
	});
	const [localAssets, setLocalAssets] = useState<NleMediaAsset[]>([]);

	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [toolMode, setToolMode] = useState<NleToolMode>('select');
	const [playhead, setPlayhead] = useState(0);
	const [seekVersion, setSeekVersion] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [masterMuted, setMasterMuted] = useState(false);
	const audioClockGetterRef = useRef<(() => number | null) | null>(null);

	const seekPlayhead = useCallback(
		(time: number, maxDur: number) => {
			setPlayhead(Math.max(0, Math.min(maxDur, time)));
			setSeekVersion((v) => v + 1);
		},
		[]
	);

	// Dual Monitor (Source Monitor + Program Monitor) + Maestro Director IA
	const [dualMonitors, setDualMonitors] = useState(true);
	const [sourceAsset, setSourceAsset] = useState<NleMediaAsset | null>(() =>
		initialSong
			? {
					id: `song-${initialSong.key}`,
					kind: 'song',
					title: initialSong.title,
					url: initialSong.audioUrl,
					thumbnailUrl: initialSong.coverUrl,
					duration: initialSong.duration || 45,
					subtitle: initialSong.style || 'Canción Qamuz',
					songRef: initialSong,
					status: 'ready',
			  }
			: null
	);
	const [maestroOpen, setMaestroOpen] = useState(false);
	const [maestroSongKey, setMaestroSongKey] = useState<string | null>(initialSong?.key ?? null);

	const openMaestroForSong = useCallback((songKey?: string) => {
		if (songKey) setMaestroSongKey(songKey);
		setMaestroOpen(true);
	}, []);

	// Modals
	const [exportOpen, setExportOpen] = useState(false);
	const [exportRes, setExportRes] = useState<'720p' | '1080p'>('1080p');
	const [isRendering, setIsRendering] = useState(false);
	const [renderProgress, setRenderProgress] = useState(0);
	const [renderError, setRenderError] = useState<string | null>(null);
	const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
	const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
	const [renderedExt, setRenderedExt] = useState<'mp4' | 'webm'>('webm');
	const [savingWorkspace, setSavingWorkspace] = useState(false);
	const [savedWorkspace, setSavedWorkspace] = useState(false);

	const [ytOpen, setYtOpen] = useState(false);
	const [ytTitle, setYtTitle] = useState(`${projectTitle} — Official Video`);
	const [ytDescription, setYtDescription] = useState('');
	const [ytTags, setYtTags] = useState('');
	const [ytPrivacy, setYtPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
	const [ytOptimizing, setYtOptimizing] = useState(false);
	const [ytSeoError, setYtSeoError] = useState<string | null>(null);
	const [ytCopied, setYtCopied] = useState(false);

	const totalDuration = useMemo(() => computeTimelineDuration(tracks), [tracks]);

	// Re-seed if user came with an explicit handoff song key after initial mount
	const seededKeyRef = useRef<string | null>(initialSong?.key ?? null);
	useEffect(() => {
		if (initialSongKey && initialSongKey !== seededKeyRef.current) {
			const match = songs.find((s) => s.key === initialSongKey);
			if (match) {
				seededKeyRef.current = match.key;
				setProjectTitle(match.title);
				setTracks(createInitialTracksFromSong(match));
				setPlayhead(0);
				setIsPlaying(false);
			}
		}
	}, [initialSongKey, songs]);

	// Main Playhead RAF loop locked to active hardware <audio> clock when available
	const playheadRef = useRef(playhead);
	playheadRef.current = playhead;
	useEffect(() => {
		if (!isPlaying) return;
		let last = performance.now();
		let rafId = 0;

		const tick = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;

			const hwTime = audioClockGetterRef.current?.() ?? null;
			const next =
				hwTime !== null && Number.isFinite(hwTime)
					? hwTime
					: playheadRef.current + dt;

			if (next >= totalDuration) {
				setPlayhead(0);
				setSeekVersion((v) => v + 1);
				setIsPlaying(false);
				return;
			}
			setPlayhead(next);
			rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, [isPlaying, totalDuration]);

	const selectedClip = useMemo(() => {
		if (!selectedClipId) return null;
		for (const tr of tracks) {
			const hit = tr.clips.find((c) => c.id === selectedClipId);
			if (hit) return hit;
		}
		return null;
	}, [tracks, selectedClipId]);

	const updateClip = useCallback((clipId: string, updater: (clip: NleClip) => NleClip) => {
		setTracks((prev) =>
			prev.map((tr) => ({
				...tr,
				clips: tr.clips.map((c) => (c.id === clipId ? updater(c) : c)),
			}))
		);
	}, []);

	const handleSplitAtPlayhead = useCallback(() => {
		if (selectedClipId) {
			setTracks((prev) => splitClipAtTime(prev, selectedClipId, playheadRef.current));
			return;
		}
		// If nothing selected, split active V1 clip at playhead
		const v1 = tracks.find((t) => t.id === 'track-v1') ?? tracks.find((t) => t.kind === 'video');
		const active = v1?.clips.find(
			(c) => playheadRef.current > c.startTime + 0.5 && playheadRef.current < c.startTime + c.duration - 0.5
		);
		if (active) {
			setTracks((prev) => splitClipAtTime(prev, active.id, playheadRef.current));
		}
	}, [selectedClipId, tracks]);

	const handleDeleteSelected = useCallback(() => {
		if (!selectedClipId) return;
		setTracks((prev) => deleteClipFromTracks(prev, selectedClipId));
		setSelectedClipId(null);
	}, [selectedClipId]);

	const handleDuplicateSelected = useCallback(() => {
		if (!selectedClipId) return;
		setTracks((prev) =>
			prev.map((tr) => {
				if (tr.locked) return tr;
				const target = tr.clips.find((c) => c.id === selectedClipId);
				if (!target) return tr;
				const clone: NleClip = {
					...target,
					id: makeClipId(target.type),
					title: `${target.title} (copia)`,
					startTime: Number((target.startTime + target.duration).toFixed(2)),
				};
				return { ...tr, clips: [...tr.clips, clone] };
			})
		);
	}, [selectedClipId]);

	// Premiere Keyboard Shortcuts (Space, V, C, Delete)
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement | null)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

			if (e.code === 'Space') {
				e.preventDefault();
				setIsPlaying((p) => !p);
			} else if (e.key.toLowerCase() === 'v') {
				setToolMode('select');
			} else if (e.key.toLowerCase() === 'c') {
				setToolMode('razor');
			} else if (e.key === 'Delete' || e.key === 'Backspace') {
				handleDeleteSelected();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [handleDeleteSelected]);

	function handleInsertAsset(asset: NleMediaAsset) {
		const isAudio = asset.kind === 'audio' || asset.kind === 'song';
		setTracks((prev) => {
			const targetTrack = isAudio
				? prev.find((t) => t.id === 'track-a1' && t.clips.length === 0) ??
				  prev.find((t) => t.id === 'track-a2') ??
				  prev.find((t) => t.kind === 'audio')
				: prev.find((t) => t.id === 'track-v1') ?? prev.find((t) => t.kind === 'video');
			if (!targetTrack) return prev;

			// Place right after last clip if overlapping at 0, or right at playhead
			const startAt = Number(playhead.toFixed(2));
			const newClip: NleClip = {
				id: makeClipId(isAudio ? 'aud' : asset.kind),
				trackId: targetTrack.id,
				type: isAudio ? 'audio' : asset.kind === 'video' ? 'video' : 'image',
				title: asset.title,
				sourceUrl: asset.url,
				thumbnailUrl: asset.thumbnailUrl,
				startTime: startAt,
				duration: Math.max(2, asset.duration || 6),
				trimStart: 0,
				opacity: 1,
				speed: 1,
				volume: 1,
				lutId: 'inherit',
				colorAdjust: { ...DEFAULT_COLOR_ADJUST },
				cameraMotion: asset.kind === 'image' ? 'zoom-in' : 'none',
				transitionIn: isAudio ? 'none' : 'cross-dissolve',
			};
			setSelectedClipId(newClip.id);
			return prev.map((tr) =>
				tr.id === targetTrack.id ? { ...tr, clips: [...tr.clips, newClip] } : tr
			);
		});
	}

	function handleInsertTextPreset(preset: {
		title: string;
		text: string;
		position: 'top' | 'center' | 'bottom';
		fontSize: number;
		fontWeight: 'medium' | 'bold' | 'black';
		bgOpacity: number;
	}) {
		setTracks((prev) => {
			const textTrack = prev.find((t) => t.kind === 'text');
			if (!textTrack) return prev;
			const newClip: NleClip = {
				id: makeClipId('txt'),
				trackId: textTrack.id,
				type: 'text',
				title: preset.title,
				sourceUrl: '',
				startTime: Number(playhead.toFixed(2)),
				duration: 5,
				trimStart: 0,
				opacity: 1,
				speed: 1,
				volume: 1,
				lutId: 'inherit',
				colorAdjust: { ...DEFAULT_COLOR_ADJUST },
				cameraMotion: 'none',
				transitionIn: 'cross-dissolve',
				textData: {
					text: preset.text,
					fontSize: preset.fontSize,
					color: '#ffffff',
					bgOpacity: preset.bgOpacity,
					position: preset.position,
					fontWeight: preset.fontWeight,
				},
			};
			setSelectedClipId(newClip.id);
			return prev.map((tr) =>
				tr.id === textTrack.id ? { ...tr, clips: [...tr.clips, newClip] } : tr
			);
		});
	}

	function handleAddTrack(kindToAdd: 'video' | 'audio') {
		setTracks((prev) => {
			const count = prev.filter((t) => t.kind === kindToAdd).length + 1;
			const id = `track-${kindToAdd[0]}${count}-${Date.now().toString(36)}`;
			const newTrack: NleTrack = {
				id,
				channelLabel: `${kindToAdd === 'video' ? 'V' : 'A'}${count}`,
				name: kindToAdd === 'video' ? `Video V${count}` : `Audio A${count}`,
				kind: kindToAdd,
				muted: false,
				hidden: false,
				locked: false,
				volume: 1,
				clips: [],
			};
			if (kindToAdd === 'video') {
				const firstVideoIdx = prev.findIndex((t) => t.kind === 'video');
				const next = [...prev];
				next.splice(Math.max(0, firstVideoIdx), 0, newTrack);
				return next;
			}
			return [...prev, newTrack];
		});
	}

	async function handleGenerateAiVideo(prompt: string, options: Record<string, unknown>) {
		const res = await createCreation('video', prompt, options);
		if (res.error) throw new Error(res.error);
		onWorkspaceUpdated();
	}

	async function handleRegenerateClipImage(clip: NleClip, prompt: string) {
		const finalPrompt = `${prompt}, 8k resolution, cinematic lighting, photorealistic`.slice(0, 950);
		const res = await createCreation('image', finalPrompt, {
			size: aspect === '9:16' ? '1024x1536' : '1536x1024',
		});
		if (res.error || !res.data?.id) {
			throw new Error(res.error || 'No se pudo regenerar la imagen.');
		}
		for (let i = 0; i < 18; i++) {
			await new Promise((r) => setTimeout(r, 2500));
			await refreshCreation(res.data.id);
			const created = await fetchCreation(res.data.id);
			if (created?.status === 'ready' && (created.result_urls?.[0] || created.thumbnail_url)) {
				const newUrl = created.result_urls?.[0] || created.thumbnail_url || clip.sourceUrl;
				updateClip(clip.id, (c) => ({
					...c,
					type: 'image',
					sourceUrl: newUrl,
					thumbnailUrl: newUrl,
					aiPrompt: prompt,
				}));
				onWorkspaceUpdated();
				return;
			}
			if (created?.status === 'error') {
				throw new Error(created.error_message || 'Error generando imagen IA.');
			}
		}
		throw new Error('Tiempo de espera agotado al generar escena IA.');
	}

	async function handleAnimateClipToVideo(clip: NleClip, prompt: string) {
		const finalPrompt = `${prompt}, smooth cinematic motion, high quality`.slice(0, 950);
		const res = await createCreation('video', finalPrompt, {
			aspect: aspect === '21:9' ? '16:9' : aspect,
			reference_image_url: clip.type === 'image' ? clip.sourceUrl : clip.thumbnailUrl,
		});
		if (res.error || !res.data?.id) {
			throw new Error(res.error || 'No se pudo iniciar la animación de video IA.');
		}
		onWorkspaceUpdated();
		for (let i = 0; i < 40; i++) {
			await new Promise((r) => setTimeout(r, 3000));
			await refreshCreation(res.data.id);
			const created = await fetchCreation(res.data.id);
			if (created?.status === 'ready' && created.result_urls?.[0]) {
				const videoUrl = created.result_urls[0];
				updateClip(clip.id, (c) => ({
					...c,
					type: 'video',
					sourceUrl: videoUrl,
					thumbnailUrl: created.thumbnail_url ?? c.thumbnailUrl,
				}));
				onWorkspaceUpdated();
				return;
			}
			if (created?.status === 'error') {
				throw new Error(created.error_message || 'Error animando clip de video.');
			}
		}
		throw new Error('El renderizado de video en GPU tardó demasiado. Revisa Medios en unos instantes.');
	}

	async function handleStartRender() {
		setIsRendering(true);
		setRenderProgress(0);
		setRenderError(null);
		setSavedWorkspace(false);
		if (renderedUrl?.startsWith('blob:')) URL.revokeObjectURL(renderedUrl);
		setRenderedUrl(null);
		setRenderedBlob(null);

		try {
			const res = await renderNleProject({
				tracks,
				fx,
				aspect,
				resolution: exportRes,
				durationSeconds: totalDuration,
				onProgress: setRenderProgress,
			});
			setRenderedBlob(res.blob);
			setRenderedUrl(res.url);
			setRenderedExt(res.ext);
			setRenderProgress(100);
		} catch (err) {
			setRenderError(
				err instanceof Error ? err.message : 'No se pudo renderizar el video en este navegador.'
			);
		} finally {
			setIsRendering(false);
		}
	}

	async function handleSaveToWorkspace() {
		if (!renderedBlob) return;
		setSavingWorkspace(true);
		setRenderError(null);
		try {
			const safeName = (projectTitle || 'qamuz-nle').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 48);
			const file = new File([renderedBlob], `${safeName}.${renderedExt}`, {
				type: renderedBlob.type || `video/${renderedExt}`,
			});
			const uploaded = await uploadMedia(userId, file, 'videos');
			if (uploaded.error || !uploaded.url) {
				setRenderError(uploaded.error || 'No se pudo subir el video renderizado.');
				return;
			}
			const firstVisual = tracks
				.find((t) => t.kind === 'video')
				?.clips.find((c) => Boolean(c.thumbnailUrl || (c.type === 'image' && c.sourceUrl)));

			const saved = await saveRenderedVideo({
				title: projectTitle || 'Video Studio Pro',
				video_url: uploaded.url,
				thumbnail_url: firstVisual?.thumbnailUrl ?? firstVisual?.sourceUrl ?? null,
				duration: Math.round(totalDuration),
				prompt: `${projectTitle} · ${aspect} · Edición Multipista`,
				options: { aspect, lutId: fx.lutId },
			});
			if (saved.error) {
				setRenderError(saved.error);
				return;
			}
			setSavedWorkspace(true);
			window.dispatchEvent(new Event('qamuz:creations-updated'));
			onWorkspaceUpdated();
		} finally {
			setSavingWorkspace(false);
		}
	}

	function insertTrimmedAsset(
		asset: NleMediaAsset,
		trimStart: number,
		duration: number,
		appendToEnd: boolean
	) {
		const isAudio = asset.kind === 'audio' || asset.kind === 'song';
		setTracks((prev) => {
			const targetTrack = isAudio
				? prev.find((t) => t.id === 'track-a1' && t.clips.length === 0) ??
				  prev.find((t) => t.id === 'track-a2') ??
				  prev.find((t) => t.kind === 'audio')
				: prev.find((t) => t.id === 'track-v1') ?? prev.find((t) => t.kind === 'video');
			if (!targetTrack) return prev;

			const maxTrackEnd = targetTrack.clips.reduce(
				(mx, c) => Math.max(mx, c.startTime + c.duration),
				0
			);
			const startAt = Number((appendToEnd ? maxTrackEnd : playheadRef.current).toFixed(2));
			const newClip: NleClip = {
				id: makeClipId(isAudio ? 'aud' : asset.kind),
				trackId: targetTrack.id,
				type: isAudio ? 'audio' : asset.kind === 'video' ? 'video' : 'image',
				title: asset.title,
				sourceUrl: asset.url,
				thumbnailUrl: asset.thumbnailUrl,
				startTime: startAt,
				duration: Math.max(0.5, Number(duration.toFixed(2))),
				trimStart: Math.max(0, Number(trimStart.toFixed(2))),
				opacity: 1,
				speed: 1,
				volume: 1,
				lutId: 'inherit',
				colorAdjust: { ...DEFAULT_COLOR_ADJUST },
				cameraMotion: asset.kind === 'image' ? 'zoom-in' : 'none',
				transitionIn: isAudio ? 'none' : 'cross-dissolve',
			};
			setSelectedClipId(newClip.id);
			return prev.map((tr) =>
				tr.id === targetTrack.id ? { ...tr, clips: [...tr.clips, newClip] } : tr
			);
		});
	}

	function handleAssembleMaestroPlan(plan: MaestroPlan) {
		setProjectTitle(plan.title);

		const visualClips: NleClip[] = plan.scenes
			.filter((sc) => Boolean(sc.videoUrl || sc.imageUrl))
			.map((sc) => ({
				id: makeClipId(sc.videoUrl ? 'vid' : 'img'),
				trackId: 'track-v1',
				type: sc.videoUrl ? 'video' : 'image',
				title: sc.title,
				sourceUrl: sc.videoUrl || sc.imageUrl,
				thumbnailUrl: sc.imageUrl,
				startTime: sc.startTime,
				duration: sc.duration,
				trimStart: 0,
				opacity: 1,
				speed: 1,
				volume: 0,
				lutId: 'inherit',
				colorAdjust: { ...DEFAULT_COLOR_ADJUST },
				cameraMotion: sc.cameraMotion,
				transitionIn: sc.sceneNumber === 1 ? 'none' : 'cross-dissolve',
				aiPrompt: sc.visualPrompt,
			}));

		const vocalEntry = plan.analysis.vocalEntryTime ?? 0;
		const textClips: NleClip[] = plan.scenes
			.filter((sc) => Boolean(sc.spokenCue?.trim()))
			.map((sc) => {
				const rawStart = sc.startTime + 0.15;
				const cueStart =
					plan.format === 'music-video' && sc.endTime > vocalEntry + 0.4
						? Math.max(rawStart, vocalEntry)
						: rawStart;
				const cueDur = Math.max(1.2, Number((sc.endTime - cueStart - 0.15).toFixed(2)));
				return {
					id: makeClipId('txt'),
					trackId: 'track-t1',
					type: 'text',
					title: sc.spokenCue.slice(0, 28),
					sourceUrl: '',
					startTime: Number(cueStart.toFixed(2)),
					duration: cueDur,
					trimStart: 0,
					opacity: 1,
					speed: 1,
					volume: 1,
					lutId: 'inherit',
					colorAdjust: { ...DEFAULT_COLOR_ADJUST },
					cameraMotion: 'none',
					transitionIn: 'cross-dissolve',
					textData: {
						text: sc.spokenCue,
						fontSize: 32,
						color: '#ffffff',
						bgOpacity: 0.68,
						position: 'bottom',
						fontWeight: 'bold',
					},
				};
			});

		const audioClips: NleClip[] = plan.audioUrl
			? [
					{
						id: makeClipId('a1'),
						trackId: 'track-a1',
						type: 'audio',
						title: plan.title,
						sourceUrl: plan.audioUrl,
						startTime: 0,
						duration: plan.analysis.duration,
						trimStart: 0,
						opacity: 1,
						speed: 1,
						volume: 1,
						lutId: 'inherit',
						colorAdjust: { ...DEFAULT_COLOR_ADJUST },
						cameraMotion: 'none',
						transitionIn: 'none',
					},
			  ]
			: [];

		setTracks((prev) =>
			prev.map((tr) => {
				if (tr.id === 'track-v1') return { ...tr, clips: visualClips };
				if (tr.id === 'track-t1') return { ...tr, clips: textClips };
				if (tr.id === 'track-a1') return { ...tr, clips: audioClips };
				return tr;
			})
		);
		setPlayhead(0);
		setSeekVersion((v) => v + 1);
		setIsPlaying(false);
		setSelectedClipId(visualClips[0]?.id ?? null);
	}

	async function handleMagicDetectTitles() {
		const a1Clip = tracks.find((t) => t.id === 'track-a1')?.clips[0];
		const songMatch =
			songs.find((s) => s.audioUrl === a1Clip?.sourceUrl) ??
			(a1Clip ? null : initialSong ?? songs[0] ?? null);
		const audioUrl = a1Clip?.sourceUrl || songMatch?.audioUrl || '';
		const dur = a1Clip?.duration || songMatch?.duration || totalDuration;

		const synced = await transcribeAndSyncLyrics({
			audioUrl,
			duration: dur,
			lyrics: songMatch?.lyrics,
			songTitle: a1Clip?.title || songMatch?.title || projectTitle,
		});

		if (synced.cues.length === 0) {
			throw new Error('La IA no detectó frases ni letras claras para sincronizar en T1.');
		}

		const items: NleClip[] = synced.cues.map((cue) => ({
			id: makeClipId('lyric'),
			trackId: 'track-t1',
			type: 'text',
			title: cue.text.slice(0, 28),
			sourceUrl: '',
			startTime: cue.startTime,
			duration: Math.max(1.2, Number((cue.endTime - cue.startTime).toFixed(1))),
			trimStart: 0,
			opacity: 1,
			speed: 1,
			volume: 1,
			lutId: 'inherit',
			colorAdjust: { ...DEFAULT_COLOR_ADJUST },
			cameraMotion: 'none',
			transitionIn: 'cross-dissolve',
			textData: {
				text: cue.text,
				fontSize: cue.isSlogan ? 36 : 30,
				color: cue.isSlogan ? '#c8f73c' : '#ffffff',
				bgOpacity: 0.68,
				position: cue.isSlogan ? 'center' : 'bottom',
				fontWeight: cue.isSlogan ? 'black' : 'bold',
			},
		}));

		setTracks((prev) =>
			prev.map((tr) => (tr.kind === 'text' ? { ...tr, clips: items } : tr))
		);
	}

	return (
		<div className="flex w-full flex-col gap-2.5 lg:h-[calc(100vh-118px)] lg:min-h-[650px]">
			{/* TOP PREMIERE ACTION HEADER */}
			<header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 flex-none">
				<div className="flex flex-wrap items-center gap-2 min-w-0">
					{/* Studio Mode Switcher */}
					<div
						role="tablist"
						className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5 flex-none"
					>
						{STUDIO_KINDS.map((k) => {
							const Icon = k.icon;
							const on = kind === k.id;
							return (
								<button
									key={k.id}
									type="button"
									role="tab"
									aria-selected={on}
									onClick={() => onChangeKind(k.id)}
									className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
										on
											? 'bg-surface-3 text-foreground'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									<Icon className="h-3.5 w-3.5" />
									<span>{t(k.label)}</span>
								</button>
							);
						})}
					</div>

					{/* Editable Project Title */}
					<input
						type="text"
						value={projectTitle}
						onChange={(e) => setProjectTitle(e.target.value)}
						aria-label="Nombre del proyecto"
						className="h-8 w-40 sm:w-48 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
					/>

					{/* Aspect Ratio Selector */}
					<div className="hidden md:flex items-center gap-1 rounded-lg bg-surface-2 p-0.5">
						{(['16:9', '9:16', '21:9'] as const).map((ar) => (
							<button
								key={ar}
								type="button"
								onClick={() => setAspect(ar)}
								className={`h-7 rounded-md px-2 font-mono text-[11px] font-bold transition-colors ${
									aspect === ar
										? 'bg-cyan-500/20 text-cyan-300'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								{ar}
							</button>
						))}
					</div>

					{/* Dual Monitor Switcher (Premiere Origen + Programa) */}
					<button
						type="button"
						onClick={() => setDualMonitors((d) => !d)}
						title="Alternar vista Dual (Monitor Origen + Monitor Programa)"
						className={`hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
							dualMonitors
								? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
								: 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
						}`}
					>
						<Columns2 className="h-3.5 w-3.5" />
						<span>{dualMonitors ? '2 Pantallas' : '1 Pantalla'}</span>
					</button>
				</div>

				{/* Right Actions */}
				<div className="flex items-center gap-2 flex-none">
					<button
						type="button"
						onClick={() => openMaestroForSong(initialSong?.key)}
						className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 text-xs font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-colors whitespace-nowrap"
					>
						<Wand2 className="h-3.5 w-3.5" />
						<span>Maestro IA</span>
					</button>

					<span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold tabular-nums">
						<Coins className="h-3.5 w-3.5 text-primary" /> {credits ?? 0}
						{isEnabled('payments') && (
							<Link
								to="/planes"
								className="ml-1 font-semibold text-primary hover:underline whitespace-nowrap"
							>
								{t('Get more')}
							</Link>
						)}
					</span>

					<button
						type="button"
						onClick={() => {
							setYtTitle(`${projectTitle} — Official Video`);
							setYtSeoError(null);
							setYtCopied(false);
							setYtOpen(true);
						}}
						className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-2.5 text-xs font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap"
					>
						<Youtube className="h-3.5 w-3.5" />
						<span className="hidden lg:inline">YouTube</span>
					</button>

					<button
						type="button"
						onClick={() => setExportOpen(true)}
						className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:brightness-110 transition-all whitespace-nowrap"
					>
						<Download className="h-3.5 w-3.5" />
						<span>Exportar</span>
					</button>
				</div>
			</header>

			{/* MIDDLE WORKSPACE: MEDIA BIN | MONITORS (ORIGEN + PROGRAMA) | INSPECTOR */}
			<div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-cols-[310px_1fr_285px] xl:grid-cols-[330px_1fr_300px]">
				<MediaBinPanel
					userId={userId}
					songs={songs}
					creations={creations}
					localAssets={localAssets}
					videoProvider={videoProvider}
					credits={credits}
					aspect={aspect}
					fx={fx}
					selectedClipId={selectedClipId}
					onAddLocalAsset={(a) => setLocalAssets((p) => [a, ...p])}
					onInsertAsset={handleInsertAsset}
					onPreviewInSource={(asset) => {
						setSourceAsset(asset);
						setDualMonitors(true);
					}}
					onOpenMaestro={(songKey) => openMaestroForSong(songKey)}
					onMagicDetectTitles={handleMagicDetectTitles}
					onInsertTextPreset={handleInsertTextPreset}
					onGenerateAiVideo={handleGenerateAiVideo}
					onUpdateFx={(patch) => setFx((prev) => ({ ...prev, ...patch }))}
					onApplyTransitionToSelected={(tr: NleTransition) => {
						if (selectedClipId) {
							updateClip(selectedClipId, (c) => ({ ...c, transitionIn: tr }));
						}
					}}
				/>

				{/* Center Screen Area: Dual Premiere Monitors or Full Program Monitor */}
				<div
					className={`grid min-h-0 gap-2 ${
						dualMonitors ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
					}`}
				>
					{dualMonitors && (
						<SourceMonitor
							asset={sourceAsset}
							onInsertAtPlayhead={(asset, trimStart, dur) =>
								insertTrimmedAsset(asset, trimStart, dur, false)
							}
							onAppendToTrack={(asset, trimStart, dur) =>
								insertTrimmedAsset(asset, trimStart, dur, true)
							}
						/>
					)}

					<ProgramMonitor
						tracks={tracks}
						fx={fx}
						aspect={aspect}
						playhead={playhead}
						totalDuration={totalDuration}
						isPlaying={isPlaying}
						masterMuted={masterMuted}
						seekVersion={seekVersion}
						onRegisterAudioClock={(getter) => {
							audioClockGetterRef.current = getter;
						}}
						onTogglePlay={() => setIsPlaying((p) => !p)}
						onSeek={(tSec) => seekPlayhead(tSec, totalDuration)}
						onToggleMasterMute={() => setMasterMuted((m) => !m)}
						onSplitAtPlayhead={handleSplitAtPlayhead}
					/>
				</div>

				<ClipInspector
					tracks={tracks}
					selectedClip={selectedClip}
					playhead={playhead}
					onSelectClip={setSelectedClipId}
					onSeek={(tSec) => seekPlayhead(tSec, totalDuration)}
					onUpdateClip={updateClip}
					onDuplicateClip={(id) => {
						setSelectedClipId(id);
						handleDuplicateSelected();
					}}
					onSplitClip={(id) => {
						setTracks((prev) => splitClipAtTime(prev, id, playheadRef.current));
					}}
					onDeleteClip={(id) => {
						setTracks((prev) => deleteClipFromTracks(prev, id));
						if (selectedClipId === id) setSelectedClipId(null);
					}}
					onRegenerateClipImage={handleRegenerateClipImage}
					onAnimateClipToVideo={handleAnimateClipToVideo}
				/>
			</div>

			{/* BOTTOM FULL-WIDTH PREMIERE/FILMORA MULTI-TRACK TIMELINE */}
			<NleTimeline
				tracks={tracks}
				songs={songs}
				playhead={playhead}
				totalDuration={totalDuration}
				selectedClipId={selectedClipId}
				toolMode={toolMode}
				onToolModeChange={setToolMode}
				onSelectClip={setSelectedClipId}
				onSeek={(tSec) => seekPlayhead(tSec, totalDuration)}
				onUpdateClip={updateClip}
				onToggleTrackProp={(trackId, prop) =>
					setTracks((prev) =>
						prev.map((t) => (t.id === trackId ? { ...t, [prop]: !t[prop] } : t))
					)
				}
				onSplitAtPlayhead={handleSplitAtPlayhead}
				onSplitClipAtTime={(id, at) =>
					setTracks((prev) => splitClipAtTime(prev, id, at))
				}
				onDuplicateSelected={handleDuplicateSelected}
				onDeleteSelected={handleDeleteSelected}
				onAddTrack={handleAddTrack}
				onAutoBuildFromSong={(song) => openMaestroForSong(song?.key)}
			/>

			<MaestroDirectorModal
				open={maestroOpen}
				userId={userId}
				songs={songs}
				initialSongKey={maestroSongKey}
				aspect={aspect}
				onClose={() => setMaestroOpen(false)}
				onAssemblePlanToTimeline={handleAssembleMaestroPlan}
				onWorkspaceUpdated={onWorkspaceUpdated}
			/>

			{/* EXPORT & RENDER MODAL */}
			{exportOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
					<div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-2xl">
						<div className="flex items-center justify-between border-b border-border pb-3">
							<div className="flex items-center gap-2">
								<Film className="h-5 w-5 text-primary" />
								<h3 className="text-sm font-bold text-foreground">
									Exportar Proyecto ({aspect})
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setExportOpen(false)}
								className="p-1 text-muted-foreground hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setExportRes('720p')}
								className={`rounded-xl border p-3 text-left ${
									exportRes === '720p'
										? 'border-primary bg-primary/10 text-foreground'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								<span className="block text-xs font-bold">HD 720p Rápido</span>
								<span className="block text-[11px] opacity-75">Renderizado ágil web</span>
							</button>
							<button
								type="button"
								onClick={() => setExportRes('1080p')}
								className={`rounded-xl border p-3 text-left ${
									exportRes === '1080p'
										? 'border-cyan-400 bg-cyan-500/15 text-foreground'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								<span className="block text-xs font-bold">Full HD 1080p</span>
								<span className="block text-[11px] opacity-75">Calidad master profesional</span>
							</button>
						</div>

						{isRendering && (
							<div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3">
								<div className="flex items-center justify-between text-xs">
									<span className="font-bold">Renderizando pistas V1/V2/T1/A1...</span>
									<span className="font-mono text-primary tabular-nums">{renderProgress}%</span>
								</div>
								<div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
									<div
										style={{ width: `${renderProgress}%` }}
										className="h-full bg-primary transition-all duration-100"
									/>
								</div>
							</div>
						)}

						{renderError && (
							<p className="rounded-lg border border-destructive/30 bg-destructive/15 px-3 py-2 text-xs text-destructive">
								{renderError}
							</p>
						)}

						{renderedUrl && (
							<div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-surface-2 p-3">
								<video
									src={renderedUrl}
									controls
									playsInline
									className="aspect-video w-full rounded-lg bg-black object-contain"
								/>
								<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
									<span className="font-bold text-primary">¡Render completado!</span>
									<div className="flex items-center gap-2">
										{!savedWorkspace ? (
											<button
												type="button"
												disabled={savingWorkspace}
												onClick={() => void handleSaveToWorkspace()}
												className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black disabled:opacity-50"
											>
												{savingWorkspace ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<Upload className="h-3.5 w-3.5" />
												)}
												<span>Guardar en Biblioteca</span>
											</button>
										) : (
											<span className="font-bold text-emerald-400">Guardado</span>
										)}
										<a
											href={renderedUrl}
											download={`${(projectTitle || 'Qamuz_Video').replace(/\s+/g, '_')}.${renderedExt}`}
											className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 font-bold text-primary-foreground"
										>
											<Download className="h-3.5 w-3.5" />
											<span>Descargar .{renderedExt}</span>
										</a>
									</div>
								</div>
							</div>
						)}

						<div className="flex items-center justify-end gap-2 border-t border-border pt-3">
							<button
								type="button"
								onClick={() => setExportOpen(false)}
								className="h-9 rounded-lg bg-surface-2 px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
							>
								Cerrar
							</button>
							<button
								type="button"
								disabled={isRendering}
								onClick={() => void handleStartRender()}
								className={primaryButton}
							>
								{isRendering ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Film className="h-4 w-4" />
								)}
								<span>{renderedUrl ? 'Volver a Renderizar' : 'Renderizar Video'}</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* YOUTUBE PREPARATION & REAL SEO MODAL (NO FAKE UPLOADS) */}
			{ytOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
					<div className="flex w-full max-w-lg flex-col gap-3.5 rounded-2xl border border-border bg-surface p-5 shadow-2xl">
						<div className="flex items-center justify-between border-b border-border pb-3">
							<div className="flex items-center gap-2">
								<Youtube className="h-5 w-5 text-red-500" />
								<h3 className="text-sm font-bold text-foreground">
									Preparar Lanzamiento en YouTube
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setYtOpen(false)}
								className="p-1 text-muted-foreground hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						{!renderedUrl ? (
							<div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 text-xs">
								<p className="font-bold text-amber-200">
									Aún no has renderizado el archivo de video final.
								</p>
								<p className="text-muted-foreground">
									Primero exporta el video real de tu línea de tiempo para poder descargarlo y subirlo a YouTube Studio.
								</p>
								<button
									type="button"
									onClick={() => {
										setYtOpen(false);
										setExportOpen(true);
									}}
									className="mt-1 inline-flex h-8 w-fit items-center gap-1.5 rounded-lg bg-primary px-3 font-bold text-primary-foreground"
								>
									<Film className="h-3.5 w-3.5" />
									<span>Ir a Renderizar Video Real Primero</span>
								</button>
							</div>
						) : (
							<div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs">
								<span className="font-semibold text-emerald-300">
									Master listo ({renderedExt.toUpperCase()}) para descargar y subir
								</span>
								<a
									href={renderedUrl}
									download={`${(projectTitle || 'Qamuz_Video').replace(/\s+/g, '_')}.${renderedExt}`}
									className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-bold text-primary-foreground"
								>
									<Download className="h-3 w-3" />
									<span>Descargar</span>
								</a>
							</div>
						)}

						<div className="flex items-center justify-between gap-2">
							<span className="text-xs font-bold text-muted-foreground">
								Metadatos SEO para YouTube Studio
							</span>
							<button
								type="button"
								disabled={ytOptimizing}
								onClick={async () => {
									setYtOptimizing(true);
									setYtSeoError(null);
									setYtCopied(false);
									try {
										const sceneCtx = tracks
											.flatMap((t) => t.clips.map((c) => c.title))
											.slice(0, 8)
											.join(', ');
										const seo = await generateYoutubeSeo({
											songTitle: projectTitle,
											style: fx.lutId,
											sceneContext: sceneCtx || projectTitle,
										});
										setYtTitle(seo.title);
										setYtDescription(seo.description);
										setYtTags(seo.tags);
									} catch (err) {
										setYtSeoError(
											err instanceof Error ? err.message : 'No se pudo optimizar el SEO con IA.'
										);
									} finally {
										setYtOptimizing(false);
									}
								}}
								className="inline-flex h-7 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
							>
								{ytOptimizing ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<Wand2 className="h-3 w-3" />
								)}
								<span>{ytOptimizing ? 'Pensando SEO...' : 'Optimizar con IA'}</span>
							</button>
						</div>

						<label className="flex flex-col gap-1 text-xs">
							<span className="font-bold text-muted-foreground">Título en YouTube</span>
							<input
								type="text"
								value={ytTitle}
								onChange={(e) => setYtTitle(e.target.value)}
								className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 outline-none focus:border-primary"
							/>
						</label>

						<label className="flex flex-col gap-1 text-xs">
							<span className="font-bold text-muted-foreground">Descripción</span>
							<textarea
								rows={3}
								value={ytDescription}
								onChange={(e) => setYtDescription(e.target.value)}
								placeholder="Haz clic en Optimizar con IA para generar una descripción SEO real..."
								className="rounded-lg border border-border bg-surface-2 p-2.5 text-xs outline-none focus:border-primary resize-none"
							/>
						</label>

						<div className="grid grid-cols-2 gap-2">
							<label className="flex flex-col gap-1 text-xs">
								<span className="font-bold text-muted-foreground">Etiquetas (Tags)</span>
								<input
									type="text"
									value={ytTags}
									onChange={(e) => setYtTags(e.target.value)}
									placeholder="videoclip, cine, qamuz..."
									className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 outline-none focus:border-primary"
								/>
							</label>
							<label className="flex flex-col gap-1 text-xs">
								<span className="font-bold text-muted-foreground">Visibilidad sugerida</span>
								<select
									value={ytPrivacy}
									onChange={(e) =>
										setYtPrivacy(e.target.value as 'public' | 'unlisted' | 'private')
									}
									className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 outline-none"
								>
									<option value="public">Público</option>
									<option value="unlisted">Oculto</option>
									<option value="private">Privado</option>
								</select>
							</label>
						</div>

						{ytSeoError && (
							<p className="rounded-lg border border-destructive/30 bg-destructive/15 px-3 py-2 text-xs text-destructive">
								{ytSeoError}
							</p>
						)}

						<div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
							<button
								type="button"
								onClick={async () => {
									const bundle = `Título: ${ytTitle}\nVisibilidad: ${ytPrivacy}\n\nDescripción:\n${ytDescription}\n\nEtiquetas:\n${ytTags}`;
									await navigator.clipboard.writeText(bundle).catch(() => undefined);
									setYtCopied(true);
								}}
								className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-bold text-foreground hover:border-primary"
							>
								{ytCopied ? (
									<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
								<span>{ytCopied ? 'Copiado' : 'Copiar Metadata SEO'}</span>
							</button>

							<a
								href="https://studio.youtube.com"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-500"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								<span>Abrir YouTube Studio</span>
							</a>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
