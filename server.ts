/* global process, Buffer */
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const MAX_AUDIO_BYTES = 18 * 1024 * 1024;

function resolveSecret(candidates: readonly string[]): string {
	for (const name of candidates) {
		const val = (process.env[name] || '')
			.trim()
			.replace(/^["']|["']$/g, '')
			.replace(/^Bearer\s+/i, '')
			.trim();
		if (!val) continue;
		if (/^(MY|YOUR)_.*(API_KEY|TOKEN)$/i.test(val) || val === 'PLACEHOLDER') continue;
		return val;
	}
	return '';
}

function resolveGeminiKey(): string {
	return resolveSecret([
		'GEMINI_API_KEY',
		'GOOGLE_API_KEY',
		'GOOGLE_GENERATIVE_AI_API_KEY',
		'API_KEY',
		'NEXT_PUBLIC_GEMINI_API_KEY',
	]);
}

function resolveSecretWithSource(candidates: readonly string[]): { value: string; source: string | null } {
	for (const name of candidates) {
		const val = (process.env[name] || '')
			.trim()
			.replace(/^["']|["']$/g, '')
			.replace(/^Bearer\s+/i, '')
			.trim();
		if (!val) continue;
		if (/^(MY|YOUR)_.*(API_KEY|TOKEN)$/i.test(val) || val === 'PLACEHOLDER') continue;
		return { value: val, source: name };
	}
	return { value: '', source: null };
}

function resolveModalVisionTokenInfo(): { value: string; source: string | null } {
	return resolveSecretWithSource([
		'QAMUZ_SERVICE_TOKEN',
		'MODAL_SERVICE_TOKEN',
		'MODAL_VISION_TOKEN',
		'MODAL_TOKEN',
		'MODAL_API_TOKEN',
	]);
}

function resolveModalVisionToken(): string {
	return resolveModalVisionTokenInfo().value;
}

function resolveModalVllmToken(): string {
	return resolveSecret([
		'MODAL_VLLM_TOKEN',
		'VLLM_TOKEN',
		'MODAL_LLM_TOKEN',
		'QAMUZ_SERVICE_TOKEN',
		'MODAL_TOKEN',
		'MODAL_API_TOKEN',
	]);
}

function resolveModalVisionUrl(): string {
	const raw = (process.env.MODAL_VISION_URL || '').trim().replace(/\/+$/, '');
	return /^https?:\/\//i.test(raw) ? raw : 'https://qamuzstudio--qamuz-vision-api.modal.run';
}

function resolveModalVllmUrl(): string {
	const raw = (process.env.MODAL_VLLM_URL || '').trim().replace(/\/+$/, '');
	return /^https?:\/\//i.test(raw)
		? raw
		: 'https://qamuzstudio--qamuz-vllm-engine-fastapi-app.modal.run';
}

function createGeminiClient(): GoogleGenAI {
	const rawKey = resolveGeminiKey();
	if (!rawKey) {
		throw new Error(
			'La variable GEMINI_API_KEY sigue teniendo el valor de ejemplo ("MY_GEMINI_API_KEY") o está vacía en el servidor de AI Studio. Abre Settings > Secrets en AI Studio, reemplaza MY_GEMINI_API_KEY por tu clave real de Google Gemini (AIza...) y guarda los cambios.'
		);
	}
	return new GoogleGenAI({
		apiKey: rawKey,
		httpOptions: {
			headers: {
				'User-Agent': 'aistudio-build',
			},
		},
	});
}

let cachedVllmModel: { id: string; fetchedAt: number } | null = null;

async function detectModalVllmModel(vllmUrl: string, token: string): Promise<string> {
	const explicit = (process.env.MODAL_VLLM_MODEL || '').trim();
	if (explicit) return explicit;
	if (cachedVllmModel && Date.now() - cachedVllmModel.fetchedAt < 60_000) {
		return cachedVllmModel.id;
	}
	try {
		const res = await fetch(`${vllmUrl}/v1/models`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(5000),
		});
		if (res.ok) {
			const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }[] };
			const firstId = data?.data?.[0]?.id;
			if (typeof firstId === 'string' && firstId.trim()) {
				cachedVllmModel = { id: firstId.trim(), fetchedAt: Date.now() };
				return cachedVllmModel.id;
			}
		}
	} catch {
		// fall back to default model alias
	}
	return 'qamuz-chat';
}

async function callModalVllmChat(options: {
	system: string;
	user: string;
	temperature?: number;
	maxTokens?: number;
	jsonMode?: boolean;
}): Promise<{ content: string; model: string }> {
	const token = resolveModalVllmToken();
	if (!token) {
		throw new Error('MODAL_VLLM_TOKEN no está configurado en Secrets.');
	}
	const vllmUrl = resolveModalVllmUrl();
	const model = await detectModalVllmModel(vllmUrl, token);

	const payload: Record<string, unknown> = {
		model,
		temperature: options.temperature ?? 0.72,
		max_tokens: options.maxTokens ?? 1400,
		messages: [
			{ role: 'system', content: options.system },
			{ role: 'user', content: options.user },
		],
	};
	if (options.jsonMode) {
		payload.response_format = { type: 'json_object' };
	}

	let res = await fetch(`${vllmUrl}/v1/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(90_000),
	});

	// Retry once without response_format if the vLLM server rejects json_object parameter
	if (!res.ok && options.jsonMode && res.status === 400) {
		delete payload.response_format;
		res = await fetch(`${vllmUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(90_000),
		});
	}

	if (!res.ok) {
		const errText = (await res.text().catch(() => '')).slice(0, 300);
		throw new Error(`Modal LLM respondió HTTP ${res.status}: ${errText || 'error desconocido'}`);
	}

	const data = (await res.json().catch(() => ({}))) as {
		choices?: { message?: { content?: string } }[];
	};
	const content = String(data?.choices?.[0]?.message?.content ?? '').trim();
	if (!content) {
		throw new Error('El modelo LLM en Modal devolvió una respuesta vacía.');
	}
	return { content, model };
}

async function resolveImageAsDataUri(image: string): Promise<string> {
	const raw = (image || '').trim();
	if (!raw) return '';
	if (raw.startsWith('data:image/')) return raw;
	if (!/^https?:\/\//i.test(raw)) return raw;
	try {
		const res = await fetch(raw, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; QamuzStudio/1.0)',
				Accept: 'image/*,*/*;q=0.8',
			},
			signal: AbortSignal.timeout(30_000),
		});
		if (!res.ok) return '';
		const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
		if (!contentType.startsWith('image/')) return '';
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.byteLength === 0 || buf.byteLength > 10 * 1024 * 1024) return '';
		return `data:${contentType};base64,${buf.toString('base64')}`;
	} catch {
		return '';
	}
}

