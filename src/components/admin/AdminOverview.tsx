import { useEffect, useState } from 'react';
import { CreditCard, Headphones, Mic2, Sparkles, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCount } from '@/lib/format';

interface Metrics {
  users: number;
  artists: number;
  tracks: number;
  plays: number;
  creations: number;
  paidSubs: number;
  mrr: number;
  planCounts: {name: string;count: number;}[];
  daily: {label: string;count: number;}[];
  creationsByKind: {kind: string;count: number;}[];
}

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' });
const DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });

export function AdminOverview() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    void (async () => {
      const [users, artists, tracks, creations, subs, history] = await Promise.all([
      client.from('profiles').select('id', { count: 'exact', head: true }),
      client.from('artists').select('id', { count: 'exact', head: true }),
      client.from('tracks').select('plays'),
      client.from('ai_creations').select('kind'),
      client.from('subscriptions').select('status, billing_period, plan:plans(name, price_monthly, price_yearly)'),
      client.from('play_history').select('played_at').gte('played_at', since.toISOString())]
      );
      const trackRows = tracks.data as {plays: number;}[] | null ?? [];
      const subRows = subs.data as unknown as {status: string;billing_period: string;plan: {name: string;price_monthly: number;price_yearly: number;} | null;}[] | null ?? [];
      const planMap = new Map<string, number>();
      let mrr = 0;
      let paid = 0;
      for (const s of subRows) {
        if (!s.plan || s.status !== 'active') continue;
        planMap.set(s.plan.name, (planMap.get(s.plan.name) ?? 0) + 1);
        const monthly = s.billing_period === 'yearly' ? Number(s.plan.price_yearly) / 12 : Number(s.plan.price_monthly);
        if (monthly > 0) {
          paid += 1;
          mrr += monthly;
        }
      }
      const days: {label: string;count: number;key: string;}[] = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        days.push({ key: d.toDateString(), label: DAY.format(d), count: 0 });
      }
      for (const row of history.data as {played_at: string;}[] | null ?? []) {
        const day = days.find((d) => d.key === new Date(row.played_at).toDateString());
        if (day) day.count += 1;
      }
      const kindMap = new Map<string, number>();
      for (const c of creations.data as {kind: string;}[] | null ?? []) kindMap.set(c.kind, (kindMap.get(c.kind) ?? 0) + 1);
      setM({
        users: users.count ?? 0,
        artists: artists.count ?? 0,
        tracks: trackRows.length,
        plays: trackRows.reduce((sum, t) => sum + t.plays, 0),
        creations: (creations.data ?? []).length,
        paidSubs: paid,
        mrr,
        planCounts: [...planMap.entries()].map(([name, count]) => ({ name, count })),
        daily: days,
        creationsByKind: ['music', 'video', 'image'].map((kind) => ({ kind, count: kindMap.get(kind) ?? 0 }))
      });
    })();
  }, []);

  if (!m) return <p data-ev-id="ev_42bff7805d" className="text-sm text-muted-foreground">Cargando métricas...</p>;

  const cards = [
  { label: 'Usuarios', value: formatCount(m.users), icon: Users },
  { label: 'Ingresos mensuales (estimado)', value: money.format(m.mrr), icon: CreditCard },
  { label: 'Suscripciones de pago', value: String(m.paidSubs), icon: CreditCard },
  { label: 'Reproducciones totales', value: formatCount(m.plays), icon: Headphones },
  { label: 'Artistas', value: String(m.artists), icon: Mic2 },
  { label: 'Creaciones con IA', value: String(m.creations), icon: Sparkles }];

  const maxDay = Math.max(1, ...m.daily.map((d) => d.count));
  const kindLabel: Record<string, string> = { music: 'Música', video: 'Video', image: 'Imagen' };

  return (
    <div data-ev-id="ev_f3cc2ead6f" className="flex flex-col gap-6">
			<div data-ev-id="ev_d117709dda" className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
				{cards.map(({ label, value, icon: Icon }) =>
        <div data-ev-id="ev_58470418f3" key={label} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
						<Icon className="h-5 w-5 text-primary" />
						<span data-ev-id="ev_b96096e71d" className="text-2xl font-black tabular-nums">{value}</span>
						<span data-ev-id="ev_f96a2bc794" className="text-xs text-muted-foreground">{label}</span>
					</div>
        )}
			</div>

			<div data-ev-id="ev_cb6f84d859" className="grid gap-4 lg:grid-cols-3">
				<section data-ev-id="ev_21f99faca0" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-span-2">
					<h2 data-ev-id="ev_2d0acabb4c" className="text-base font-bold">Reproducciones de usuarios · últimos 7 días</h2>
					<div data-ev-id="ev_2a1d6cb5e2" className="flex h-48 items-end gap-3">
						{m.daily.map((d) =>
            <div data-ev-id="ev_74c5d92857" key={d.label + d.count} className="flex flex-1 flex-col items-center gap-2">
								<span data-ev-id="ev_7130fc6dbb" className="text-xs tabular-nums text-muted-foreground">{d.count}</span>
								<div data-ev-id="ev_d736734585" className="w-full rounded-t-md bg-primary" style={{ height: `${Math.max(4, d.count / maxDay * 140)}px` }} />
								<span data-ev-id="ev_03973ad664" className="text-xs capitalize text-muted-foreground">{d.label}</span>
							</div>
            )}
					</div>
				</section>

				<section data-ev-id="ev_b1ae2382b9" className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5">
					<div data-ev-id="ev_e51dafb270" className="flex flex-col gap-3">
						<h2 data-ev-id="ev_bce8cf04ee" className="text-base font-bold">Usuarios por plan</h2>
						{m.planCounts.length === 0 && <p data-ev-id="ev_487c58b948" className="text-sm text-muted-foreground">Sin suscripciones aún.</p>}
						{m.planCounts.map((p) =>
            <div data-ev-id="ev_38e02b2471" key={p.name} className="flex justify-between text-sm">
								<span data-ev-id="ev_1626d016a7">{p.name}</span>
								<span data-ev-id="ev_4f956ce574" className="font-semibold tabular-nums">{p.count}</span>
							</div>
            )}
					</div>
					<div data-ev-id="ev_65c8e8416d" className="flex flex-col gap-3 border-t border-border pt-4">
						<h2 data-ev-id="ev_f32d051b0c" className="text-base font-bold">Creaciones por tipo</h2>
						{m.creationsByKind.map((c) =>
            <div data-ev-id="ev_d8ed7eaa78" key={c.kind} className="flex justify-between text-sm">
								<span data-ev-id="ev_8f06f7d2db">{kindLabel[c.kind]}</span>
								<span data-ev-id="ev_67110bf3c1" className="font-semibold tabular-nums">{c.count}</span>
							</div>
            )}
					</div>
				</section>
			</div>
		</div>);

}