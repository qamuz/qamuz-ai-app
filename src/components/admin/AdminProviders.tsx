import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchProviders, fetchProvidersStatus, KIND_LABEL, type CreationKind, type ProviderInfo } from '@/lib/studio';
import { slugify } from '@/lib/media';
import { Field, GhostButton, Notice, PrimaryButton, Select, TextInput, Toggle } from '@/components/ui/Field';

type StatusMap = Record<string, {configured: boolean;supported: boolean;}>;

function ProviderEditor({ provider, status, onSaved }: {provider: ProviderInfo;status?: {configured: boolean;supported: boolean;};onSaved: () => void;}) {
  const [draft, setDraft] = useState(() => {
    if (provider.slug === 'openai-image' && (provider.model === 'gpt-image-1' || !provider.model)) {
      return { ...provider, model: 'dall-e-3' };
    }
    return provider;
  });
  const [msg, setMsg] = useState<{tone: 'error' | 'success';text: string;} | null>(null);

  async function save() {
    if (!supabase) return;
    if (draft.is_default) {
      await supabase.from('ai_providers').update({ is_default: false }).eq('kind', draft.kind).neq('id', draft.id);
    }
    const { error } = await supabase.
    from('ai_providers').
    update({
      name: draft.name,
      model: draft.model || null,
      secret_name: draft.secret_name || null,
      credit_cost: Number(draft.credit_cost),
      is_active: draft.is_active,
      is_default: draft.is_default
    }).
    eq('id', draft.id);
    setMsg(error ? { tone: 'error', text: error.message } : { tone: 'success', text: 'Proveedor guardado' });
    if (!error) onSaved();
  }

  async function remove() {
    if (!supabase || !window.confirm(`¿Eliminar ${provider.name}?`)) return;
    await supabase.from('ai_providers').delete().eq('id', provider.id);
    onSaved();
  }

  return (
    <article data-ev-id="ev_ab03093d36" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
			<div data-ev-id="ev_66e9ab352a" className="flex flex-wrap items-center justify-between gap-2">
				<div data-ev-id="ev_f94d38d875" className="flex flex-col">
					<h3 data-ev-id="ev_358e8d5f23" className="text-base font-bold">{provider.name}</h3>
					<span data-ev-id="ev_fd6ccef931" className="text-xs text-muted-foreground">{KIND_LABEL[provider.kind]}</span>
				</div>
				<div data-ev-id="ev_c1e4d199a9" className="flex flex-wrap gap-2 text-xs font-semibold">
					{status?.supported ?
          <span data-ev-id="ev_ee731bb010" className="rounded-md bg-surface-3 px-2 py-1 text-muted-foreground">Integrado</span> :

          <span data-ev-id="ev_c5573e706a" className="rounded-md bg-surface-3 px-2 py-1 text-muted-foreground">Sin integración</span>
          }
					{status?.configured ?
          <span data-ev-id="ev_c1c12bf772" className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-primary">
							<CheckCircle2 className="h-3.5 w-3.5" /> Clave configurada
						</span> :

          <span data-ev-id="ev_9a4b0d61f9" className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-destructive">
							<CircleDashed className="h-3.5 w-3.5" /> Falta clave
						</span>
          }
				</div>
			</div>
			<div data-ev-id="ev_4a1634996f" className="grid grid-cols-2 gap-3">
				<Field label="Nombre">
					<TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
				</Field>
				<Field label="Modelo">
					<TextInput value={draft.model ?? ''} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
				</Field>
				<Field label="Nombre del secreto" hint="Solo el nombre, nunca la clave">
					<TextInput value={draft.secret_name ?? ''} onChange={(e) => setDraft({ ...draft, secret_name: e.target.value.toUpperCase() })} placeholder="MI_PROVEEDOR_API_KEY" />
				</Field>
				<Field label="Créditos por creación">
					<TextInput type="number" min={0} value={draft.credit_cost} onChange={(e) => setDraft({ ...draft, credit_cost: Number(e.target.value) })} />
				</Field>
			</div>
			<div data-ev-id="ev_edb6c9b551" className="flex flex-wrap items-center gap-5">
				<label data-ev-id="ev_a00e1f583b" className="flex items-center gap-2 text-sm">
					<Toggle checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} label="Activo" /> Activo
				</label>
				<label data-ev-id="ev_06837873ac" className="flex items-center gap-2 text-sm">
					<Toggle checked={draft.is_default} onChange={(v) => setDraft({ ...draft, is_default: v })} label="Predeterminado" /> Predeterminado para {KIND_LABEL[draft.kind].toLowerCase()}
				</label>
			</div>
			{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
			<div data-ev-id="ev_231ac14624" className="flex gap-2">
				<PrimaryButton type="button" onClick={() => void save()}>
					<Save className="h-4 w-4" /> Guardar
				</PrimaryButton>
				<GhostButton type="button" onClick={() => void remove()}>
					<Trash2 className="h-4 w-4" /> Eliminar
				</GhostButton>
			</div>
		</article>);

}

export function AdminProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CreationKind>('video');

  const load = useCallback(async () => {
    setProviders(await fetchProviders());
    const res = await fetchProvidersStatus();
    if (res.data) {
      setStatus(res.data.status);
      setStatusError(null);
    } else if (res.error) {
      setStatusError(res.error);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !name.trim()) return;
    await supabase.from('ai_providers').insert({ name: name.trim(), slug: slugify(name), kind, is_active: false });
    setName('');
    void load();
  }

  return (
    <div data-ev-id="ev_d8d129a46c" className="flex flex-col gap-5">
			<Notice>
				Las claves de API se guardan como secretos del servidor (nunca en la base de datos). Integrados ahora: Kie · Suno (música, secreto KIE_API_KEY) y OpenAI (imágenes, secreto OPENAI_API_KEY). Puedes registrar otros proveedores; para que funcionen hay que añadir su integración.
			</Notice>
			{statusError && (
				<Notice tone="error">
					No se pudo verificar el estado de los secretos en el servidor: {statusError}. Asegúrate de que tu usuario tenga el rol 'admin' asignado en la base de datos.
				</Notice>
			)}
			<form data-ev-id="ev_82307b7999" onSubmit={create} className="flex flex-wrap items-end gap-2">
				<Field label="Nuevo proveedor">
					<TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Runway" />
				</Field>
				<Field label="Tipo">
					<Select value={kind} onChange={(e) => setKind(e.target.value as CreationKind)}>
						<option data-ev-id="ev_6bb30798d5" value="music">Música</option>
						<option data-ev-id="ev_c75bc95c23" value="video">Video</option>
						<option data-ev-id="ev_805d0ad6d2" value="image">Imagen</option>
					</Select>
				</Field>
				<PrimaryButton type="submit" disabled={!name.trim()}>
					<Plus className="h-4 w-4" /> Añadir
				</PrimaryButton>
			</form>
			<div data-ev-id="ev_6ea4460c73" className="grid gap-4 xl:grid-cols-2">
				{providers.map((p) =>
        <ProviderEditor key={`${p.id}-${p.is_default}-${p.is_active}`} provider={p} status={status[p.slug]} onSaved={() => void load()} />
        )}
			</div>
		</div>);

}