const SIZE_TO_ASPECT: Record<string, string> = {
	'1024x1024': '1:1',
	'1536x1024': '3:2',
	'1792x1024': '16:9',
	'1024x1536': '2:3',
	'1024x1792': '9:16',
	'1365x1024': '4:3',
	'1152x896': '4:3',
	'896x1152': '3:4',
};

function formatGeminiError(err: unknown, fallback: string): string {
	const raw = err instanceof Error ? err.message : String(err ?? '');
	let extracted = raw;
	let code: number | undefined;
	let reason = '';

	const jsonMatch = raw.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[0]) as {
				error?: {
					code?: number;
					message?: string;
					status?: string;
					details?: { reason?: string }[];
				};
			};
			if (parsed?.error) {
				code = parsed.error.code;
				extracted = parsed.error.message || parsed.error.status || raw;
				reason = parsed.error.details?.[0]?.reason || parsed.error.status || '';
			}
		} catch {
			// ignore invalid JSON wrapper
		}
	}

	if (
		reason === 'API_KEY_INVALID' ||
		/API key not valid|API_KEY_INVALID/i.test(raw) ||
		code === 403 ||
		reason === 'PERMISSION_DENIED'
	) {
		return 'La clave de Gemini (GEMINI_API_KEY) no es válida o fue rechazada por Google AI. Por favor verifica o selecciona una API key válida en Settings > Secrets.';
	}
	if (code === 429 || /RESOURCE_EXHAUSTED|quota/i.test(raw)) {
		return 'Se alcanzó el límite de cuota de Gemini (429). Espera unos segundos o revisa tu clave en Settings > Secrets.';
	}
	if (code === 404 || reason === 'NOT_FOUND') {
		return 'El modelo de Gemini no se encontró o no está habilitado para tu API key actual.';
	}
	return extracted || fallback;
}

async function resolveAudioPart(
	audioUrl?: string,
	audioBase64?: string,
	audioMime?: string
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
	if (audioBase64 && typeof audioBase64 === 'string') {
		const cleaned = audioBase64.replace(/^data:[^;]+;base64,/, '');
		if (cleaned.length > 0 && cleaned.length < MAX_AUDIO_BYTES * 1.4) {
			return {
				inlineData: {
					mimeType: audioMime || 'audio/mpeg',
					data: cleaned,
				},
			};
		}
	}

	if (audioUrl && /^https?:\/\//i.test(audioUrl)) {
		try {
			const res = await fetch(audioUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; QamuzStudio/1.0)',
					Accept: 'audio/*,*/*;q=0.8',
				},
				signal: AbortSignal.timeout(30000),
			});
			if (!res.ok) {
				console.warn(`[audio] fetch failed (${res.status}) for ${audioUrl.slice(0, 80)}`);
				return null;
			}
			const contentLength = Number(res.headers.get('content-length') || '0');
			if (contentLength > MAX_AUDIO_BYTES) {
				console.warn(`[audio] skipped oversized file (${contentLength} bytes)`);
				return null;
			}
			const buf = Buffer.from(await res.arrayBuffer());
			if (buf.byteLength === 0 || buf.byteLength > MAX_AUDIO_BYTES) return null;
			const rawType = res.headers.get('content-type')?.split(';')[0]?.trim();
			const mimeType = rawType && rawType.startsWith('audio/') ? rawType : 'audio/mpeg';
			return {
				inlineData: {
					mimeType,
					data: buf.toString('base64'),
				},
			};
		} catch (err) {
			console.warn('[audio] fetch error:', err instanceof Error ? err.message : String(err));
			return null;
		}
	}

	return null;
}

function sendSse(res: Response, event: string, data: unknown) {
	res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
	const n = Number(val);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(min, Math.min(max, n));
}

function cleanJsonString(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.startsWith('```')) {
		return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
	}
	return trimmed;
}

