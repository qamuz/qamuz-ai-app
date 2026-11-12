import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { uploadMedia } from '@/lib/media';
import { coverUrl } from '@/lib/covers';
import { fetchOwnAlbums } from '@/lib/artist-panel';
import type { OwnedArtist } from '@/contexts/account-context';
import type { Album } from '@/types/music';
import { Field, Notice, PrimaryButton, TextInput } from '@/components/ui/Field';

export function ArtistAlbumsManager({ artist }: {artist: OwnedArtist;}) {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setAlbums(await fetchOwnAlbums(artist.id)), [artist.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !user || !title.trim()) return;
    setBusy(true);
    setError(null);
    let coverKey: string | null = null;
    if (cover) {
      const res = await uploadMedia(user.id, cover, 'covers');
      if (res.error) {
        setBusy(false);
        setError(res.error);
        return;
      }
      coverKey = res.url ?? null;
    }
    const { error: err } = await supabase.from('albums').insert({ artist_id: artist.id, title: title.trim(), release_date: date || null, cover_key: coverKey });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setTitle('');
    setDate('');
    setCover(null);
    (event.target as HTMLFormElement).reset();
    void load();
  }

  async function remove(album: Album) {
    if (!supabase || !window.confirm(`¿Eliminar el álbum "${album.title}"? Las canciones se conservarán como sencillos.`)) return;
    await supabase.from('albums').delete().eq('id', album.id);
    void load();
  }

  return (
    <div data-ev-id="ev_7102f8a574" className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
			<form data-ev-id="ev_5d828b8185" onSubmit={submit} className="flex h-fit flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
				<h2 data-ev-id="ev_a17ae27ed8" className="text-lg font-bold">Nuevo álbum</h2>
				<Field label="Título">
					<TextInput value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
				</Field>
				<Field label="Fecha de lanzamiento">
					<TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
				</Field>
				<Field label="Portada">
					<input data-ev-id="ev_0f7b532658" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground" />
				</Field>
				{error && <Notice tone="error">{error}</Notice>}
				<PrimaryButton type="submit" disabled={busy || !title.trim()}>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
					Crear álbum
				</PrimaryButton>
			</form>

			<section data-ev-id="ev_658d5378ca" className="flex flex-col gap-3">
				<h2 data-ev-id="ev_1e3679a207" className="text-lg font-bold">Discografía</h2>
				{albums.length === 0 && <p data-ev-id="ev_b5e6ed2900" className="text-sm text-muted-foreground">Aún no tienes álbumes.</p>}
				<div data-ev-id="ev_ade2c49e61" className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
					{albums.map((a) =>
          <div data-ev-id="ev_59ad0b97d6" key={a.id} className="group relative flex flex-col gap-2 rounded-xl bg-surface p-3">
							<img data-ev-id="ev_68a5b00359" src={coverUrl(a.cover_key)} alt={`Portada de ${a.title}`} className="aspect-square w-full rounded-lg object-cover" />
							<span data-ev-id="ev_c3702a4bde" className="truncate text-sm font-semibold">{a.title}</span>
							<span data-ev-id="ev_de13a8ce65" className="text-xs text-muted-foreground">{a.release_date ?? 'Sin fecha'}</span>
							<button data-ev-id="ev_f95d88a97c" type="button" onClick={() => void remove(a)} aria-label={`Eliminar ${a.title}`} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-lg bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100">
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
          )}
				</div>
			</section>
		</div>);

}