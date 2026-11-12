import { supabase } from '@/integrations/supabase/client';
import { invokeStudio } from '@/lib/studio';

/** Kie Suno services offered in the Studio, besides creating a song. */
export type KieService =
	| 'extend'
	| 'cover'
	| 'upload_extend'
	| 'add_vocals'
	| 'add_instrumental'
	| 'replace_section'
	| 'wav'
	| 'video'
	| 'lyrics'
	| 'timestamped_lyrics'
	| 'persona'
	| 'cover_image';

/** Services that produce a new song in the workspace. */
export const SONG_SERVICES: KieService[] = ['extend', 'cover', 'upload_extend', 'add_vocals', 'add_instrumental', 'replace_section'];

/** Services that need a song created in Qamuz AI (they use its Suno ids). */
export const NEEDS_AI_SONG: KieService[] = ['extend', 'replace_section', 'wav', 'video', 'timestamped_lyrics', 'persona', 'cover_image'];

export interface KiePrice {
	service: string;
	label: string;
	user_credits: number;
	enabled: boolean;
	/** Plan slugs that can use it; empty = every plan. */
	allowed_plans: string[];
}

/** Gating only by plan.slug (users without a plan are on "gratis"). */
export function planAllows(price: KiePrice | undefined, planSlug: string | null | undefined): boolean {
	const plans = price?.allowed_plans ?? [];
	return plans.length === 0 || plans.includes(planSlug ?? 'gratis');
}

export interface KieTask {
	id: string;
	creation_id: string | null;
	item_index: number;
	service: KieService;
	title: string | null;
	status: 'generating' | 'ready' | 'error';
	credits_spent: number;
	result: Record<string, unknown>;
	error_message: string | null;
	created_at: string;
}

export interface VoicePersonaRow {
	id: string;
	name: string;
	description: string | null;
	created_at: string;
}

export async function fetchKiePrices(): Promise<Record<string, KiePrice>> {
	if (!supabase) return {};
	const { data } = await supabase.from('kie_service_prices').select('service, label, user_credits, enabled, allowed_plans');
	return Object.fromEntries(((data ?? []) as KiePrice[]).map((p) => [p.service, p]));
}

const TASK_SELECT = 'id, creation_id, item_index, service, title, status, credits_spent, result, error_message, created_at';

export async function fetchKieTasks(userId: string, creationId?: string | null): Promise<KieTask[]> {
	if (!supabase) return [];
	let q = supabase.from('kie_tasks').select(TASK_SELECT).eq('user_id', userId);
	q = creationId ? q.eq('creation_id', creationId) : q.is('creation_id', null);
	const { data } = await q.order('created_at', { ascending: false }).limit(20);
	return (data as unknown as KieTask[] | null) ?? [];
}

export function runKie(service: KieService, source: { creation_id: string; index: number } | null, params: Record<string, unknown>) {
	return invokeStudio<{ id: string; kind: 'creation' | 'task' }>({ action: 'kie_run', service, ...(source ?? {}), params });
}

export function refreshKieTask(id: string) {
	return invokeStudio<{ ok: boolean }>({ action: 'kie_task_status', id });
}

export async function deleteKieTask(id: string, userId: string): Promise<string | null> {
	if (!supabase) return 'not connected';
	const { error } = await supabase.from('kie_tasks').delete().eq('id', id).eq('user_id', userId);
	return error?.message ?? null;
}

export async function fetchVoicePersonas(userId: string): Promise<VoicePersonaRow[]> {
	if (!supabase) return [];
	const { data } = await supabase.from('voice_personas').select('id, name, description, created_at').eq('user_id', userId).order('created_at', { ascending: false });
	return (data as VoicePersonaRow[] | null) ?? [];
}

export async function deleteVoicePersona(id: string, userId: string): Promise<string | null> {
	if (!supabase) return 'not connected';
	const { error } = await supabase.from('voice_personas').delete().eq('id', id).eq('user_id', userId);
	return error?.message ?? null;
}

/** Copy text without the Clipboard API (blocked in this environment). */
export function copyText(text: string) {
	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	document.body.appendChild(textarea);
	textarea.select();
	document.execCommand('copy');
	document.body.removeChild(textarea);
}

/** Synced words → LRC-style lines (one line per ~8 words). */
export function wordsToLrc(words: { word: string; start: number }[]): string {
	const lines: string[] = [];
	for (let i = 0; i < words.length; i += 8) {
		const chunk = words.slice(i, i + 8);
		const s = chunk[0].start;
		const mm = String(Math.floor(s / 60)).padStart(2, '0');
		const ss = (s % 60).toFixed(2).padStart(5, '0');
		lines.push(`[${mm}:${ss}] ${chunk.map((w) => w.word.trim()).join(' ')}`);
	}
	return lines.join('\n');
}
