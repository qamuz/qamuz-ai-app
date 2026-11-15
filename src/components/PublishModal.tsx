import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UploadCloud,
  Sparkles,
  ZoomIn,
  ZoomOut,
  BadgeCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Music,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { isTrackOwner } from '@/lib/engagement';
import { uploadMedia } from '@/lib/media';
import { coverUrl } from '@/lib/covers';
import { createCreation, fetchCreation, refreshCreation } from '@/lib/studio';
import { magicEnhancePrompt } from '@/lib/nle/maestroDirector';
import type { TrackWithArtist } from '@/types/music';

export interface PublishModalProps {
  track: TrackWithArtist | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (updated: {
    title: string;
    genre: string | null;
    cover_key?: string | null;
    is_published: boolean;
  }) => void;
}

const POPULAR_GENRES = [
  'Bachata',
  'Dembow',
  'Reggaeton',
  'Trap Latino',
  'Salsa',
  'Merengue',
  'Urbano',
  'Afrobeat',
  'Pop',
  'Rock',
];

const AI_STYLES = [
  { label: '🌆 Neón Cyberpunk', prompt: 'estilo cyberpunk futurista, iluminación de neón turquesa y vino, destellos luminosos y alto contraste cinemático' },
  { label: '🎨 Óleo Clásico', prompt: 'estilo pintura al óleo sobre lienzo clásico, pinceladas texturizadas, arte renacentista dramático' },
  { label: '💿 Vinilo Vintage 80s', prompt: 'estilo carátula de disco de vinilo retro de los 80, grano analógico, tipografía retro e ilustración vintage' },
  { label: '🏝️ Caribe Tropical', prompt: 'estilo caribeño dominicano tropical, atardecer dorado en el mar, palmeras y estética musical cálida' },
  { label: '💎 Render 3D Abstracto', prompt: 'estilo render 3D hiperrealista, formas geométricas de vidrio y cromo brillante con reflejos y refracciones' },
  { label: '🌌 Galaxia & Cosmos', prompt: 'estilo cósmico de nebulosas espaciales, estrellas brillantes y atmósfera profunda interestelar' },
];

