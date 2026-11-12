import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function mapStatus(status: string): 'active' | 'trialing' | 'past_due' | 'canceled' {
	if (status === 'active' || status === 'trialing' || status === 'canceled') return status;
	if (status === 'incomplete_expired') return 'canceled';
	return 'past_due';
}

function periodEnd(sub: Stripe.Subscription): string | null {
	const raw = (sub as unknown as { current_period_end?: number }).current_period_end ?? (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
	return raw ? new Date(raw * 1000).toISOString() : null;
}

async function syncSubscription(admin: SupabaseClient, sub: Stripe.Subscription) {
	const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
	let userId = sub.metadata?.user_id;
	if (!userId) {
		const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
		userId = data?.user_id as string | undefined;
	}
	if (!userId) return null;

	const row: Record<string, unknown> = {
		user_id: userId,
		status: mapStatus(sub.status),
		current_period_end: periodEnd(sub),
		stripe_customer_id: customerId,
		stripe_subscription_id: sub.id,
		updated_at: new Date().toISOString(),
	};
	if (sub.metadata?.plan_id) row.plan_id = sub.metadata.plan_id;
	if (sub.metadata?.period === 'yearly' || sub.metadata?.period === 'monthly') row.billing_period = sub.metadata.period;
	await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' });
	return userId;
}

async function downgradeToFree(admin: SupabaseClient, sub: Stripe.Subscription) {
	const { data: free } = await admin.from('plans').select('id').eq('slug', 'gratis').maybeSingle();
	if (!free) return;
	await admin
		.from('subscriptions')
		.update({ plan_id: free.id, status: 'active', billing_period: 'monthly', stripe_subscription_id: null, current_period_end: null, updated_at: new Date().toISOString() })
		.eq('stripe_subscription_id', sub.id);
}

async function grantCredits(admin: SupabaseClient, invoice: Stripe.Invoice) {
	const inv = invoice as unknown as { subscription?: string | { id: string }; parent?: { subscription_details?: { subscription?: string } } };
	const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id ?? inv.parent?.subscription_details?.subscription;
	if (!subId) return;

	let { data: row } = await admin.from('subscriptions').select('user_id, plan_id').eq('stripe_subscription_id', subId).maybeSingle();
	if (!row) {
		// invoice.paid can arrive before checkout.session.completed
		await syncSubscription(admin, await stripe.subscriptions.retrieve(subId));
		({ data: row } = await admin.from('subscriptions').select('user_id, plan_id').eq('stripe_subscription_id', subId).maybeSingle());
	}
	if (!row) return;

	const { data: plan } = await admin.from('plans').select('name, monthly_credits').eq('id', row.plan_id).maybeSingle();
	const credits = Number(plan?.monthly_credits ?? 0);
	if (credits <= 0) return;

	const reason = `Plan ${plan?.name} · ${invoice.id}`;
	const { data: already } = await admin.from('credit_transactions').select('id').eq('reason', reason).maybeSingle();
	if (already) return;

	const { data: bal } = await admin.from('credit_balances').select('balance').eq('user_id', row.user_id).maybeSingle();
	if (bal) {
		await admin.from('credit_balances').update({ balance: Number(bal.balance) + credits, updated_at: new Date().toISOString() }).eq('user_id', row.user_id);
	} else {
		await admin.from('credit_balances').insert({ user_id: row.user_id, balance: credits });
	}
	await admin.from('credit_transactions').insert({ user_id: row.user_id, amount: credits, reason });
}

Deno.serve(async (req) => {
	if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

	const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
	if (!stripeKey || !webhookSecret) return new Response('Not configured', { status: 500 });

	const signature = req.headers.get('stripe-signature');
	if (!signature) return new Response('Missing signature', { status: 401 });

	const body = await req.text();
	let event: Stripe.Event;
	try {
		event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
	} catch {
		return new Response('Invalid signature', { status: 401 });
	}

	// Signature verified: safe to use the service role for system writes.
	const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
				if (session.mode === 'subscription' && session.subscription) {
					const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
					await syncSubscription(admin, await stripe.subscriptions.retrieve(subId));
				}
				break;
			}
			case 'customer.subscription.created':
			case 'customer.subscription.updated': {
				const sub = event.data.object as Stripe.Subscription;
				if (sub.status === 'canceled') await downgradeToFree(admin, sub);
				else await syncSubscription(admin, sub);
				break;
			}
			case 'customer.subscription.deleted':
				await downgradeToFree(admin, event.data.object as Stripe.Subscription);
				break;
			case 'invoice.paid':
				await grantCredits(admin, event.data.object as Stripe.Invoice);
				break;
			default:
				break;
		}
	} catch (err) {
		console.error(err);
		return new Response('Webhook handler error', { status: 500 });
	}

	return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
