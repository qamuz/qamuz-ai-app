import { useState } from 'react';
import { Mic2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { slugify } from '@/lib/media';
import { Field, Notice, PrimaryButton, TextArea, TextInput } from '@/components/ui/Field';

export function CreateArtistForm() {
  const { user } = useAuth();
  const { refresh } = useAccount();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;
    const finalSlug = slugify(slug || name);
    if (!name.trim() || !finalSlug) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('artists').insert({ owner_id: user.id, name: name.trim(), slug: finalSlug, bio: bio.trim() || null });
    setBusy(false);
    if (err) {
      setError(err.code === '23505' ? 'Esa dirección ya está en uso, prueba con otra.' : err.message);
      return;
    }
    await refresh();
  }

  return (
    <form data-ev-id="ev_ea3fdb811b" onSubmit={submit} className="mx-auto flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-border bg-surface p-6 md:p-8">
			<span data-ev-id="ev_14b8991ff8" className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
				<Mic2 className="h-5 w-5" />
			</span>
			<div data-ev-id="ev_858632b76d" className="flex flex-col gap-1">
				<h1 data-ev-id="ev_c1c5d82a4e" className="text-2xl font-black tracking-tight">Crea tu perfil de artista</h1>
				<p data-ev-id="ev_4349cc5e7d" className="text-sm text-pretty text-muted-foreground">Publica tus canciones, sube letras sincronizadas y conoce a tu audiencia.</p>
			</div>
			<Field label="Nombre artístico">
				<TextInput
          value={name}
          required
          maxLength={80}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="Luna Valdivia" />
        
			</Field>
			<Field label="Dirección del perfil" hint={`/artista/${slugify(slug || name) || 'tu-nombre'}`}>
				<TextInput
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="luna-valdivia" />
        
			</Field>
			<Field label="Biografía">
				<TextArea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={800} placeholder="Cuéntale al mundo quién eres y cómo suena tu música" />
			</Field>
			{error && <Notice tone="error">{error}</Notice>}
			<PrimaryButton type="submit" disabled={busy || !name.trim()}>
				{busy ? 'Creando...' : 'Crear perfil'}
			</PrimaryButton>
		</form>);

}