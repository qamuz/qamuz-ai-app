import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Flame, Globe, Layers, Music, Sparkles, X } from 'lucide-react';
import { MUSIC_TEMPLATES, type MusicTemplate } from '@/lib/music-templates';
import { fetchLastfmTopTags, fetchLastfmTagTracks, lastfmIsLive, type LastfmTag, type LastfmTrack } from '@/lib/lastfm';
import { formatCount } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: MusicTemplate) => void;
  onApplyTag: (tagName: string) => void;
}

export function StudioTemplatesModal({ isOpen, onClose, onApplyTemplate, onApplyTag }: Props) {
  const { t: tr } = useI18n();
  const [tab, setTab] = useState<'templates' | 'trends'>('templates');
  const [category, setCategory] = useState<string>('all');
  const [tags, setTags] = useState<LastfmTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagTracks, setTagTracks] = useState<LastfmTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) setSelectedTag(null);
  }, [isOpen]);

  // Prevent background scrolling while modal is open & listen for Escape key
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && tags.length === 0) {
      void fetchLastfmTopTags(40).then((res) => {
        setTags(res);
        setLive(lastfmIsLive());
      });
    }
  }, [isOpen, tags.length]);

  useEffect(() => {
    if (!selectedTag) {
      setTagTracks([]);
      return;
    }
    let active = true;
    setLoadingTracks(true);
    void fetchLastfmTagTracks(selectedTag, 6).then((res) => {
      if (active) {
        setTagTracks(res);
        setLoadingTracks(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedTag]);

  if (!isOpen || typeof document === 'undefined') return null;

  const categories = [
  { id: 'all', label: tr('Todos') },
  { id: 'urban', label: tr('Urbano & Trap') },
  { id: 'latin', label: tr('Latino & Reggaeton') },
  { id: 'electronic', label: tr('Electrónica & Synth') },
  { id: 'chill', label: tr('Lo-Fi & Chill') },
  { id: 'rock_pop', label: tr('Pop & Rock') },
  { id: 'cinematic', label: tr('Cinemático') }];


  const filteredTemplates = category === 'all' ?
  MUSIC_TEMPLATES :
  MUSIC_TEMPLATES.filter((t) => t.category === category);

  return createPortal(
    <div data-ev-id="ev_8a0ca3f5f2"
    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6"
    role="dialog"
    aria-modal="true"
    aria-label={tr('Plantillas Musicales y Tendencias')}
    onClick={onClose}>
      
			<div data-ev-id="ev_cae103fd86"
      className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-surface shadow-2xl"
      onClick={(e) => e.stopPropagation()}>
        
				{/* Modal Header */}
				<div data-ev-id="ev_d320a9f56d" className="flex items-center justify-between border-b border-border p-5">
					<div data-ev-id="ev_bf2008f732" className="flex items-center gap-3">
						<span data-ev-id="ev_b9befbd8dd" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
							<Sparkles className="h-5 w-5" />
						</span>
						<div data-ev-id="ev_e8709cfe12">
							<h2 data-ev-id="ev_fa57b48b3f" className="text-lg font-black tracking-tight text-foreground sm:text-xl">
								{tr('Inspiración de Estilos & Tendencias')}
							</h2>
							<p data-ev-id="ev_2e07d91c95" className="text-xs text-muted-foreground">
								{tr('Selecciona una plantilla de producción o un tag de Last.fm para rellenar tu estilo sonoro')}
							</p>
						</div>
					</div>
					<button data-ev-id="ev_e55ed96922"
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label={tr('Cerrar ventana')}>
            
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Tab Selector */}
				<div data-ev-id="ev_5a5adccd62" className="flex border-b border-border px-5 pt-2">
					<button data-ev-id="ev_b5148c52a4"
          type="button"
          onClick={() => setTab('templates')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
          tab === 'templates' ?
          'border-primary text-primary' :
          'border-transparent text-muted-foreground hover:text-foreground'}`
          }>
            
						<Layers className="h-4 w-4" />
						{tr('Plantillas de Producción')} ({MUSIC_TEMPLATES.length})
					</button>
					<button data-ev-id="ev_a144e30143"
          type="button"
          onClick={() => setTab('trends')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
          tab === 'trends' ?
          'border-primary text-primary' :
          'border-transparent text-muted-foreground hover:text-foreground'}`
          }>
            
						<Globe className="h-4 w-4" />
						{tr('Tendencias Globales Last.fm')}
					</button>
				</div>

				{/* Body Content */}
				<div data-ev-id="ev_829832472b" className="no-scrollbar flex-1 overflow-y-auto p-5">
					{tab === 'templates' ?
          <div data-ev-id="ev_26dfb1e38d" className="flex flex-col gap-5">
							{/* Category Filters */}
							<div data-ev-id="ev_e5ed8a6559" className="flex flex-wrap gap-1.5">
								{categories.map((c) =>
              <button data-ev-id="ev_e5b32a5d17"
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              category === c.id ?
              'bg-primary text-primary-foreground' :
              'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground'}`
              }>
                
										{c.label}
									</button>
              )}
							</div>

							{/* Template Cards Grid */}
							<div data-ev-id="ev_6181db4b41" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{filteredTemplates.map((t) =>
              <article data-ev-id="ev_c177775a3c"
              key={t.id}
              className="group flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface-2 p-4 transition-all hover:border-primary/50 hover:bg-surface-3">
                
										<div data-ev-id="ev_a3ed913dc7" className="flex flex-col gap-2">
											<div data-ev-id="ev_0b4ac44da2" className="flex items-start justify-between gap-2">
												<span data-ev-id="ev_a7c8219a10" className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
													{t.categoryLabel}
												</span>
												<span data-ev-id="ev_d2805de0a5" className="text-xs font-bold tabular-nums text-muted-foreground">
													{t.bpm} BPM
												</span>
											</div>
											<h3 data-ev-id="ev_211c5db730" className="text-sm font-bold text-foreground group-hover:text-primary">
												{t.name}
											</h3>
											<p data-ev-id="ev_92ad19dd80" className="text-xs text-muted-foreground">{t.mood}</p>

											<div data-ev-id="ev_649cdf99cb" className="mt-1 flex flex-wrap gap-1">
												{t.instruments.slice(0, 3).map((inst) =>
                    <span data-ev-id="ev_55f2623acb"
                    key={inst}
                    className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      
														{inst}
													</span>
                    )}
											</div>
										</div>

										<button data-ev-id="ev_a853d56d34"
                type="button"
                onClick={() => {
                  onApplyTemplate(t);
                  onClose();
                }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/15 py-2 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground">
                  
											<Check className="h-3.5 w-3.5" />
											{tr('Aplicar estilo al creador')}
										</button>
									</article>
              )}
							</div>
						</div> :

          <div data-ev-id="ev_bb1dd5d1f4" className="flex flex-col gap-6">
							<div data-ev-id="ev_53febf8245" className="rounded-xl border border-border bg-surface-2 p-4">
								<h3 data-ev-id="ev_d81197bcc7" className="mb-1 flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
									<Flame className="h-4 w-4 text-primary" />
									{tr('Géneros y etiquetas globales')}
									{live === true &&
                <span data-ev-id="ev_2c72f2057a" className="flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
											<span data-ev-id="ev_b5f5f1c361" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
											{tr('En vivo')}
										</span>
                }
									{live === false &&
                <span data-ev-id="ev_e239afe934" className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
											{tr('Datos de ejemplo · Last.fm sin conectar')}
										</span>
                }
								</h3>
								<p data-ev-id="ev_c8bdf5b490" className="text-xs text-muted-foreground">
									{tr('Selecciona un tag para inyectarlo en el campo de estilo de tu canción en el estudio.')}
								</p>

								{/* Cloud of Tags */}
								<div data-ev-id="ev_f232acf7d6" className="mt-4 flex flex-wrap gap-2">
									{tags.map((tag) => {
                  const isSelected = selectedTag === tag.name;
                  return (
                    <button data-ev-id="ev_4e64612e8e"
                    key={tag.name}
                    type="button"
                    onClick={() => setSelectedTag(tag.name === selectedTag ? null : tag.name)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected ?
                    'bg-primary text-primary-foreground shadow-md' :
                    'bg-surface text-foreground hover:border-primary/40 hover:bg-surface-3'}`
                    }>
                      
												<span data-ev-id="ev_54aa38dc7c">#{tag.name}</span>
												{tag.reach > 0 &&
                      <span data-ev-id="ev_d89efa0daa" className="text-[10px] opacity-75">({formatCount(tag.reach)})</span>
                      }
											</button>);

                })}
								</div>
							</div>

							{selectedTag &&
            <div data-ev-id="ev_6637afb016" className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
									<div data-ev-id="ev_5693f1508a" className="flex flex-wrap items-center justify-between gap-2">
										<div data-ev-id="ev_ba054aac14">
											<h4 data-ev-id="ev_8238629037" className="text-sm font-bold text-foreground">
												{tr('Tag seleccionado: #{tag}', { tag: selectedTag })}
											</h4>
											<p data-ev-id="ev_97ee39d497" className="text-xs text-muted-foreground">
												{tr('Ejemplos de pistas globales asociadas a este sonido')}
											</p>
										</div>
										<button data-ev-id="ev_43b744618c"
                type="button"
                onClick={() => {
                  onApplyTag(selectedTag);
                  onClose();
                }}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-105">
                  
											{tr('+ Añadir #{tag} a mi creación', { tag: selectedTag })}
										</button>
									</div>

									{loadingTracks ?
              <p data-ev-id="ev_342e5225c0" className="py-2 text-xs text-muted-foreground">{tr('Consultando referencias...')}</p> :
              tagTracks.length > 0 ?
              <div data-ev-id="ev_072f452c2b" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
											{tagTracks.map((tr) =>
                <div data-ev-id="ev_d2276f192e"
                key={`${tr.artist}-${tr.name}`}
                className="flex items-center gap-2.5 rounded-lg bg-surface p-2 text-xs">
                  
													<div data-ev-id="ev_82702806bc" className="flex h-8 w-8 flex-none items-center justify-center rounded bg-surface-3 text-primary">
														<Music className="h-4 w-4" />
													</div>
													<div data-ev-id="ev_ea5ca8d73b" className="min-w-0 flex-1">
														<p data-ev-id="ev_39c01d49ac" className="truncate font-semibold text-foreground">{tr.name}</p>
														<p data-ev-id="ev_736f01130d" className="truncate text-[10px] text-muted-foreground">{tr.artist}</p>
													</div>
												</div>
                )}
										</div> :

              <p data-ev-id="ev_69d293894a" className="py-2 text-xs text-muted-foreground">
											{live === false ?
                tr('Las pistas de referencia aparecerán cuando Last.fm esté conectado.') :
                tr('No hay pistas de referencia para este tag.')}
										</p>
              }
								</div>
            }
						</div>
          }
				</div>
			</div>
		</div>,
    document.body
  );
}