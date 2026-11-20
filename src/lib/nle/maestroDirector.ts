import { analyzeAudioTrack, type AudioAnalysisResult } from '@/lib/nle/audioAnalyzer';
import { getAuthHeaders } from '@/lib/safeUrl';
import type { StudioSong } from '@/lib/studio';

export type MaestroFormat = 'music-video' | 'short-film' | 'mini-series' | 'commercial-promo';

export type MaestroSceneStatus =
	| 'scripted'
	| 'generating_image'
	| 'image_ready'
	| 'generating_video'
	| 'video_ready'
	| 'error';

export interface MaestroScene {
	id: string;
	sceneNumber: number;
	title: string;
	sectionTag: string;
	startTime: number;
	endTime: number;
	duration: number;
	shotType: string;
	cameraMotion: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'none';
	spokenCue: string;
	narrativeAction: string;
	visualPrompt: string;
	videoMotionPrompt: string;
	imageUrl: string;
	videoUrl: string | null;
	status: MaestroSceneStatus;
	errorMessage?: string;
}

export interface MaestroPlan {
	title: string;
	format: MaestroFormat;
	style: string;
	character: string;
	storySummary: string;
	visualBible: string;
	directorThought: string;
	detectedMood: string;
	audioUrl: string;
	analysis: AudioAnalysisResult;
	scenes: MaestroScene[];
}

async function localBlobToBase64(url: string): Promise<{ base64: string; mime: string } | null> {
	if (!url.startsWith('blob:')) return null;
	try {
		const res = await fetch(url);
		const blob = await res.blob();
		if (blob.size === 0 || blob.size > 16 * 1024 * 1024) return null;
		const buffer = await blob.arrayBuffer();
		const bytes = new Uint8Array(buffer);
		let bin = '';
		for (let i = 0; i < bytes.length; i += 0x8000) {
			bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		}
		return {
			base64: btoa(bin),
			mime: blob.type || 'audio/mpeg',
		};
	} catch {
		return null;
	}
}

export interface MagicEnhanceOptions {
	mode?: 'enhance-prompt' | 'cover-prompt' | 'video-prompt';
	style?: string;
	character?: string;
	format?: MaestroFormat;
	songTitle?: string;
	sceneContext?: string;
	provider?: 'auto' | 'modal' | 'gemini';
	previousVideos?: string[];
	visualBible?: string;
	previousScenePrompt?: string;
	nextScenePrompt?: string;
	cameraMotion?: string;
	hasStartImage?: boolean;
}

export interface MagicEnhanceResult {
	prompt: string;
	recommendedMotion?: number;
	continuityNote?: string;
}

export async function magicEnhancePromptDetailed(
	rawText: string,
	options: MagicEnhanceOptions = {}
): Promise<MagicEnhanceResult> {
	const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
	const res = await fetch('/api/ai/magic-wand', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			mode: options.mode || 'enhance-prompt',
			text: rawText,
			style: options.style || 'Cinematic',
			character: options.character || 'Protagonist',
			format: options.format || 'music-video',
			songTitle: options.songTitle || '',
			sceneContext: options.sceneContext || '',
			provider: options.provider || 'auto',
			previousVideos: options.previousVideos ?? [],
			visualBible: options.visualBible || '',
			previousScenePrompt: options.previousScenePrompt || '',
			nextScenePrompt: options.nextScenePrompt || '',
			cameraMotion: options.cameraMotion || '',
			hasStartImage: Boolean(options.hasStartImage),
		}),
	});
	const data = (await res.json().catch(() => ({}))) as {
		result?: string;
		recommendedMotion?: number;
		continuityNote?: string;
		error?: string;
	};
	if (!res.ok || !data.result) {
		throw new Error(data.error || 'No se pudo conectar con el Prompter IA.');
	}
	return {
		prompt: data.result.slice(0, 920),
		recommendedMotion:
			typeof data.recommendedMotion === 'number' && Number.isFinite(data.recommendedMotion)
				? data.recommendedMotion
				: undefined,
		continuityNote: typeof data.continuityNote === 'string' ? data.continuityNote : undefined,
	};
}

