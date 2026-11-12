import { useEffect, useState } from 'react';
import { Check, Coins, Loader2, Settings2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { openBillingPortal, startCheckout } from '@/lib/billing';
import { AppLayout } from '@/components/AppLayout';
import { ModuleDisabled } from '@/components/ModuleDisabled';
import { Notice } from '@/components/ui/Field';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { useModules } from '@/hooks/useModules';
import plansHero from '@/assets/generated/plans-hero.webp';

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  monthly_credits: number;
  features: string[];
  is_highlighted: boolean;
  is_active: boolean;
  sort: number;
  stripe_price_monthly: string | null;
  stripe_price_yearly: string | null;
}

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' });

function PlansContent() {
  const { user } = useAuth();
  const { plan: currentPlan, credits, refresh } = useAccount();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [yearly, setYearly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const paidPlan = Boolean(currentPlan && currentPlan.slug !== 'gratis');

  useEffect(() => {
    const result = params.get('pago');
    if (!result) return;
    if (result === 'ok') {
      setNotice('¡Pago completado! Tu plan y tus créditos se actualizarán en unos segundos.');
      const id = window.setTimeout(() => void refresh(), 4000);
      setParams({}, { replace: true });
      return () => window.clearTimeout(id);
    }
    setNotice('El pago se canceló. No se ha hecho ningún cargo.');
    setParams({}, { replace: true });
  }, [params, setParams, refresh]);

  async function choose(p: Plan, free: boolean) {
    if (free) {
      setNotice(paidPlan ? 'Para volver al plan Gratis, cancela tu suscripción en «Gestionar suscripción».' : 'Ya estás en el plan Gratis.');
      return;
    }
    setBusyId(p.id);
    setNotice(null);
    const { url, error } = await startCheckout(p.id, yearly ? 'yearly' : 'monthly');
    if (url) {
      window.location.href = url;
      return;
    }
    setBusyId(null);
    setNotice(error ?? 'No se pudo iniciar el pago');
  }

  async function manage() {
    setBusyId('portal');
    const { url, error } = await openBillingPortal();
    if (url) {
      window.location.href = url;
      return;
    }
    setBusyId(null);
    setNotice(error ?? 'No se pudo abrir la gestión de la suscripción');
  }

  useEffect(() => {
    if (!supabase) return;
    void supabase.
    from('plans').
    select('*').
    eq('is_active', true).
    order('sort').
    then(({ data }) => setPlans(data as Plan[] | null ?? []));
  }, []);

  return (
    <div data-ev-id="ev_80f9c35476" className="mx-auto flex max-w-[1400px] flex-col gap-10">
			<header data-ev-id="ev_392e1cdfa9" className="relative overflow-hidden rounded-2xl border border-border">
				<img data-ev-id="ev_60617476b7" src={plansHero} width={1792} height={768} alt="" className="h-56 w-full object-cover md:h-72" />
				<div data-ev-id="ev_f3f792ff74" className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" aria-hidden="true" />
				<div data-ev-id="ev_24602f3a97" className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-6 text-center">
					<h1 data-ev-id="ev_e6b3cb8699" className="text-3xl font-black tracking-tight text-balance md:text-5xl">Elige cómo quieres sonar</h1>
					<p data-ev-id="ev_eeaf4f5c32" className="max-w-lg text-sm text-pretty text-muted-foreground">Música sin límites, créditos para el Estudio de IA y herramientas para artistas.</p>
				</div>
			</header>

			<div data-ev-id="ev_71bee57eaa" className="flex flex-col items-center gap-4">
				<div data-ev-id="ev_2259ee62c4" className="inline-flex rounded-xl border border-border bg-surface p-1">
					{[
          { v: false, l: 'Mensual' },
          { v: true, l: 'Anual · 2 meses gratis' }].
          map(({ v, l }) =>
          <button data-ev-id="ev_8973c3e8aa" key={l} type="button" onClick={() => setYearly(v)} className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${yearly === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
							{l}
						</button>
          )}
				</div>
				{user &&
        <p data-ev-id="ev_561704a0c5" className="flex items-center gap-2 text-sm text-muted-foreground">
						<Coins className="h-4 w-4 text-primary" /> Plan actual: <span data-ev-id="ev_10591bdd0a" className="font-semibold text-foreground">{currentPlan?.name ?? 'Gratis'}</span> · {credits} créditos
					</p>
        }
				{user && paidPlan &&
        <button data-ev-id="ev_q_portal01" type="button" onClick={() => void manage()} disabled={busyId === 'portal'} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
						{busyId === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />} Gestionar suscripción
					</button>
        }
			</div>

			{notice &&
      <div data-ev-id="ev_828dbf5ae5" className="mx-auto max-w-xl">
					<Notice>{notice}</Notice>
				</div>
      }

			<div data-ev-id="ev_7ba233c792" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{plans.map((p) => {
          const isCurrent = currentPlan?.id === p.id;
          const price = yearly ? Number(p.price_yearly) : Number(p.price_monthly);
          const free = price === 0;
          return (
            <article data-ev-id="ev_99f1874fcc" key={p.id} className={`relative flex flex-col gap-6 rounded-2xl border p-6 ${p.is_highlighted ? 'border-primary bg-surface-2 shadow-[0_0_40px_-12px] shadow-primary/40' : 'border-border bg-surface'}`}>
							{p.is_highlighted && <span data-ev-id="ev_4963528c9d" className="absolute -top-3 left-6 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">Más elegido</span>}
							<div data-ev-id="ev_ef06c5de9d" className="flex flex-col gap-1">
								<h2 data-ev-id="ev_029a858390" className="text-xl font-black">{p.name}</h2>
								<p data-ev-id="ev_27b84fd555" className="text-sm text-pretty text-muted-foreground">{p.description}</p>
							</div>
							<div data-ev-id="ev_676b7f6dad" className="flex items-end gap-1">
								<span data-ev-id="ev_2c7f8fba35" className="text-4xl font-black tabular-nums">{free ? 'Gratis' : money.format(price)}</span>
								{!free && <span data-ev-id="ev_1b0b24d7f3" className="pb-1 text-sm text-muted-foreground">/{yearly ? 'año' : 'mes'}</span>}
							</div>
							<ul data-ev-id="ev_809e49b4bc" className="flex flex-1 flex-col gap-2.5">
								{p.features.map((f) =>
                <li data-ev-id="ev_d4b158d3fb" key={f} className="flex items-start gap-2 text-sm">
										<Check className="mt-0.5 h-4 w-4 flex-none text-primary" /> {f}
									</li>
                )}
							</ul>
							{!user ?
              <Link data-ev-id="ev_89d7d2cb61" to="/registro" className="flex min-h-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
									Empezar
								</Link> :
              isCurrent ?
              <span data-ev-id="ev_7f33f14f52" className="flex min-h-11 items-center justify-center rounded-full border border-primary text-sm font-bold text-primary">Tu plan actual</span> :

              <button data-ev-id="ev_e4340d4ee5"
              type="button"
              onClick={() => void choose(p, free)}
              disabled={busyId !== null}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full disabled:opacity-60 text-sm font-bold transition-transform hover:scale-[1.02] ${p.is_highlighted ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'}`}>
                
									{busyId === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
									Elegir {p.name}
								</button>
              }
						</article>);

        })}
			</div>
		</div>);

}

export default function PlansPage() {
  const { isEnabled } = useModules();
  return <AppLayout>{isEnabled('payments') ? <PlansContent /> : <ModuleDisabled name="La página de planes" />}</AppLayout>;
}