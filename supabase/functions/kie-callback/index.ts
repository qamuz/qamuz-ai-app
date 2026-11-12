import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Kie webhook. Every request must carry a valid signature:
 *   X-Webhook-Signature = base64(HMAC-SHA256(taskId + "." + X-Webhook-Timestamp, KIE_WEBHOOK_HMAC_KEY))
 * The body is never trusted beyond the signed taskId: results are re-read from Kie's API.
 * (Helpers below mirror the ones in ai-studio; edge functions are deployed as single files.)
 */

const encoder = new TextEncoder();
const MAX_SKEW_SECONDS = 300;
const KIE_API = 'https://api.kie.ai/api/v1';

function reply(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function hmacBase64(key: string, message: string): Promise<string> {
	const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)));
	let bin = '';
	for (const b of sig) bin += String.fromCharCode(b);
	return btoa(bin);
}

/** Constant-time comparison. */
function safeEqual(a: string, b: string): boolean {
	const x = encoder.encode(a);
	const y = encoder.encode(b);
	if (x.length !== y.length) return false;
	let diff = 0;
	for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
	return diff === 0;
}

type Row = { id: string; user_id: string; credits_spent: number; creation_id?: string | null };

async function addCredits(admin: SupabaseClient, userId: string, amount: number, reason: string, creationId: string | null) {
	const { data } = await admin.from('credit_balances').select('balance').eq('user_id', userId).maybeSingle();
	const balance = (data?.balance as number | undefined) ?? 0;
	await admin.from('credit_balances').update({ balance: balance + amount, updated_at: new Date().toISOString() }).eq('user_id', userId);
	await admin.from('credit_transactions').insert({ user_id: userId, amount, reason, creation_id: creationId });
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

async function savePersona(admin: SupabaseClient, userId: string, creationId: string | null, personaId: string, name: string, description: string) {
	const { data } = await admin
		.from('voice_personas')
		.insert({ user_id: userId, creation_id: creationId, kie_persona_id: personaId, name: name.slice(0, 80), description: description.slice(0, 300) })
		.select('id')
		.single();
	return (data?.id as string | undefined) ?? null;
}

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

function alignedWords(raw: unknown): { word: string; start: number; end: number }[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.slice(0, 3000)
		.map((w: Record<string, unknown>) => ({ word: String(w.word ?? ''), start: Number(w.startS ?? w.start_s ?? 0), end: Number(w.endS ?? w.end_s ?? 0) }))
		.filter((w) => w.word);
}

type TaskRow = Row & { service: string; external_task_id: string | null; result: Record<string, unknown> | null };

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

Deno.serve(async (req) => {
	if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

	const secret = Deno.env.get('KIE_WEBHOOK_HMAC_KEY');
	if (!secret) return reply({ error: 'Webhook verification is not configured' }, 503);

	const raw = await req.text();
	if (raw.length > 1_000_000) return reply({ error: 'Payload too large' }, 413);
	let body: Record<string, unknown>;
	try {
		body = JSON.parse(raw);
	} catch {
		return reply({ error: 'Invalid body' }, 400);
	}

	const data = (body?.data ?? {}) as Record<string, unknown>;
	const taskId = String(data.taskId ?? data.task_id ?? body.taskId ?? body.task_id ?? '');
	const timestamp = req.headers.get('x-webhook-timestamp') ?? '';
	const signature = req.headers.get('x-webhook-signature') ?? '';
	if (!taskId || taskId.length > 200 || !/^\d{9,11}$/.test(timestamp) || !signature) return reply({ error: 'Invalid signature' }, 401);
	if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return reply({ error: 'Expired signature' }, 401);

	const expected = await hmacBase64(secret, `${taskId}.${timestamp}`);
	if (!safeEqual(expected, signature)) return reply({ error: 'Invalid signature' }, 401);

	const apiKey = Deno.env.get('KIE_API_KEY');
	if (!apiKey) return reply({ ok: true });
	const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

	try {
		const { data: creation } = await admin
			.from('ai_creations')
			.select('id, user_id, status, provider_slug, external_task_id, credits_spent')
			.eq('external_task_id', taskId)
			.eq('status', 'generating')
			.maybeSingle();
		if (creation?.provider_slug === 'kie-suno') await pollMusic(admin, creation, apiKey);
		else if (creation?.provider_slug === 'kie-suno-jobs') await pollJobCreation(admin, creation, apiKey);

		const { data: stem } = await admin
			.from('ai_stems')
			.select('id, user_id, creation_id, status, external_task_id, credits_spent, mode, stem_name')
			.eq('external_task_id', taskId)
			.eq('status', 'generating')
			.maybeSingle();
		if (stem) await pollStemJob(admin, stem, apiKey);

		const { data: task } = await admin
			.from('kie_tasks')
			.select('id, user_id, creation_id, service, status, external_task_id, credits_spent, result')
			.eq('external_task_id', taskId)
			.eq('status', 'generating')
			.maybeSingle();
		if (task) await pollKieTask(admin, task, apiKey);
	} catch (err) {
		console.error('kie-callback', err);
	}
	return reply({ ok: true });
});