export async function magicEnhancePrompt(
	rawText: string,
	options: MagicEnhanceOptions = {}
): Promise<string> {
	const detailed = await magicEnhancePromptDetailed(rawText, options);
	return detailed.prompt;
}

export async function magicExpandStoryIdea(
	idea: string,
	songTitle: string,
	format: MaestroFormat,
	options: { style?: string; character?: string; lyrics?: string } = {}
): Promise<string> {
	const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
	const res = await fetch('/api/ai/magic-wand', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			mode: 'expand-story',
			text: idea,
			songTitle,
			format,
			style: options.style || 'Cinematic',
			character: options.character || 'Protagonist',
			lyrics: options.lyrics || '',
		}),
	});
	const data = (await res.json().catch(() => ({}))) as { result?: string; error?: string };
	if (!res.ok || !data.result) {
		throw new Error(data.error || 'No se pudo generar la propuesta narrativa con IA.');
	}
	return data.result;
}

export async function generateYoutubeSeo(payload: {
	songTitle: string;
	style: string;
	sceneContext: string;
}): Promise<{ title: string; description: string; tags: string }> {
	const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
	const res = await fetch('/api/ai/magic-wand', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			mode: 'youtube-seo',
			songTitle: payload.songTitle,
			style: payload.style,
			sceneContext: payload.sceneContext,
		}),
	});
	const data = (await res.json().catch(() => ({}))) as {
		result?: { title: string; description: string; tags: string };
		error?: string;
	};
	if (!res.ok || !data.result) {
		throw new Error(data.error || 'No se pudo generar metadata SEO con IA.');
	}
	return data.result;
}

export async function transcribeAndSyncLyrics(payload: {
	audioUrl: string;
	duration: number;
	lyrics?: string | null;
	songTitle?: string;
}): Promise<{
	vocalEntryTime: number;
	cues: { startTime: number; endTime: number; text: string; isSlogan: boolean }[];
}> {
	const blobAudio = await localBlobToBase64(payload.audioUrl);
	const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
	const res = await fetch('/api/ai/transcribe-sync', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			audioUrl: payload.audioUrl.startsWith('http') ? payload.audioUrl : '',
			audioBase64: blobAudio?.base64 || '',
			audioMime: blobAudio?.mime || 'audio/mpeg',
			duration: payload.duration,
			lyrics: payload.lyrics || '',
			songTitle: payload.songTitle || '',
		}),
	});
	const data = (await res.json().catch(() => ({}))) as {
		vocalEntryTime?: number;
		cues?: { startTime: number; endTime: number; text: string; isSlogan: boolean }[];
		error?: string;
	};
	if (!res.ok || !data.cues) {
		throw new Error(data.error || 'No se pudo transcribir y sincronizar el audio.');
	}
	return {
		vocalEntryTime: data.vocalEntryTime ?? 2,
		cues: data.cues,
	};
}

