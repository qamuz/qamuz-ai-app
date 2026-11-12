import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';
import { Shelf } from '@/components/Shelf';
import { fetchArtistMedia, type ArtistMedia } from '@/lib/social';
import { useI18n } from '@/hooks/useI18n';

export function ArtistGallery({ artistId, artistName }: {artistId: string;artistName: string;}) {
  const [media, setMedia] = useState<ArtistMedia[]>([]);
  const [selected, setSelected] = useState<ArtistMedia | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    let active = true;
    void fetchArtistMedia(artistId).then((rows) => {
      if (active) setMedia(rows);
    });
    return () => {
      active = false;
    };
  }, [artistId]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  if (media.length === 0) return null;

  return (
    <Shelf title={t('Videos & art')}>
			<div data-ev-id="ev_b14cc964a2" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{media.map((m) =>
        <button data-ev-id="ev_66f5a96abc"
        key={m.id}
        type="button"
        onClick={() => setSelected(m)}
        className={`group relative overflow-hidden rounded-xl border border-border bg-surface-2 ${m.kind === 'video' ? 'aspect-video' : 'aspect-square'}`}
        aria-label={`${m.kind === 'video' ? t('Watch video') : t('View image')}: ${m.title ?? artistName}`}>
          
						{m.kind === 'video' ?
          m.thumbnail_url ?
          <img data-ev-id="ev_2d76c0caf4" src={m.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> :

          <video data-ev-id="ev_903d1ce38c" src={`${m.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" /> :


          <img data-ev-id="ev_2f6e3f3d00" src={m.url} alt={m.title ?? t('Artwork by {name}', { name: artistName })} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          }
						{m.kind === 'video' &&
          <span data-ev-id="ev_d7fb11eb8a" className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40">
								<span data-ev-id="ev_e0b59eed9f" className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
									<Play className="h-5 w-5 translate-x-[1px] fill-current" />
								</span>
							</span>
          }
						{m.title &&
          <span data-ev-id="ev_13f52ff786" className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-left text-xs font-semibold text-white">{m.title}</span>
          }
					</button>
        )}
			</div>

			{selected &&
      <div data-ev-id="ev_3ca24626cd" role="dialog" aria-modal="true" aria-label={selected.title ?? t('Enlarged view')} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelected(null)}>
					<button data-ev-id="ev_bdf74e2fb1" type="button" onClick={() => setSelected(null)} aria-label={t('Close')} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-foreground">
						<X className="h-5 w-5" />
					</button>
					<div data-ev-id="ev_3b394d55dc" className="max-h-full w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
						{selected.kind === 'video' ?
          <video data-ev-id="ev_3568454936" src={selected.url} poster={selected.thumbnail_url ?? undefined} controls autoPlay playsInline className="max-h-[85vh] w-full rounded-xl bg-black" /> :

          <img data-ev-id="ev_ce695dd3da" src={selected.url} alt={selected.title ?? t('Artwork by {name}', { name: artistName })} className="mx-auto max-h-[85vh] rounded-xl object-contain" />
          }
						{selected.title && <p data-ev-id="ev_5f492f48a7" className="mt-3 text-center text-sm font-semibold text-white">{selected.title}</p>}
					</div>
				</div>
      }
		</Shelf>);

}