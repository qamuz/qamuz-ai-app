import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { DawProject, DawProjectSummary, Lane, LaneType, MasterSettings } from '@/lib/daw/types';
import { DEFAULT_MASTER } from '@/lib/daw/fx';

const COLORS = ['#c8f73c', '#7cf0d8', '#f472b6', '#facc15', '#60a5fa', '#fb923c'];

export function uid(): string {
	return crypto.randomUUID().slice(0, 12);
}

export function newLane(type: LaneType, index: number, name: string): Lane {
	return {
		id: uid(),
		name,
		type,
		instrument: 'piano',
		color: COLORS[index % COLORS.length],
		volume: 0.8,
		pan: 0,
		mute: false,
		solo: false,
		clips: [],
		fx: [],
	};
}

export function newProject(name: string, audioName: string, instrumentName: string): DawProject {
	return { id: null, name, bpm: 120, lanes: [newLane('audio', 0, audioName), newLane('instrument', 1, instrumentName)], master: { ...DEFAULT_MASTER } };
}

export async function listProjects(userId: string): Promise<DawProjectSummary[]> {
	if (!supabase) return [];
	const { data } = await supabase
		.from('daw_projects')
		.select('id, name, bpm, updated_at')
		.eq('user_id', userId)
		.order('updated_at', { ascending: false })
		.limit(50);
	return (data as DawProjectSummary[] | null) ?? [];
}

export async function loadProject(id: string): Promise<DawProject | null> {
	if (!supabase) return null;
	const { data } = await supabase.from('daw_projects').select('id, name, bpm, data').eq('id', id).maybeSingle();
	if (!data) return null;
	const saved = data.data as unknown as { lanes?: Lane[]; master?: MasterSettings } | null;
	const lanes = (saved?.lanes ?? []).map((l) => ({ ...l, fx: l.fx ?? [] }));
	return { id: data.id, name: data.name, bpm: data.bpm, lanes, master: { ...DEFAULT_MASTER, ...(saved?.master ?? {}) } };
}

export async function saveProject(userId: string, project: DawProject): Promise<{ id?: string; error?: string }> {
	if (!supabase) return { error: 'Backend is not connected' };
	const row = {
		name: project.name.trim().slice(0, 120) || 'Untitled project',
		bpm: Math.round(Math.min(240, Math.max(40, project.bpm))),
		data: { lanes: project.lanes, master: project.master ?? DEFAULT_MASTER } as unknown as Json,
	};
	if (project.id) {
		const { error } = await supabase.from('daw_projects').update(row).eq('id', project.id).eq('user_id', userId);
		return error ? { error: error.message } : { id: project.id };
	}
	const { data, error } = await supabase
		.from('daw_projects')
		.insert({ ...row, user_id: userId })
		.select('id')
		.single();
	if (error || !data) return { error: error?.message ?? 'Could not save the project' };
	return { id: data.id };
}

export async function deleteProject(id: string): Promise<void> {
	if (!supabase) return;
	await supabase.from('daw_projects').delete().eq('id', id);
}
