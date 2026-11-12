import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNELS = new Set(['copy', 'whatsapp', 'x', 'facebook', 'telegram', 'email', 'native']);
const VIEW_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Records song engagement (views and shares) and recomputes the public counters
 * and trending score. Counters live on `tracks` and can only be written here.
 */
Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

	let body: Record<string, unknown> = {};
	try {
		body = await req.json();
	} catch {
		return json({ error: 'Invalid request' }, 400);
	}
	const trackId = String(body.trackId ?? '');
	const action = String(body.action ?? '');
	if (!UUID.test(trackId) || !['view', 'share', 'sync'].includes(action)) return json({ error: 'Invalid request' }, 400);
	const channel = CHANNELS.has(String(body.channel)) ? String(body.channel) : null;

	// Identify the caller if signed in (anonymous visitors are allowed).
	const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
		global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
	});
	const {
		data: { user },
	} = await userClient.auth.getUser();
	const userId = user?.id ?? null;

	const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

	const { data: track } = await admin.from('tracks').select('id, plays, is_published').eq('id', trackId).maybeSingle();
	if (!track || !track.is_published) return json({ error: 'Song not found' }, 404);

	let plays = track.plays as number;

	// Only verified signed-in users count; anonymous calls just read the current stats.
	if (action === 'view' && userId) {
		let counted = true;
		{
			const since = new Date(Date.now() - VIEW_COOLDOWN_MS).toISOString();
			const { count } = await admin
				.from('track_events')
				.select('id', { count: 'exact', head: true })
				.eq('track_id', trackId)
				.eq('user_id', userId)
				.eq('kind', 'view')
				.gte('created_at', since);
			counted = (count ?? 0) === 0;
		}
		if (counted) {
			await admin.from('track_events').insert({ track_id: trackId, user_id: userId, kind: 'view' });
			plays += 1;
		}
	} else if (action === 'share' && userId) {
		await admin.from('track_events').insert({ track_id: trackId, user_id: userId, kind: 'share', channel });
	}

	const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const countOf = async (table: string, filter: (q: any) => any) => {
		const { count } = await filter(admin.from(table).select('id', { count: 'exact', head: true }).eq('track_id', trackId));
		return count ?? 0;
	};

	const [likes, comments, shares, views7, likes7, comments7, shares7] = await Promise.all([
		countOf('liked_tracks', (q) => q),
		countOf('track_comments', (q) => q),
		countOf('track_events', (q) => q.eq('kind', 'share')),
		countOf('track_events', (q) => q.eq('kind', 'view').gte('created_at', weekAgo)),
		countOf('liked_tracks', (q) => q.gte('created_at', weekAgo)),
		countOf('track_comments', (q) => q.gte('created_at', weekAgo)),
		countOf('track_events', (q) => q.eq('kind', 'share').gte('created_at', weekAgo)),
	]);

	// Recent activity weighs most; all-time plays keep a small baseline.
	const score = Math.round((views7 + likes7 * 3 + comments7 * 2 + shares7 * 5 + Math.log(1 + plays) + likes * 0.5) * 1000) / 1000;

	const stats = { plays, likes_count: likes, comments_count: comments, shares_count: shares };
	await admin
		.from('tracks')
		.update({ ...stats, trending_score: score })
		.eq('id', trackId);

	return json({ stats });
});
