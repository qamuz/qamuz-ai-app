import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Stuck-task reconciler, called every 5 minutes by a database schedule.
 * Finds Kie jobs still "generating" after a while, asks Kie for the real status and saves the result.
 * If Kie never finishes (or the task never started), the row is closed and its credits are refunded once.
 * Auth: the X-Reconcile-Token header must match the SHA-256 stored in internal_job_keys (generated inside the database).
 * (Helpers below mirror the ones in kie-callback; edge functions are deployed as single files.)
 */

const encoder = new TextEncoder();
const KIE_API = 'https://api.kie.ai/api/v1';
const STALE_MINUTES = 10; // ask Kie about jobs older than this
const TIMEOUT_MINUTES = 45; // refund jobs Kie still hasn't finished after this
const NO_TASK_MINUTES = 15; // refund jobs that never got a Kie task id
const BATCH = 25;

function reply(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sha256Hex(value: string): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
	return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

const minutesAgo = (m: number) => Date.now() - m * 60_000;
const olderThan = (ts: string, limit: number) => Date.parse(ts) < limit;

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

/** Still generating after the poll? Re-read the row. */
async function stillGenerating(admin: SupabaseClient, table: string, id: string): Promise<Record<string, unknown> | null> {
	const { data } = await admin.from(table).select('status, result_urls').eq('id', id).maybeSingle();
	return data?.status === 'generating' ? (data as Record<string, unknown>) : null;
}

Deno.serve(async (req) => {
	if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

	const token = req.headers.get('x-reconcile-token') ?? '';
	if (token.length < 32 || token.length > 200) return reply({ error: 'Unauthorized' }, 401);

	const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
	const { data: key } = await admin.from('internal_job_keys').select('token_sha256').eq('name', 'kie_reconcile').maybeSingle();
	const stored = String(key?.token_sha256 ?? '');
	if (!stored || !safeEqual(await sha256Hex(token), stored)) return reply({ error: 'Unauthorized' }, 401);

	const apiKey = Deno.env.get('KIE_API_KEY');
	if (!apiKey) return reply({ error: 'KIE_API_KEY is not configured' }, 503);

	const stats = { checked: 0, refunded: 0 };
	const stale = new Date(minutesAgo(STALE_MINUTES)).toISOString();
	const timeout = minutesAgo(TIMEOUT_MINUTES);
	const noTask = minutesAgo(NO_TASK_MINUTES);

	// Songs (create / extend / cover / add vocals...).
	const { data: creations } = await admin
		.from('ai_creations')
		.select('id, user_id, status, provider_slug, external_task_id, credits_spent, created_at')
		.eq('status', 'generating')
		.in('provider_slug', ['kie-suno', 'kie-suno-jobs'])
		.lt('created_at', stale)
		.order('created_at', { ascending: true })
		.limit(BATCH);
	for (const c of creations ?? []) {
		try {
			stats.checked++;
			if (!c.external_task_id) {
				if (olderThan(c.created_at, noTask)) {
					await refundCreation(admin, c, 'The task could not be started');
					stats.refunded++;
				}
				continue;
			}
			if (c.provider_slug === 'kie-suno') await pollMusic(admin, c, apiKey);
			else await pollJobCreation(admin, c, apiKey);
			if (!olderThan(c.created_at, timeout)) continue;
			const row = await stillGenerating(admin, 'ai_creations', c.id);
			if (!row) continue;
			if (Array.isArray(row.result_urls) && row.result_urls.length > 0) {
				// Kie delivered part of the result: keep what we have instead of refunding.
				await admin.from('ai_creations').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', c.id).eq('status', 'generating');
			} else {
				await refundCreation(admin, c, 'The service took too long. Credits refunded');
				stats.refunded++;
			}
		} catch (err) {
			console.error('kie-reconcile creation', c.id, err);
		}
	}

	// Stems.
	const { data: stems } = await admin
		.from('ai_stems')
		.select('id, user_id, creation_id, status, external_task_id, credits_spent, mode, stem_name, created_at')
		.eq('status', 'generating')
		.lt('created_at', stale)
		.order('created_at', { ascending: true })
		.limit(BATCH);
	for (const s of stems ?? []) {
		try {
			stats.checked++;
			if (!s.external_task_id) {
				if (olderThan(s.created_at, noTask)) {
					await failStem(admin, s, 'The task could not be started');
					stats.refunded++;
				}
				continue;
			}
			await pollStemJob(admin, s, apiKey);
			if (!olderThan(s.created_at, timeout)) continue;
			const { data: row } = await admin.from('ai_stems').select('status').eq('id', s.id).maybeSingle();
			if (row?.status === 'generating') {
				await failStem(admin, s, 'The service took too long. Credits refunded');
				stats.refunded++;
			}
		} catch (err) {
			console.error('kie-reconcile stem', s.id, err);
		}
	}

	// Other AI services (WAV, video, lyrics, persona, cover art).
	const { data: tasks } = await admin
		.from('kie_tasks')
		.select('id, user_id, creation_id, service, status, external_task_id, credits_spent, result, created_at')
		.eq('status', 'generating')
		.lt('created_at', stale)
		.order('created_at', { ascending: true })
		.limit(BATCH);
	for (const t of tasks ?? []) {
		try {
			stats.checked++;
			if (!t.external_task_id) {
				if (olderThan(t.created_at, noTask)) {
					await failTask(admin, t, 'The task could not be started');
					stats.refunded++;
				}
				continue;
			}
			await pollKieTask(admin, t, apiKey);
			if (!olderThan(t.created_at, timeout)) continue;
			const { data: row } = await admin.from('kie_tasks').select('status').eq('id', t.id).maybeSingle();
			if (row?.status === 'generating') {
				await failTask(admin, t, 'The service took too long. Credits refunded');
				stats.refunded++;
			}
		} catch (err) {
			console.error('kie-reconcile task', t.id, err);
		}
	}

	const balance = await checkKieBalance(admin, apiKey).catch((err) => {
		console.error('kie-reconcile balance', err);
		return null;
	});

	return reply({ ok: true, ...stats, kie_balance: balance });
});

const LOW_BALANCE = 2000; // Kie credits (~$10)
const ALERT_EVERY_MS = 24 * 3_600_000;

/** Notifies every admin (bell) when the Kie account runs low; at most once a day while it stays low. */
async function checkKieBalance(admin: SupabaseClient, apiKey: string): Promise<number | null> {
	const res = await fetch(`${KIE_API}/chat/credit`, { headers: { Authorization: `Bearer ${apiKey}` } });
	const payload = await res.json().catch(() => ({}));
	const credits = Number(payload?.data);
	if (!res.ok || payload?.code !== 200 || !Number.isFinite(credits)) return null;

	if (credits >= LOW_BALANCE) {
		await admin.from('internal_alerts').delete().eq('name', 'kie_low_balance');
		return credits;
	}
	const { data: last } = await admin.from('internal_alerts').select('last_sent_at').eq('name', 'kie_low_balance').maybeSingle();
	if (last && Date.now() - Date.parse(last.last_sent_at as string) < ALERT_EVERY_MS) return credits;

	const ids = new Set<string>();
	const { data: roles } = await admin.from('user_roles').select('user_id').eq('role', 'admin');
	for (const r of roles ?? []) ids.add(r.user_id as string);
	if (ids.size === 0) {
		const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
		const owner = list?.users.find((u) => u.email?.toLowerCase() === 'admin@qamuz.com');
		if (owner) ids.add(owner.id);
	}
	const rounded = String(Math.floor(credits));
	if (ids.size > 0) {
		await admin.from('notifications').insert(
			[...ids].map((user_id) => ({
				user_id,
				type: 'system',
				title: 'Kie balance is low: {credits} credits left. Top up your Kie account so AI tools keep working.',
				meta: { credits: rounded },
				link: '/admin',
			})),
		);
	}
	await admin.from('internal_alerts').upsert({ name: 'kie_low_balance', last_value: credits, last_sent_at: new Date().toISOString() });
	return credits;
}
