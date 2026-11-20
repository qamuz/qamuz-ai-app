import { supabase } from '@/integrations/supabase/client';
import { getAuthHeaders } from '@/lib/safeUrl';
import type { Creation } from '@/lib/studio';

export interface ModalHealth {
	ok: boolean;
	visionConfigured: boolean;
	visionAuthOk?: boolean;
	vllmConfigured: boolean;
	geminiConfigured: boolean;
	remoteVisionOk: boolean;
	models: string[];
}

interface LocalModalJob {
	id: string;
	callId: string;
	kind: 'image' | 'video';
	prompt: string;
	options: Record<string, unknown>;
	status: 'queued' | 'generating' | 'ready' | 'error';
	title: string | null;
	result_urls: string[];
	thumbnail_url: string | null;
	error_message: string | null;
	created_at: string;
	persistedId?: string | null;
	finalizing?: boolean;
}

const localJobs = new Map<string, LocalModalJob>();
let healthCache: { value: ModalHealth; fetchedAt: number } | null = null;

export function isLocalModalId(id: string): boolean {
	return id.startsWith('local-modal-');
}

export async function checkModalHealth(force = false): Promise<ModalHealth> {
	if (!force && healthCache && Date.now() - healthCache.fetchedAt < 10_000) {
		return healthCache.value;
	}
	try {
		const res = await fetch('/api/modal/health');
		if (res.ok) {
			const data = (await res.json()) as ModalHealth;
			healthCache = { value: data, fetchedAt: Date.now() };
			return data;
		}
	} catch {
		// fall back to offline defaults
	}
	const fallback: ModalHealth = {
		ok: false,
		visionConfigured: false,
		vllmConfigured: false,
		geminiConfigured: false,
		remoteVisionOk: false,
		models: [],
	};
	return fallback;
}

function toCreation(job: LocalModalJob): Creation {
	return {
		id: job.id,
		kind: job.kind,
		prompt: job.prompt,
		options: job.options,
		status: job.status,
		provider_slug: job.kind === 'image' ? 'modal-image' : 'modal-video',
		title: job.title,
		result_urls: job.result_urls,
		thumbnail_url: job.thumbnail_url,
		duration_seconds: null,
		error_message: job.error_message,
		credits_spent: 0,
		published_track_id: null,
		items: null,
		created_at: job.created_at,
	};
}

function dataUriToBlob(dataUri: string): { blob: Blob; mime: string; ext: string } | null {
	const m = dataUri.match(/^data:([^;]+);base64,(.*)$/s);
	if (!m) return null;
	const mime = m[1];
	const bin = atob(m[2]);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) {
		bytes[i] = bin.charCodeAt(i);
	}
	const ext = mime.includes('mp4') ? 'mp4' : mime.includes('jpeg') ? 'jpg' : 'png';
	return { blob: new Blob([bytes], { type: mime }), mime, ext };
}

async function prepareReferenceImageDataUri(rawUrl: string): Promise<string> {
	const cleaned = (rawUrl || '').trim();
	if (!cleaned) return '';
	// Keep normal HTTPS URLs untouched so the server fetches them directly without bloating browser upload,
	// ONLY convert local blob: URLs or oversized data:image/ URIs (> 2.5MB) to a clean 1280px JPEG data URI.
	const needsCanvasConversion =
		cleaned.startsWith('blob:') ||
		(cleaned.startsWith('data:image/') && cleaned.length > 2_500_000);
	if (!needsCanvasConversion) return cleaned;

	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = new Image();
			el.onload = () => resolve(el);
			el.onerror = () => reject(new Error('No se pudo leer la imagen inicial'));
			el.src = cleaned;
		});
		const maxSide = 1280;
		const scale = Math.min(1, maxSide / Math.max(1, img.naturalWidth, img.naturalHeight));
		const w = Math.max(64, Math.round(img.naturalWidth * scale));
		const h = Math.max(64, Math.round(img.naturalHeight * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return cleaned;
		ctx.drawImage(img, 0, 0, w, h);
		return canvas.toDataURL('image/jpeg', 0.9);
	} catch {
		return cleaned.startsWith('blob:') ? '' : cleaned;
	}
}

