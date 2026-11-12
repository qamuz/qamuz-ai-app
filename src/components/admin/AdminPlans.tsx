import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { slugify } from '@/lib/media';
import type { Plan } from '@/pages/PlansPage';
import { Field, GhostButton, Notice, PrimaryButton, TextArea, TextInput, Toggle } from '@/components/ui/Field';

function PlanEditor({ plan, onSaved }: {plan: Plan;onSaved: () => void;}) {
  const [draft, setDraft] = useState(plan);
  const [features, setFeatures] = useState(plan.features.join('\n'));
  const [status, setStatus] = useState<{tone: 'error' | 'success';text: string;} | null>(null);

  function set<K extends keyof Plan>(key: K, value: Plan[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    if (!supabase) return;
    const { error } = await supabase.
    from('plans').
    update({
      name: draft.name,
      description: draft.description,
      price_monthly: Number(draft.price_monthly),
      price_yearly: Number(draft.price_yearly),
      monthly_credits: Number(draft.monthly_credits),
      features: features.split('\n').map((f) => f.trim()).filter(Boolean),
      is_highlighted: draft.is_highlighted,
      is_active: draft.is_active,
      sort: Number(draft.sort),
      stripe_price_monthly: draft.stripe_price_monthly || null,
      stripe_price_yearly: draft.stripe_price_yearly || null
    }).
    eq('id', plan.id);
    setStatus(error ? { tone: 'error', text: error.message } : { tone: 'success', text: 'Plan guardado' });
    if (!error) onSaved();
  }

  async function remove() {
    if (!supabase || !window.confirm(`¿Eliminar el plan "${plan.name}"?`)) return;
    const { error } = await supabase.from('plans').delete().eq('id', plan.id);
    if (error) {
      setStatus({ tone: 'error', text: error.code === '23503' ? 'Hay usuarios con este plan. Desactívalo en lugar de eliminarlo.' : error.message });
      return;
    }
    onSaved();
  }

  return (
    <article data-ev-id="ev_9fa69f71ee" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
			<div data-ev-id="ev_0d8fb50344" className="flex items-center justify-between gap-3">
				<h3 data-ev-id="ev_7b9365bae1" className="text-lg font-bold">{draft.name || 'Plan sin nombre'}</h3>
				<span data-ev-id="ev_c4f2993810" className="text-xs text-muted-foreground">/{plan.slug}</span>
			</div>
			<div data-ev-id="ev_c69c41fed6" className="grid grid-cols-2 gap-3">
				<Field label="Nombre">
					<TextInput value={draft.name} onChange={(e) => set('name', e.target.value)} />
				</Field>
				<Field label="Orden">
					<TextInput type="number" value={draft.sort} onChange={(e) => set('sort', Number(e.target.value))} />
				</Field>
				<Field label="Precio mensual (USD)">
					<TextInput type="number" step="0.01" min={0} value={draft.price_monthly} onChange={(e) => set('price_monthly', Number(e.target.value))} />
				</Field>
				<Field label="Precio anual (USD)">
					<TextInput type="number" step="0.01" min={0} value={draft.price_yearly} onChange={(e) => set('price_yearly', Number(e.target.value))} />
				</Field>
				<Field label="Créditos IA / mes">
					<TextInput type="number" min={0} value={draft.monthly_credits} onChange={(e) => set('monthly_credits', Number(e.target.value))} />
				</Field>
				<Field label="Descripción">
					<TextInput value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
				</Field>
			</div>
			<Field label="Funciones (una por línea)">
				<TextArea rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} />
			</Field>
			<div data-ev-id="ev_edfe055603" className="grid grid-cols-2 gap-3">
				<Field label="ID de precio Stripe mensual" hint="Para cuando conectes Stripe">
					<TextInput value={draft.stripe_price_monthly ?? ''} onChange={(e) => set('stripe_price_monthly', e.target.value)} placeholder="price_..." />
				</Field>
				<Field label="ID de precio Stripe anual">
					<TextInput value={draft.stripe_price_yearly ?? ''} onChange={(e) => set('stripe_price_yearly', e.target.value)} placeholder="price_..." />
				</Field>
			</div>
			<div data-ev-id="ev_0f8de18d8e" className="flex flex-wrap items-center gap-5">
				<label data-ev-id="ev_5f0b5c7503" className="flex items-center gap-2 text-sm">
					<Toggle checked={draft.is_active} onChange={(v) => set('is_active', v)} label="Activo" /> Visible
				</label>
				<label data-ev-id="ev_dfab29764c" className="flex items-center gap-2 text-sm">
					<Toggle checked={draft.is_highlighted} onChange={(v) => set('is_highlighted', v)} label="Destacado" /> Destacado
				</label>
			</div>
			{status && <Notice tone={status.tone}>{status.text}</Notice>}
			<div data-ev-id="ev_51c041ce4a" className="flex gap-2">
				<PrimaryButton type="button" onClick={() => void save()}>
					<Save className="h-4 w-4" /> Guardar
				</PrimaryButton>
				<GhostButton type="button" onClick={() => void remove()}>
					<Trash2 className="h-4 w-4" /> Eliminar
				</GhostButton>
			</div>
		</article>);

}

export function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('plans').select('*').order('sort');
    setPlans(data as Plan[] | null ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !newName.trim()) return;
    const { error: err } = await supabase.from('plans').insert({ name: newName.trim(), slug: slugify(newName), sort: plans.length + 1, is_active: false });
    if (err) {
      setError(err.code === '23505' ? 'Ya existe un plan con ese nombre.' : err.message);
      return;
    }
    setError(null);
    setNewName('');
    void load();
  }

  return (
    <div data-ev-id="ev_2c8a439660" className="flex flex-col gap-5">
			<form data-ev-id="ev_8039d9ad1f" onSubmit={create} className="flex max-w-md items-end gap-2">
				<Field label="Nuevo plan">
					<TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Estudiante" />
				</Field>
				<PrimaryButton type="submit" disabled={!newName.trim()}>
					<Plus className="h-4 w-4" /> Crear
				</PrimaryButton>
			</form>
			{error && <Notice tone="error">{error}</Notice>}
			<Notice>Los nuevos planes se crean ocultos. Cuando conectes Stripe, añade los ID de precio para activar el pago en línea.</Notice>
			<div data-ev-id="ev_dafb8fb95a" className="grid gap-4 xl:grid-cols-2">
				{plans.map((p) =>
        <PlanEditor key={p.id} plan={p} onSaved={() => void load()} />
        )}
			</div>
		</div>);

}