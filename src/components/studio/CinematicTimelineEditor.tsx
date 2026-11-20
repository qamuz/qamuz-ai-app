import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Activity,
	ArrowRight,
	Camera,
	Check,
	CheckCircle2,
	ChevronDown,
	Clapperboard,
	Copy,
	Download,
	Edit,
	ExternalLink,
	Eye,
	Film,
	Grid3x3,
	Layers,
	Loader2,
	Maximize2,
	Mic,
	Minimize2,
	Music,
	Palette,
	Pause,
	Play,
	Plus,
	RefreshCw,
	Scissors,
	Share2,
	Sliders,
	Sparkles,
	Trash2,
	Upload,
	Volume2,
	VolumeX,
	Wand2,
	X,
	Youtube,
	Zap,
} from 'lucide-react';
import { inputClass, primaryButton } from '@/lib/ui';
import { useI18n } from '@/hooks/useI18n';
import { formatTime } from '@/lib/format';
import { uploadMedia } from '@/lib/media';
import { createCreation, fetchCreation, refreshCreation, saveRenderedVideo, type StudioSong } from '@/lib/studio';
import { generateYoutubeSeo } from '@/lib/nle/maestroDirector';
import {
	analyzeAudioTrack,
	buildMusicalCutGrid,
	type AudioAnalysisResult,
} from '@/lib/nle/audioAnalyzer';
import {
	COLOR_GRADE_PRESETS,
	buildTimelineTracks,
	generateScriptAndStoryboard,
	type StoryboardScene,
	type TimelineClip,
	type TimelineTrack,
} from '@/lib/storyboard';

interface Props {
	song: StudioSong;
	userId?: string;
	style: string;
	category: 'artistic' | 'cinema';
	director?: string;
	characterName?: string;
	onClose: () => void;
	onPublished?: () => void;
}