export function PublishModal({ track, isOpen, onClose, onUpdated }: PublishModalProps) {
  const { user } = useAuth();
  const { artist, isAdmin } = useAccount();

  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [zoomLevel, setZoomLevel] = useState(0);
  const [currentCover, setCurrentCover] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isSuggestingPrompt, setIsSuggestingPrompt] = useState(false);
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState(false);

  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [alreadyPublic, setAlreadyPublic] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isOwner = track ? isTrackOwner(track, { artist, isAdmin }) : false;
  const isDifferentOwner = Boolean(track && user && !isOwner && !isAdmin);

  useEffect(() => {
    if (isOpen && track) {
      setTitle(track.title || '');
      setGenre(track.genre || '');
      setTagsInput(track.genre ? `#${track.genre.toLowerCase()}` : '');
      setZoomLevel(0);
      setCurrentCover(track.cover_key || null);
      setAlreadyPublic(Boolean(track.is_published));
      setSubmitError('');
      setSubmitSuccess('');
      setConfirmUnpublish(false);
      setShowAiPrompt(false);
      setAiPrompt(
        `Portada artística futurista y cinematográfica para la canción "${track.title}" estilo ${track.genre || 'música moderna'}`
      );
    }
  }, [isOpen, track]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !track) return null;

  const displayCover = currentCover ? coverUrl(currentCover) : coverUrl(track.cover_key);

  async function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('Por favor selecciona una imagen válida (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setSubmitError('El archivo es demasiado grande (máximo 8MB).');
      return;
    }

    setIsUploadingCover(true);
    setSubmitError('');
    try {
      const { url, error } = await uploadMedia(user.id, file, 'covers');
      if (error || !url) {
        setSubmitError(error || 'Error al subir la portada.');
        return;
      }
      setCurrentCover(url);
      setSubmitSuccess('Portada subida correctamente');
      setTimeout(() => setSubmitSuccess(''), 2500);
    } catch {
      setSubmitError('Error de red al subir la portada.');
    } finally {
      setIsUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSuggestPrompt() {
    if (isSuggestingPrompt || isGeneratingAiCover) return;
    setIsSuggestingPrompt(true);
    setSubmitError('');
    try {
      const randomStyle = AI_STYLES[Math.floor(Math.random() * AI_STYLES.length)];
      const baseIdea = aiPrompt.trim() || `Portada artística musical para "${title || track?.title || 'canción'}", ${randomStyle.prompt}`;
      const enhanced = await magicEnhancePrompt(baseIdea, {
        mode: 'cover-prompt',
        songTitle: title || track?.title || undefined,
        style: genre || track?.genre || randomStyle.label,
      });
      setAiPrompt(enhanced);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo sugerir el prompt con IA.');
    } finally {
      setIsSuggestingPrompt(false);
    }
  }

  function handleSelectStyle(stylePrompt: string) {
    const nextPrompt = `Portada de álbum para "${title || track?.title || 'canción'}" (${genre || 'música'}), ${stylePrompt}, composición icónica 8k`;
    setAiPrompt(nextPrompt);
    void handleGenerateAiCoverWithPrompt(nextPrompt);
  }

  async function handleGenerateAiCoverWithPrompt(customPrompt?: string) {
    if (!user) {
      setSubmitError('Inicia sesión para generar portadas con IA.');
      return;
    }
    const prompt = (customPrompt || aiPrompt).trim();
    if (!prompt) {
      setSubmitError('Escribe una descripción para la portada.');
      return;
    }

    setIsGeneratingAiCover(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      const createdRes = await createCreation('image', prompt, {
        size: '1024x1024',
        aspect_ratio: '1:1',
        style: genre || 'Album cover',
      });

      if (createdRes.error || !createdRes.data?.id) {
        setSubmitError(createdRes.error || 'No se pudo iniciar la generación de la portada en Modal.');
        return;
      }

      const creationId = createdRes.data.id;
      for (let i = 0; i < 48; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        await refreshCreation(creationId);
        const created = await fetchCreation(creationId);
        if (created?.status === 'ready' && (created.result_urls?.[0] || created.thumbnail_url)) {
          const url = created.result_urls?.[0] || created.thumbnail_url || '';
          setCurrentCover(url);
          setSubmitSuccess('¡Portada recreada con éxito por la IA!');
          setTimeout(() => setSubmitSuccess(''), 3500);
          return;
        }
        if (created?.status === 'error') {
          setSubmitError(created.error_message || 'La IA devolvió un error al generar la portada.');
          return;
        }
      }

      setSubmitError('La generación de portada tardó demasiado. Intenta de nuevo en unos momentos.');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error conectando con la IA de portadas.');
    } finally {
      setIsGeneratingAiCover(false);
    }
  }

  async function handleGenerateAiCover() {
    await handleGenerateAiCoverWithPrompt();
  }

  async function handlePublish() {
    if (!track) return;
    if (isDifferentOwner) {
      setSubmitError('Solo el creador puede publicar o editar esta canción.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSubmitError('Escribe un título antes de publicar.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      const trimmedGenre = genre.trim() || null;
      const updates: {
        title: string;
        genre: string | null;
        is_published: boolean;
        cover_key?: string | null;
      } = {
        title: trimmedTitle,
        genre: trimmedGenre,
        is_published: true,
      };

      if (currentCover) {
        updates.cover_key = currentCover;
      }

      if (supabase && track.id && !track.id.startsWith('ai-')) {
        const { error: dbError } = await supabase
          .from('tracks')
          .update(updates)
          .eq('id', track.id);

        if (dbError) {
          console.error('Error updating track:', dbError);
          setSubmitError('No se pudo guardar la publicación en el servidor.');
          setIsSubmitting(false);
          return;
        }
      }

      setAlreadyPublic(true);
      setSubmitSuccess(
        alreadyPublic
          ? '¡Publicación actualizada con éxito!'
          : '¡Canción publicada! Ya es visible en el feed público.'
      );

      onUpdated?.(updates);

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error(err);
      setSubmitError('Ocurrió un error inesperado al publicar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnpublish() {
    if (!track || isSubmitting) return;
    if (isDifferentOwner) {
      setSubmitError('Solo el creador puede despublicar esta canción.');
      return;
    }

    if (!confirmUnpublish) {
      setConfirmUnpublish(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      if (supabase && track.id && !track.id.startsWith('ai-')) {
        const { error: dbError } = await supabase
          .from('tracks')
          .update({ is_published: false })
          .eq('id', track.id);

        if (dbError) {
          setSubmitError('No se pudo despublicar la canción.');
          setIsSubmitting(false);
          return;
        }
      }

      setAlreadyPublic(false);
      setConfirmUnpublish(false);
      setSubmitSuccess('Canción despublicada. Ya no aparece en el feed público.');

      onUpdated?.({
        title,
        genre: genre.trim() || null,
        cover_key: currentCover,
        is_published: false,
      });

      setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setSubmitError('Error al despublicar la canción.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div
      data-ev-id="ev_publish_modal_backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div
        data-ev-id="ev_publish_modal_card"
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar modal"
          className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground sm:right-6 sm:top-6"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="shrink-0 border-b border-border p-4 pb-3 pr-12 sm:p-7 sm:pb-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {alreadyPublic ? 'Publicación' : 'Publicar'}
          </h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
            {alreadyPublic
              ? 'Esta canción ya está publicada. Puedes actualizar los datos o despublicarla.'
              : 'Al publicar, otras personas pueden descubrir tu canción en el feed y Shorts.'}
          </p>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:gap-5 sm:px-7 sm:py-5">
          {/* Alert if not owner */}
          {isDifferentOwner && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-200 sm:text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-100">Canción de otro artista</p>
                <p className="mt-0.5 text-xs text-amber-200/80">
                  Solo el creador original de esta canción tiene permiso para editar sus datos o publicarla.
                </p>
              </div>
            </div>
          )}

          {/* Already published banner */}
          {alreadyPublic && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-100 sm:text-sm">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <p className="font-semibold text-amber-50">Ya publicada</p>
                <p className="mt-0.5 text-xs text-amber-100/75">
                  Visible en el feed público y YouTube Shorts de QAMUZ.
                </p>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {submitError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300 sm:text-sm">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300 sm:text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              {submitSuccess}
            </div>
          )}

          {/* Title input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="publishTitle" className="text-xs font-semibold text-foreground sm:text-sm">
              Título
            </label>
            <div className="relative flex items-center">
              <input
                id="publishTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
                disabled={isDifferentOwner || isSubmitting}
                placeholder="Nombre de la canción"
                className="w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-3.5 pr-16 text-sm text-foreground transition-colors hover:border-border/80 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="absolute right-3.5 font-mono text-[11px] text-muted-foreground">
                {title.length} / 50
              </span>
            </div>
          </div>

          {/* Genre and Tags */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="publishGenre" className="text-xs font-semibold text-foreground sm:text-sm">
                Género
              </label>
              <input
                id="publishGenre"
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                maxLength={40}
                placeholder="ej. Bachata"
                disabled={isDifferentOwner || isSubmitting}
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground transition-colors hover:border-border/80 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              {/* Genre chips */}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {POPULAR_GENRES.slice(0, 5).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    disabled={isDifferentOwner || isSubmitting}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      genre.toLowerCase() === g.toLowerCase()
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'bg-surface-2 border border-border text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="publishTags" className="text-xs font-semibold text-foreground sm:text-sm">
                Tags
              </label>
              <input
                id="publishTags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                maxLength={180}
                placeholder="romántica, guitarra, tropical"
                disabled={isDifferentOwner || isSubmitting}
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground transition-colors hover:border-border/80 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground">Separados por coma, hasta 12.</p>
            </div>
          </div>

          {/* Cover Section with Interactive Zoom Slider */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground sm:text-sm">Portada</span>
            <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2 sm:gap-4">
              {/* Zoomable Preview */}
              <div className="flex flex-col gap-2.5">
                <div className="relative mx-auto aspect-square w-36 overflow-hidden rounded-2xl border border-border bg-black shadow-inner sm:mx-0 sm:w-full">
                  {displayCover ? (
                    <img
                      src={displayCover}
                      alt="Cover preview"
                      className="h-full w-full object-cover transition-transform duration-100 ease-out"
                      style={{ transform: `scale(${1 + zoomLevel / 100})` }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      <Music className="h-8 w-8 text-white/20" />
                    </div>
                  )}
                </div>

                {/* Zoom range slider */}
                <div className="flex items-center gap-2.5 px-1 text-muted-foreground">
                  <ZoomOut className="h-3.5 w-3.5 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={zoomLevel}
                    onChange={(e) => setZoomLevel(Number(e.target.value))}
                    aria-label="Nivel de zoom de la portada"
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary outline-none"
                  />
                  <ZoomIn className="h-3.5 w-3.5 shrink-0" />
                </div>
              </div>

              {/* Cover Action Buttons */}
              <div className="flex flex-col justify-start gap-2.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCoverFileChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isDifferentOwner || isUploadingCover || isSubmitting}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-left transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 transition-colors group-hover:bg-surface-2">
                    {isUploadingCover ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                    ) : (
                      <UploadCloud className="h-4.5 w-4.5 text-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground sm:text-sm">
                      {isUploadingCover ? 'Subiendo imagen…' : 'Subir portada'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">JPG, PNG o WebP, hasta 5MB</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAiPrompt((s) => !s)}
                  disabled={isDifferentOwner || isSubmitting}
                  className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    showAiPrompt
                      ? 'border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(200,247,60,0.15)]'
                      : 'border-border bg-surface-2 hover:border-primary/40'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 transition-colors group-hover:bg-primary/25">
                    <Sparkles className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground sm:text-sm">
                      Rehacer portada con IA
                    </span>
                    <span className="text-[11px] text-muted-foreground">Generar o pedir nueva imagen</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Collapsible rich AI cover studio */}
            {showAiPrompt && (
              <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-surface-2 p-3.5 shadow-xl sm:p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Estudio de Portadas IA QAMUZ
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSuggestPrompt()}
                    disabled={isGeneratingAiCover || isSuggestingPrompt}
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {isSuggestingPrompt ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : (
                      <Wand2 className="h-3 w-3 text-primary" />
                    )}
                    {isSuggestingPrompt ? 'Pensando...' : 'Sugerir prompt'}
                  </button>
                </div>

                {/* Quick Style Chips */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Estilos predefinidos (1 clic para aplicar y generar):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_STYLES.map((style) => (
                      <button
                        key={style.label}
                        type="button"
                        onClick={() => handleSelectStyle(style.prompt)}
                        disabled={isGeneratingAiCover}
                        className="rounded-lg border border-border bg-surface-3 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/15 hover:text-primary active:scale-95 disabled:opacity-50"
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Prompt Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    O describe exactamente qué quieres que la IA pinte:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="ej. Carátula futurista, sintetizadores neón, ambiente urbano nocturno..."
                      disabled={isGeneratingAiCover}
                      className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs text-foreground transition-colors hover:border-border/80 focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateAiCover}
                      disabled={isGeneratingAiCover}
                      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                    >
                      {isGeneratingAiCover ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Creando…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5" />
                          Rehacer ahora
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    La imagen generada se previsualizará arriba para que ajustes su zoom antes de publicar.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-2 border-t border-border bg-surface p-4 shadow-2xl sm:p-6">
          <button
            type="button"
            onClick={handlePublish}
            disabled={isSubmitting || isDifferentOwner}
            className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </span>
            ) : isDifferentOwner ? (
              'Solo lectura'
            ) : alreadyPublic ? (
              'Actualizar publicación'
            ) : (
              'Publicar canción'
            )}
          </button>

          {/* Unpublish option */}
          {alreadyPublic && !isDifferentOwner && (
            <>
              {confirmUnpublish ? (
                <div className="flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-center">
                  <p className="text-xs text-rose-200">
                    ¿Despublicar esta canción? Dejará de aparecer en el feed público.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleUnpublish}
                      disabled={isSubmitting}
                      className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600"
                    >
                      Sí, despublicar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmUnpublish(false)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmUnpublish(true)}
                  disabled={isSubmitting}
                  className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                >
                  Despublicar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