export async function createLocalModalCreation(
	kind: 'image' | 'video',
	prompt: string,
	options: Record<string, unknown>
): Promise<{ data?: { id: string }; error?: string }> {
	const endpoint = kind === 'image' ? '/api/modal/image' : '/api/modal/video';
	const requestOptions: Record<string, unknown> = { ...options };

	if (kind === 'video') {
		const candidateRef = String(
			requestOptions.image ||
				requestOptions.image_b64 ||
				requestOptions.reference_image_url ||
				requestOptions.image_url ||
				''
		).trim();
		if (candidateRef) {
			const prepared = await prepareReferenceImageDataUri(candidateRef);
			if (prepared) {
				if (prepared.startsWith('data:image/')) {
					requestOptions.image = prepared;
					delete requestOptions.reference_image_url;
				} else {
					requestOptions.reference_image_url = prepared;
				}
			} else if (candidateRef.startsWith('blob:')) {
				delete requestOptions.reference_image_url;
				delete requestOptions.image;
			}
		}
	}

	const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
	const res = await fetch(endpoint, {
		method: 'POST',
		headers,
		body: JSON.stringify({ prompt, ...requestOptions }),
	});
	const payload = (await res.json().catch(() => ({}))) as {
		call_id?: string;
		error?: string;
	};
	if (!res.ok || !payload.call_id) {
		return { error: payload.error || 'No se pudo iniciar la generación en Modal.' };
	}

	const id = `local-modal-${crypto.randomUUID()}`;
	const src = options.source as { title?: string; cover_url?: string } | undefined;
	const refImg = typeof options.reference_image_url === 'string' && !options.reference_image_url.startsWith('data:')
		? options.reference_image_url
		: null;

	// Strip heavy base64 image buffers from persisted metadata options
	const safeStoredOptions: Record<string, unknown> = { ...options };
	if (typeof safeStoredOptions.image === 'string' && safeStoredOptions.image.startsWith('data:')) {
		delete safeStoredOptions.image;
	}
	if (typeof safeStoredOptions.image_b64 === 'string' && safeStoredOptions.image_b64.startsWith('data:')) {
		delete safeStoredOptions.image_b64;
	}

	localJobs.set(id, {
		id,
		callId: payload.call_id,
		kind,
		prompt,
		options: safeStoredOptions,
		status: 'generating',
		title: src?.title ? String(src.title).slice(0, 120) : null,
		result_urls: [],
		thumbnail_url: refImg || src?.cover_url || null,
		error_message: null,
		created_at: new Date().toISOString(),
		persistedId: null,
	});

	return { data: { id } };
}

export async function refreshLocalModalCreation(id: string): Promise<{ ok: boolean }> {
	const job = localJobs.get(id);
	if (!job || job.status === 'ready' || job.status === 'error' || job.finalizing) {
		return { ok: true };
	}

	try {
		const headers = await getAuthHeaders();
		const res = await fetch(`/api/modal/status/${encodeURIComponent(job.callId)}`, { headers });
		const data = (await res.json().catch(() => ({ status: 'PROCESSING' }))) as {
			status?: string;
			output?: unknown;
			error?: string;
		};

		if (data.status === 'FAILED') {
			job.status = 'error';
			job.error_message = data.error || 'Modal devolvió un error en la generación.';
			return { ok: true };
		}

		if (data.status !== 'SUCCESS' || typeof data.output !== 'string') {
			return { ok: true };
		}

		job.finalizing = true;
		let finalUrl = data.output;

		try {
			const parsed = dataUriToBlob(data.output);
			if (parsed) {
				if (supabase) {
					const { data: userData } = await supabase.auth.getUser();
					const userId = userData.user?.id;
					if (userId) {
						const storagePath = `${userId}/studio/${crypto.randomUUID()}.${parsed.ext}`;
						const { error: upErr } = await supabase.storage
							.from('media')
							.upload(storagePath, parsed.blob, { contentType: parsed.mime, upsert: true });
						if (!upErr) {
							finalUrl = supabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl;
						}
					}
				}
				if (finalUrl === data.output) {
					finalUrl = URL.createObjectURL(parsed.blob);
				}
			}

			// Persist completed Modal creation into Supabase ai_creations so it stays in the user's library
			if (supabase && /^https?:\/\//i.test(finalUrl)) {
				const { data: userData } = await supabase.auth.getUser();
				const userId = userData.user?.id;
				if (userId) {
					const { data: inserted } = await supabase
						.from('ai_creations')
						.insert({
							user_id: userId,
							kind: job.kind,
							prompt: job.prompt,
							options: JSON.parse(JSON.stringify(job.options)),
							status: 'ready',
							provider_slug: job.kind === 'image' ? 'modal-image' : 'modal-video',
							title: job.title,
							result_urls: [finalUrl],
							thumbnail_url: job.kind === 'image' ? finalUrl : job.thumbnail_url,
							credits_spent: 0,
						})
						.select('id')
						.maybeSingle();
					if (inserted?.id) {
						job.persistedId = inserted.id;
					}
				}
			}
		} finally {
			job.finalizing = false;
		}

		job.result_urls = [finalUrl];
		if (job.kind === 'image') {
			job.thumbnail_url = finalUrl;
		}
		job.status = 'ready';
		return { ok: true };
	} catch {
		job.finalizing = false;
		return { ok: false };
	}
}

