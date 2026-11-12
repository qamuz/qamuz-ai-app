import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

	const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
	if (!stripeKey) return json({ error: 'Los pagos en línea todavía no están configurados' }, 400);

	const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
		global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
	});
	const {
		data: { user },
	} = await userClient.auth.getUser();
	if (!user) return json({ error: 'Debes iniciar sesión' }, 401);

	// Trusted writes (Stripe customer id) after the user is verified.
	const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
	const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

	let body: Record<string, unknown> = {};
	try {
		body = await req.json();
	} catch {
		return json({ error: 'Solicitud inválida' }, 400);
	}
	const origin = String(body.origin ?? '');
	if (!/^https?:\/\/[^\s/]+$/.test(origin)) return json({ error: 'Origen inválido' }, 400);

	const { data: sub } = await admin
		.from('subscriptions')
		.select('id, status, stripe_customer_id, stripe_subscription_id')
		.eq('user_id', user.id)
		.maybeSingle();

	try {
		if (body.action === 'checkout') {
			const period = body.period === 'yearly' ? 'yearly' : 'monthly';
			const { data: plan } = await admin
				.from('plans')
				.select('id, name, price_monthly, price_yearly, stripe_price_monthly, stripe_price_yearly')
				.eq('id', String(body.planId ?? ''))
				.eq('is_active', true)
				.maybeSingle();
			if (!plan) return json({ error: 'Plan no encontrado' }, 404);
			const amount = Number(period === 'yearly' ? plan.price_yearly : plan.price_monthly);
			if (!(amount > 0)) return json({ error: 'Este plan es gratuito' }, 400);

			if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status as string)) {
				return json({ error: 'Ya tienes una suscripción de pago. Usa «Gestionar suscripción» para cambiarla o cancelarla.' }, 409);
			}

			let customerId = sub?.stripe_customer_id as string | null | undefined;
			if (!customerId) {
				const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
				customerId = customer.id;
				await admin.from('subscriptions').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
			}

			const priceId = (period === 'yearly' ? plan.stripe_price_yearly : plan.stripe_price_monthly) as string | null;
			const lineItem = priceId
				? { price: priceId, quantity: 1 }
				: {
						quantity: 1,
						price_data: {
							currency: 'usd',
							unit_amount: Math.round(amount * 100),
							recurring: { interval: period === 'yearly' ? ('year' as const) : ('month' as const) },
							product_data: { name: `Qamuz AI · Plan ${plan.name}` },
						},
					};
			const metadata = { user_id: user.id, plan_id: plan.id as string, period };
			const session = await stripe.checkout.sessions.create({
				mode: 'subscription',
				customer: customerId,
				line_items: [lineItem],
				client_reference_id: user.id,
				metadata,
				subscription_data: { metadata },
				allow_promotion_codes: true,
				locale: 'es',
				success_url: `${origin}/planes?pago=ok`,
				cancel_url: `${origin}/planes?pago=cancelado`,
			});
			return json({ url: session.url });
		}

		if (body.action === 'portal') {
			if (!sub?.stripe_customer_id) return json({ error: 'Todavía no tienes una suscripción de pago' }, 400);
			const portal = await stripe.billingPortal.sessions.create({
				customer: sub.stripe_customer_id as string,
				return_url: `${origin}/planes`,
				locale: 'es',
			});
			return json({ url: portal.url });
		}

		return json({ error: 'Acción desconocida' }, 400);
	} catch (err) {
		console.error(err);
		const message = err instanceof Stripe.errors.StripeError ? err.message : 'No se pudo conectar con Stripe';
		return json({ error: message }, 500);
	}
});
