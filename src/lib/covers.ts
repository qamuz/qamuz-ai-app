import cover1 from '@/assets/generated/cover-1.webp';
import cover2 from '@/assets/generated/cover-2.webp';
import cover3 from '@/assets/generated/cover-3.webp';
import cover4 from '@/assets/generated/cover-4.webp';
import cover5 from '@/assets/generated/cover-5.webp';
import cover6 from '@/assets/generated/cover-6.webp';

const COVERS: Record<string, string> = {
	'cover-1': cover1,
	'cover-2': cover2,
	'cover-3': cover3,
	'cover-4': cover4,
	'cover-5': cover5,
	'cover-6': cover6,
};

/** Resolve a stored cover key (e.g. "cover-3") or an uploaded image URL to a usable image URL. */
export function coverUrl(key?: string | null): string {
	if (key && /^https?:\/\//.test(key)) return key;
	if (key && COVERS[key]) return COVERS[key];
	return cover1;
}