export function getLocalModalCreation(id: string): Creation | null {
	const job = localJobs.get(id);
	return job ? toCreation(job) : null;
}

export function getLocalModalCreations(existingIds: Set<string>): Creation[] {
	const list: Creation[] = [];
	for (const job of localJobs.values()) {
		// Once persisted in Supabase and already returned by fetchCreations, avoid duplicating rows
		if (job.persistedId && existingIds.has(job.persistedId)) {
			continue;
		}
		list.push(toCreation(job));
	}
	return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function removeLocalModalCreation(id: string) {
	localJobs.delete(id);
}

export async function writeLyricsWithModal(payload: {
	idea: string;
	style?: string;
	title?: string;
	lyrics?: string;
	mode?: string;
	language?: string;
}): Promise<{ lyrics?: string; title?: string; style?: string; error?: string }> {
	const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
	const res = await fetch('/api/modal/lyrics', {
		method: 'POST',
		headers,
		body: JSON.stringify(payload),
	});
	const data = (await res.json().catch(() => ({}))) as {
		call_id?: string;
		status?: string;
		lyrics?: string;
		title?: string;
		style?: string;
		error?: string;
	};
	if (!res.ok) {
		return { error: data.error || 'No se pudo generar la letra con Modal.' };
	}
	if (data.status === 'SUCCESS' && data.lyrics) {
		return { lyrics: data.lyrics, title: data.title, style: data.style };
	}
	if (!data.call_id) {
		return { error: data.error || 'El motor de letras en Modal no devolvió respuesta.' };
	}

	for (let i = 0; i < 120; i++) {
		await new Promise((r) => window.setTimeout(r, 2500));
		const pollHeaders = await getAuthHeaders();
		const pollRes = await fetch(`/api/modal/status/${encodeURIComponent(data.call_id)}`, { headers: pollHeaders });
		const pollData = (await pollRes.json().catch(() => ({ status: 'PROCESSING' }))) as {
			status?: string;
			output?: { lyrics?: string; title?: string; style?: string } | string;
			error?: string;
		};
		if (pollData.status === 'FAILED') {
			return { error: pollData.error || 'El motor de letras en Modal falló.' };
		}
		if (pollData.status === 'SUCCESS') {
			if (typeof pollData.output === 'object' && pollData.output?.lyrics) {
				return {
					lyrics: String(pollData.output.lyrics),
					title: String(pollData.output.title || ''),
					style: String(pollData.output.style || ''),
				};
			}
			if (typeof pollData.output === 'string' && pollData.output.trim()) {
				return { lyrics: pollData.output.trim() };
			}
		}
	}

	return { error: 'El motor de letras en Modal tardó demasiado. Inténtalo nuevamente.' };
}
