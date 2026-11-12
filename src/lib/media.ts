import { supabase } from '@/integrations/supabase/client';

/** Upload a file into the user's folder of the public media bucket. */
export async function uploadMedia(userId: string, file: File, folder: string): Promise<{ url?: string; error?: string }> {
	if (!supabase) return { error: 'El backend no está conectado' };
	const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
	const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
	const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type || undefined, upsert: false });
	if (error) return { error: error.message };
	return { url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl };
}

/** Read an audio file's duration in seconds. */
export function audioDuration(file: File): Promise<number> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const audio = new Audio();
		audio.preload = 'metadata';
		audio.onloadedmetadata = () => {
			const d = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
			URL.revokeObjectURL(url);
			resolve(d);
		};
		audio.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(0);
		};
		audio.src = url;
	});
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
		.slice(0, 60);
}
