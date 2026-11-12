import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Notice, Select, TextInput } from '@/components/ui/Field';

interface Row {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  role: string;
  plan_id: string | null;
  credits: number;
}

const ROLE_LABEL: Record<string, string> = { listener: 'Oyente', artist: 'Artista', admin: 'Administrador' };

export function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<{id: string;name: string;}[]>([]);
  const [term, setTerm] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    const [profiles, roles, subs, credits, planRes] = await Promise.all([
    client.from('profiles').select('id, email, display_name, created_at').order('created_at', { ascending: false }).limit(500),
    client.from('user_roles').select('user_id, role'),
    client.from('subscriptions').select('user_id, plan_id'),
    client.from('credit_balances').select('user_id, balance'),
    client.from('plans').select('id, name').order('sort')]
    );
    const roleMap = new Map((roles.data ?? []).map((r) => [r.user_id, r.role]));
    const subMap = new Map((subs.data ?? []).map((s) => [s.user_id, s.plan_id]));
    const creditMap = new Map((credits.data ?? []).map((c) => [c.user_id, c.balance]));
    setPlans(planRes.data ?? []);
    setRows(
      (profiles.data ?? []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) ?? 'listener',
        plan_id: subMap.get(p.id) ?? null,
        credits: creditMap.get(p.id) ?? 0
      }))
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => `${r.email ?? ''} ${r.display_name ?? ''}`.toLowerCase().includes(t));
  }, [rows, term]);

  function flash(id: string) {
    setSavedId(id);
    window.setTimeout(() => setSavedId((cur) => cur === id ? null : cur), 1500);
  }

  async function setRole(row: Row, role: string) {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.from('user_roles').update({ role }).eq('user_id', row.id);
    if (err) {
      setError(`No se pudo actualizar el rol: ${err.message}. Asegúrate de que tu usuario tenga rol admin en la base de datos.`);
    } else {
      flash(row.id);
    }
    void load();
  }

  async function setPlan(row: Row, planId: string) {
    if (!supabase) return;
    setError(null);
    const res = row.plan_id
      ? await supabase.from('subscriptions').update({ plan_id: planId, status: 'active', updated_at: new Date().toISOString() }).eq('user_id', row.id)
      : await supabase.from('subscriptions').insert({ user_id: row.id, plan_id: planId, status: 'active' });
    if (res.error) {
      setError(`No se pudo actualizar el plan: ${res.error.message}`);
    } else {
      flash(row.id);
    }
    void load();
  }

  async function setCredits(row: Row, value: number) {
    if (!supabase || Number.isNaN(value) || value === row.credits) return;
    setError(null);
    const { error: err } = await supabase.from('credit_balances').update({ balance: Math.max(0, Math.round(value)), updated_at: new Date().toISOString() }).eq('user_id', row.id);
    if (err) {
      setError(`No se pudieron actualizar los créditos: ${err.message}`);
    } else {
      flash(row.id);
    }
    void load();
  }

  return (
    <div data-ev-id="ev_8bde56f2da" className="flex flex-col gap-4">
      {error && <Notice tone="error">{error}</Notice>}
			<div data-ev-id="ev_223ce82652" className="relative max-w-sm">
				<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<TextInput value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar por nombre o correo" className="pl-9" aria-label="Buscar usuarios" />
			</div>
			<div data-ev-id="ev_72dadeb8be" className="overflow-x-auto rounded-xl border border-border">
				<table data-ev-id="ev_4134356028" className="w-full min-w-[760px] text-left text-sm">
					<thead data-ev-id="ev_033944f5a1" className="bg-surface text-xs text-muted-foreground">
						<tr data-ev-id="ev_84c6d449c6">
							<th data-ev-id="ev_f9d15f0320" className="px-4 py-3 font-semibold">Usuario</th>
							<th data-ev-id="ev_a5b9759cab" className="px-4 py-3 font-semibold">Rol</th>
							<th data-ev-id="ev_7c9e8a9acb" className="px-4 py-3 font-semibold">Plan</th>
							<th data-ev-id="ev_fde8300055" className="px-4 py-3 font-semibold">Créditos</th>
							<th data-ev-id="ev_b65d2c6293" className="px-4 py-3 font-semibold">Alta</th>
						</tr>
					</thead>
					<tbody data-ev-id="ev_06faacee55">
						{filtered.map((r) =>
            <tr data-ev-id="ev_e34cd006aa" key={r.id} className="border-t border-border">
								<td data-ev-id="ev_8ff315665e" className="px-4 py-3">
									<div data-ev-id="ev_17789e77bb" className="flex flex-col">
										<span data-ev-id="ev_e565984405" className="font-semibold">{r.display_name || 'Sin nombre'}</span>
										<span data-ev-id="ev_d988020f6f" className="text-xs text-muted-foreground">{r.email}</span>
									</div>
								</td>
								<td data-ev-id="ev_88b6656613" className="px-4 py-3">
									<Select value={r.role} onChange={(e) => void setRole(r, e.target.value)} aria-label="Rol" className="py-1.5">
										{Object.entries(ROLE_LABEL).map(([v, l]) =>
                  <option data-ev-id="ev_59d23ae6b3" key={v} value={v}>
												{l}
											</option>
                  )}
									</Select>
								</td>
								<td data-ev-id="ev_65a18079c8" className="px-4 py-3">
									<Select value={r.plan_id ?? ''} onChange={(e) => void setPlan(r, e.target.value)} aria-label="Plan" className="py-1.5">
										{!r.plan_id && <option data-ev-id="ev_7971fbfffb" value="">Sin plan</option>}
										{plans.map((p) =>
                  <option data-ev-id="ev_e6e6b04a59" key={p.id} value={p.id}>
												{p.name}
											</option>
                  )}
									</Select>
								</td>
								<td data-ev-id="ev_c3188da087" className="px-4 py-3">
									<TextInput
                  type="number"
                  min={0}
                  defaultValue={r.credits}
                  key={`${r.id}-${r.credits}`}
                  onBlur={(e) => void setCredits(r, Number(e.target.value))}
                  aria-label="Créditos"
                  className="w-24 py-1.5" />
                
								</td>
								<td data-ev-id="ev_859e34a174" className="px-4 py-3 text-xs text-muted-foreground">
									{savedId === r.id ? <span data-ev-id="ev_6440a77c4d" className="font-semibold text-primary">Guardado</span> : new Date(r.created_at).toLocaleDateString('es-ES')}
								</td>
							</tr>
            )}
					</tbody>
				</table>
				{filtered.length === 0 && <p data-ev-id="ev_839175ab50" className="p-6 text-center text-sm text-muted-foreground">No hay usuarios que coincidan.</p>}
			</div>
		</div>);

}