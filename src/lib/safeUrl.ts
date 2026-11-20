import { supabase } from '@/integrations/supabase/client';

/**
 * Validates and normalizes an external URL so only safe http(s) URLs can be rendered
 * in links or opened in new windows. Blocks javascript:, data:, vbscript:, file:, etc.
 */
export function sanitizeExternalUrl(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (!trimmed || trimmed.length > 2048) return null;
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
		return parsed.toString();
	} catch {
		return null;
	}
}

/**
 * Returns Authorization header with the signed-in user's Supabase JWT when available,
 * so backend /api/* routes can authenticate requests.
 */
export async function getAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
	const headers: Record<string, string> = { ...extra };
	if (!supabase) return headers;
	try {
		const { data } = await supabase.auth.getSession();
		const token = data.session?.access_token;
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}
	} catch {
		// proceed without token if session lookup fails
	}
	return headers;
}
