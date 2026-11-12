import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Eye, EyeOff, Film, ImageIcon, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchArtistMedia, type ArtistMedia } from '@/lib/social';
import type { OwnedArtist } from '@/contexts/account-context';

export function ArtistGalleryManager({ artist }: {artist: OwnedArtist;}) {
  const [media, setMedia] = useState<ArtistMedia[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setMedia(await fetchArtistMedia(artist.id, false));
    setLoading(false);
  }, [artist.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePublished(item: ArtistMedia) {
    if (!supabase) return;
    setMedia((prev) => prev.map((m) => m.id === item.id ? { ...m, is_published: !m.is_published } : m));
    await supabase.from('artist_media').update({ is_published: !item.is_published }).eq('id', item.id);
  }

  async function rename(item: ArtistMedia, title: string) {
    if (!supabase || title === (item.title ?? '')) return;
    await supabase.from('artist_media').update({ title: title || null }).eq('id', item.id);
  }

  async function remove(id: string) {
    if (!supabase) return;
    setMedia((prev) => prev.filter((m) => m.id !== id));
    await supabase.from('artist_media').delete().eq('id', id);
  }

  return (
    <section data-ev-id="ev_392b4dca8d" className="flex flex-col gap-5">
			<div data-ev-id="ev_de0f1fc5ee" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
				<div data-ev-id="ev_13a4abd1a3" className="flex flex-col gap-1">
					<h2 data-ev-id="ev_8fde34812c" className="text-lg font-bold">Galería de tu perfil</h2>
					<p data-ev-id="ev_f262bd8fcf" className="text-sm text-pretty text-muted-foreground">Los videos e imágenes que publiques desde el Estudio aparecen en «Videos y arte» de tu página pública.</p>
				</div>
				<Link data-ev-id="ev_ddd1824c92" to="/estudio" className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">
					<Sparkles className="h-4 w-4" /> Crear en el Estudio
				</Link>
			</div>

			{loading && <p data-ev-id="ev_9fcbfc8d34" className="text-sm text-muted-foreground">Cargando galería...</p>}
			{!loading && media.length === 0 && <p data-ev-id="ev_8ec1cb5e0a" className="text-sm text-muted-foreground">Todavía no has publicado videos ni imágenes.</p>}

			<div data-ev-id="ev_c7b48f6f1b" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{media.map((m) =>
        <article data-ev-id="ev_14f02d3fa9" key={m.id} className={`flex flex-col overflow-hidden rounded-xl border border-border bg-surface ${m.is_published ? '' : 'opacity-60'}`}>
						<div data-ev-id="ev_0aa5329f65" className="relative aspect-video bg-black">
							{m.kind === 'video' ?
            <video data-ev-id="ev_06576d017d" src={m.url} poster={m.thumbnail_url ?? undefined} controls playsInline preload="metadata" className="h-full w-full object-contain" /> :

            <img data-ev-id="ev_3f1f0b4fd1" src={m.url} alt={m.title ?? 'Imagen de la galería'} loading="lazy" className="h-full w-full object-cover" />
            }
							<span data-ev-id="ev_cfbbf4197b" className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs font-bold">
								{m.kind === 'video' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
								{m.kind === 'video' ? 'Video' : 'Imagen'}
							</span>
						</div>
						<div data-ev-id="ev_175f5ed816" className="flex items-center gap-2 p-3">
							<label data-ev-id="ev_78eba2c0f8" className="sr-only" htmlFor={`title-${m.id}`}>
								Título
							</label>
							<input data-ev-id="ev_3f8672c713"
            id={`title-${m.id}`}
            defaultValue={m.title ?? ''}
            placeholder="Título"
            onBlur={(e) => void rename(m, e.target.value.trim())}
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-primary" />
            
							<button data-ev-id="ev_c63b7b232a" type="button" onClick={() => void togglePublished(m)} aria-label={m.is_published ? 'Ocultar del perfil' : 'Mostrar en el perfil'} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground">
								{m.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
							</button>
							<button data-ev-id="ev_055e1f1f4a" type="button" onClick={() => void remove(m.id)} aria-label="Quitar de la galería" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-destructive">
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
					</article>
        )}
			</div>
		</section>);

}