import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ---------- Kie (Suno) helpers (mirrored in kie-callback; edge functions deploy as single files) ----------

const KIE_API = 'https://api.kie.ai/api/v1';

/** Every Kie task reports to the signed webhook, which verifies Kie's HMAC before doing anything. */
const callbackUrl = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/kie-callback`;

const STEM_NAMES = [
	'Lead Vocal', 'Backing Vocals', 'Drum Kit', 'Kick', 'Snare', 'Percussion', 'Bass', 'Synth Bass', 'Upright Bass',
	'Piano', 'Electric Piano', 'Keyboards', 'Organ', 'Synth', 'Synth Pad', 'Synth Lead', 'Synth Keys', 'Synth Strings',
	'Guitar', 'Acoustic Guitar', 'Electric Guitar', 'Lead Electric Guitar', 'Rhythm Electric Guitar', 'Rhythm Acoustic Guitar',
	'String Section', 'Violin', 'Brass Section', 'Trumpet', 'Woodwinds', 'Flute', 'Choir', 'Sound Effects',
];

type Row = { id: string; user_id: string; credits_spent: number; creation_id?: string | null };

async function addCredits(admin: SupabaseClient, userId: string, amount: number, reason: string, creationId: string | null) {
	const { data } = await admin.from('credit_balances').select('balance').eq('user_id', userId).maybeSingle();
	const balance = (data?.balance as number | undefined) ?? 0;
	await admin.from('credit_balances').update({ balance: balance + amount, updated_at: new Date().toISOString() }).eq('user_id', userId);
	await admin.from('credit_transactions').insert({ user_id: userId, amount, reason, creation_id: creationId });
}

/** Take credits with an optimistic check so two parallel requests can't overspend. */
async function charge(admin: SupabaseClient, userId: string, cost: number): Promise<{ ok: true; balance: number } | { ok: false; status: number; error: string }> {
	const { data: bal } = await admin.from('credit_balances').select('balance').eq('user_id', userId).maybeSingle();
	const balance = (bal?.balance as number | undefined) ?? 0;
	if (balance < cost) return { ok: false, status: 402, error: `You need ${cost} credits and have ${balance}` };
	if (cost === 0) return { ok: true, balance };
	const { data: updated } = await admin
		.from('credit_balances')
		.update({ balance: balance - cost, updated_at: new Date().toISOString() })
		.eq('user_id', userId)
		.eq('balance', balance)
		.select('balance');
	if (!updated || updated.length === 0) return { ok: false, status: 409, error: 'Please try again' };
	return { ok: true, balance };
}

async function priceOf(admin: SupabaseClient, service: string): Promise<{ cost: number; label: string; plans: string[] } | null> {
	const { data } = await admin.from('kie_service_prices').select('user_credits, label, enabled, allowed_plans').eq('service', service).maybeSingle();
	if (!data || !data.enabled) return null;
	return { cost: Number(data.user_credits), label: String(data.label), plans: (data.allowed_plans as string[] | null) ?? [] };
}

const PLAN_ERROR = 'This tool is included in the Pro, Artista and Empresa plans. Upgrade your plan to use it.';
const MAX_ACTIVE = 5;
const MAX_PER_HOUR = 30;
const MAX_ACTIVE_MODAL = 24;
const MAX_PER_HOUR_MODAL = 300;

/** The user's plan slug (active or trialing subscription); everyone else is on "gratis". */
async function planSlugOf(admin: SupabaseClient, userId: string): Promise<string> {
	const { data } = await admin.from('subscriptions').select('status, plan:plans(slug)').eq('user_id', userId).maybeSingle();
	const slug = (data?.plan as { slug?: string } | null)?.slug;
	return slug && (data?.status === 'active' || data?.status === 'trialing') ? slug : 'gratis';
}

/** Gating only by plan.slug: an empty list means every plan. */
async function planAllows(admin: SupabaseClient, userId: string, plans: string[]): Promise<boolean> {
	if (plans.length === 0) return true;
	return plans.includes(await planSlugOf(admin, userId));
}

/** Per-user request limits: Modal GPU jobs have generous limits so storyboards don't hit the 30/hr third-party cap. */
async function rateLimitError(admin: SupabaseClient, userId: string, providerSlug?: string): Promise<string | null> {
	const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
	const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

	if (providerSlug?.startsWith('modal-')) {
		const [activeModal, hourModal] = await Promise.all([
			count(admin.from('ai_creations').select('id', { count: 'exact', head: true }).eq('user_id', userId).like('provider_slug', 'modal-%').in('status', ['queued', 'generating'])),
			count(admin.from('ai_creations').select('id', { count: 'exact', head: true }).eq('user_id', userId).like('provider_slug', 'modal-%').gte('created_at', hourAgo)),
		]);
		if (activeModal >= MAX_ACTIVE_MODAL) return 'You already have 24 Modal GPU tasks in progress. Wait a moment for one to finish.';
		if (hourModal >= MAX_PER_HOUR_MODAL) return 'You reached the hourly Modal safety limit (300/hr). Try again in a few minutes.';
		return null;
	}

	const [a1, a2, a3, h1, h2, h3] = await Promise.all([
		count(admin.from('ai_creations').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('provider_slug', 'like', 'modal-%').in('status', ['queued', 'generating'])),
		count(admin.from('ai_stems').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'generating')),
		count(admin.from('kie_tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'generating')),
		count(admin.from('ai_creations').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('provider_slug', 'like', 'modal-%').gte('created_at', hourAgo)),
		count(admin.from('ai_stems').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', hourAgo)),
		count(admin.from('kie_tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', hourAgo)),
	]);
	if (a1 + a2 + a3 >= MAX_ACTIVE) return 'You already have 5 tasks in progress. Wait for one to finish.';
	if (h1 + h2 + h3 >= MAX_PER_HOUR) return 'You reached the limit of 30 tasks per hour. Try again in a few minutes.';
	return null;
}

/** Moves a row to "error" only once, so a refund is never paid twice (webhook, app and reconciler can race). */
async function markError(admin: SupabaseClient, table: string, id: string, message: string): Promise<boolean> {
	const { data } = await admin
		.from(table)
		.update({ status: 'error', error_message: message.slice(0, 500), updated_at: new Date().toISOString() })
		.eq('id', id)
		.neq('status', 'error')
		.select('id');
	return Boolean(data && data.length > 0);
}

async function refundCreation(admin: SupabaseClient, creation: Row, message: string) {
	if (!(await markError(admin, 'ai_creations', creation.id, message))) return;
	if (creation.credits_spent > 0) await addCredits(admin, creation.user_id, creation.credits_spent, 'Reembolso por error', creation.id);
}

async function failStem(admin: SupabaseClient, job: Row, message: string) {
	if (!(await markError(admin, 'ai_stems', job.id, message))) return;
	if (job.credits_spent > 0) await addCredits(admin, job.user_id, job.credits_spent, 'Stem separation refund', job.creation_id ?? null);
}

async function failTask(admin: SupabaseClient, task: Row, message: string) {
	if (!(await markError(admin, 'kie_tasks', task.id, message))) return;
	if (task.credits_spent > 0) await addCredits(admin, task.user_id, task.credits_spent, 'AI service refund', task.creation_id ?? null);
}

/** Collect every stem URL from Kie's response, keyed by stem name (vocal, drums, bass...). */
function parseStems(info: Record<string, unknown>): Record<string, string> {
	const stems: Record<string, string> = {};
	for (const [key, value] of Object.entries(info ?? {})) {
		if (typeof value !== 'string' || !/^https?:\/\//.test(value)) continue;
		const m = key.match(/^(.*?)(_url|Url)$/);
		if (!m) continue;
		const name = m[1].replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
		if (name === 'origin' || name === 'origin_') continue;
		stems[name] = value;
	}
	return stems;
}

/** Only files inside the user's own folder of the media bucket may be sent to Kie as uploads. */
function isOwnMediaUrl(url: unknown, userId: string): url is string {
	if (typeof url !== 'string' || url.length > 2048) return false;
	return url.startsWith(`${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/media/${userId}/`);
}

/** A Qamuz voice persona id (row of voice_personas owned by the user) → the real Suno persona id. */
async function resolvePersona(admin: SupabaseClient, userId: string, raw: unknown): Promise<string | undefined> {
	if (typeof raw !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw)) return undefined;
	const { data } = await admin.from('voice_personas').select('kie_persona_id').eq('id', raw).eq('user_id', userId).maybeSingle();
	return (data?.kie_persona_id as string | undefined) ?? undefined;
}

async function savePersona(admin: SupabaseClient, userId: string, creationId: string | null, personaId: string, name: string, description: string) {
	const { data } = await admin
		.from('voice_personas')
		.insert({ user_id: userId, creation_id: creationId, kie_persona_id: personaId, name: name.slice(0, 80), description: description.slice(0, 300) })
		.select('id')
		.single();
	return (data?.id as string | undefined) ?? null;
}

/** Market jobs API: create a task. Synchronous services return their result in `data`. */
async function kieCreateTask(apiKey: string, model: string, input: Record<string, unknown>): Promise<{ taskId?: string; data: Record<string, unknown>; error?: string }> {
	try {
		const res = await fetch(`${KIE_API}/jobs/createTask`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, input, callBackUrl: callbackUrl() }),
			signal: AbortSignal.timeout(60000),
		});
		const payload = await res.json().catch(() => ({}));
		const data = (payload?.data ?? {}) as Record<string, unknown>;
		if (payload?.code !== 200) return { data, error: String(payload?.msg ?? 'Kie rejected the request') };
		const taskId = (data.taskId ?? data.task_id) as string | undefined;
		return { taskId: taskId ? String(taskId) : undefined, data };
	} catch {
		return { data: {}, error: 'Kie did not respond' };
	}
}

/** Market jobs API: read a task's state and its parsed result. */
async function kieRecord(apiKey: string, taskId: string): Promise<{ state: string; result: Record<string, unknown>; failMsg: string }> {
	const res = await fetch(`${KIE_API}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
	const payload = await res.json().catch(() => ({}));
	const data = (payload?.data ?? {}) as Record<string, unknown>;
	let result = (data.response ?? null) as Record<string, unknown> | null;
	if (!result && typeof data.resultJson === 'string' && data.resultJson) {
		try {
			result = JSON.parse(data.resultJson) as Record<string, unknown>;
		} catch {
			result = null;
		}
	}
	return { state: String(data.state ?? '').toLowerCase(), result: result ?? {}, failMsg: String(data.failMsg || data.errorMessage || '') };
}

