import { supabase } from '@/integrations/supabase/client';
import { invokeStudio } from '@/lib/studio';

export type StemMode = 'separate_vocal' | 'split_stem' | 'split_stem_advanced';

/** Instruments Kie can isolate one at a time (single-instrument stems). */
export const STEM_NAMES = [
	'Lead Vocal', 'Backing Vocals', 'Drum Kit', 'Kick', 'Snare', 'Percussion', 'Bass', 'Synth Bass', 'Upright Bass',
	'Piano', 'Electric Piano', 'Keyboards', 'Organ', 'Synth', 'Synth Pad', 'Synth Lead', 'Synth Keys', 'Synth Strings',
	'Guitar', 'Acoustic Guitar', 'Electric Guitar', 'Lead Electric Guitar', 'Rhythm Electric Guitar', 'Rhythm Acoustic Guitar',
	'String Section', 'Violin', 'Brass Section', 'Trumpet', 'Woodwinds', 'Flute', 'Choir', 'Sound Effects',
];

export interface StemJob {
	id: string;
	creation_id: string | null;
	item_index: number;
	title: string;
	mode: StemMode;
	stem_name?: string | null;
	status: 'generating' | 'ready' | 'error';
	stems: Record<string, string>;
	credits_spent: number;
	error_message: string | null;
	created_at: string;
}

/** `service` is the row in kie_service_prices; `cost` is only a fallback until prices load. */
export const STEM_MODES: { key: StemMode; service: string; label: string; description: string; eta: string; cost: number }[] = [
	{ key: 'separate_vocal', service: 'stems_vocal', label: 'Vocals + instrumental', description: '2 tracks · great for karaoke and remixes', eta: 'About 1 minute', cost: 20 },
	{ key: 'split_stem', service: 'stems_full', label: 'Full stems', description: 'Up to 12 tracks: vocals, drums, bass, guitar, keys and more', eta: 'About 3–5 minutes', cost: 100 },
	{ key: 'split_stem_advanced', service: 'stems_advanced', label: 'Single instrument', description: 'Isolate one instrument or voice with studio precision', eta: 'About 2–4 minutes', cost: 40 },
];

/** Load one of the user's separations (RLS keeps it owner-only). */
export async function fetchStemJob(id: string): Promise<StemJob | null> {
	if (!supabase) return null;
	const { data } = await supabase
		.from('ai_stems')
		.select('id, creation_id, item_index, title, mode, stem_name, status, stems, credits_spent, error_message, created_at')
		.eq('id', id)
		.maybeSingle();
	return (data as unknown as StemJob | null) ?? null;
}

export const STEM_LABELS: Record<string, string> = {
	vocal: 'Vocals',
	backingVocals: 'Backing vocals',
	instrumental: 'Instrumental',
	drums: 'Drums',
	bass: 'Bass',
	guitar: 'Guitar',
	keyboard: 'Keys',
	piano: 'Keys',
	strings: 'Strings',
	brass: 'Brass',
	woodwinds: 'Woodwinds',
	percussion: 'Percussion',
	synth: 'Synth',
	fx: 'FX / Other',
};

const ORDER = Object.keys(STEM_LABELS);

export function sortedStems(stems: Record<string, string>): [string, string][] {
	return Object.entries(stems)
		.filter(([, url]) => typeof url === 'string' && url.length > 0)
		.sort(([a], [b]) => (ORDER.indexOf(a) === -1 ? 99 : ORDER.indexOf(a)) - (ORDER.indexOf(b) === -1 ? 99 : ORDER.indexOf(b)));
}

export async function fetchStemJobs(userId: string): Promise<StemJob[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('ai_stems')
		.select('id, creation_id, item_index, title, mode, stem_name, status, stems, credits_spent, error_message, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(30);
	return (data as unknown as StemJob[] | null) ?? [];
}

export function createStemJob(source: { creation_id: string; index: number } | { track_id: string }, mode: StemMode, stemName?: string) {
	return invokeStudio<{ id: string }>({ action: 'stems_create', ...source, mode, ...(mode === 'split_stem_advanced' ? { stem_name: stemName } : {}) });
}

export function refreshStemJob(id: string) {
	return invokeStudio<{ ok: boolean }>({ action: 'stems_status', id });
}

export async function deleteStemJob(id: string, userId: string): Promise<string | null> {
	if (!supabase) return 'not connected';
	const { error } = await supabase.from('ai_stems').delete().eq('id', id).eq('user_id', userId);
	return error?.message ?? null;
}
