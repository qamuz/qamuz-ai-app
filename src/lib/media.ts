import { supabase } from '@/integrations/supabase/client';

const ALLOWED_MEDIA_EXTENSIONS = new Set([
	'png', 'jpg', 'jpeg', 'webp', 'gif',
	'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
	'mp4', 'webm', 'mov',
]);

const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
const BLOCKED_MIMES = new Set(['image/svg+xml', 'text/html', 'application/javascript', 'text/javascript']);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

/** Upload a validated media file into the user's folder of the public media bucket. */
export async function uploadMedia(userId: string, file: File, folder: string): Promise<{ url?: string; error?: string }> {
	if (!supabase) return { error: 'El backend no está conectado' };

	const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
	const safeFolder = folder.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'uploads';
	const rawExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	const mime = (file.type || '').toLowerCase().split(';')[0].trim();

	if (!ALLOWED_MEDIA_EXTENSIONS.has(rawExt)) {
		return { error: 'Formato de archivo no permitido. Usa imágenes (PNG/JPG/WEBP), audio (MP3/WAV/M4A) o video (MP4/WEBM).' };
	}
	if (mime && (BLOCKED_MIMES.has(mime) || !ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)))) {
		return { error: 'Tipo de archivo no permitido por seguridad.' };
	}
	const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(rawExt);
	const maxSize = isImage ? MAX_IMAGE_BYTES : MAX_MEDIA_BYTES;
	if (file.size <= 0 || file.size > maxSize) {
		return { error: `El archivo excede el tamaño máximo permitido (${Math.round(maxSize / (1024 * 1024))} MB).` };
	}

	const path = `${safeUserId}/${safeFolder}/${crypto.randomUUID()}.${rawExt}`;
	const { error } = await supabase.storage.from('media').upload(path, file, {
		contentType: mime || undefined,
		upsert: false,
	});
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