function mapSongItems(items: Record<string, unknown>[]) {
	return items
		.map((t) => ({
			id: (t.id ?? null) as string | null,
			audio_url: (t.audioUrl ?? t.audio_url ?? t.streamAudioUrl ?? t.stream_audio_url ?? '') as string,
			image_url: (t.imageUrl ?? t.image_url ?? null) as string | null,
			title: (t.title ?? null) as string | null,
			duration: t.duration ? Math.round(Number(t.duration)) : null,
			lyrics: (t.prompt ?? t.lyric ?? null) as string | null,
			tags: (t.tags ?? null) as string | null,
		}))
		.filter((s) => Boolean(s.audio_url));
}

type CreationRow = Row & { external_task_id: string | null };

async function saveSongs(admin: SupabaseClient, creation: CreationRow, songs: ReturnType<typeof mapSongItems>, done: boolean) {
	const first = songs[0];
	await admin
		.from('ai_creations')
		.update({
			status: done ? 'ready' : 'generating',
			result_urls: songs.map((s) => s.audio_url),
			items: songs,
			thumbnail_url: first?.image_url ?? null,
			title: first?.title ?? null,
			duration_seconds: first?.duration ?? null,
			updated_at: new Date().toISOString(),
		})
		.eq('id', creation.id);
}

/** Songs created with the classic Suno endpoint (`/generate`). */
async function pollMusic(admin: SupabaseClient, creation: CreationRow, apiKey: string) {
	const res = await fetch(`${KIE_API}/generate/record-info?taskId=${encodeURIComponent(creation.external_task_id ?? '')}`, { headers: { Authorization: `Bearer ${apiKey}` } });
	const payload = await res.json().catch(() => ({}));
	const data = payload?.data ?? {};
	const status = String(data.status ?? '');
	const songs = mapSongItems((data.response?.sunoData ?? data.response?.data ?? []) as Record<string, unknown>[]);
	if (status === 'SUCCESS' || (status === 'FIRST_SUCCESS' && songs.length > 0)) {
		await saveSongs(admin, creation, songs, status === 'SUCCESS');
		return;
	}
	if (status.includes('FAILED') || status.includes('ERROR')) {
		await refundCreation(admin, creation, (data.errorMessage as string | undefined) ?? 'La generación de música falló');
	}
}

/** Songs created with the jobs API (extend, cover, add vocals/instrumental, replace section...). */
async function pollJobCreation(admin: SupabaseClient, creation: CreationRow, apiKey: string) {
	const { state, result, failMsg } = await kieRecord(apiKey, creation.external_task_id ?? '');
	const raw = (result.data ?? result.sunoData ?? []) as Record<string, unknown>[];
	const songs = mapSongItems(Array.isArray(raw) ? raw : []);
	if (state === 'success') {
		if (songs.length === 0) await refundCreation(admin, creation, 'The service returned no audio');
		else await saveSongs(admin, creation, songs, true);
		return;
	}
	if (state === 'fail') {
		await refundCreation(admin, creation, failMsg || 'The generation failed');
		return;
	}
	if (songs.length > 0) await saveSongs(admin, creation, songs, false);
}

type StemRow = Row & { external_task_id: string | null; mode?: string | null; stem_name?: string | null };

