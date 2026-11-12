import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useModules } from '@/hooks/useModules';
import { Notice, Toggle } from '@/components/ui/Field';

export function AdminModules() {
  const { modules, refresh } = useModules();
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: string, enabled: boolean) {
    if (!supabase) return;
    const { error: err } = await supabase.from('app_modules').update({ enabled, updated_at: new Date().toISOString() }).eq('key', key);
    setError(err ? err.message : null);
    await refresh();
  }

  return (
    <div data-ev-id="ev_8b7dfef022" className="flex max-w-2xl flex-col gap-4">
			<p data-ev-id="ev_b9dc242760" className="text-sm text-pretty text-muted-foreground">Cada módulo funciona de forma independiente. Al desactivarlo desaparece de la navegación y sus páginas muestran un aviso.</p>
			{error && <Notice tone="error">{error}</Notice>}
			<div data-ev-id="ev_d4c915d7d4" className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
				{modules.map((m) =>
        <div data-ev-id="ev_f5c6fd7d1f" key={m.key} className="flex items-center justify-between gap-4 p-4">
						<div data-ev-id="ev_649d144105" className="flex flex-col gap-0.5">
							<span data-ev-id="ev_cb5c2c76de" className="text-sm font-semibold">{m.name}</span>
							<span data-ev-id="ev_a83e75a7be" className="text-xs text-muted-foreground">{m.description}</span>
						</div>
						<Toggle checked={m.enabled} onChange={(v) => void toggle(m.key, v)} label={`Activar ${m.name}`} />
					</div>
        )}
			</div>
		</div>);

}