export function CinematicTimelineEditor({
	song,
	userId,
	style,
	category,
	director,
	characterName,
	onClose,
	onPublished,
}: Props) {
	const { t } = useI18n();

	// Storyboard & Script State
	const [scenes, setScenes] = useState<StoryboardScene[]>(() =>
		generateScriptAndStoryboard({
			song,
			style,
			category,
			director,
			characterName,
			totalDurationSeconds: song.duration || 60,
		})
	);

	// Timeline Tracks State (Multitrack Filmora style)
	const [tracks, setTracks] = useState<TimelineTrack[]>(() => buildTimelineTracks(song, scenes));
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

	// Playback & Beat/Compás State
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [beatAnalysis, setBeatAnalysis] = useState<AudioAnalysisResult | null>(null);
	const [syncingBeat, setSyncingBeat] = useState(false);
	const [showBeatGrid, setShowBeatGrid] = useState(true);
	const totalDuration = useMemo(
		() => Math.max(song.duration || 60, scenes.reduce((max, s) => Math.max(max, s.endTime), 0)),
		[song.duration, scenes]
	);

	const playheadBarBeat = useMemo(() => {
		const bars = beatAnalysis?.barTimes ?? [];
		if (bars.length === 0) return null;
		let barIdx = 0;
		for (let i = 0; i < bars.length; i++) {
			if (currentTime >= bars[i] - 0.03) barIdx = i;
			else break;
		}
		const barStart = bars[barIdx] ?? 0;
		const beatSec = beatAnalysis?.estimatedBpm ? 60 / beatAnalysis.estimatedBpm : 0.5;
		const beatInBar = Math.min(4, Math.max(1, Math.floor(Math.max(0, currentTime - barStart) / beatSec) + 1));
		return { bar: barIdx + 1, beat: beatInBar };
	}, [beatAnalysis, currentTime]);

	// Audio element for playing the song synchronized with the timeline
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const autoSyncedOnceRef = useRef(false);

	// Helper to cut/distribute scenes dynamically onto exact 1.0–2.0s compás slots
	function applyBeatCutScenes(
		baseScenes: StoryboardScene[],
		analysis: AudioAnalysisResult
	): StoryboardScene[] {
		if (baseScenes.length === 0) return baseScenes;
		const targetDur = Math.max(8, song.duration || analysis.duration || 60);
		const slots = buildMusicalCutGrid({
			duration: targetDur,
			bpm: analysis.estimatedBpm,
			beatOffset: analysis.beatOffset,
			energyBins: analysis.energyBins,
			vocalEntryTime: analysis.vocalEntryTime,
			peakHookStart: analysis.peakHookStart,
			peakHookEnd: analysis.peakHookEnd,
		});
		if (slots.length === 0) return baseScenes;

		// Preserve unique narrative scenes as pool
		const pool: StoryboardScene[] = [];
		const seenKeys = new Set<string>();
		for (const sc of baseScenes) {
			const k = sc.visualPrompt || sc.title;
			if (seenKeys.has(k)) continue;
			seenKeys.add(k);
			pool.push(sc);
		}
		const sourcePool = pool.length > 0 ? pool : baseScenes;
		let lastPoolIdx = -1;

		return slots.map((slot, idx) => {
			const ratio = (slot.startTime + slot.endTime) / 2 / Math.max(1, targetDur);
			const primaryIdx = Math.min(sourcePool.length - 1, Math.floor(ratio * sourcePool.length));
			let pickIdx =
				idx % 2 === 0 ? primaryIdx : (primaryIdx + 1 + Math.floor(idx / 2)) % sourcePool.length;
			if (pickIdx === lastPoolIdx && sourcePool.length > 1) {
				pickIdx = (pickIdx + 1) % sourcePool.length;
			}
			lastPoolIdx = pickIdx;
			const base = sourcePool[pickIdx];
			const cleanTitle = base.title.replace(/\s*·\s*C\d+$/i, '');

			return {
				...base,
				id: `scene-cut-${idx + 1}-${slot.startTime}`,
				sceneNumber: idx + 1,
				title: `${cleanTitle} · C${idx + 1}`,
				startTime: slot.startTime,
				endTime: slot.endTime,
				duration: slot.duration,
				transition: slot.isVocalEntryBoundary ? 'disolvencia' : 'corte',
			};
		});
	}

	// Automatically analyze audio compás on mount and apply 1–2s rhythmic cuts once
	useEffect(() => {
		let cancelled = false;
		void analyzeAudioTrack(song.audioUrl || '', song.duration || 60, song.lyrics).then((analysis) => {
			if (cancelled) return;
			setBeatAnalysis(analysis);
			if (!autoSyncedOnceRef.current) {
				autoSyncedOnceRef.current = true;
				setScenes((prev) => {
					const cut = applyBeatCutScenes(prev, analysis);
					setTracks(buildTimelineTracks(song, cut));
					return cut;
				});
			}
		});
		return () => {
			cancelled = true;
		};
	}, [song.audioUrl, song.duration, song.lyrics]); // eslint-disable-line react-hooks/exhaustive-deps

	// Pre-decode all unique scene images into GPU memory so 1–2s cuts never flicker
	useEffect(() => {
		const urls = Array.from(new Set(scenes.map((s) => s.imageUrl).filter(Boolean)));
		for (const url of urls) {
			const img = new Image();
			img.decoding = 'async';
			img.src = url;
			if (typeof img.decode === 'function') {
				void img.decode().catch(() => undefined);
			}
		}
	}, [scenes]);

	// Color Grading & Effects State
	const [selectedColorGrade, setSelectedColorGrade] = useState<string>(COLOR_GRADE_PRESETS[1].id);
	const [enableLetterbox, setEnableLetterbox] = useState(category === 'cinema');
	const [enableFilmGrain, setEnableFilmGrain] = useState(true);
	const [enableLightLeak, setEnableLightLeak] = useState(false);
	const [enableVignette, setEnableVignette] = useState(true);

	// Scene Re-creation Modal State
	const [editingScene, setEditingScene] = useState<StoryboardScene | null>(null);
	const [regeneratingScene, setRegeneratingScene] = useState(false);
	const [sceneError, setSceneError] = useState<string | null>(null);
	const [customPrompt, setCustomPrompt] = useState('');
	const [customScript, setCustomScript] = useState('');

	// Export / Render Modal State
	const [showExportModal, setShowExportModal] = useState(false);
	const [exportResolution, setExportResolution] = useState<'1080p' | '4k'>('1080p');
	const [isRendering, setIsRendering] = useState(false);
	const [renderProgress, setRenderProgress] = useState(0);
	const [renderError, setRenderError] = useState<string | null>(null);
	const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
	const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
	const [renderedExt, setRenderedExt] = useState<'webm' | 'mp4'>('webm');
	const [savingToWorkspace, setSavingToWorkspace] = useState(false);
	const [savedToWorkspace, setSavedToWorkspace] = useState(false);

	// YouTube Studio Export Modal State (Real AI SEO + Rendered Master)
	const [showYouTubeModal, setShowYouTubeModal] = useState(false);
	const [ytTitle, setYtTitle] = useState(`${song.title} — Official Music Video`);
	const [ytDescription, setYtDescription] = useState(
		`Official cinematic music video for "${song.title}".\nGenre: ${song.style || 'Urban / Pop'}\nDirection: ${director || 'AI Cinema'}`
	);
	const [ytPrivacy, setYtPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
	const [ytTags, setYtTags] = useState('music video, official video, cinema');
	const [ytOptimizing, setYtOptimizing] = useState(false);
	const [ytSeoError, setYtSeoError] = useState<string | null>(null);
	const [ytCopied, setYtCopied] = useState(false);

	// Synchronize audio playback with currentTime
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		if (isPlaying) {
			audio.currentTime = currentTime;
			audio.play().catch(() => undefined);

			const tick = () => {
				if (audio) {
					setCurrentTime(audio.currentTime);
					if (audio.currentTime >= totalDuration) {
						setIsPlaying(false);
						audio.pause();
						audio.currentTime = 0;
						setCurrentTime(0);
						return;
					}
				}
				animationFrameRef.current = requestAnimationFrame(tick);
			};
			animationFrameRef.current = requestAnimationFrame(tick);
		} else {
			audio.pause();
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		}

		return () => {
			if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
		};
	}, [isPlaying, totalDuration]); // eslint-disable-line react-hooks/exhaustive-deps

	// Active & previous scene at currentTime (gap-immune so rapid 1–2s cuts never flash black)
	const { activeScene, previousScene } = useMemo(() => {
		if (scenes.length === 0) return { activeScene: scenes[0], previousScene: null as StoryboardScene | null };
		let idx = scenes.findIndex((s) => currentTime >= s.startTime && currentTime < s.endTime);
		if (idx < 0) {
			idx = currentTime >= (scenes[scenes.length - 1]?.startTime ?? 0) ? scenes.length - 1 : 0;
		}
		return {
			activeScene: scenes[idx] || scenes[0],
			previousScene: idx > 0 ? scenes[idx - 1] : null,
		};
	}, [scenes, currentTime]);

	// Active color grade preset
	const activeFilter = useMemo(
		() => COLOR_GRADE_PRESETS.find((p) => p.id === selectedColorGrade) || COLOR_GRADE_PRESETS[0],
		[selectedColorGrade]
	);

	function togglePlay() {
		setIsPlaying((prev) => !prev);
	}

	function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, clickX / rect.width));
		const newTime = ratio * totalDuration;
		setCurrentTime(newTime);
		if (audioRef.current) {
			audioRef.current.currentTime = newTime;
		}
	}

	async function handleAutoSync() {
		setSyncingBeat(true);
		try {
			const analysis =
				beatAnalysis ??
				(await analyzeAudioTrack(song.audioUrl || '', song.duration || totalDuration, song.lyrics));
			setBeatAnalysis(analysis);
			const resyncedScenes = applyBeatCutScenes(scenes, analysis);
			setScenes(resyncedScenes);
			setTracks(buildTimelineTracks(song, resyncedScenes));
		} finally {
			setSyncingBeat(false);
		}
	}

	function openSceneEditor(sc: StoryboardScene) {
		setEditingScene(sc);
		setSceneError(null);
		setCustomPrompt(sc.visualPrompt);
		setCustomScript(sc.scriptDialogue || '');
	}

	async function handleRegenerateScene() {
		if (!editingScene) return;
		setRegeneratingScene(true);
		setSceneError(null);

		try {
			const scenePrompt = `${customPrompt.trim()}, 8k resolution, cinematic lighting, photorealistic, ${style} aesthetic`.slice(0, 950);
			const res = await createCreation('image', scenePrompt, {
				size: '1536x1024',
				style,
			});

			if (res.error || !res.data?.id) {
				setSceneError(res.error || 'No se pudo iniciar la generación de la escena con IA.');
				return;
			}

			let generatedImageUrl: string | null = null;
			for (let attempt = 0; attempt < 18; attempt++) {
				await new Promise((r) => setTimeout(r, 2500));
				await refreshCreation(res.data.id);
				const created = await fetchCreation(res.data.id);
				if (created?.status === 'ready' && (created.result_urls?.[0] || created.thumbnail_url)) {
					generatedImageUrl = created.result_urls?.[0] || created.thumbnail_url;
					break;
				}
				if (created?.status === 'error') {
					setSceneError(created.error_message || 'La IA devolvió un error al regenerar la escena.');
					return;
				}
			}

			const updatedScenes = scenes.map((s) => {
				if (s.id === editingScene.id) {
					return {
						...s,
						visualPrompt: customPrompt,
						scriptDialogue: customScript,
						imageUrl: generatedImageUrl || s.imageUrl,
					};
				}
				return s;
			});

			setScenes(updatedScenes);
			setTracks(buildTimelineTracks(song, updatedScenes));
			setEditingScene(null);
		} catch (err) {
			setSceneError(err instanceof Error ? err.message : 'Error al conectar con el estudio de IA.');
		} finally {
			setRegeneratingScene(false);
		}
	}

	function loadCanvasImage(url: string): Promise<HTMLImageElement | null> {
		return new Promise((resolve) => {
			if (!url) {
				resolve(null);
				return;
			}
			const img = new Image();
			if (!url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('/')) {
				img.crossOrigin = 'anonymous';
			}
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null);
			img.src = url;
		});
	}

	async function handleStartRender() {
		setIsRendering(true);
		setRenderProgress(0);
		setRenderError(null);
		setSavedToWorkspace(false);
		if (renderedVideoUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(renderedVideoUrl);
		}
		setRenderedVideoUrl(null);
		setRenderedBlob(null);

		try {
			const width = exportResolution === '4k' ? 1920 : 1280;
			const height = exportResolution === '4k' ? 1080 : 720;
			const fps = 24;
			const renderSeconds = Math.min(240, Math.max(8, totalDuration));

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				throw new Error('Tu navegador no soporta renderizado Canvas 2D.');
			}

			// Preload scene images
			const loadedImages = await Promise.all(scenes.map((sc) => loadCanvasImage(sc.imageUrl)));

			const canvasStream = canvas.captureStream(fps);
			const tracksToRecord: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

			// Try attaching synchronized song audio via WebAudio
			let audioCtx: AudioContext | null = null;
			let renderAudio: HTMLAudioElement | null = null;
			if (song.audioUrl) {
				try {
					renderAudio = new Audio();
					renderAudio.crossOrigin = 'anonymous';
					renderAudio.preload = 'auto';
					renderAudio.src = song.audioUrl;
					audioCtx = new AudioContext();
					const srcNode = audioCtx.createMediaElementSource(renderAudio);
					const dest = audioCtx.createMediaStreamDestination();
					srcNode.connect(dest);
					tracksToRecord.push(...dest.stream.getAudioTracks());
				} catch {
					// Fallback smoothly to video-only if audio CORS is blocked
					audioCtx = null;
					renderAudio = null;
				}
			}

			const combinedStream = new MediaStream(tracksToRecord);
			const mimeCandidates = [
				'video/mp4;codecs=avc1,mp4a.40.2',
				'video/mp4',
				'video/webm;codecs=vp9,opus',
				'video/webm;codecs=vp8,opus',
				'video/webm',
			];
			const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
			const recorder = new MediaRecorder(
				combinedStream,
				mimeType ? { mimeType, videoBitsPerSecond: exportResolution === '4k' ? 6_000_000 : 3_500_000 } : undefined
			);
			const chunks: BlobPart[] = [];
			recorder.ondataavailable = (ev) => {
				if (ev.data.size > 0) chunks.push(ev.data);
			};

			const donePromise = new Promise<Blob>((resolve) => {
				recorder.onstop = () => {
					const outType = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
					setRenderedExt(outType === 'video/mp4' ? 'mp4' : 'webm');
					resolve(new Blob(chunks, { type: outType }));
				};
			});

			recorder.start(250);
			if (renderAudio && audioCtx) {
				if (audioCtx.state === 'suspended') await audioCtx.resume();
				await renderAudio.play().catch(() => undefined);
			}

			const startedAt = performance.now();

			await new Promise<void>((resolve) => {
				const step = () => {
					const wallSec = (performance.now() - startedAt) / 1000;
					const timelineT =
						renderAudio && !renderAudio.paused && renderAudio.readyState >= 2
							? Math.min(renderSeconds, renderAudio.currentTime)
							: Math.min(renderSeconds, wallSec);
					const progressRatio = Math.min(1, timelineT / renderSeconds);
					setRenderProgress(Math.round(progressRatio * 100));

					const exactIdx = scenes.findIndex((sc) => timelineT >= sc.startTime && timelineT < sc.endTime);
					const sceneIdx = exactIdx >= 0 ? exactIdx : scenes.length - 1;
					const sc = scenes[sceneIdx] || scenes[0];
					const img = loadedImages[sceneIdx] || null;
					const localProgress = Math.max(0, Math.min(1, (timelineT - sc.startTime) / Math.max(1, sc.duration)));

					ctx.save();
					ctx.fillStyle = '#07070b';
					ctx.fillRect(0, 0, width, height);

					ctx.filter = activeFilter.cssFilter !== 'none' ? activeFilter.cssFilter : 'none';
					if (img) {
						const scale = 1.0 + localProgress * 0.08;
						const imgRatio = img.width / Math.max(1, img.height);
						const canvasRatio = width / height;
						let drawW = width;
						let drawH = height;
						if (imgRatio > canvasRatio) {
							drawH = height * scale;
							drawW = drawH * imgRatio;
						} else {
							drawW = width * scale;
							drawH = drawW / imgRatio;
						}
						const dx = (width - drawW) / 2;
						const dy = (height - drawH) / 2;
						ctx.drawImage(img, dx, dy, drawW, drawH);
					} else {
						const grad = ctx.createLinearGradient(0, 0, width, height);
						grad.addColorStop(0, '#0f172a');
						grad.addColorStop(0.5, '#1e1b4b');
						grad.addColorStop(1, '#09090b');
						ctx.fillStyle = grad;
						ctx.fillRect(0, 0, width, height);
					}
					ctx.filter = 'none';

					if (enableVignette) {
						const vig = ctx.createRadialGradient(width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.72);
						vig.addColorStop(0, 'rgba(0,0,0,0)');
						vig.addColorStop(1, 'rgba(0,0,0,0.65)');
						ctx.fillStyle = vig;
						ctx.fillRect(0, 0, width, height);
					}

					if (enableLetterbox) {
						const barH = Math.round(height * 0.1);
						ctx.fillStyle = '#000000';
						ctx.fillRect(0, 0, width, barH);
						ctx.fillRect(0, height - barH, width, barH);
					}

					// Subtle title / lyric subtitle if dialogue exists
					if (sc.scriptDialogue) {
						ctx.fillStyle = 'rgba(0,0,0,0.55)';
						ctx.fillRect(width * 0.12, height - (enableLetterbox ? height * 0.18 : height * 0.12), width * 0.76, 38);
						ctx.fillStyle = '#ffffff';
						ctx.font = `600 ${Math.round(height * 0.026)}px system-ui, sans-serif`;
						ctx.textAlign = 'center';
						ctx.fillText(sc.scriptDialogue.slice(0, 72), width / 2, height - (enableLetterbox ? height * 0.145 : height * 0.085));
					}
					ctx.restore();

					if (progressRatio >= 1) {
						resolve();
					} else {
						requestAnimationFrame(step);
					}
				};
				requestAnimationFrame(step);
			});

			if (renderAudio) renderAudio.pause();
			if (audioCtx) void audioCtx.close();
			recorder.stop();
			const blob = await donePromise;
			const objUrl = URL.createObjectURL(blob);
			setRenderedBlob(blob);
			setRenderedVideoUrl(objUrl);
			setRenderProgress(100);
		} catch (err) {
			setRenderError(err instanceof Error ? err.message : 'No se pudo renderizar el video en este navegador.');
		} finally {
			setIsRendering(false);
		}
	}

	async function handleSaveRenderedToWorkspace() {
		if (!renderedBlob || !userId) return;
		setSavingToWorkspace(true);
		setRenderError(null);
		try {
			const safeName = (song.title || 'timeline-video').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 48);
			const file = new File([renderedBlob], `${safeName}.${renderedExt}`, {
				type: renderedBlob.type || `video/${renderedExt}`,
			});
			const uploaded = await uploadMedia(userId, file, 'videos');
			if (uploaded.error || !uploaded.url) {
				setRenderError(uploaded.error || 'No se pudo subir el video al almacenamiento.');
				return;
			}
			const saved = await saveRenderedVideo({
				title: song.title || 'Video Timeline Studio',
				video_url: uploaded.url,
				thumbnail_url: scenes[0]?.imageUrl?.startsWith('https://') ? scenes[0].imageUrl : song.coverUrl,
				duration: Math.round(totalDuration),
				prompt: `${category === 'cinema' ? 'Cine' : 'Music Video'} · ${style} · ${scenes.length} escenas`,
				options: {
					style,
					category,
					director,
					character: characterName,
					source: song.audioUrl
						? {
								song_key: song.key,
								audio_url: song.audioUrl,
								title: song.title,
								cover_url: song.coverUrl,
								duration: song.duration,
						  }
						: null,
				},
			});
			if (saved.error) {
				setRenderError(saved.error);
				return;
			}
			setSavedToWorkspace(true);
			window.dispatchEvent(new Event('qamuz:creations-updated'));
			onPublished?.();
		} finally {
			setSavingToWorkspace(false);
		}
	}

	async function handleOptimizeYoutubeSeo() {
		setYtOptimizing(true);
		setYtSeoError(null);
		setYtCopied(false);
		try {
			const seo = await generateYoutubeSeo({
				songTitle: song.title,
				style,
				sceneContext: scenes.map((s) => s.title).join(', '),
			});
			setYtTitle(seo.title);
			setYtDescription(seo.description);
			setYtTags(seo.tags);
		} catch (err) {
			setYtSeoError(err instanceof Error ? err.message : 'No se pudo optimizar el SEO con IA.');
		} finally {
			setYtOptimizing(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0e] text-foreground select-none overflow-hidden">
			{/* Hidden audio element for synchronous playback */}
			{song.audioUrl && (
				<audio ref={audioRef} src={song.audioUrl} preload="auto" />
			)}

			{/* Top Bar: Title & Action Header */}
			<header className="flex items-center justify-between px-5 py-3 border-b border-border/80 bg-[#121217] flex-none">
				<div className="flex items-center gap-3">
					<div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-black font-black">
						<Film className="h-5 w-5" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h2 className="text-sm font-black text-foreground">{song.title}</h2>
							<span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
								{category === 'cinema' ? 'Modo Cine & Storyboard' : 'Timeline Multicanal'}
							</span>
						</div>
						<p className="text-[11px] text-muted-foreground">
							Director IA Cinemático · Estilo Filmora Pro · {scenes.length} escenas generadas
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						disabled={syncingBeat}
						onClick={() => void handleAutoSync()}
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-black transition-all disabled:opacity-50"
						title="Corta y sincroniza cada escena cada 1–2s al ritmo exacto del compás"
					>
						<Wand2 className="h-3.5 w-3.5" />
						<span>
							{syncingBeat
								? 'Sincronizando...'
								: beatAnalysis
								? `Compás ${Math.round(beatAnalysis.estimatedBpm)} BPM (1-2s)`
								: 'Auto-Sincronizar Beat'}
						</span>
					</button>

					<button
						type="button"
						onClick={() => setShowExportModal(true)}
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
					>
						<Download className="h-3.5 w-3.5" />
						<span>Renderizar & Descargar</span>
					</button>

					<button
						type="button"
						onClick={() => setShowYouTubeModal(true)}
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
					>
						<Youtube className="h-3.5 w-3.5" />
						<span>Subir a YouTube</span>
					</button>

					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground ml-2"
						title="Cerrar editor"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
			</header>

			{/* Main Middle Section: Player & Storyboard Script Panel */}
			<div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-3 p-3 overflow-hidden min-h-0 bg-[#0c0c10]">
				{/* LEFT: Video Preview Player with Real-Time FX and LUTs */}
				<div className="flex flex-col gap-2 rounded-2xl bg-[#14141a] border border-border/80 p-3.5 min-h-0">
					{/* Video Canvas Container */}
					<div className="relative flex-1 w-full bg-black rounded-xl overflow-hidden flex items-center justify-center shadow-2xl min-h-[220px]">
						{/* CinemaScope Letterbox Bars */}
						{enableLetterbox && (
							<>
								<div className="absolute top-0 left-0 right-0 h-[10%] bg-black z-30 pointer-events-none" />
								<div className="absolute bottom-0 left-0 right-0 h-[10%] bg-black z-30 pointer-events-none" />
							</>
						)}

						{/* Film Grain Texture Overlay */}
						{enableFilmGrain && (
							<div
								className="absolute inset-0 pointer-events-none z-20 opacity-25 mix-blend-overlay"
								style={{
									backgroundImage:
										'radial-gradient(circle, transparent 20%, #000 120%), url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
								}}
							/>
						)}

						{/* Light Leak Overlay */}
						{enableLightLeak && (
							<div className="absolute inset-0 pointer-events-none z-20 opacity-30 bg-gradient-to-tr from-amber-500/20 via-transparent to-cyan-500/30 mix-blend-screen" />
						)}

						{/* Vignette Overlay */}
						{enableVignette && (
							<div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)]" />
						)}

						{/* Zero-Flicker Double-Buffered Scene Preview */}
						{previousScene?.imageUrl && (
							<img
								key={`prev-${previousScene.id}`}
								src={previousScene.imageUrl}
								alt=""
								decoding="async"
								style={{ filter: activeFilter.cssFilter }}
								className="absolute inset-0 h-full w-full object-contain z-[1] pointer-events-none"
							/>
						)}
						{activeScene?.imageUrl && (
							<img
								key={`act-${activeScene.id}`}
								src={activeScene.imageUrl}
								alt={activeScene.title}
								decoding="async"
								style={{ filter: activeFilter.cssFilter }}
								className="relative z-[2] h-full w-full object-contain will-change-transform"
							/>
						)}

						{/* Scene Overlay HUD */}
						<div className="absolute top-3 left-3 z-30 flex items-center gap-2">
							<span className="rounded bg-black/75 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono font-bold text-primary border border-primary/30">
								Escena #{activeScene.sceneNumber}
							</span>
							<span className="rounded bg-black/75 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
								{activeScene.shotType}
							</span>
						</div>

						{/* Play overlay button on center */}
						<button
							type="button"
							onClick={togglePlay}
							className="absolute inset-0 flex items-center justify-center bg-black/15 hover:bg-black/30 transition-colors z-30 group cursor-pointer"
						>
							<div className="h-14 w-14 rounded-full bg-primary text-black flex items-center justify-center shadow-2xl scale-95 group-hover:scale-105 transition-transform">
								{isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 translate-x-0.5" />}
							</div>
						</button>

						{/* Bottom Playhead info */}
						<div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between text-[11px] font-mono text-white/90 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg">
							<span>{activeScene.title}</span>
							<span>
								{formatTime(currentTime)} / {formatTime(totalDuration)}
							</span>
						</div>
					</div>

					{/* Playback Controls & Effects Palette Bar */}
					<div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
						{/* Transport controls */}
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={togglePlay}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs font-bold text-foreground"
							>
								{isPlaying ? <Pause className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5 text-primary" />}
								<span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
							</button>
							<span className="text-xs font-mono text-primary font-bold">
								{formatTime(currentTime)}
							</span>
						</div>

						{/* Effects toggles */}
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={() => setEnableLetterbox((v) => !v)}
								className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
									enableLetterbox
										? 'border-cyan-400 bg-cyan-950/40 text-cyan-300'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
								title="2.39:1 CinemaScope"
							>
								Letterbox 2.39:1
							</button>
							<button
								type="button"
								onClick={() => setEnableFilmGrain((v) => !v)}
								className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
									enableFilmGrain
										? 'border-purple-400 bg-purple-950/40 text-purple-300'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								Grano 35mm
							</button>
							<button
								type="button"
								onClick={() => setEnableLightLeak((v) => !v)}
								className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
									enableLightLeak
										? 'border-amber-400 bg-amber-950/40 text-amber-300'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								Light Leaks
							</button>
						</div>

						{/* Color Grade LUT selector */}
						<div className="flex items-center gap-1.5">
							<Palette className="h-3.5 w-3.5 text-primary" />
							<select
								value={selectedColorGrade}
								onChange={(e) => setSelectedColorGrade(e.target.value)}
								className="bg-surface-2 border border-border text-foreground text-[10px] rounded px-2 py-1 outline-none font-bold"
							>
								{COLOR_GRADE_PRESETS.map((lut) => (
									<option key={lut.id} value={lut.id}>
										LUT: {lut.name}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>

				{/* RIGHT: Storyboard & Script Breakdown Panel */}
				<div className="flex flex-col gap-2 rounded-2xl bg-[#14141a] border border-border/80 p-3.5 min-h-0 overflow-hidden">
					<div className="flex items-center justify-between pb-1 border-b border-border/50">
						<div className="flex items-center gap-2">
							<Clapperboard className="h-4 w-4 text-primary" />
							<span className="text-xs font-bold text-foreground">
								Storyboard & Guion del Director ({scenes.length} Escenas)
							</span>
						</div>
						<span className="text-[10px] text-muted-foreground font-medium">
							Haz clic en cualquier escena para editarla o regenerarla con IA
						</span>
					</div>

					{/* Scrollable Scene Cards List */}
					<div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2.5 pr-1">
						{scenes.map((scene) => {
							const isActive = activeScene.id === scene.id;
							return (
								<div
									key={scene.id}
									className={`flex gap-3 p-2.5 rounded-xl border text-left transition-all ${
										isActive
											? 'border-primary bg-primary/10 shadow-md shadow-primary/10 ring-1 ring-primary/40'
											: 'border-border bg-[#181820] hover:border-border/80'
									}`}
								>
									{/* Scene Thumbnail Frame */}
									<div className="relative aspect-video w-28 rounded-lg overflow-hidden bg-black flex-none shadow-md">
										<img
											src={scene.imageUrl}
											alt=""
											className="h-full w-full object-cover"
										/>
										<span className="absolute top-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-mono font-bold text-primary">
											#{scene.sceneNumber}
										</span>
										<span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[8px] font-mono text-white">
											{scene.duration}s
										</span>
									</div>

									{/* Scene Details */}
									<div className="flex-1 min-w-0 flex flex-col justify-between">
										<div>
											<div className="flex items-center justify-between gap-1">
												<h4 className="text-xs font-bold truncate text-foreground">
													{scene.title}
												</h4>
												<span className="text-[9px] font-semibold text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20">
													{scene.shotType}
												</span>
											</div>

											{scene.scriptDialogue && (
												<p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 italic">
													{scene.scriptDialogue}
												</p>
											)}
										</div>

										<div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 mt-1">
											<span className="text-[9px] text-muted-foreground font-mono">
												{formatTime(scene.startTime)} - {formatTime(scene.endTime)}
											</span>

											<button
												type="button"
												onClick={() => openSceneEditor(scene)}
												className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline cursor-pointer"
											>
												<Sparkles className="h-3 w-3" />
												<span>Editar con IA</span>
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* Bottom Workspace: Multitrack Timeline (Filmora Style) */}
			<div className="h-60 border-t border-border/80 bg-[#121217] flex flex-col min-h-0 flex-none p-3">
				{/* Timeline Header Strip with Compás Grid Toggle & Live Bar.Beat Readout */}
				<div className="flex items-center justify-between gap-2 pb-1.5 text-[10px]">
					<div className="flex items-center gap-2 font-mono tabular-nums">
						<span className="font-bold text-primary">{formatTime(currentTime)}</span>
						{playheadBarBeat && (
							<span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-bold text-amber-300 border border-amber-400/30">
								Compás {playheadBarBeat.bar} · Tiempo {playheadBarBeat.beat}
							</span>
						)}
						{beatAnalysis && (
							<span className="text-muted-foreground">
								{Math.round(beatAnalysis.estimatedBpm)} BPM · {beatAnalysis.barTimes.length} compases
							</span>
						)}
					</div>
					<button
						type="button"
						onClick={() => setShowBeatGrid((v) => !v)}
						className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold transition-colors ${
							showBeatGrid
								? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
								: 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
						}`}
					>
						<Grid3x3 className="h-3 w-3" />
						<span>{showBeatGrid ? 'Rejilla Compases ON' : 'Rejilla Compases OFF'}</span>
					</button>
				</div>

				{/* Timeline Timecode & Compás Ruler (aligned with w-20 track headers) */}
				<div className="flex h-7 bg-[#0e0e13] rounded-t-lg border border-border/60 overflow-hidden">
					<div className="w-20 flex-none border-r border-border/50 px-2 flex items-center justify-between text-[9px] font-mono text-amber-300/90 font-bold">
						<span>COMPÁS</span>
						<span className="text-[8px] opacity-70">4/4</span>
					</div>
					<div
						onClick={handleTimelineClick}
						className="relative flex-1 cursor-pointer overflow-hidden flex items-center"
					>
						{/* Peak / Chorus Band */}
						{showBeatGrid &&
							beatAnalysis &&
							beatAnalysis.peakHookEnd > beatAnalysis.peakHookStart && (
								<div
									style={{
										left: `${(beatAnalysis.peakHookStart / totalDuration) * 100}%`,
										width: `${((beatAnalysis.peakHookEnd - beatAnalysis.peakHookStart) / totalDuration) * 100}%`,
									}}
									title={`Coro / Pico (${formatTime(beatAnalysis.peakHookStart)}–${formatTime(beatAnalysis.peakHookEnd)})`}
									className="pointer-events-none absolute top-0 h-1 bg-cyan-400/75"
								/>
							)}

						{/* Timecode marks */}
						{Array.from({ length: Math.ceil(totalDuration / 10) + 1 }).map((_, i) => {
							const markSeconds = i * 10;
							const leftPercent = (markSeconds / totalDuration) * 100;
							if (leftPercent > 100) return null;
							return (
								<div
									key={i}
									style={{ left: `${leftPercent}%` }}
									className="absolute top-0 bottom-0 flex flex-col justify-start pl-1 border-l border-white/15 text-[8px] font-mono text-muted-foreground pointer-events-none"
								>
									<span>{formatTime(markSeconds)}</span>
								</div>
							);
						})}

						{/* Detected Compás Downbeat Markers (clickable to seek to exact compás) */}
						{showBeatGrid &&
							beatAnalysis?.barTimes.map((barT, idx) => {
								const leftPercent = (barT / totalDuration) * 100;
								if (leftPercent > 100) return null;
								const labelEvery = beatAnalysis.barTimes.length > 32 ? 4 : beatAnalysis.barTimes.length > 16 ? 2 : 1;
								return (
									<button
										key={`cbar-${idx}`}
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											setCurrentTime(barT);
											if (audioRef.current) audioRef.current.currentTime = barT;
										}}
										title={`Compás ${idx + 1} (${formatTime(barT)})`}
										style={{ left: `${leftPercent}%` }}
										className="absolute bottom-0 h-3.5 border-l border-amber-400/75 pl-0.5 text-[8px] font-mono font-bold text-amber-300 hover:text-amber-200 leading-none flex items-end pb-0.5"
									>
										{idx % labelEvery === 0 ? `C${idx + 1}` : ''}
									</button>
								);
							})}

						{/* Vocal Entry Marker */}
						{showBeatGrid &&
							beatAnalysis &&
							beatAnalysis.vocalEntryTime > 0.3 &&
							beatAnalysis.vocalEntryTime < totalDuration && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										setCurrentTime(beatAnalysis.vocalEntryTime);
										if (audioRef.current) audioRef.current.currentTime = beatAnalysis.vocalEntryTime;
									}}
									title={`Entrada vocal (${formatTime(beatAnalysis.vocalEntryTime)})`}
									style={{ left: `${(beatAnalysis.vocalEntryTime / totalDuration) * 100}%` }}
									className="absolute top-0 bottom-0 z-20 border-l-2 border-emerald-400 bg-emerald-500/20 px-1 text-[8px] font-black text-emerald-300 flex items-center"
								>
									VOZ
								</button>
							)}

						{/* Playhead Indicator in Ruler */}
						<div
							style={{ left: `${(currentTime / totalDuration) * 100}%` }}
							className="absolute top-0 bottom-0 w-0.5 bg-primary z-40 pointer-events-none"
						>
							<div className="w-3 h-3 bg-primary rounded-full -translate-x-[5px] -translate-y-1 shadow-md shadow-primary/60" />
						</div>
					</div>
				</div>

				{/* Multitrack Channels Workspace */}
				<div
					className="relative flex-1 bg-[#101015] rounded-b-lg border-x border-b border-border/60 overflow-y-auto no-scrollbar flex flex-col p-1 gap-1"
				>
					{tracks.map((track) => (
						<div key={track.id} className="relative flex items-center h-8 rounded bg-[#171720] border border-border/50">
							{/* Track Header Label */}
							<div className="w-20 flex-none px-2 text-[10px] font-bold text-muted-foreground border-r border-border/50 flex items-center justify-between">
								<span>{track.channelLabel}</span>
								<span className="text-[8px] opacity-75">{track.type}</span>
							</div>

							{/* Clips & Visual Compás Grid in this track */}
							<div
								onClick={handleTimelineClick}
								className="relative flex-1 h-full overflow-hidden cursor-pointer"
							>
								{/* Vertical Compás Gridlines */}
								{showBeatGrid &&
									beatAnalysis?.barTimes.map((barT, idx) => {
										const leftPercent = (barT / totalDuration) * 100;
										if (leftPercent > 100) return null;
										return (
											<div
												key={`tbar-${idx}`}
												style={{ left: `${leftPercent}%` }}
												className="pointer-events-none absolute top-0 bottom-0 border-l border-amber-400/25 z-[1]"
											/>
										);
									})}

								{/* Vocal Entry Guide */}
								{showBeatGrid &&
									beatAnalysis &&
									beatAnalysis.vocalEntryTime > 0.3 &&
									beatAnalysis.vocalEntryTime < totalDuration && (
										<div
											style={{ left: `${(beatAnalysis.vocalEntryTime / totalDuration) * 100}%` }}
											className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-emerald-400/50 z-[1]"
										/>
									)}

								{/* Playhead Line inside clips lane */}
								<div
									style={{ left: `${(currentTime / totalDuration) * 100}%` }}
									className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none"
								/>

								{track.clips.map((clip) => {
									const leftPercent = (clip.startTime / totalDuration) * 100;
									const widthPercent = (clip.duration / totalDuration) * 100;

									return (
										<div
											key={clip.id}
											style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
											onClick={(e) => {
												e.stopPropagation();
												setSelectedClipId(clip.id);
											}}
											className={`absolute top-0.5 bottom-0.5 z-[2] rounded px-2 flex items-center justify-between text-[10px] font-semibold text-white shadow-sm overflow-hidden border border-white/10 ${
												track.type === 'video'
													? 'bg-gradient-to-r from-blue-700 to-cyan-600'
													: 'bg-gradient-to-r from-emerald-700 to-teal-600'
											}`}
										>
											<span className="truncate">{clip.title}</span>
											<span className="text-[8px] font-mono opacity-80 flex-none ml-1">
												{clip.duration.toFixed(1)}s
											</span>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* MODAL 1: RE-CREATE SCENE WITH AI */}
			{editingScene && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
					<div className="flex flex-col gap-4 w-full max-w-xl rounded-2xl bg-surface p-5 border border-border shadow-2xl">
						<div className="flex items-center justify-between border-b border-border pb-3">
							<div className="flex items-center gap-2">
								<Sparkles className="h-4 w-4 text-primary" />
								<h3 className="text-sm font-bold text-foreground">
									Recrear Escena #{editingScene.sceneNumber} con Director IA
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setEditingScene(null)}
								className="text-muted-foreground hover:text-foreground p-1"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="flex gap-3">
							<img
								src={editingScene.imageUrl}
								alt=""
								className="h-24 w-36 rounded-lg object-cover border border-border"
							/>
							<div className="flex-1 min-w-0">
								<h4 className="text-xs font-bold text-foreground">{editingScene.title}</h4>
								<p className="text-[11px] text-cyan-400 mt-1">{editingScene.shotType} · {editingScene.cameraMotion}</p>
								<p className="text-[10px] text-muted-foreground mt-1">Duración: {editingScene.duration}s</p>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="custom-prompt-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Instrucción Visual de la Escena (Prompt)
							</label>
							<textarea
								id="custom-prompt-input"
								value={customPrompt}
								onChange={(e) => setCustomPrompt(e.target.value)}
								rows={3}
								className={`${inputClass} text-xs leading-relaxed`}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="custom-script-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Guion / Acción Dramática de la Escena
							</label>
							<input
								id="custom-script-input"
								type="text"
								value={customScript}
								onChange={(e) => setCustomScript(e.target.value)}
								className={`${inputClass} text-xs`}
							/>
						</div>

						{sceneError && (
							<p className="rounded-lg bg-destructive/15 border border-destructive/30 px-3 py-2 text-xs text-destructive">
								{sceneError}
							</p>
						)}

						<div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
							<button
								type="button"
								onClick={() => setEditingScene(null)}
								className="px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-bold text-muted-foreground hover:text-foreground"
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={() => void handleRegenerateScene()}
								disabled={regeneratingScene || !customPrompt.trim()}
								className={`${primaryButton} cursor-pointer px-4`}
							>
								{regeneratingScene ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Wand2 className="h-4 w-4" />
								)}
								<span>Recrear Escena con IA</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL 2: RENDER & HIGH QUALITY EXPORT */}
			{showExportModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
					<div className="flex flex-col gap-4 w-full max-w-lg rounded-2xl bg-surface p-6 border border-border shadow-2xl">
						<div className="flex items-center justify-between border-b border-border pb-3">
							<div className="flex items-center gap-2">
								<Film className="h-5 w-5 text-cyan-400" />
								<h3 className="text-sm font-bold text-foreground">
									Renderizar & Descargar Video Final
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setShowExportModal(false)}
								className="text-muted-foreground hover:text-foreground p-1"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<p className="text-xs text-muted-foreground">
							Ensambla el storyboard visual, sincronización rítmica con el audio, corrección de color y efectos de cine en un archivo de alta fidelidad.
						</p>

						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setExportResolution('1080p')}
								className={`p-3 rounded-xl border text-left transition-all ${
									exportResolution === '1080p'
										? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								<span className="font-bold text-xs block">Full HD 1080p</span>
								<span className="text-[10px] opacity-75 block">Ideal para redes y distribución web</span>
							</button>

							<button
								type="button"
								onClick={() => setExportResolution('4k')}
								className={`p-3 rounded-xl border text-left transition-all ${
									exportResolution === '4k'
										? 'border-primary bg-primary/20 text-primary'
										: 'border-border bg-surface-2 text-muted-foreground'
								}`}
							>
								<span className="font-bold text-xs block">Ultra HD 4K Cinema</span>
								<span className="text-[10px] opacity-75 block">Máxima definición master de cine</span>
							</button>
						</div>

						{isRendering && (
							<div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-2 border border-border">
								<div className="flex items-center justify-between text-xs">
									<span className="font-bold text-foreground">Codificando video real con escenas y audio...</span>
									<span className="font-mono text-cyan-400">{renderProgress}%</span>
								</div>
								<div className="h-2 w-full bg-surface-3 rounded-full overflow-hidden">
									<div
										style={{ width: `${renderProgress}%` }}
										className="h-full bg-cyan-500 transition-all duration-100"
									/>
								</div>
							</div>
						)}

						{renderError && (
							<p className="rounded-lg bg-destructive/15 border border-destructive/30 px-3 py-2 text-xs text-destructive">
								{renderError}
							</p>
						)}

						{renderedVideoUrl && (
							<div className="flex flex-col gap-3 p-3 rounded-xl bg-surface-2 border border-primary/30">
								<video
									src={renderedVideoUrl}
									controls
									playsInline
									className="aspect-video w-full rounded-lg bg-black object-contain"
								/>
								<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
									<span className="font-bold text-primary">¡Video real listo!</span>
									<div className="flex items-center gap-2">
										{userId && !savedToWorkspace && (
											<button
												type="button"
												disabled={savingToWorkspace}
												onClick={() => void handleSaveRenderedToWorkspace()}
												className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 font-bold hover:bg-cyan-500 hover:text-black transition-colors disabled:opacity-50"
											>
												{savingToWorkspace ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
												<span>Guardar en Workspace</span>
											</button>
										)}
										{savedToWorkspace && (
											<span className="text-[11px] font-bold text-emerald-400">Guardado en Videos</span>
										)}
										<a
											href={renderedVideoUrl}
											download={`${(song.title || 'Qamuz_Video').replace(/\s+/g, '_')}.${renderedExt}`}
											className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-black font-bold"
										>
											<Download className="h-3.5 w-3.5" />
											<span>Descargar .{renderedExt}</span>
										</a>
									</div>
								</div>
							</div>
						)}

						<div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
							<button
								type="button"
								onClick={() => setShowExportModal(false)}
								className="px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-bold text-muted-foreground hover:text-foreground"
							>
								Cerrar
							</button>
							<button
								type="button"
								onClick={() => void handleStartRender()}
								disabled={isRendering}
								className={`${primaryButton} cursor-pointer px-5`}
							>
								{isRendering ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Film className="h-4 w-4" />
								)}
								<span>{renderedVideoUrl ? 'Volver a Renderizar' : 'Comenzar Renderizado'}</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL 3: YOUTUBE REAL SEO & STUDIO PREPARATION */}
			{showYouTubeModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
					<div className="flex flex-col gap-4 w-full max-w-lg rounded-2xl bg-surface p-6 border border-border shadow-2xl">
						<div className="flex items-center justify-between border-b border-border pb-3">
							<div className="flex items-center gap-2">
								<Youtube className="h-5 w-5 text-red-500" />
								<h3 className="text-sm font-bold text-foreground">
									Preparar Lanzamiento en YouTube
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setShowYouTubeModal(false)}
								className="text-muted-foreground hover:text-foreground p-1"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						{!renderedVideoUrl ? (
							<div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs">
								<p className="font-bold text-amber-200">
									Renderiza tu video primero para descargarlo antes de subirlo a YouTube Studio.
								</p>
								<button
									type="button"
									onClick={() => {
										setShowYouTubeModal(false);
										setShowExportModal(true);
									}}
									className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-bold text-black"
								>
									<Film className="h-3.5 w-3.5" />
									<span>Ir a Renderizar Video Real</span>
								</button>
							</div>
						) : (
							<div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs">
								<span className="font-bold text-emerald-300">
									Master listo (.{renderedExt})
								</span>
								<a
									href={renderedVideoUrl}
									download={`${(song.title || 'Qamuz_Video').replace(/\s+/g, '_')}.${renderedExt}`}
									className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-black font-bold"
								>
									<Download className="h-3.5 w-3.5" />
									<span>Descargar</span>
								</a>
							</div>
						)}

						<div className="flex items-center justify-between">
							<span className="text-xs font-bold text-muted-foreground">Metadata SEO</span>
							<button
								type="button"
								disabled={ytOptimizing}
								onClick={() => void handleOptimizeYoutubeSeo()}
								className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-black disabled:opacity-50"
							>
								{ytOptimizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
								<span>{ytOptimizing ? 'Pensando SEO...' : 'Optimizar con IA'}</span>
							</button>
						</div>

						<div className="flex flex-col gap-3">
							<div className="flex flex-col gap-1">
								<label htmlFor="yt-title-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
									Título en YouTube
								</label>
								<input
									id="yt-title-input"
									type="text"
									value={ytTitle}
									onChange={(e) => setYtTitle(e.target.value)}
									className={`${inputClass} text-xs font-semibold`}
								/>
							</div>

							<div className="flex flex-col gap-1">
								<label htmlFor="yt-desc-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
									Descripción & Créditos
								</label>
								<textarea
									id="yt-desc-input"
									value={ytDescription}
									onChange={(e) => setYtDescription(e.target.value)}
									rows={3}
									className={`${inputClass} text-xs resize-none`}
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="flex flex-col gap-1">
									<label htmlFor="yt-tags-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
										Etiquetas
									</label>
									<input
										id="yt-tags-input"
										type="text"
										value={ytTags}
										onChange={(e) => setYtTags(e.target.value)}
										className={`${inputClass} text-xs`}
									/>
								</div>

								<div className="flex flex-col gap-1">
									<label htmlFor="yt-privacy-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
										Privacidad sugerida
									</label>
									<select
										id="yt-privacy-select"
										value={ytPrivacy}
										onChange={(e) => setYtPrivacy(e.target.value as 'public' | 'unlisted' | 'private')}
										className={`${inputClass} text-xs font-semibold`}
									>
										<option value="public">Público (Para todos)</option>
										<option value="unlisted">Oculto (Solo con enlace)</option>
										<option value="private">Privado (Solo tú)</option>
									</select>
								</div>
							</div>
						</div>

						{ytSeoError && (
							<p className="rounded-lg bg-destructive/15 border border-destructive/30 px-3 py-2 text-xs text-destructive">
								{ytSeoError}
							</p>
						)}

						<div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
							<button
								type="button"
								onClick={async () => {
									const bundle = `Título: ${ytTitle}\nVisibilidad: ${ytPrivacy}\n\nDescripción:\n${ytDescription}\n\nEtiquetas:\n${ytTags}`;
									await navigator.clipboard.writeText(bundle).catch(() => undefined);
									setYtCopied(true);
								}}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-bold text-foreground hover:text-primary"
							>
								{ytCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
								<span>{ytCopied ? 'Copiado' : 'Copiar Metadata SEO'}</span>
							</button>

							<a
								href="https://studio.youtube.com"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all"
							>
								<ExternalLink className="h-4 w-4" />
								<span>Abrir YouTube Studio</span>
							</a>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