async function pollStemJob(admin: SupabaseClient, job: StemRow, apiKey: string) {
	const taskId = job.external_task_id ?? '';
	if (job.mode === 'split_stem_advanced') {
		const { state, result, failMsg } = await kieRecord(apiKey, taskId);
		if (state === 'success') {
			const info = (result.vocal_removal_info ?? result.vocal_separation_info ?? result) as Record<string, unknown>;
			const stems = parseStems(info);
			const urls = (result.resultUrls ?? []) as unknown[];
			if (Object.keys(stems).length === 0 && typeof urls[0] === 'string') {
				const key = (job.stem_name ?? 'stem').toLowerCase().replace(/\s+([a-z])/g, (_, c: string) => c.toUpperCase());
				stems[key] = urls[0];
			}
			if (Object.keys(stems).length === 0) await failStem(admin, job, 'The service returned no stems');
			else await admin.from('ai_stems').update({ status: 'ready', stems, updated_at: new Date().toISOString() }).eq('id', job.id);
		} else if (state === 'fail') {
			await failStem(admin, job, failMsg || 'The separation failed');
		}
		return;
	}
	const res = await fetch(`${KIE_API}/vocal-removal/record-info?taskId=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
	const payload = await res.json().catch(() => ({}));
	const data = (payload?.data ?? {}) as Record<string, unknown>;
	const flag = String(data.successFlag ?? data.status ?? '');
	if (flag === 'SUCCESS') {
		const info = (data.response ?? data.vocal_separation_info ?? data.vocal_removal_info ?? {}) as Record<string, unknown>;
		const stems = parseStems(info);
		if (Object.keys(stems).length === 0) await failStem(admin, job, 'The service returned no stems');
		else await admin.from('ai_stems').update({ status: 'ready', stems, updated_at: new Date().toISOString() }).eq('id', job.id);
	} else if (/FAIL|ERROR|EXCEPTION/.test(flag)) {
		await failStem(admin, job, (data.errorMessage as string | undefined) ?? 'The separation failed');
	}
}

function firstUrl(...values: unknown[]): string | null {
	for (const v of values) {
		if (typeof v === 'string' && /^https:\/\//.test(v)) return v;
		if (Array.isArray(v) && typeof v[0] === 'string' && /^https:\/\//.test(v[0])) return v[0];
	}
	return null;
}

/** Trim Kie's aligned words to what the UI needs. */
function alignedWords(raw: unknown): { word: string; start: number; end: number }[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.slice(0, 3000)
		.map((w: Record<string, unknown>) => ({ word: String(w.word ?? ''), start: Number(w.startS ?? w.start_s ?? 0), end: Number(w.endS ?? w.end_s ?? 0) }))
		.filter((w) => w.word);
}

type TaskRow = Row & { service: string; external_task_id: string | null; result: Record<string, unknown> | null };

/** Turn a finished Kie task into a stored result (WAV, video, cover art, lyrics, synced lyrics, persona). */
async function pollKieTask(admin: SupabaseClient, task: TaskRow, apiKey: string) {
	const { state, result, failMsg } = await kieRecord(apiKey, task.external_task_id ?? '');
	if (state === 'fail') {
		await failTask(admin, task, failMsg || 'The service failed');
		return;
	}
	if (state !== 'success') return;
	const prev = task.result ?? {};
	let out: Record<string, unknown> | null = null;
	if (task.service === 'wav') {
		const url = firstUrl(result.resultUrls, result.audio_wav_url);
		if (url) out = { url };
	} else if (task.service === 'video') {
		const url = firstUrl(result.resultUrls, result.video_url);
		if (url) out = { url };
	} else if (task.service === 'cover_image') {
		const images = ((result.images ?? result.resultUrls ?? []) as unknown[]).filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 4);
		if (images.length) out = { images };
	} else if (task.service === 'lyrics') {
		const obj = (result.resultObject ?? result) as Record<string, unknown>;
		const list = ((obj.lyricsData ?? obj.data ?? []) as Record<string, unknown>[])
			.filter((l) => l && l.text && l.status !== 'failed')
			.slice(0, 4)
			.map((l) => ({ title: String(l.title ?? ''), text: String(l.text ?? '').slice(0, 6000) }));
		if (list.length) out = { lyrics: list };
	} else if (task.service === 'timestamped_lyrics') {
		const obj = (result.resultObject ?? result) as Record<string, unknown>;
		const words = alignedWords(obj.alignedWords ?? obj.aligned_words ?? (obj.data as Record<string, unknown> | undefined)?.alignedWords);
		if (words.length) out = { words };
	} else if (task.service === 'persona') {
		const obj = (result.resultObject ?? result) as Record<string, unknown>;
		const personaId = obj.persona_id ?? obj.personaId;
		if (typeof personaId === 'string' && personaId) {
			const rowId = await savePersona(admin, task.user_id, task.creation_id ?? null, personaId, String(prev.name ?? 'My voice'), String(prev.description ?? ''));
			out = { name: prev.name ?? 'My voice', persona: rowId };
		}
	}
	if (!out) {
		await failTask(admin, task, 'The service returned no result');
		return;
	}
	await admin.from('kie_tasks').update({ status: 'ready', result: { ...prev, ...out }, updated_at: new Date().toISOString() }).eq('id', task.id);
}

// ---------- end Kie helpers ----------

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

interface Provider {
	slug: string;
	name: string;
	kind: string;
	secret_name: string | null;
	model: string | null;
	credit_cost: number;
}

interface Creation {
	id: string;
	user_id: string;
	kind: string;
	status: string;
	provider_slug: string | null;
	external_task_id: string | null;
	credits_spent: number;
}

const SUPPORTED = new Set(['kie-suno', 'openai-image', 'kie-veo', 'modal-image', 'modal-video']);

// Qamuz Vision API on Modal: images, videos and lyrics (queue + poll).
const MODAL_VISION = 'https://qamuzstudio--qamuz-vision-api.modal.run';
const LANGS: Record<string, string> = { es: 'Spanish', pt: 'Portuguese', fr: 'French', en: 'English' };

async function modalSubmit(token: string, task: string, input: Record<string, unknown>): Promise<{ callId?: string; error?: string }> {
	try {
		const res = await fetch(`${MODAL_VISION}/submit`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ task, input }),
			signal: AbortSignal.timeout(60000),
		});
		const payload = await res.json().catch(() => ({}));
		if (!res.ok || !payload?.call_id) return { error: String(payload?.detail ?? 'Modal rejected the request') };
		return { callId: String(payload.call_id) };
	} catch {
		return { error: 'Modal did not respond' };
	}
}

async function modalStatus(token: string, callId: string): Promise<Record<string, unknown>> {
	const res = await fetch(`${MODAL_VISION}/status/${encodeURIComponent(callId)}`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(60000),
	});
	if (!res.ok) return { status: 'PROCESSING' };
	return (await res.json().catch(() => ({ status: 'PROCESSING' }))) as Record<string, unknown>;
}

/** Download an image and return it as a data URI (empty string if it can't be fetched or is too big). */
async function toDataUri(url: string): Promise<string> {
	try {
		const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (QamuzAI)', Accept: 'image/*' }, signal: AbortSignal.timeout(30000) });
		if (!res.ok) return '';
		const type = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
		if (!type.startsWith('image/')) return '';
		const bytes = new Uint8Array(await res.arrayBuffer());
		if (bytes.length === 0 || bytes.length > 8_000_000) return '';
		let bin = '';
		for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		return `data:${type};base64,${btoa(bin)}`;
	} catch {
		return '';
	}
}

async function startModal(admin: SupabaseClient, creation: Creation, token: string, task: 'image' | 'video', input: Record<string, unknown>) {
	const { callId, error } = await modalSubmit(token, task, input);
	if (!callId) {
		await refund(admin, creation, error ?? 'Modal rejected the request');
		return;
	}
	await admin.from('ai_creations').update({ status: 'generating', external_task_id: callId, updated_at: new Date().toISOString() }).eq('id', creation.id);
}

async function pollModal(admin: SupabaseClient, creation: Creation, token: string) {
	const data = await modalStatus(token, creation.external_task_id ?? '');
	const status = String(data.status ?? '');
	if (status === 'FAILED') {
		await refund(admin, creation, String(data.error ?? 'The generation failed'));
		return;
	}
	if (status !== 'SUCCESS') return;
	const output = String(data.output ?? '');
	const m = output.match(/^data:([^;]+);base64,(.*)$/s);
	if (!m) {
		await refund(admin, creation, 'Modal returned no file');
		return;
	}
	const type = m[1];
	const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
	const ext = type.includes('mp4') ? 'mp4' : type.includes('jpeg') ? 'jpg' : 'png';
	const path = `${creation.user_id}/studio/${creation.id}.${ext}`;
	const { error } = await admin.storage.from('media').upload(path, bytes, { contentType: type, upsert: true });
	if (error) {
		await refund(admin, creation, 'Could not save the file');
		return;
	}
	const url = admin.storage.from('media').getPublicUrl(path).data.publicUrl;
	const patch: Record<string, unknown> = { status: 'ready', result_urls: [url], updated_at: new Date().toISOString() };
	if (creation.kind === 'image') patch.thumbnail_url = url;
	await admin.from('ai_creations').update(patch).eq('id', creation.id);
}

const refund = (admin: SupabaseClient, creation: Creation, message: string) => refundCreation(admin, creation, message);

async function generateImage(admin: SupabaseClient, creation: Creation, provider: Provider, apiKey: string, prompt: string, size: string) {
	// OpenAI image models: 'dall-e-3' (default) or 'dall-e-2'. Fix invalid legacy placeholder 'gpt-image-1'.
	const rawModel = (provider.model || '').trim();
	const model = !rawModel || rawModel === 'gpt-image-1' ? 'dall-e-3' : rawModel;

	// DALL-E 3 requires dimensions: 1024x1024 (square), 1792x1024 (landscape), or 1024x1792 (portrait)
	let apiSize = size;
	if (model === 'dall-e-3') {
		if (size === '1536x1024' || size === '1792x1024' || size === 'landscape') {
			apiSize = '1792x1024';
		} else if (size === '1024x1536' || size === '1024x1792' || size === 'portrait') {
			apiSize = '1024x1792';
		} else {
			apiSize = '1024x1024';
		}
	}

	// Auto-heal the database record if it still contains the invalid 'gpt-image-1'
	if (provider.model === 'gpt-image-1') {
		void admin.from('ai_providers').update({ model: 'dall-e-3' }).eq('slug', provider.slug);
	}

	const res = await fetch('https://api.openai.com/v1/images/generations', {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model,
			prompt: prompt.slice(0, 4000),
			size: apiSize,
			n: 1,
			response_format: 'b64_json',
		}),
	});
	const payload = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = (payload?.error?.message as string | undefined) ?? 'OpenAI rechazó la solicitud';
		await refund(admin, creation, msg);
		return;
	}
	const item = payload?.data?.[0] ?? {};
	let url: string | null = null;
	if (item.b64_json) {
		const bytes = Uint8Array.from(atob(item.b64_json as string), (c) => c.charCodeAt(0));
		const path = `${creation.user_id}/studio/${creation.id}.png`;
		const { error } = await admin.storage.from('media').upload(path, bytes, { contentType: 'image/png', upsert: true });
		if (error) {
			await refund(admin, creation, 'No se pudo guardar la imagen');
			return;
		}
		url = admin.storage.from('media').getPublicUrl(path).data.publicUrl;
	} else if (item.url) {
		try {
			const imgRes = await fetch(item.url as string);
			if (imgRes.ok) {
				const buf = await imgRes.arrayBuffer();
				const path = `${creation.user_id}/studio/${creation.id}.png`;
				const { error: upErr } = await admin.storage.from('media').upload(path, new Uint8Array(buf), { contentType: 'image/png', upsert: true });
				if (!upErr) {
					url = admin.storage.from('media').getPublicUrl(path).data.publicUrl;
				} else {
					url = item.url as string;
				}
			} else {
				url = item.url as string;
			}
		} catch {
			url = item.url as string;
		}
	}
	if (!url) {
		await refund(admin, creation, 'El proveedor no devolvió ninguna imagen');
		return;
	}
	await admin
		.from('ai_creations')
		.update({ status: 'ready', result_urls: [url], thumbnail_url: url, updated_at: new Date().toISOString() })
		.eq('id', creation.id);
}

async function startMusic(admin: SupabaseClient, creation: Creation, provider: Provider, apiKey: string, request: Record<string, unknown>) {
	const res = await fetch('https://api.kie.ai/api/v1/generate', {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...request,
			model: provider.model || 'V4_5',
			callBackUrl: callbackUrl(),
		}),
	});
	const payload = await res.json().catch(() => ({}));
	const taskId = payload?.data?.taskId as string | undefined;
	if (!res.ok || payload?.code !== 200 || !taskId) {
		await refund(admin, creation, (payload?.msg as string | undefined) ?? 'Kie rechazó la solicitud');
		return;
	}
	await admin
		.from('ai_creations')
		.update({ status: 'generating', external_task_id: taskId, updated_at: new Date().toISOString() })
		.eq('id', creation.id);
}


async function startVideo(admin: SupabaseClient, creation: Creation, provider: Provider, apiKey: string, prompt: string, aspectRatio: string) {
	const res = await fetch('https://api.kie.ai/api/v1/veo/generate', {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ prompt: prompt.slice(0, 1000), model: provider.model || 'veo3_fast', aspectRatio }),
	});
	const payload = await res.json().catch(() => ({}));
	const taskId = payload?.data?.taskId as string | undefined;
	if (!res.ok || payload?.code !== 200 || !taskId) {
		await refund(admin, creation, (payload?.msg as string | undefined) ?? 'Kie rechazó la solicitud de video');
		return;
	}
	await admin
		.from('ai_creations')
		.update({ status: 'generating', external_task_id: taskId, updated_at: new Date().toISOString() })
		.eq('id', creation.id);
}

async function pollVideo(admin: SupabaseClient, creation: Creation, apiKey: string) {
	const res = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${encodeURIComponent(creation.external_task_id ?? '')}`, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});
	const payload = await res.json().catch(() => ({}));
	const data = payload?.data ?? {};
	const flag = Number(data.successFlag ?? 0);
	if (flag === 1) {
		let urls: string[] = [];
		const raw = data.response?.resultUrls ?? data.resultUrls;
		if (Array.isArray(raw)) urls = raw as string[];
		else if (typeof raw === 'string') {
			try {
				urls = JSON.parse(raw) as string[];
			} catch {
				urls = [raw];
			}
		}
		if (urls.length === 0) {
			await refund(admin, creation, 'El proveedor no devolvió ningún video');
			return;
		}
		await admin
			.from('ai_creations')
			.update({ status: 'ready', result_urls: urls, updated_at: new Date().toISOString() })
			.eq('id', creation.id);
		return;
	}
	if (flag === 2 || flag === 3) {
		await refund(admin, creation, (data.errorMessage as string | undefined) ?? 'La generación de video falló');
	}
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

	let body: Record<string, unknown> = {};
	try {
		body = await req.json();
	} catch {
		return json({ error: 'Solicitud inválida' }, 400);
	}
	const action = String(body.action ?? '');

	// Public discovery actions that do not require user session
	if (action === 'lastfm_top_tags' || action === 'lastfm_tag_tracks' || action === 'lastfm_similar') {
		const apiKey = Deno.env.get('LASTFM_API_KEY') || Deno.env.get('LAST_FM_API_KEY');
		if (!apiKey) return json({ error: 'LASTFM_API_KEY is not configured', fallback: true, tags: [], tracks: [], similar: [] }, 200);
		try {
			if (action === 'lastfm_top_tags') {
				const num = Math.min(Math.max(Number(body.num ?? 40), 10), 100);
				const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=chart.gettoptags&api_key=${apiKey}&format=json&limit=${num}`);
				if (!res.ok) return json({ error: 'Last.fm request failed', fallback: true, tags: [] }, 200);
				const data = await res.json();
				const tags = (data?.tags?.tag ?? []).map((t: { name?: string; count?: number; reach?: number }) => ({
					name: String(t.name ?? ''),
					count: Number(t.count ?? 0),
					reach: Number(t.reach ?? 0),
				})).filter((t: { name: string }) => Boolean(t.name));
				return json({ tags });
			}
			if (action === 'lastfm_tag_tracks') {
				const tag = encodeURIComponent(String(body.tag ?? '').trim());
				if (!tag) return json({ error: 'Tag is required' }, 400);
				const num = Math.min(Math.max(Number(body.num ?? 20), 5), 50);
				const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${tag}&api_key=${apiKey}&format=json&limit=${num}`);
				if (!res.ok) return json({ error: 'Last.fm request failed', fallback: true, tracks: [] }, 200);
				const data = await res.json();
				const tracks = (data?.tracks?.track ?? []).map((tr: { name?: string; duration?: string; artist?: { name?: string }; image?: { ['#text']?: string }[] }) => ({
					name: String(tr.name ?? ''),
					artist: String(tr.artist?.name ?? ''),
					duration: Number(tr.duration ?? 0),
					image: tr.image?.[2]?.['#text'] || tr.image?.[1]?.['#text'] || null,
				}));
				return json({ tracks });
			}
			if (action === 'lastfm_similar') {
				const track = encodeURIComponent(String(body.track ?? '').trim());
				const artist = encodeURIComponent(String(body.artist ?? '').trim());
				if (!track || !artist) return json({ error: 'Track and artist are required' }, 400);
				const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&track=${track}&artist=${artist}&api_key=${apiKey}&format=json&limit=15`);
				if (!res.ok) return json({ error: 'Last.fm request failed', fallback: true, similar: [] }, 200);
				const data = await res.json();
				const similar = (data?.similartracks?.track ?? []).map((tr: { name?: string; match?: number; artist?: { name?: string }; image?: { ['#text']?: string }[] }) => ({
					name: String(tr.name ?? ''),
					artist: String(tr.artist?.name ?? ''),
					match: Number(tr.match ?? 0),
					image: tr.image?.[2]?.['#text'] || null,
				}));
				return json({ similar });
			}
		} catch (e) {
			return json({ error: String(e), fallback: true }, 200);
		}
	}

	const authHeader = req.headers.get('Authorization') ?? '';
	const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
		global: { headers: { Authorization: authHeader } },
	});
	const {
		data: { user },
	} = await userClient.auth.getUser();
	if (!user) return json({ error: 'Debes iniciar sesión' }, 401);

	// Service client: only used after the user is verified, for trusted writes (credits, results).
	const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

	try {
		// Home «Templates»: returns the prompt of a published song and counts each user once.
		if (action === 'template_use') {
			const trackId = String(body.track_id ?? '');
			if (!/^[0-9a-f-]{36}$/i.test(trackId)) return json({ error: 'This template is not available' }, 400);
			const { data: tr } = await admin.from('tracks').select('id, prompt, style, template_uses').eq('id', trackId).eq('is_published', true).not('prompt', 'is', null).maybeSingle();
			if (!tr) return json({ error: 'This template is not available' }, 404);
			const { error: insErr } = await admin.from('template_uses').insert({ user_id: user.id, track_id: trackId });
			let count = Number(tr.template_uses ?? 0);
			if (!insErr) {
				const { count: total } = await admin.from('template_uses').select('id', { count: 'exact', head: true }).eq('track_id', trackId);
				count = total ?? count + 1;
				await admin.from('tracks').update({ template_uses: count }).eq('id', trackId);
			}
			return json({ count, prompt: tr.prompt, style: tr.style });
		}

		if (action === 'providers_status') {
			const { data: isAdmin } = await userClient.rpc('has_role', { _role: 'admin' });
			if (!isAdmin) return json({ error: 'Solo administradores' }, 403);
			const { data: providers } = await admin.from('ai_providers').select('slug, secret_name');
			const status: Record<string, { configured: boolean; supported: boolean }> = {};
			for (const p of providers ?? []) {
				status[p.slug as string] = {
					configured: Boolean(p.secret_name && Deno.env.get(p.secret_name as string)),
					supported: SUPPORTED.has(p.slug as string),
				};
			}
			return json({ status });
		}

		if (action === 'lyrics_status') {
			const serviceToken = Deno.env.get('QAMUZ_SERVICE_TOKEN');
			if (!serviceToken) return json({ error: 'Lyrics engine is not configured' }, 503);
			const data = await modalStatus(serviceToken, String(body.call_id ?? '').slice(0, 120));
			const status = String(data.status ?? 'PROCESSING');
			if (status === 'FAILED') return json({ status, error: 'The lyrics engine did not respond. Try again.' });
			if (status !== 'SUCCESS') return json({ status: 'PROCESSING' });
			const out = (data.output ?? {}) as Record<string, unknown>;
			return json({ status, lyrics: String(out.lyrics ?? ''), title: String(out.title ?? ''), style: String(out.style ?? '') });
		}

		if (action === 'lyrics_write') {
			const idea = String(body.idea ?? '').trim().slice(0, 2000);
			const style = String(body.style ?? '').trim().slice(0, 500);
			const title = String(body.title ?? '').trim().slice(0, 80);
			const existing = String(body.lyrics ?? '').trim().slice(0, 5000);
			const language = LANGS[String(body.lang ?? 'en').slice(0, 2)] ?? 'English';
			if (!idea && !style && !title && !existing) return json({ error: 'Add a title, style or idea first' }, 400);

			// Preferred: Qamuz Lyrics Engine (Qwen 7B) through the Vision API queue.
			const serviceToken = Deno.env.get('QAMUZ_SERVICE_TOKEN');
			if (serviceToken) {
				const { callId, error } = await modalSubmit(serviceToken, 'lyrics', {
					idea: idea || title || style,
					style,
					title,
					lyrics: existing,
					mode: existing ? 'optimize' : 'lyrics',
					language,
				});
				if (!callId) {
					console.error('modal lyrics submit', error);
					return json({ error: 'The lyrics engine did not respond. Try again.' }, 502);
				}
				return json({ call_id: callId });
			}

			// Fallback: small vLLM chat engine (synchronous).
			const token = Deno.env.get('MODAL_VLLM_TOKEN');
			if (!token) return json({ error: 'Lyrics engine is not configured' }, 503);
			const res = await fetch('https://qamuzstudio--qamuz-vllm-engine-fastapi-app.modal.run/v1/chat/completions', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				signal: AbortSignal.timeout(120000),
				body: JSON.stringify({
					model: 'qamuz-chat',
					temperature: 0.9,
					max_tokens: 700,
					messages: [
						{ role: 'system', content: `You are a professional songwriter. Write original song lyrics in ${language}. Use section tags on their own line: [Verse], [Chorus], [Bridge]. Output only the lyrics, no explanations.` },
						{ role: 'user', content: [title && `Title: ${title}`, style && `Style: ${style}`, idea && `Idea: ${idea}`].filter(Boolean).join('\n') },
					],
				}),
			});
			if (!res.ok) {
				console.error('modal lyrics', res.status, (await res.text()).slice(0, 300));
				return json({ error: 'The lyrics engine did not respond. Try again.' }, 502);
			}
			const out = await res.json();
			const lyrics = String(out?.choices?.[0]?.message?.content ?? '').trim().slice(0, 5000);
			if (!lyrics) return json({ error: 'The lyrics engine returned nothing. Try again.' }, 502);
			return json({ lyrics });
		}

		if (action === 'create') {
			const kind = String(body.kind ?? '');
			const prompt = String(body.prompt ?? '').trim();
			const options = (body.options ?? {}) as Record<string, unknown>;
			if (!['music', 'video', 'image'].includes(kind)) return json({ error: 'Tipo de creación inválido' }, 400);
			const maxLen = kind === 'music' && options.custom ? 5000 : 1000;
			if (prompt.length < 3 || prompt.length > maxLen) return json({ error: `Describe your idea in 3 to ${maxLen} characters` }, 400);

			const { data: mod } = await admin.from('app_modules').select('enabled').eq('key', 'studio').maybeSingle();
			if (mod && !mod.enabled) return json({ error: 'El Estudio de IA está desactivado' }, 403);

			const { data: provider } = await admin
				.from('ai_providers')
				.select('slug, name, kind, secret_name, model, credit_cost')
				.eq('kind', kind)
				.eq('is_active', true)
				.order('is_default', { ascending: false })
				.limit(1)
				.maybeSingle<Provider>();
			if (!provider || !SUPPORTED.has(provider.slug)) return json({ error: 'No hay un proveedor activo para este tipo de creación' }, 400);
			const apiKey = provider.secret_name ? Deno.env.get(provider.secret_name) : undefined;
			if (!apiKey) return json({ error: `${provider.name} todavía no tiene su clave de API configurada` }, 400);

			const limited = await rateLimitError(admin, user.id, provider.slug);
			if (limited) return json({ error: limited }, 429);
			const cost = provider.credit_cost;
			const { data: bal } = await admin.from('credit_balances').select('balance').eq('user_id', user.id).maybeSingle();
			const balance = (bal?.balance as number | undefined) ?? 0;
			if (balance < cost) return json({ error: `Necesitas ${cost} créditos y tienes ${balance}` }, 402);

			const { data: updated } = await admin
				.from('credit_balances')
				.update({ balance: balance - cost, updated_at: new Date().toISOString() })
				.eq('user_id', user.id)
				.eq('balance', balance)
				.select('balance');
			if (!updated || updated.length === 0) return json({ error: 'Inténtalo de nuevo' }, 409);

			const { data: creation, error: insertError } = await admin
				.from('ai_creations')
				.insert({ user_id: user.id, kind, prompt, options, status: 'queued', provider_slug: provider.slug, credits_spent: cost })
				.select('id, user_id, kind, status, provider_slug, external_task_id, credits_spent')
				.single<Creation>();
			if (insertError || !creation) {
				await admin.from('credit_balances').update({ balance }).eq('user_id', user.id);
				return json({ error: 'No se pudo crear la tarea' }, 500);
			}
			await admin.from('credit_transactions').insert({ user_id: user.id, amount: -cost, reason: `Creación de ${kind}`, creation_id: creation.id });

			if (provider.slug === 'openai-image') {
				const rawSize = String(options.size || '1024x1024');
				const size = ['1024x1024', '1536x1024', '1792x1024', '1024x1536', '1024x1792'].includes(rawSize) ? rawSize : '1024x1024';
				const style = options.style ? `. Estilo: ${String(options.style)}` : '';
				await admin.from('ai_creations').update({ status: 'generating' }).eq('id', creation.id);
				await generateImage(admin, creation, provider, apiKey, `${prompt}${style}`, size);
			} else if (provider.slug === 'modal-image') {
				const aspects: Record<string, string> = { '1024x1024': '1:1', '1536x1024': '3:2', '1792x1024': '16:9', '1024x1536': '2:3' };
				const style = options.style ? `, ${String(options.style)} style` : '';
				await startModal(admin, creation, apiKey, 'image', {
					prompt: `${prompt}${style}`.slice(0, 1200),
					aspect_ratio: aspects[String(options.size)] ?? '1:1',
					model_id: provider.model || 'qamuz-image-flux',
				});
			} else if (provider.slug === 'modal-video') {
				const style = options.style ? `, ${String(options.style)} style` : '';
				const aspect = options.aspect === '9:16' || String(options.size) === '1024x1536' ? '9:16' : '16:9';
				const src = (options.source ?? null) as Record<string, unknown> | null;
				let cover: string | null = null;
				if (src && typeof src.audio_url === 'string') {
					cover = typeof src.cover_url === 'string' && /^https:\/\//.test(src.cover_url) ? src.cover_url : null;
					const songTitle = typeof src.title === 'string' ? src.title.slice(0, 120) : null;
					await admin.from('ai_creations').update({ thumbnail_url: cover, title: songTitle }).eq('id', creation.id);
				}
				const refImg = typeof options.reference_image_url === 'string' && /^https:\/\//.test(options.reference_image_url) ? options.reference_image_url : null;
				if (!cover && refImg) {
					await admin.from('ai_creations').update({ thumbnail_url: refImg }).eq('id', creation.id);
				}
				// Animates the chosen start image or song cover; otherwise Modal makes the first frame from the prompt.
				const startImgUrl = refImg || cover;
				const image = startImgUrl ? await toDataUri(startImgUrl) : '';
				await startModal(admin, creation, apiKey, 'video', {
					prompt: `${prompt}${style}`.slice(0, 1000),
					image,
					aspect_ratio: aspect,
					model_id: provider.model || 'qamuz-video-svd',
				});
			} else if (provider.slug === 'kie-suno') {
				const instrumental = Boolean(options.instrumental);
				const refUrl = typeof options.reference_audio_url === 'string' ? options.reference_audio_url : undefined;
				const refBpm = options.reference_bpm ? `, ${options.reference_bpm} bpm` : '';
				const personaName = typeof options.vocal_persona === 'string' ? options.vocal_persona : undefined;
				// Only personas the user created through Qamuz (voice_personas) are forwarded as real Suno persona ids; Qamuz voice styles are applied via the style text.
				const personaId = await resolvePersona(admin, user.id, options.vocal_persona_id);
				const personaStyle = personaName ? `, ${personaName} vocal style` : '';

				if (options.custom) {
					const lyrics = String(options.lyrics ?? '').trim().slice(0, 5000);
					const musicStyle = String(options.style ?? '').trim().slice(0, 1000);
					const title = (String(options.title ?? '').trim() || 'Untitled').slice(0, 80);
					const request: Record<string, unknown> = { customMode: true, instrumental, style: `${musicStyle || 'Pop'}${refBpm}${personaStyle}`, title };
					if (!instrumental) request.prompt = lyrics || prompt.slice(0, 5000);
					if (options.vocal === 'm' || options.vocal === 'f') request.vocalGender = options.vocal;
					if (personaId) request.personaId = personaId;
					if (refUrl) {
						request.audioUrl = refUrl;
						request.referenceAudioUrl = refUrl;
					}
					await startMusic(admin, creation, provider, apiKey, request);
				} else {
					const style = options.style ? `. Style: ${String(options.style)}` : '';
					const req: Record<string, unknown> = { customMode: false, instrumental, prompt: `${prompt}${style}${refBpm}${personaStyle}`.slice(0, 490) };
					if (personaId) req.personaId = personaId;
					if (refUrl) {
						req.audioUrl = refUrl;
						req.referenceAudioUrl = refUrl;
					}
					await startMusic(admin, creation, provider, apiKey, req);
				}
			} else if (provider.slug === 'kie-veo') {
				const style = options.style ? `. Estilo: ${String(options.style)}` : '';
				const aspect = options.aspect === '9:16' || String(options.size) === '1024x1536' ? '9:16' : '16:9';
				const src = (options.source ?? null) as Record<string, unknown> | null;
				const refImg = typeof options.reference_image_url === 'string' && /^https:\/\//.test(options.reference_image_url) ? options.reference_image_url : null;
				if (src && typeof src.audio_url === 'string') {
					const cover = typeof src.cover_url === 'string' && /^https:\/\//.test(src.cover_url) ? src.cover_url : refImg;
					const songTitle = typeof src.title === 'string' ? src.title.slice(0, 120) : null;
					await admin.from('ai_creations').update({ thumbnail_url: cover, title: songTitle }).eq('id', creation.id);
				} else if (refImg) {
					await admin.from('ai_creations').update({ thumbnail_url: refImg }).eq('id', creation.id);
				}
				await startVideo(admin, creation, provider, apiKey, `${prompt}${style}`, aspect);
			}
			return json({ id: creation.id });
		}

		if (action === 'save_trimmed') {
			const title = String(body.title ?? 'Audio Recortado').trim().slice(0, 120);
			const audioUrl = String(body.audio_url ?? '');
			const thumbnailUrl = typeof body.thumbnail_url === 'string' && /^https:\/\/[^\s]+$/i.test(body.thumbnail_url) && body.thumbnail_url.length <= 2048 ? body.thumbnail_url : null;
			const duration = Math.max(1, Math.round(Number(body.duration ?? 0)));
			const options = (body.options ?? {}) as Record<string, unknown>;
			const rawItems = (body.items ?? []) as Record<string, unknown>[];

			if (!audioUrl) return json({ error: 'Falta la URL del audio recortado' }, 400);
			const isSafeUrl = (u: unknown) => typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u) && u.length <= 2048;
			if (!isSafeUrl(audioUrl)) return json({ error: 'Invalid audio URL' }, 400);
			if (rawItems.length > 20 || rawItems.some((it) => it.audio_url != null && !isSafeUrl(it.audio_url))) {
				return json({ error: 'Invalid audio items' }, 400);
			}
			for (const it of rawItems) if (it.image_url != null && !isSafeUrl(it.image_url)) it.image_url = null;

			const items = rawItems.length > 0 ? rawItems : [
				{
					id: `trim-${Date.now()}`,
					title,
					audio_url: audioUrl,
					image_url: thumbnailUrl,
					duration,
					tags: (options.style as string) || 'trimmed,audio',
				}
			];

			const prompt = String(body.prompt ?? `Recorte de audio: ${title}`).slice(0, 500);

			const { data: creation, error: insertError } = await admin
				.from('ai_creations')
				.insert({
					user_id: user.id,
					kind: 'music',
					prompt,
					options,
					status: 'ready',
					provider_slug: 'trimmed-audio',
					title,
					result_urls: [audioUrl],
					thumbnail_url: thumbnailUrl,
					duration_seconds: duration,
					items,
					credits_spent: 0,
				})
				.select('id, user_id, kind, status, provider_slug, external_task_id, credits_spent')
				.single<Creation>();

			if (insertError || !creation) {
				console.error('save_trimmed insert error', insertError);
				return json({ error: 'No se pudo guardar la creación en el espacio de trabajo' }, 500);
			}

			return json({ id: creation.id });
		}

		if (action === 'save_rendered_video') {
			const title = String(body.title ?? 'Video Timeline Studio').trim().slice(0, 120);
			const videoUrl = String(body.video_url ?? '');
			const thumbnailUrl = typeof body.thumbnail_url === 'string' && /^https:\/\/[^\s]+$/i.test(body.thumbnail_url) && body.thumbnail_url.length <= 2048 ? body.thumbnail_url : null;
			const duration = Math.max(1, Math.round(Number(body.duration ?? 0)));
			const options = (body.options ?? {}) as Record<string, unknown>;
			const isSafeUrl = (u: unknown) => typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u) && u.length <= 2048;
			if (!isSafeUrl(videoUrl)) return json({ error: 'URL de video inválida' }, 400);

			const prompt = String(body.prompt ?? `Timeline Studio: ${title}`).slice(0, 500);
			const { data: creation, error: insertError } = await admin
				.from('ai_creations')
				.insert({
					user_id: user.id,
					kind: 'video',
					prompt,
					options,
					status: 'ready',
					provider_slug: 'timeline-studio',
					title,
					result_urls: [videoUrl],
					thumbnail_url: thumbnailUrl,
					duration_seconds: duration,
					credits_spent: 0,
				})
				.select('id, user_id, kind, status, provider_slug, external_task_id, credits_spent')
				.single<Creation>();

			if (insertError || !creation) {
				console.error('save_rendered_video insert error', insertError);
				return json({ error: 'No se pudo guardar el video en el espacio de trabajo' }, 500);
			}
			return json({ id: creation.id });
		}

		if (action === 'status') {
			const id = String(body.id ?? '');
			const { data: creation } = await admin
				.from('ai_creations')
				.select('id, user_id, kind, status, provider_slug, external_task_id, credits_spent')
				.eq('id', id)
				.eq('user_id', user.id)
				.maybeSingle<Creation>();
			if (!creation) return json({ error: 'No encontrada' }, 404);
			if (creation.status === 'generating' && creation.external_task_id) {
				const apiKey = Deno.env.get('KIE_API_KEY');
				if (apiKey && creation.provider_slug === 'kie-suno') await pollMusic(admin, creation, apiKey);
				if (apiKey && creation.provider_slug === 'kie-veo') await pollVideo(admin, creation, apiKey);
				if (apiKey && creation.provider_slug === 'kie-suno-jobs') await pollJobCreation(admin, creation, apiKey);
				const serviceToken = Deno.env.get('QAMUZ_SERVICE_TOKEN');
				if (serviceToken && creation.provider_slug?.startsWith('modal-')) await pollModal(admin, creation, serviceToken);
			}
			return json({ ok: true });
		}

		if (action === 'stems_create') {
			const { data: mod } = await admin.from('app_modules').select('enabled').eq('key', 'stems').maybeSingle();
			if (mod && !mod.enabled) return json({ error: 'Stem separation is turned off' }, 403);
			const rawMode = String(body.mode ?? '');
			const mode = rawMode === 'split_stem' || rawMode === 'split_stem_advanced' ? rawMode : 'separate_vocal';
			const stemName = mode === 'split_stem_advanced' ? String(body.stem_name ?? '') : null;
			if (mode === 'split_stem_advanced' && !STEM_NAMES.includes(stemName ?? '')) return json({ error: 'Choose an instrument to isolate' }, 400);
			const index = Math.max(0, Math.floor(Number(body.index ?? 0)));

			// Resolve the song the user owns: AI song, video soundtrack, or artist track.
			let creationId: string | null = null;
			let trackId: string | null = null;
			let title = 'Untitled';
			let sunoTaskId: string | null = null;
			let sunoAudioId: string | null = null;
			let audioUrl: string | null = null;

			if (body.track_id) {
				const { data: tr } = await admin
					.from('tracks')
					.select('id, title, audio_url, artists!inner(owner_id)')
					.eq('id', String(body.track_id))
					.eq('artists.owner_id', user.id)
					.maybeSingle();
				if (!tr) return json({ error: 'You can only separate your own songs' }, 403);
				trackId = tr.id as string;
				title = String(tr.title ?? title);
				audioUrl = tr.audio_url as string;
			} else {
				const { data: c } = await admin
					.from('ai_creations')
					.select('id, user_id, kind, status, provider_slug, external_task_id, items, result_urls, options, title')
					.eq('id', String(body.creation_id ?? ''))
					.eq('user_id', user.id)
					.maybeSingle();
				if (!c) return json({ error: 'You can only separate your own songs' }, 403);
				creationId = c.id as string;
				if (c.kind === 'music') {
					if (c.status !== 'ready') return json({ error: 'This song is still being created' }, 400);
					const items = ((c.items ?? []) as Record<string, unknown>[]) || [];
					const item = items[index] ?? {};
					title = String(item.title ?? c.title ?? title);
					audioUrl = (typeof item.audio_url === 'string' && item.audio_url) || ((c.result_urls as string[] | null) ?? [])[index] || null;
					if ((c.provider_slug === 'kie-suno' || c.provider_slug === 'kie-suno-jobs') && c.external_task_id && typeof item.id === 'string' && item.id) {
						sunoTaskId = c.external_task_id as string;
						sunoAudioId = item.id;
					}
				} else if (c.kind === 'video') {
					const src = ((c.options ?? {}) as Record<string, unknown>).source as Record<string, unknown> | undefined;
					if (src && typeof src.audio_url === 'string') {
						audioUrl = src.audio_url;
						title = String(src.title ?? c.title ?? title);
					}
				}
			}
			if (!sunoTaskId && !(audioUrl && /^https?:\/\//.test(audioUrl))) {
				return json({ error: 'This song has no audio file to separate' }, 400);
			}
			const apiKey = Deno.env.get('KIE_API_KEY');
			if (!apiKey) return json({ error: 'The stem separation service is not configured yet' }, 400);

			const stemPrice = await priceOf(admin, mode === 'split_stem' ? 'stems_full' : mode === 'split_stem_advanced' ? 'stems_advanced' : 'stems_vocal');
			if (!stemPrice) return json({ error: 'This separation type is not available' }, 403);
			if (!(await planAllows(admin, user.id, stemPrice.plans))) return json({ error: PLAN_ERROR }, 403);
			const stemLimited = await rateLimitError(admin, user.id);
			if (stemLimited) return json({ error: stemLimited }, 429);
			const cost = stemPrice.cost;
			const { data: bal } = await admin.from('credit_balances').select('balance').eq('user_id', user.id).maybeSingle();
			const balance = (bal?.balance as number | undefined) ?? 0;
			if (balance < cost) return json({ error: `You need ${cost} credits and have ${balance}` }, 402);
			const { data: updated } = await admin
				.from('credit_balances')
				.update({ balance: balance - cost, updated_at: new Date().toISOString() })
				.eq('user_id', user.id)
				.eq('balance', balance)
				.select('balance');
			if (!updated || updated.length === 0) return json({ error: 'Please try again' }, 409);

			title = title.slice(0, 120);
			const { data: job, error: jobError } = await admin
				.from('ai_stems')
				.insert({ user_id: user.id, creation_id: creationId, track_id: trackId, item_index: index, title, mode, stem_name: stemName, status: 'generating', credits_spent: cost })
				.select('id, user_id, creation_id, credits_spent')
				.single();
			if (jobError || !job) {
				await admin.from('credit_balances').update({ balance }).eq('user_id', user.id);
				return json({ error: 'Could not start the separation' }, 500);
			}
			await admin.from('credit_transactions').insert({ user_id: user.id, amount: -cost, reason: 'Stem separation', creation_id: creationId });

			let taskId: string | undefined;
			let failMsg = 'The separation service rejected the request';
			if (mode === 'split_stem_advanced') {
				const input: Record<string, unknown> = sunoTaskId ? { task_id: sunoTaskId, audio_id: sunoAudioId } : { audio_url: audioUrl };
				input.type = 'split_stem_advanced';
				input.stem_name = stemName;
				const r = await kieCreateTask(apiKey, 'ai-music-api/separate-vocals', input);
				taskId = r.taskId;
				if (r.error) failMsg = r.error;
			} else {
				const callBackUrl = callbackUrl();
				const request = sunoTaskId
					? { taskId: sunoTaskId, audioId: sunoAudioId, type: mode, callBackUrl }
					: { audioUrl, audio_url: audioUrl, type: mode, callBackUrl };
				const res = await fetch('https://api.kie.ai/api/v1/vocal-removal/generate', {
					method: 'POST',
					headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
					body: JSON.stringify(request),
				});
				const payload = await res.json().catch(() => ({}));
				if (res.ok && payload?.code === 200) taskId = payload?.data?.taskId as string | undefined;
				else if (payload?.msg) failMsg = String(payload.msg);
			}
			if (!taskId) {
				await failStem(admin, job, failMsg);
				return json({ error: failMsg }, 502);
			}
			await admin.from('ai_stems').update({ external_task_id: taskId, updated_at: new Date().toISOString() }).eq('id', job.id);
			return json({ id: job.id });
		}

		if (action === 'stems_status') {
			const { data: job } = await admin
				.from('ai_stems')
				.select('id, user_id, creation_id, status, external_task_id, credits_spent, mode, stem_name')
				.eq('id', String(body.id ?? ''))
				.eq('user_id', user.id)
				.maybeSingle();
			if (!job) return json({ error: 'Not found' }, 404);
			const apiKey = Deno.env.get('KIE_API_KEY');
			if (job.status === 'generating' && job.external_task_id && apiKey) await pollStemJob(admin, job, apiKey);
			return json({ ok: true });
		}

		if (action === 'kie_run') {
			const service = String(body.service ?? '');
			const SONG = ['extend', 'cover', 'upload_extend', 'add_vocals', 'add_instrumental', 'replace_section'];
			const TASK = ['wav', 'video', 'lyrics', 'timestamped_lyrics', 'persona', 'cover_image'];
			if (!SONG.includes(service) && !TASK.includes(service)) return json({ error: 'Unknown service' }, 400);
			const { data: mod } = await admin.from('app_modules').select('enabled').eq('key', 'studio').maybeSingle();
			if (mod && !mod.enabled) return json({ error: 'El Estudio de IA está desactivado' }, 403);
			const apiKey = Deno.env.get('KIE_API_KEY');
			if (!apiKey) return json({ error: 'This service is not configured yet' }, 400);
			const price = await priceOf(admin, service);
			if (!price) return json({ error: 'This service is not available' }, 403);
			if (!(await planAllows(admin, user.id, price.plans))) return json({ error: PLAN_ERROR }, 403);
			const kieLimited = await rateLimitError(admin, user.id);
			if (kieLimited) return json({ error: kieLimited }, 429);

			const p = (body.params ?? {}) as Record<string, unknown>;
			const str = (k: string, max: number) => String(p[k] ?? '').trim().slice(0, max);
			const num = (k: string) => {
				if (p[k] === '' || p[k] == null) return null;
				const n = Number(p[k]);
				return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
			};

			// Source song: must belong to the user. Kie task/audio ids come from our database, never from the client.
			let src: { creationId: string; index: number; title: string; audioUrl: string | null; taskId: string | null; audioId: string | null; lyrics: string; style: string; model: string; duration: number } | null = null;
			if (body.creation_id) {
				const { data: c } = await admin
					.from('ai_creations')
					.select('id, kind, status, provider_slug, external_task_id, items, options, title')
					.eq('id', String(body.creation_id))
					.eq('user_id', user.id)
					.maybeSingle();
				if (!c || c.kind !== 'music') return json({ error: 'You can only use your own songs' }, 403);
				if (c.status !== 'ready') return json({ error: 'This song is still being created' }, 400);
				const index = Math.max(0, Math.floor(Number(body.index ?? 0)));
				const item = (((c.items ?? []) as Record<string, unknown>[])[index] ?? {}) as Record<string, unknown>;
				const opts = (c.options ?? {}) as Record<string, unknown>;
				const fromKie = (c.provider_slug === 'kie-suno' || c.provider_slug === 'kie-suno-jobs') && Boolean(c.external_task_id) && typeof item.id === 'string' && Boolean(item.id);
				let model = typeof opts.model === 'string' ? opts.model : '';
				if (!model && c.provider_slug === 'kie-suno') {
					const { data: prov } = await admin.from('ai_providers').select('model').eq('slug', 'kie-suno').maybeSingle();
					model = (prov?.model as string | undefined) || 'V4_5';
				}
				src = {
					creationId: c.id as string,
					index,
					title: String(item.title ?? c.title ?? 'Untitled').slice(0, 80),
					audioUrl: typeof item.audio_url === 'string' && /^https:\/\//.test(item.audio_url) ? item.audio_url : null,
					taskId: fromKie ? String(c.external_task_id) : null,
					audioId: fromKie ? String(item.id) : null,
					lyrics: String(item.lyrics ?? '').slice(0, 5000),
					style: String(item.tags ?? opts.style ?? '').slice(0, 1000),
					model: model || 'V5',
					duration: Number(item.duration ?? 0),
				};
			}
			const upload = isOwnMediaUrl(p.upload_url, user.id) ? p.upload_url : null;
			if (p.upload_url && !upload) return json({ error: 'Invalid audio file' }, 400);
			const needsKieSong = ['extend', 'replace_section', 'wav', 'video', 'timestamped_lyrics', 'persona', 'cover_image'].includes(service);
			if (needsKieSong && !src?.taskId) return json({ error: 'This option only works with songs created in Qamuz AI' }, 400);
			const audioSource = upload ?? src?.audioUrl ?? null;
			if (['upload_extend', 'add_vocals', 'add_instrumental'].includes(service) && !audioSource) return json({ error: 'Upload an audio file first' }, 400);

			const title = str('title', 80) || src?.title || 'Untitled';
			const style = str('style', 1000) || src?.style || '';
			const lyrics = str('lyrics', 5000);
			const instrumental = Boolean(p.instrumental);
			const vocal = p.vocal === 'm' || p.vocal === 'f' ? p.vocal : undefined;
			const personaId = await resolvePersona(admin, user.id, p.persona_id);
			const withVoice = (o: Record<string, unknown>) => {
				if (instrumental) return o;
				if (lyrics) o.lyrics = lyrics;
				if (vocal) o.vocal_gender = vocal;
				if (personaId && /^V(5|6)/.test(String(o.model ?? ''))) {
					o.persona_id = personaId;
					o.persona_model = 'voice_persona';
				}
				return o;
			};
			const negative = str('negative_tags', 200) || 'low quality, distorted';

			let model = '';
			let input: Record<string, unknown> = {};
			if (service === 'extend' && src) {
				model = 'ai-music-api/extend';
				input = withVoice({ model: src.model, audio_id: src.audioId, instrumental, title });
				if (style) input.style = style;
				const at = num('continue_at');
				if (at && (!src.duration || at < src.duration)) input.continue_at = at;
			} else if (service === 'cover') {
				if (!upload && !src) return json({ error: 'Choose a song or upload an audio file' }, 400);
				model = 'ai-music-api/upload-and-cover-audio';
				const base = upload ? { upload_url: upload } : src?.taskId ? { task_id: src.taskId, audio_id: src.audioId } : { upload_url: audioSource };
				if (!upload && !src?.taskId && !audioSource) return json({ error: 'This song has no audio file' }, 400);
				input = withVoice({ ...base, model: 'V5', instrumental, title });
				if (style) input.style = style;
			} else if (service === 'upload_extend') {
				model = 'ai-music-api/upload-and-extend-audio';
				input = withVoice({ upload_url: audioSource, model: 'V5', instrumental, title });
				if (style) input.style = style;
				const at = num('continue_at');
				if (at) input.continue_at = at;
			} else if (service === 'add_vocals') {
				if (!style) return json({ error: 'Describe the style first' }, 400);
				model = 'ai-music-api/add-vocals';
				input = { upload_url: audioSource, title, style, negative_tags: negative };
				if (lyrics) input.lyrics = lyrics;
				if (vocal) input.vocal_gender = vocal;
			} else if (service === 'add_instrumental') {
				if (!style) return json({ error: 'Describe the style first' }, 400);
				model = 'ai-music-api/add-instrumental';
				input = { upload_url: audioSource, title, tags: style, negative_tags: negative };
			} else if (service === 'replace_section' && src) {
				const s = num('start');
				const e = num('end');
				if (s == null || e == null || e - s < 10) return json({ error: 'The section must be at least 10 seconds long' }, 400);
				if (src.duration > 0 && (e > src.duration || e - s > src.duration / 2)) return json({ error: 'The section can be at most half of the song' }, 400);
				const full = str('full_lyrics', 5000) || src.lyrics;
				if (!full) return json({ error: 'Add the song lyrics' }, 400);
				model = 'ai-music-api/replace-section';
				input = { task_id: src.taskId, audio_id: src.audioId, prompt: lyrics || style || 'New section', tags: style || 'pop', title, infill_start_s: s, infill_end_s: e, full_lyrics: full };
				if (lyrics) input.lyrics = lyrics;
			} else if (service === 'wav' && src) {
				model = 'ai-music-api/convert-to-wav-format';
				input = { task_id: src.taskId, audio_id: src.audioId };
			} else if (service === 'video' && src) {
				model = 'ai-music-api/create-music-video';
				input = { task_id: src.taskId, audio_id: src.audioId, domain_name: 'Qamuz AI' };
				const author = str('author', 50);
				if (author) input.author = author;
			} else if (service === 'cover_image' && src) {
				model = 'ai-music-api/cover-generate';
				input = { task_id: src.taskId };
			} else if (service === 'timestamped_lyrics' && src) {
				model = 'ai-music-api/timeStamped-lyrics';
				input = { task_id: src.taskId, audio_id: src.audioId };
			} else if (service === 'lyrics') {
				const prompt = str('prompt', 200);
				if (prompt.length < 3) return json({ error: 'Describe your idea in 3 to 200 characters' }, 400);
				model = 'ai-music-api/generate-lyrics';
				input = { prompt };
			} else if (service === 'persona' && src) {
				const name = str('name', 80);
				const description = str('description', 300);
				if (!name || !description) return json({ error: 'Add a name and a description' }, 400);
				const vs = num('vocal_start') ?? 0;
				const ve = num('vocal_end') ?? vs + 30;
				if (ve - vs < 10 || ve - vs > 30) return json({ error: 'Choose a vocal segment of 10 to 30 seconds' }, 400);
				model = 'ai-music-api/generate-persona';
				input = { task_id: src.taskId, audio_id: src.audioId, name, description, vocal_start: vs, vocal_end: ve };
				if (style) input.style = style;
			}
			if (!model) return json({ error: 'Choose a song first' }, 400);

			const paid = await charge(admin, user.id, price.cost);
			if (!paid.ok) return json({ error: paid.error }, paid.status);
			const restore = () => admin.from('credit_balances').update({ balance: paid.balance }).eq('user_id', user.id);
			const reason = `AI service: ${price.label}`;

			if (SONG.includes(service)) {
				const { data: creation, error: insErr } = await admin
					.from('ai_creations')
					.insert({
						user_id: user.id,
						kind: 'music',
						prompt: `${price.label}: ${title}`.slice(0, 500),
						title,
						status: 'queued',
						provider_slug: 'kie-suno-jobs',
						credits_spent: price.cost,
						options: { operation: service, source_creation_id: src?.creationId ?? null, source_index: src?.index ?? null, model: (input.model as string | undefined) ?? 'V6', style, instrumental, title },
					})
					.select('id, user_id, kind, status, provider_slug, external_task_id, credits_spent')
					.single<Creation>();
				if (insErr || !creation) {
					await restore();
					return json({ error: 'Could not start the task' }, 500);
				}
				if (price.cost > 0) await admin.from('credit_transactions').insert({ user_id: user.id, amount: -price.cost, reason, creation_id: creation.id });
				const r = await kieCreateTask(apiKey, model, input);
				if (!r.taskId) {
					await refund(admin, creation, r.error ?? 'Kie rejected the request');
					return json({ error: r.error ?? 'Kie rejected the request' }, 502);
				}
				await admin.from('ai_creations').update({ status: 'generating', external_task_id: r.taskId, updated_at: new Date().toISOString() }).eq('id', creation.id);
				return json({ id: creation.id, kind: 'creation' });
			}

			const initial: Record<string, unknown> = service === 'persona' ? { name: input.name, description: input.description } : {};
			const { data: task, error: taskErr } = await admin
				.from('kie_tasks')
				.insert({
					user_id: user.id,
					creation_id: src?.creationId ?? null,
					item_index: src?.index ?? 0,
					service,
					title: service === 'lyrics' ? String(input.prompt) : title,
					status: 'generating',
					credits_spent: price.cost,
					result: initial,
				})
				.select('id, user_id, creation_id, service, external_task_id, credits_spent, result')
				.single();
			if (taskErr || !task) {
				await restore();
				return json({ error: 'Could not start the task' }, 500);
			}
			if (price.cost > 0) await admin.from('credit_transactions').insert({ user_id: user.id, amount: -price.cost, reason, creation_id: src?.creationId ?? null });
			const r = await kieCreateTask(apiKey, model, input);
			if (r.error) {
				await failTask(admin, task, r.error);
				return json({ error: r.error }, 502);
			}
			const now = new Date().toISOString();
			// Persona and synced lyrics can answer immediately.
			if (service === 'persona') {
				const pid = r.data.persona_id ?? r.data.personaId;
				if (typeof pid === 'string' && pid) {
					const rowId = await savePersona(admin, user.id, src?.creationId ?? null, pid, String(input.name), String(input.description));
					await admin.from('kie_tasks').update({ status: 'ready', result: { ...initial, persona: rowId }, external_task_id: r.taskId ?? null, updated_at: now }).eq('id', task.id);
					return json({ id: task.id, kind: 'task' });
				}
			}
			if (service === 'timestamped_lyrics') {
				const inner = (r.data.data ?? r.data) as Record<string, unknown>;
				const words = alignedWords(inner.alignedWords ?? inner.aligned_words);
				if (words.length) {
					await admin.from('kie_tasks').update({ status: 'ready', result: { words }, external_task_id: r.taskId ?? null, updated_at: now }).eq('id', task.id);
					return json({ id: task.id, kind: 'task' });
				}
			}
			if (!r.taskId) {
				await failTask(admin, task, 'The service returned no result');
				return json({ error: 'The service returned no result' }, 502);
			}
			await admin.from('kie_tasks').update({ external_task_id: r.taskId, updated_at: now }).eq('id', task.id);
			return json({ id: task.id, kind: 'task' });
		}

		if (action === 'kie_task_status') {
			const { data: task } = await admin
				.from('kie_tasks')
				.select('id, user_id, creation_id, service, status, external_task_id, credits_spent, result')
				.eq('id', String(body.id ?? ''))
				.eq('user_id', user.id)
				.maybeSingle();
			if (!task) return json({ error: 'Not found' }, 404);
			const apiKey = Deno.env.get('KIE_API_KEY');
			if (task.status === 'generating' && task.external_task_id && apiKey) await pollKieTask(admin, task, apiKey);
			return json({ ok: true });
		}

		return json({ error: 'Acción desconocida' }, 400);
	} catch (err) {
		console.error(err);
		return json({ error: 'Error interno del estudio' }, 500);
	}
});
