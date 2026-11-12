import { supabase } from '@/integrations/supabase/client';

async function invokeBilling(body: Record<string, unknown>): Promise<{ url?: string; error?: string }> {
	if (!supabase) return { error: 'El backend no está conectado' };
	const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { ...body, origin: window.location.origin } });
	if (error) {
		let message = 'No se pudo conectar con el sistema de pagos';
		const ctx = (error as { context?: Response }).context;
		if (ctx && typeof ctx.json === 'function') {
			try {
				const parsed = (await ctx.json()) as { error?: string };
				if (parsed?.error) message = parsed.error;
			} catch {
				/* keep default */
			}
		}
		return { error: message };
	}
	return { url: (data as { url?: string } | null)?.url };
}

export function startCheckout(planId: string, period: 'monthly' | 'yearly') {
	return invokeBilling({ action: 'checkout', planId, period });
}

export function openBillingPortal() {
	return invokeBilling({ action: 'portal' });
}