export async function buildMaestroDirectorPlan({
	song,
	audioUrl,
	audioTitle,
	durationHint,
	lyrics,
	format,
	style,
	character,
	storyIdea,
	onStage,
	onThought,
}: {
	song?: StudioSong | null;
	audioUrl: string;
	audioTitle: string;
	durationHint: number;
	lyrics?: string | null;
	format: MaestroFormat;
	style: string;
	character: string;
	storyIdea?: string;
	onStage?: (stage: string, message: string) => void;
	onThought?: (fullThought: string) => void;
}): Promise<MaestroPlan> {
	const effectiveUrl = song?.audioUrl ?? audioUrl;
	const effectiveLyrics = lyrics ?? song?.lyrics ?? null;
	const effectiveTitle = audioTitle || song?.title || 'Producción Maestro IA';

	onStage?.('analyzing', 'Midiendo energía acústica y espectro del audio en el navegador...');
	const analysis = await analyzeAudioTrack(
		effectiveUrl,
		song?.duration || durationHint || 45,
		effectiveLyrics
	);

	const energySummary = analysis.segments
		.map((s) => `${s.startTime}s-${s.endTime}s: ${Math.round(s.energy * 100)}% energía`)
		.join(' | ');

	const blobAudio = effectiveUrl ? await localBlobToBase64(effectiveUrl) : null;

	const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
	const response = await fetch('/api/ai/director-plan', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			audioUrl: effectiveUrl.startsWith('http') ? effectiveUrl : '',
			audioBase64: blobAudio?.base64 || '',
			audioMime: blobAudio?.mime || 'audio/mpeg',
			audioTitle: effectiveTitle,
			duration: analysis.duration,
			bpm: analysis.estimatedBpm,
			vocalEntryHint: analysis.vocalEntryTime,
			peakHookStart: analysis.peakHookStart,
			peakHookEnd: analysis.peakHookEnd,
			energySummary,
			lyrics: effectiveLyrics || '',
			format,
			style,
			character,
			storyIdea: storyIdea || '',
		}),
	});

	if (!response.ok || !response.body) {
		const errPayload = (await response.json().catch(() => ({}))) as { error?: string };
		throw new Error(errPayload.error || 'No se pudo iniciar el Maestro Director IA.');
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let thoughtText = '';
	let completedPayload: {
		directorThought?: string;
		directorSummary?: string;
		visualBible?: string;
		detectedMood?: string;
		detectedBpm?: number;
		detectedVocalEntryTime?: number;
		detectedLyrics?: { time: number; text: string; isSlogan: boolean }[];
		scenes?: MaestroScene[];
	} | null = null;
	let streamError: string | null = null;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		const blocks = buffer.split('\n\n');
		buffer = blocks.pop() ?? '';

		for (const block of blocks) {
			const lines = block.split('\n');
			let eventName = 'message';
			let dataStr = '';
			for (const line of lines) {
				if (line.startsWith('event:')) eventName = line.slice(6).trim();
				else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
			}
			if (!dataStr) continue;

			const payload = JSON.parse(dataStr) as Record<string, unknown>;
			if (eventName === 'stage') {
				onStage?.(String(payload.stage || ''), String(payload.message || ''));
			} else if (eventName === 'thought') {
				thoughtText += String(payload.delta || '');
				onThought?.(thoughtText);
			} else if (eventName === 'error') {
				streamError = String(payload.error || 'Error en el flujo del Maestro Director IA.');
			} else if (eventName === 'complete') {
				completedPayload = payload as typeof completedPayload;
			}
		}
	}

	if (streamError) {
		throw new Error(streamError);
	}
	if (!completedPayload || !Array.isArray(completedPayload.scenes) || completedPayload.scenes.length === 0) {
		throw new Error('El Maestro Director IA no devolvió escenas completas.');
	}

	const mergedAnalysis: AudioAnalysisResult = {
		...analysis,
		estimatedBpm: completedPayload.detectedBpm ?? analysis.estimatedBpm,
		vocalEntryTime: completedPayload.detectedVocalEntryTime ?? analysis.vocalEntryTime,
		detectedLyrics:
			completedPayload.detectedLyrics && completedPayload.detectedLyrics.length > 0
				? completedPayload.detectedLyrics
				: analysis.detectedLyrics,
	};

	return {
		title: effectiveTitle,
		format,
		style,
		character,
		storySummary: completedPayload.directorSummary || '',
		visualBible: completedPayload.visualBible || '',
		directorThought: completedPayload.directorThought || thoughtText,
		detectedMood: completedPayload.detectedMood || '',
		audioUrl: effectiveUrl,
		analysis: mergedAnalysis,
		scenes: completedPayload.scenes,
	};
}