async function startServer() {
	const app = express();
	app.use(express.json({ limit: '26mb' }));

	// 1. REAL GEMINI + MODAL LLM STREAMING MAESTRO DIRECTOR (Audio Listening + Deep Thinking + Synchronized Script & Storyboard)
	app.post('/api/ai/director-plan', async (req: Request, res: Response) => {
		res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
		res.setHeader('Cache-Control', 'no-cache, no-transform');
		res.setHeader('Connection', 'keep-alive');
		res.flushHeaders?.();

		try {
			const hasGemini = Boolean(resolveGeminiKey());
			const hasModalLlm = Boolean(resolveModalVllmToken());
			if (!hasGemini && !hasModalLlm) {
				throw new Error(
					'Configura GEMINI_API_KEY o MODAL_VLLM_TOKEN en Settings > Secrets de AI Studio para ejecutar el Maestro Director IA.'
				);
			}
			const body = (req.body ?? {}) as Record<string, unknown>;
			const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl : '';
			const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
			const audioMime = typeof body.audioMime === 'string' ? body.audioMime : 'audio/mpeg';
			const audioTitle = String(body.audioTitle || 'Producción Audiovisual').slice(0, 120);
			const duration = clampNumber(body.duration, 12, 300, 45);
			const estimatedBpm = clampNumber(body.bpm, 60, 190, 110);
			const vocalEntryHint = clampNumber(body.vocalEntryHint, 0, duration, 3);
			const peakHookStart = clampNumber(body.peakHookStart, 0, duration, 12);
			const peakHookEnd = clampNumber(body.peakHookEnd, peakHookStart + 2, duration, Math.min(duration, 26));
			const energySummary = String(body.energySummary || '').slice(0, 800);
			const lyrics = String(body.lyrics || '').slice(0, 6000);
			const format = String(body.format || 'music-video');
			const style = String(body.style || 'Cinematic');
			const character = String(body.character || 'Mateo');
			const storyIdea = String(body.storyIdea || '').slice(0, 1500);

			sendSse(res, 'stage', {
				stage: 'listening',
				message: 'Descargando y escuchando el audio real para analizar voz, ritmo y emoción...',
			});

			const audioPart = await resolveAudioPart(audioUrl, audioBase64, audioMime);
			const targetSceneCount = duration <= 28 ? 4 : duration <= 58 ? 5 : duration <= 110 ? 6 : 8;

			sendSse(res, 'stage', {
				stage: 'thinking',
				message: audioPart
					? 'Audio real cargado en memoria. Escuchando melodía, entrada de voz y diseñando guion coherente...'
					: 'Analizando letra y telemetría acústica. Diseñando guion cinematográfico coherente...',
			});

			const formatLabel =
				format === 'mini-series'
					? 'Mini-Serie Episódica'
					: format === 'short-film'
					? 'Película / Cortometraje Cinematográfico'
					: format === 'commercial-promo'
					? 'Spot Comercial / Eslogan de Alto Impacto'
					: 'Videoclip Musical Oficial';

			const systemInstruction = [
				'Eres el Maestro Director, Guionista y Editor Jefe de Qamuz AI Studio.',
				'Debes escuchar y analizar el audio real proporcionado (ritmo, subidas de energía, entrada exacta de la voz cantante o narradora, coros, frases y eslóganes) junto con la letra y telemetría.',
				'OBJETIVO CRÍTICO DE COHERENCIA Y VARIEDAD VISUAL:',
				'Muchos modelos generan 5 imágenes casi iguales del mismo retrato. TÚ DEBES EVITARLO COMPLETAMENTE:',
				'- Primero define una Biblia Visual (visualBible): protagonista único con vestuario específico invariable, rasgos físicos concretos, paleta cromática y universo narrativo.',
				'- Luego diseña una PROGRESIÓN NARRATIVA CONTINUA en actos/escenas reales (Escena 1 origen -> Escena 2 desarrollo/cambio de locación -> Escena 3 punto de giro/actuación -> Escena 4 clímax en otro entorno/iluminación -> Escena final resolución), donde CADA escena cambie obligatoriamente de: (a) locación o sub-escenario, (b) distancia/ángulo de cámara (Plano General Amplio, Plano Medio Tracking, Primer Plano Emocional, Contrapicado Dramático, Plano Aéreo/Cenital), (c) luz y acción física concreta.',
				`Crea exactamente ${targetSceneCount} escenas continuas que cubran desde 0.0 segundos hasta ${duration.toFixed(1)} segundos sin huecos ni solapamientos.`,
				'Reglas estrictas para cada escena:',
				'1. Sincronía real al segundo: detecta el segundo exacto en que empieza la voz (detectedVocalEntryTime). Si la Escena 1 es un intro instrumental previo a detectedVocalEntryTime, su spokenCue debe estar vacío (""). Coloca en spokenCue únicamente la frase exacta cantada o el eslogan que suena dentro de ese intervalo [startTime, endTime].',
				'2. Idioma narrativo: directorSummary, visualBible, title, sectionTag, spokenCue, narrativeAction en español natural (respetando el idioma original cantado dentro de spokenCue si aplica).',
				'3. visualPrompt (MÁXIMO 750 caracteres, en inglés): LOS PRIMEROS 30 PALABRAS DEBEN describir primero el ENCUADRE ÚNICO, la LOCACIÓN DISTINTA, la ACCIÓN FÍSICA DIFERENTE y la ILUMINACIÓN ESPECÍFICA de ESA escena (ej. "Extreme wide drone shot over a rain-slicked neon suspension bridge at midnight..."), y solo DESPUÉS integra los detalles consistentes de vestuario/rasgos de visualBible y el estilo visual. PROHIBIDO empezar dos escenas con las mismas palabras o repetir la misma composición.',
				'4. videoMotionPrompt (MÁXIMO 700 caracteres, en inglés): describe el movimiento de cámara único de esa toma y la acción dinámica del personaje (incluido lip-sync expresivo cuando spokenCue no esté vacío).',
			].join('\n');

			const userPrompt = [
				`Título de la obra/audio: "${audioTitle}"`,
				`Formato solicitado: ${formatLabel}`,
				`Estilo visual: ${style}`,
				`Protagonista / Elenco: ${character}`,
				`Duración total exacta: ${duration.toFixed(1)} segundos`,
				`Telemetría Web Audio: ~${estimatedBpm} BPM, pico/hook principal entre ${peakHookStart}s y ${peakHookEnd}s, posible inicio acústico vocal cerca de ${vocalEntryHint}s.`,
				energySummary ? `Perfil de energía por tramos: ${energySummary}` : '',
				storyIdea ? `Idea / Historia / Eslogan indicado por el creador: "${storyIdea}"` : 'El creador dejó libre la dirección artística: crea una historia cinematográfica con principio, conflicto, clímax y desenlace perfectamente ligada a la canción.',
				lyrics ? `Letra o guion base proporcionado:\n${lyrics}` : 'No se entregó letra escrita: escucha el audio adjunto y transcribe las frases, versos o eslóganes clave en sus tiempos exactos.',
			]
				.filter(Boolean)
				.join('\n\n');

			const contents = audioPart ? { parts: [audioPart, { text: userPrompt }] } : userPrompt;

			const heartbeat = setInterval(() => {
				if (!res.writableEnded) res.write(': keepalive\n\n');
			}, 8000);

			let fullThought = '';
			let jsonBuffer = '';

			try {
				if (hasGemini) {
					try {
						const ai = createGeminiClient();
						const stream = await ai.models.generateContentStream({
							model: 'gemini-4-argon',
							contents,
							config: {
								systemInstruction,
								thinkingConfig: {
									thinkingLevel: ThinkingLevel.MEDIUM,
									includeThoughts: true,
								},
								responseMimeType: 'application/json',
								responseSchema: {
									type: Type.OBJECT,
									properties: {
										directorSummary: {
											type: Type.STRING,
											description: 'Resumen del arco narrativo completo y visión de dirección coherente de principio a fin.',
										},
										visualBible: {
											type: Type.STRING,
											description: 'Biblia visual fija para coherencia: descripción concreta del protagonista, vestuario exacto, paleta y estética común entre escenas.',
										},
										detectedMood: {
											type: Type.STRING,
											description: 'Atmósfera emocional detectada en el audio.',
										},
										detectedBpm: {
											type: Type.NUMBER,
											description: 'Tempo BPM estimado.',
										},
										detectedVocalEntryTime: {
											type: Type.NUMBER,
											description: 'Segundo exacto en que entra la voz principal o narración.',
										},
										detectedLyrics: {
											type: Type.ARRAY,
											items: {
												type: Type.OBJECT,
												properties: {
													time: { type: Type.NUMBER },
													text: { type: Type.STRING },
													isSlogan: { type: Type.BOOLEAN },
												},
												required: ['time', 'text', 'isSlogan'],
											},
										},
										scenes: {
											type: Type.ARRAY,
											items: {
												type: Type.OBJECT,
												properties: {
													sceneNumber: { type: Type.INTEGER },
													title: { type: Type.STRING },
													sectionTag: { type: Type.STRING },
													startTime: { type: Type.NUMBER },
													endTime: { type: Type.NUMBER },
													shotType: { type: Type.STRING },
													cameraMotion: { type: Type.STRING },
													spokenCue: { type: Type.STRING },
													narrativeAction: { type: Type.STRING },
													visualPrompt: { type: Type.STRING },
													videoMotionPrompt: { type: Type.STRING },
												},
												required: [
													'sceneNumber',
													'title',
													'sectionTag',
													'startTime',
													'endTime',
													'shotType',
													'cameraMotion',
													'spokenCue',
													'narrativeAction',
													'visualPrompt',
													'videoMotionPrompt',
												],
											},
										},
									},
									required: [
										'directorSummary',
										'visualBible',
										'detectedMood',
										'detectedBpm',
										'detectedVocalEntryTime',
										'detectedLyrics',
										'scenes',
									],
								},
							},
						});

						for await (const chunk of stream) {
							const parts = chunk.candidates?.[0]?.content?.parts ?? [];
							for (const part of parts) {
								if (!part.text) continue;
								if (part.thought) {
									fullThought += part.text;
									sendSse(res, 'thought', { delta: part.text });
								} else {
									jsonBuffer += part.text;
								}
							}
						}
					} catch (geminiErr) {
						if (!hasModalLlm) throw geminiErr;
						sendSse(res, 'stage', {
							stage: 'thinking',
							message: 'Usando tu LLM en Modal para diseñar el guion y storyboard sincronizado...',
						});
						jsonBuffer = '';
					}
				}

				if (!jsonBuffer && hasModalLlm) {
					const jsonSchemaPrompt = `${systemInstruction}\n\nDevuelve ÚNICAMENTE un JSON válido con la estructura:\n{"directorSummary": string, "visualBible": string, "detectedMood": string, "detectedBpm": number, "detectedVocalEntryTime": number, "detectedLyrics": [{"time": number, "text": string, "isSlogan": boolean}], "scenes": [{"sceneNumber": number, "title": string, "sectionTag": string, "startTime": number, "endTime": number, "shotType": string, "cameraMotion": "zoom-in"|"zoom-out"|"pan-left"|"pan-right"|"none", "spokenCue": string, "narrativeAction": string, "visualPrompt": string, "videoMotionPrompt": string}]}`;
					const modalRes = await callModalVllmChat({
						system: jsonSchemaPrompt,
						user: userPrompt,
						temperature: 0.7,
						maxTokens: 2800,
						jsonMode: true,
					});
					fullThought = `Plan generado por Modal LLM (${modalRes.model}).`;
					sendSse(res, 'thought', { delta: fullThought });
					jsonBuffer = modalRes.content;
				}
			} finally {
				clearInterval(heartbeat);
			}

			const parsed = JSON.parse(cleanJsonString(jsonBuffer)) as {
				directorSummary?: string;
				visualBible?: string;
				detectedMood?: string;
				detectedBpm?: number;
				detectedVocalEntryTime?: number;
				detectedLyrics?: { time: number; text: string; isSlogan: boolean }[];
				scenes?: Record<string, unknown>[];
			};

			const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
			if (rawScenes.length === 0) {
				throw new Error('El Maestro Director IA no devolvió escenas válidas. Inténtalo nuevamente.');
			}

			const allowedMotions = new Set(['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'none']);
			const fallbackMotions: ('zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right')[] = [
				'zoom-in',
				'pan-right',
				'zoom-out',
				'pan-left',
			];
			const detectedVocalEntry = Number(clampNumber(parsed.detectedVocalEntryTime, 0, duration, vocalEntryHint).toFixed(1));

			let cursor = 0;
			const normalizedScenes = rawScenes.map((sc, idx) => {
				const isLast = idx === rawScenes.length - 1;
				const remainingScenes = rawScenes.length - idx;
				const minRemainingDur = Math.max(0, (remainingScenes - 1) * 2.0);
				const maxAllowedEnd = isLast ? duration : Math.max(cursor + 2.0, duration - minRemainingDur);
				const defaultSlice = (duration - cursor) / remainingScenes;

				const sTime = Number(cursor.toFixed(1));
				const rawEnd = clampNumber(sc.endTime, sTime + 2.0, maxAllowedEnd, sTime + defaultSlice);
				const eTime = isLast
					? Number(duration.toFixed(1))
					: Number(Math.max(sTime + 2.0, Math.min(maxAllowedEnd, rawEnd)).toFixed(1));
				cursor = eTime;

				const rawMotion = String(sc.cameraMotion || '').toLowerCase();
				const cameraMotion = allowedMotions.has(rawMotion)
					? (rawMotion as 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'none')
					: fallbackMotions[idx % fallbackMotions.length];

				let spokenCue = String(sc.spokenCue || '').trim().slice(0, 220);
				// Ensure purely instrumental openings prior to vocal entry don't show premature lyric text
				if (eTime <= detectedVocalEntry + 0.15 && format === 'music-video') {
					spokenCue = '';
				}

				const rawShot = String(sc.shotType || `Toma ${idx + 1}`).slice(0, 50);
				const rawVisPrompt = String(sc.visualPrompt || '').trim();
				const visualPrompt = rawVisPrompt.slice(0, 920);

				return {
					id: `maestro-sc-${idx + 1}-${Date.now().toString(36)}`,
					sceneNumber: idx + 1,
					title: String(sc.title || `Escena ${idx + 1}`).slice(0, 90),
					sectionTag: String(sc.sectionTag || 'Escena').slice(0, 50),
					startTime: sTime,
					endTime: eTime,
					duration: Number(Math.max(1.5, eTime - sTime).toFixed(1)),
					shotType: rawShot,
					cameraMotion,
					spokenCue,
					narrativeAction: String(sc.narrativeAction || '').slice(0, 500),
					visualPrompt,
					videoMotionPrompt: String(sc.videoMotionPrompt || '').slice(0, 880),
					imageUrl: '',
					videoUrl: null,
					status: 'scripted',
				};
			});

			sendSse(res, 'complete', {
				directorThought: fullThought.trim(),
				directorSummary: String(parsed.directorSummary || '').trim(),
				visualBible: String(parsed.visualBible || '').trim(),
				detectedMood: String(parsed.detectedMood || '').trim(),
				detectedBpm: Math.round(clampNumber(parsed.detectedBpm, 60, 195, estimatedBpm)),
				detectedVocalEntryTime: detectedVocalEntry,
				detectedLyrics: Array.isArray(parsed.detectedLyrics)
					? parsed.detectedLyrics
							.map((l) => ({
								time: Number(clampNumber(l.time, 0, duration, 0).toFixed(1)),
								text: String(l.text || '').trim().slice(0, 220),
								isSlogan: Boolean(l.isSlogan),
							}))
							.filter((l) => Boolean(l.text))
					: [],
				scenes: normalizedScenes,
			});
			res.end();
		} catch (err) {
			const msg = formatGeminiError(err, 'Error conectando con Gemini Director IA');
			sendSse(res, 'error', { error: msg });
			res.end();
		}
	});

	// 2. UNIVERSAL AI PROMPTER & MAGIC WAND (Modal LLM + Gemini fallback)
	app.post('/api/ai/magic-wand', async (req: Request, res: Response) => {
		try {
			const body = (req.body ?? {}) as Record<string, unknown>;
			const mode = String(body.mode || 'enhance-prompt');
			const text = String(body.text || '').trim().slice(0, 2500);
			const songTitle = String(body.songTitle || '').trim().slice(0, 120);
			const format = String(body.format || 'music-video');
			const style = String(body.style || 'Cinematic');
			const character = String(body.character || 'Protagonist');
			const lyrics = String(body.lyrics || '').trim().slice(0, 3000);
			const sceneContext = String(body.sceneContext || '').trim().slice(0, 1000);
			const preferProvider = String(body.provider || 'auto');

			const hasModalVllm = Boolean(resolveSecret(['MODAL_VLLM_TOKEN', 'VLLM_TOKEN', 'MODAL_LLM_TOKEN']));
			const hasGemini = Boolean(resolveGeminiKey());

			if (!hasModalVllm && !hasGemini) {
				res.status(400).json({
					error: 'Configura MODAL_VLLM_TOKEN o GEMINI_API_KEY en Settings > Secrets para usar el Prompter IA.',
				});
				return;
			}

			let systemInstruction = '';
			let prompt = '';

			if (mode === 'expand-story') {
				systemInstruction =
					'Eres un guionista y director creativo de cine y videoclips musicales. Piensa con profundidad dramática y visual, y redacta una sinopsis/tratamiento narrativo original, emotivo y concreto en español (máximo 110 palabras). Devuelve únicamente el tratamiento narrativo sin encabezados ni markdown.';
				prompt = [
					songTitle && `Título de la canción/obra: "${songTitle}"`,
					`Formato: ${format}`,
					`Estilo visual: ${style}`,
					`Protagonista: ${character}`,
					text ? `Idea inicial del usuario para expandir: "${text}"` : 'El usuario quiere una propuesta cinematográfica original desde cero.',
					lyrics ? `Fragmento de letra para inspirarte:\n${lyrics.slice(0, 1200)}` : '',
				]
					.filter(Boolean)
					.join('\n');
			} else if (mode === 'youtube-seo') {
				systemInstruction =
					'Eres un estratega de lanzamientos musicales y cine en YouTube. Responde únicamente en JSON válido con title, description y tags (separados por comas) en español atractivo y profesional.';
				const seoUserPrompt = `Proyecto: "${songTitle || text}". Estilo: ${style}. Contexto de escenas/letra: ${sceneContext || lyrics}`;

				if ((preferProvider === 'modal' || preferProvider === 'auto') && hasModalVllm) {
					try {
						const modalRes = await callModalVllmChat({
							system: systemInstruction,
							user: seoUserPrompt,
							temperature: 0.65,
							maxTokens: 700,
							jsonMode: true,
						});
						const seo = JSON.parse(cleanJsonString(modalRes.content));
						res.json({ result: seo, provider: 'modal-llm' });
						return;
					} catch (e) {
						if (!hasGemini) throw e;
					}
				}

				const ai = createGeminiClient();
				const r = await ai.models.generateContent({
					model: 'gemini-4-hydrogen',
					contents: seoUserPrompt,
					config: {
						systemInstruction,
						thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
						responseMimeType: 'application/json',
						responseSchema: {
							type: Type.OBJECT,
							properties: {
								title: { type: Type.STRING },
								description: { type: Type.STRING },
								tags: { type: Type.STRING },
							},
							required: ['title', 'description', 'tags'],
						},
					},
				});
				const seo = JSON.parse(cleanJsonString(r.text || '{}'));
				res.json({ result: seo, provider: 'gemini' });
				return;
			} else if (mode === 'cover-prompt') {
				systemInstruction =
					'Eres un director de arte experto en portadas musicales y pósters para FLUX/SDXL. Convierte la idea o canción en un único prompt detallado de portada en inglés (35 a 85 palabras, máximo 700 caracteres) con composición central, paleta cromática, textura, iluminación dramática y estilo editorial 8K. Devuelve únicamente el prompt final sin comillas ni explicaciones.';
				prompt = [
					text ? `Cover concept: "${text}"` : 'Create an iconic commercial music album cover art concept',
					songTitle && `Song / Album title: ${songTitle}`,
					`Visual style / Genre: ${style}`,
					character && !character.startsWith('Sin personaje') ? `Featured subject: ${character}` : '',
					sceneContext ? `Additional details: ${sceneContext}` : '',
				]
					.filter(Boolean)
					.join('\n');
			} else if (mode === 'video-prompt') {
				systemInstruction =
					'Eres un director de fotografía y realizador experto en generación de video con IA (SVD / Veo). Redacta un único prompt en inglés (35 a 90 palabras, máximo 700 caracteres) enfocado en movimiento de cámara fluido, iluminación, atmósfera, acción del sujeto y ritmo visual. Devuelve únicamente el prompt final sin comillas ni explicaciones.';
				prompt = [
					text ? `Video scene idea: "${text}"` : 'Atmospheric cinematic performance video scene',
					songTitle && `Song/Project title: ${songTitle}`,
					`Visual style: ${style}`,
					character && !character.startsWith('Sin personaje') ? `Lead actor: ${character}` : 'Atmosphere and environment focus',
					`Production format: ${format}`,
					sceneContext ? `Direction context: ${sceneContext}` : '',
				]
					.filter(Boolean)
					.join('\n');
			} else {
				// enhance-prompt
				systemInstruction =
					'Eres un director de fotografía experto en prompts para modelos de generación de imagen y video (FLUX / Stable Video). Piensa en iluminación, lente óptica, composición, textura fílmica, vestuario y acción del personaje. Convierte la idea en un único prompt cinematográfico en inglés de alta precisión (entre 35 y 90 palabras, máximo 700 caracteres). Devuelve únicamente el prompt final sin comillas ni explicaciones.';
				prompt = [
					`Base idea: "${text || 'Atmospheric cinematic performance scene'}"`,
					songTitle && `Song/Project title: ${songTitle}`,
					`Visual style: ${style}`,
					character && !character.startsWith('Sin personaje') ? `Lead actor/character: ${character}` : 'Focus on atmosphere and environment without a named actor',
					`Production format: ${format}`,
					sceneContext ? `Scene timing/context: ${sceneContext}` : '',
				]
					.filter(Boolean)
					.join('\n');
			}

			if ((preferProvider === 'modal' || preferProvider === 'auto') && hasModalVllm) {
				try {
					const modalRes = await callModalVllmChat({
						system: systemInstruction,
						user: prompt,
						temperature: 0.72,
						maxTokens: 600,
					});
					res.json({ result: modalRes.content.replace(/^["']|["']$/g, '').trim(), thoughts: '', provider: 'modal-llm' });
					return;
				} catch (modalErr) {
					if (!hasGemini) throw modalErr;
					console.warn('[magic-wand] Modal vLLM failed, falling back to Gemini:', modalErr);
				}
			}

			const ai = createGeminiClient();
			const response = await ai.models.generateContent({
				model: 'gemini-4-hydrogen',
				contents: prompt,
				config: {
					systemInstruction,
					thinkingConfig: {
						thinkingLevel: ThinkingLevel.MEDIUM,
						includeThoughts: true,
					},
				},
			});

			let thoughts = '';
			let resultText = '';
			const parts = response.candidates?.[0]?.content?.parts ?? [];
			for (const p of parts) {
				if (!p.text) continue;
				if (p.thought) thoughts += p.text;
				else resultText += p.text;
			}

			const finalResult = (resultText || response.text || '').trim();
			if (!finalResult) {
				res.status(502).json({ error: 'La IA no devolvió contenido.' });
				return;
			}
			res.json({ result: finalResult, thoughts: thoughts.trim(), provider: 'gemini' });
		} catch (err) {
			const msg = formatGeminiError(err, 'Error ejecutando Prompter IA');
			res.status(500).json({ error: msg });
		}
	});

	// 3. REAL AUDIO TRANSCRIPTION & LYRICS / SLOGAN TIMELINE SYNC
	app.post('/api/ai/transcribe-sync', async (req: Request, res: Response) => {
		try {
			const ai = createGeminiClient();
			const body = (req.body ?? {}) as Record<string, unknown>;
			const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl : '';
			const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
			const audioMime = typeof body.audioMime === 'string' ? body.audioMime : 'audio/mpeg';
			const duration = clampNumber(body.duration, 5, 300, 45);
			const lyrics = String(body.lyrics || '').slice(0, 6000);
			const songTitle = String(body.songTitle || '').slice(0, 120);

			const audioPart = await resolveAudioPart(audioUrl, audioBase64, audioMime);
			if (!audioPart && !lyrics.trim()) {
				res.status(400).json({
					error: 'Añade una pista de audio a A1 o escribe letras/frases para poder sincronizar títulos reales con IA.',
				});
				return;
			}

			const promptText = [
				`Analiza esta pista ("${songTitle || 'Audio en timeline'}") de duración ${duration.toFixed(1)}s.`,
				'Escucha el audio (si está adjunto) y detecta los momentos exactos en que entra la voz y cada verso, diálogo o eslogan clave.',
				'Devuelve entre 4 y 10 rótulos cronológicos precisos (startTime, endTime, text, isSlogan=true para estribillos/eslóganes de impacto).',
				lyrics ? `Letra de referencia:\n${lyrics}` : 'Transcribe directamente las frases cantadas o habladas del audio.',
			].join('\n\n');

			const contents = audioPart ? { parts: [audioPart, { text: promptText }] } : promptText;
			const response = await ai.models.generateContent({
				model: 'gemini-4-hydrogen',
				contents,
				config: {
					thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
					responseMimeType: 'application/json',
					responseSchema: {
						type: Type.OBJECT,
						properties: {
							vocalEntryTime: { type: Type.NUMBER },
							cues: {
								type: Type.ARRAY,
								items: {
									type: Type.OBJECT,
									properties: {
										startTime: { type: Type.NUMBER },
										endTime: { type: Type.NUMBER },
										text: { type: Type.STRING },
										isSlogan: { type: Type.BOOLEAN },
									},
									required: ['startTime', 'endTime', 'text', 'isSlogan'],
								},
							},
						},
						required: ['vocalEntryTime', 'cues'],
					},
				},
			});

			const parsed = JSON.parse(cleanJsonString(response.text || '{}')) as {
				vocalEntryTime?: number;
				cues?: { startTime: number; endTime: number; text: string; isSlogan: boolean }[];
			};

			const rawVocalEntry = Number(clampNumber(parsed.vocalEntryTime, 0, duration, 2).toFixed(1));
			let cueCursor = 0;
			const nonOverlappingCues = (parsed.cues || [])
				.map((c) => {
					const text = String(c.text || '').trim().slice(0, 180);
					if (!text) return null;
					const st = Number(
						clampNumber(c.startTime, cueCursor, Math.max(cueCursor, duration - 1.2), cueCursor).toFixed(1)
					);
					const en = Number(
						clampNumber(c.endTime, st + 1.2, duration, Math.min(duration, st + 3.5)).toFixed(1)
					);
					cueCursor = en;
					return {
						startTime: st,
						endTime: en,
						text,
						isSlogan: Boolean(c.isSlogan),
					};
				})
				.filter((c): c is { startTime: number; endTime: number; text: string; isSlogan: boolean } => Boolean(c));

			res.json({
				vocalEntryTime: rawVocalEntry,
				cues: nonOverlappingCues,
			});
		} catch (err) {
			const msg = formatGeminiError(err, 'Error sincronizando letras y audio con IA');
			res.status(500).json({ error: msg });
		}
	});

	// 4. MODAL VISION & LLM DIRECT ROUTES (using AI Studio Secrets: QAMUZ_SERVICE_TOKEN / MODAL_VLLM_TOKEN)
	app.get('/api/modal/health', async (_req: Request, res: Response) => {
		const visionInfo = resolveModalVisionTokenInfo();
		const visionToken = visionInfo.value;
		const vllmToken = resolveSecret(['MODAL_VLLM_TOKEN', 'VLLM_TOKEN', 'MODAL_LLM_TOKEN']);
		const visionUrl = resolveModalVisionUrl();
		const vllmUrl = resolveModalVllmUrl();

		let remoteVisionOk = false;
		let visionAuthOk = false;
		let visionAuthStatus: number | null = null;
		let models: string[] = [];
		try {
			const r = await fetch(`${visionUrl}/health`, { signal: AbortSignal.timeout(4000) });
			if (r.ok) {
				const j = (await r.json().catch(() => ({}))) as { ok?: boolean; models?: string[] };
				remoteVisionOk = Boolean(j?.ok);
				if (Array.isArray(j?.models)) models = j.models;
			}
		} catch {
			remoteVisionOk = false;
		}

		if (visionToken && remoteVisionOk) {
			try {
				const authRes = await fetch(`${visionUrl}/status/auth-check`, {
					headers: { Authorization: `Bearer ${visionToken}` },
					signal: AbortSignal.timeout(4000),
				});
				visionAuthStatus = authRes.status;
				visionAuthOk = authRes.status !== 401 && authRes.status !== 403 && authRes.status !== 503;
			} catch {
				visionAuthOk = false;
			}
		}

		res.json({
			ok: Boolean(visionToken || vllmToken),
			visionConfigured: Boolean(visionToken),
			visionSecretSource: visionInfo.source,
			visionAuthOk,
			visionAuthStatus,
			vllmConfigured: Boolean(vllmToken),
			geminiConfigured: Boolean(resolveGeminiKey()),
			visionUrl,
			vllmUrl,
			remoteVisionOk,
			models,
		});
	});

	app.post('/api/modal/image', async (req: Request, res: Response) => {
		try {
			const token = resolveModalVisionToken();
			if (!token) {
				res.status(503).json({
					error: 'Falta el secreto QAMUZ_SERVICE_TOKEN en Settings > Secrets de AI Studio para generar portadas e imágenes en Modal.',
				});
				return;
			}

			const body = (req.body ?? {}) as Record<string, unknown>;
			const rawPrompt = String(body.prompt || '').trim();
			if (!rawPrompt) {
				res.status(400).json({ error: 'Describe la imagen o portada primero.' });
				return;
			}

			const style = typeof body.style === 'string' && body.style.trim() ? `, ${body.style.trim()} style` : '';
			const sizeStr = String(body.size || '');
			const aspectRatio = String(body.aspect_ratio || SIZE_TO_ASPECT[sizeStr] || '1:1');

			const input: Record<string, unknown> = {
				prompt: `${rawPrompt}${style}`.slice(0, 1200),
				aspect_ratio: aspectRatio,
				model_id: String(body.model_id || 'qamuz-image-flux'),
			};
			if (typeof body.negative_prompt === 'string' && body.negative_prompt.trim()) {
				input.negative_prompt = body.negative_prompt.trim().slice(0, 500);
			}
			if (body.seed != null) input.seed = Number(body.seed);
			if (body.steps != null) input.steps = Number(body.steps);
			if (body.guidance != null) input.guidance = Number(body.guidance);

			const visionUrl = resolveModalVisionUrl();
			const endpoint = body.sync ? `${visionUrl}/infer` : `${visionUrl}/submit`;
			const requestBody = body.sync ? { capability: 'qamuz-image', ...input } : { task: 'image', input };

			const modalRes = await fetch(endpoint, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
				signal: AbortSignal.timeout(body.sync ? 180_000 : 60_000),
			});
			const payload = (await modalRes.json().catch(() => ({}))) as Record<string, unknown>;
			if (!modalRes.ok) {
				const msg =
					modalRes.status === 401
						? 'Modal rechazó el token (401 Unauthorized). Verifica que QAMUZ_SERVICE_TOKEN en AI Studio > Settings > Secrets sea exactamente el valor de QAMUZ_SERVICE_TOKEN dentro del secreto "qamuz-service" en Modal (el mismo token que usa tu Supabase).'
						: String(payload?.detail || payload?.error || 'Modal rechazó la generación de imagen.');
				res.status(modalRes.status).json({ error: msg });
				return;
			}
			res.json(payload);
		} catch (err) {
			res.status(500).json({
				error: err instanceof Error ? err.message : 'Error conectando con Modal Vision (Imágenes)',
			});
		}
	});

	app.post('/api/modal/video', async (req: Request, res: Response) => {
		try {
			const token = resolveModalVisionToken();
			if (!token) {
				res.status(503).json({
					error: 'Falta el secreto QAMUZ_SERVICE_TOKEN en Settings > Secrets de AI Studio para generar videos en Modal.',
				});
				return;
			}

			const body = (req.body ?? {}) as Record<string, unknown>;
			const rawPrompt = String(body.prompt || '').trim();
			const style = typeof body.style === 'string' && body.style.trim() ? `, ${body.style.trim()} style` : '';
			const aspect =
				String(body.aspect_ratio || body.aspect || '') === '9:16' || String(body.size || '') === '1024x1536'
					? '9:16'
					: '16:9';

			const rawImage = String(
				body.image || body.image_b64 || body.reference_image_url || body.image_url || ''
			).trim();
			const image = rawImage ? await resolveImageAsDataUri(rawImage) : '';

			if (!rawPrompt && !image) {
				res.status(400).json({ error: 'Envía una imagen inicial o una descripción para generar el video.' });
				return;
			}

			const input: Record<string, unknown> = {
				prompt: `${rawPrompt}${style}`.slice(0, 1000),
				image,
				aspect_ratio: aspect,
				model_id: String(body.model_id || 'qamuz-video-svd'),
			};
			if (body.fps != null) input.fps = Number(body.fps);
			if (body.motion != null) input.motion = Number(body.motion);
			if (body.num_frames != null) input.num_frames = Number(body.num_frames);

			const visionUrl = resolveModalVisionUrl();
			const modalRes = await fetch(`${visionUrl}/submit`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ task: 'video', input }),
				signal: AbortSignal.timeout(60_000),
			});
			const payload = (await modalRes.json().catch(() => ({}))) as Record<string, unknown>;
			if (!modalRes.ok) {
				const msg =
					modalRes.status === 401
						? 'Modal rechazó el token (401 Unauthorized). Verifica que QAMUZ_SERVICE_TOKEN en AI Studio > Settings > Secrets sea exactamente el valor de QAMUZ_SERVICE_TOKEN dentro del secreto "qamuz-service" en Modal (el mismo token que usa tu Supabase).'
						: String(payload?.detail || payload?.error || 'Modal rechazó la generación de video.');
				res.status(modalRes.status).json({ error: msg });
				return;
			}
			res.json(payload);
		} catch (err) {
			res.status(500).json({
				error: err instanceof Error ? err.message : 'Error conectando con Modal Vision (Videos)',
			});
		}
	});

	app.post('/api/modal/lyrics', async (req: Request, res: Response) => {
		try {
			const body = (req.body ?? {}) as Record<string, unknown>;
			const idea = String(body.idea || '').trim().slice(0, 2000);
			const style = String(body.style || '').trim().slice(0, 500);
			const title = String(body.title || '').trim().slice(0, 80);
			const existing = String(body.lyrics || '').trim().slice(0, 5000);
			const language = String(body.language || body.lang || 'es').slice(0, 20);
			const mode = String(body.mode || (existing ? 'optimize' : 'lyrics'));

			if (!idea && !style && !title && !existing) {
				res.status(400).json({ error: 'Agrega un título, estilo o idea para escribir la letra.' });
				return;
			}

			const visionToken = resolveModalVisionToken();
			const vllmToken = resolveSecret(['MODAL_VLLM_TOKEN', 'VLLM_TOKEN', 'MODAL_LLM_TOKEN']);

			if (visionToken) {
				try {
					const visionUrl = resolveModalVisionUrl();
					const modalRes = await fetch(`${visionUrl}/submit`, {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${visionToken}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							task: 'lyrics',
							input: {
								idea: idea || title || style,
								style,
								title,
								lyrics: existing,
								mode,
								language,
							},
						}),
						signal: AbortSignal.timeout(60_000),
					});
					const payload = (await modalRes.json().catch(() => ({}))) as Record<string, unknown>;
					if (modalRes.ok && payload?.call_id) {
						res.json({ call_id: String(payload.call_id), status: 'QUEUED', provider: 'modal-lyrics' });
						return;
					}
				} catch (err) {
					console.warn('[modal/lyrics] submit failed, checking vLLM fallback:', err);
				}
			}

			if (vllmToken) {
				const langName = language.startsWith('es')
					? 'Spanish'
					: language.startsWith('pt')
					? 'Portuguese'
					: language.startsWith('fr')
					? 'French'
					: 'English';
				const system = [
					`You are Qamuz's master songwriting engine. Write or optimize original song lyrics in ${langName}.`,
					'Use clean section tags on their own line: [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro] (or [Canto 1], [Coro], [Mambo] for Latin genres).',
					'Return ONLY valid JSON: {"title": string, "style": string, "lyrics": string}.',
				].join(' ');
				const user = [
					`Mode: ${mode}`,
					title && `Title: ${title}`,
					style && `Style: ${style}`,
					idea && `Idea: ${idea}`,
					existing && `Existing lyrics to improve:\n${existing}`,
				]
					.filter(Boolean)
					.join('\n');

				const out = await callModalVllmChat({ system, user, temperature: 0.78, maxTokens: 1600, jsonMode: true });
				try {
					const parsed = JSON.parse(cleanJsonString(out.content)) as {
						title?: string;
						style?: string;
						lyrics?: string;
					};
					res.json({
						status: 'SUCCESS',
						title: String(parsed.title || title),
						style: String(parsed.style || style),
						lyrics: String(parsed.lyrics || out.content).trim(),
						provider: 'modal-vllm',
					});
					return;
				} catch {
					res.json({
						status: 'SUCCESS',
						title,
						style,
						lyrics: out.content.trim(),
						provider: 'modal-vllm',
					});
					return;
				}
			}

			if (resolveGeminiKey()) {
				const ai = createGeminiClient();
				const r = await ai.models.generateContent({
					model: 'gemini-4-hydrogen',
					contents: `Idioma: ${language}. Modo: ${mode}. Título: ${title}. Estilo: ${style}. Idea: ${idea}. Letra existente:\n${existing}`,
					config: {
						systemInstruction:
							'Eres compositor profesional. Escribe letras originales con etiquetas [Intro], [Verso 1], [Coro], [Verso 2], [Puente], [Outro]. Devuelve únicamente la letra.',
						thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
					},
				});
				const text = (r.text || '').trim();
				if (text) {
					res.json({ status: 'SUCCESS', lyrics: text, title, style, provider: 'gemini' });
					return;
				}
			}

			res.status(503).json({
				error: 'Configura QAMUZ_SERVICE_TOKEN o MODAL_VLLM_TOKEN en Settings > Secrets para generar letras con tu LLM en Modal.',
			});
		} catch (err) {
			res.status(500).json({
				error: err instanceof Error ? err.message : 'Error generando letras con Modal LLM',
			});
		}
	});

	app.get('/api/modal/status/:callId', async (req: Request, res: Response) => {
		try {
			const token = resolveModalVisionToken();
			if (!token) {
				res.status(503).json({ error: 'QAMUZ_SERVICE_TOKEN no configurado en Secrets.' });
				return;
			}
			const callId = String(req.params.callId || '').trim();
			if (!callId) {
				res.status(400).json({ error: 'callId requerido' });
				return;
			}
			const visionUrl = resolveModalVisionUrl();
			const modalRes = await fetch(`${visionUrl}/status/${encodeURIComponent(callId)}`, {
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(60_000),
			});
			if (!modalRes.ok) {
				res.json({ status: 'PROCESSING' });
				return;
			}
			const payload = await modalRes.json().catch(() => ({ status: 'PROCESSING' }));
			res.json(payload);
		} catch {
			res.json({ status: 'PROCESSING' });
		}
	});

	if (process.env.NODE_ENV === 'production') {
		const distDir = path.resolve(process.cwd(), 'dist');
		app.use(express.static(distDir));
		app.use((_req: Request, res: Response) => {
			res.sendFile(path.join(distDir, 'index.html'));
		});
	} else {
		const { createServer: createViteServer } = await import('vite');
		const vite = await createViteServer({
			server: { middlewareMode: true },
			appType: 'spa',
		});
		app.use(vite.middlewares);
	}

	app.listen(PORT, '0.0.0.0', () => {
		console.log(`Qamuz AI Server running at http://0.0.0.0:${PORT}`);
	});
}

void startServer();
