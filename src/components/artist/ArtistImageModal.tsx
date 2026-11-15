import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Check,
  Coins,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
  User,
  Wand2,
  X } from
'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { uploadMedia } from '@/lib/media';
import { coverUrl } from '@/lib/covers';
import { createCreation, fetchCreation, refreshCreation } from '@/lib/studio';
import { Notice } from '@/components/ui/Field';

export interface ArtistImageModalProps {
  isOpen: boolean;
  kind: 'avatar' | 'banner';
  currentUrl: string | null;
  artistId: string;
  artistName: string;
  onClose: () => void;
  onApply: (url: string) => void;
  onSaved: (url: string) => void;
}

const AVATAR_PROMPT_SUGGESTIONS = [
'Retrato fotográfico de estudio con iluminación editorial y fondo oscuro',
'Estilo cyberpunk futurista con luces de neón magenta y azul cian',
'Ilustración anime de cantante urbano con audífonos y mirada fija',
'Fotografía dramática en blanco y negro con sombras profundas y alto contraste',
'Retrato al óleo expresionista con textura de pintura y colores vibrantes'];


const BANNER_PROMPT_SUGGESTIONS = [
'Escenario de festival masivo al anochecer con lásers violetas y humo',
'Estudio de sintetizadores retro synthwave con vista a una ciudad nocturna',
'Ondas sonoras fluorescentes fluyendo en una galaxia cósmica oscura',
'Horizonte urbano futurista al atardecer con luces de neón y reflejos en la lluvia',
'Textura musical abstracta elegante en negro mate con detalles dorados'];


const STYLES = [
{ id: 'Fotorealista', label: 'Fotorealista' },
{ id: 'Cyberpunk', label: 'Cyberpunk' },
{ id: 'Cinemático', label: 'Cinemático' },
{ id: 'Studio Portrait', label: 'Estudio' },
{ id: 'Synthwave 80s', label: 'Synthwave' },
{ id: 'Anime / Ilustración', label: 'Ilustración' },
{ id: 'Pintura al óleo', label: 'Óleo' },
{ id: 'Minimalista 3D', label: '3D Minimalista' }];


export function ArtistImageModal({
  isOpen,
  kind,
  currentUrl,
  artistId,
  artistName,
  onClose,
  onApply,
  onSaved
}: ArtistImageModalProps) {
  const { user } = useAuth();
  const { credits, refresh: refreshAccount } = useAccount();

  const [activeTab, setActiveTab] = useState<'upload' | 'ai'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Fotorealista');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync currentUrl whenever modal opens or changes
  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentUrl);
      setError(null);
      setUploading(false);
      setGenerating(false);
      setSaving(false);
      setProgressText('');
    }
  }, [isOpen, currentUrl]);

  // Lock body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !generating && !saving && !uploading) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, generating, saving, uploading]);

  if (!isOpen) return null;

  const suggestions = kind === 'avatar' ? AVATAR_PROMPT_SUGGESTIONS : BANNER_PROMPT_SUGGESTIONS;
  const isNewImage = previewUrl && previewUrl !== currentUrl;

  async function handleFileProcess(file: File | undefined) {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo seleccionado debe ser una imagen (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('La imagen es demasiado pesada. El límite es de 15 MB.');
      return;
    }

    setError(null);
    setUploading(true);
    setProgressText('Subiendo imagen a tu perfil...');

    try {
      const { url, error: uploadErr } = await uploadMedia(user.id, file, 'artist');
      if (uploadErr || !url) {
        setError(uploadErr ?? 'No se pudo subir la imagen.');
        return;
      }
      setPreviewUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al procesar la imagen.');
    } finally {
      setUploading(false);
      setProgressText('');
    }
  }

  async function handleGenerateAI() {
    if (!prompt.trim() || prompt.trim().length < 3) {
      setError('Escribe una descripción de al menos 3 caracteres.');
      return;
    }
    if (credits < 3) {
      setError(`Necesitas al menos 3 créditos para generar con IA (tienes ${credits}).`);
      return;
    }

    setError(null);
    setGenerating(true);
    setProgressText('Iniciando generador de Inteligencia Artificial...');

    try {
      const size = kind === 'avatar' ? '1024x1024' : '1792x1024';
      const fullPrompt = `${prompt.trim()}${artistName ? `, para el artista musical ${artistName}` : ''}`;
      const { data, error: createErr } = await createCreation('image', fullPrompt, {
        size,
        style: selectedStyle
      });

      if (createErr || !data?.id) {
        setError(createErr ?? 'Error al iniciar la generación de imagen con IA.');
        setGenerating(false);
        return;
      }

      const creationId = data.id;
      setProgressText('Diseñando tu imagen con IA...');

      // Poll for readiness
      let readyUrl: string | null = null;
      const maxAttempts = 25;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await refreshCreation(creationId);
        const creation = await fetchCreation(creationId);

        if (creation) {
          if (creation.status === 'ready') {
            readyUrl = creation.result_urls?.[0] || creation.thumbnail_url || null;
            if (readyUrl) break;
          } else if (creation.status === 'error') {
            throw new Error(creation.error_message || 'El generador de IA devolvió un error.');
          }
        }

        setProgressText(`Renderizando detalles... (${(attempt + 1) * 2}s)`);
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (readyUrl) {
        setPreviewUrl(readyUrl);
        void refreshAccount();
      } else {
        throw new Error('La imagen tardó más de lo esperado. Puedes encontrarla luego en tu Estudio.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error durante la generación con IA.');
      void refreshAccount();
    } finally {
      setGenerating(false);
      setProgressText('');
    }
  }

  async function handleSaveDirect() {
    if (!previewUrl || !supabase) return;
    setSaving(true);
    setError(null);

    const field = kind === 'avatar' ? 'avatar_key' : 'banner_key';
    const { error: dbErr } = await supabase.
    from('artists').
    update({ [field]: previewUrl }).
    eq('id', artistId);

    setSaving(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }

    await refreshAccount();
    onSaved(previewUrl);
    onClose();
  }

  function handleApplyToForm() {
    if (previewUrl) {
      onApply(previewUrl);
      onClose();
    }
  }

  return createPortal(
    <div data-ev-id="ev_bf1bbd9575"
    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-5"
    role="dialog"
    aria-modal="true"
    aria-labelledby="artist-image-modal-title"
    onClick={() => {
      if (!generating && !saving && !uploading) onClose();
    }}>
      
			<div data-ev-id="ev_f24df84bda"
      className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      onClick={(e) => e.stopPropagation()}>
        
				{/* Header */}
				<div data-ev-id="ev_c85e5bf51e" className="flex items-center justify-between border-b border-border/80 px-6 py-4">
					<div data-ev-id="ev_a977c9373b" className="flex items-center gap-3">
						<div data-ev-id="ev_49a0a4706f" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							{kind === 'avatar' ? <User className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
						</div>
						<div data-ev-id="ev_fd9a2ac2ae">
							<h2 data-ev-id="ev_1bd7e62338" id="artist-image-modal-title" className="text-lg font-bold text-foreground">
								{kind === 'avatar' ? 'Personalizar Avatar' : 'Personalizar Portada / Banner'}
							</h2>
							<p data-ev-id="ev_730df7607c" className="text-xs text-muted-foreground">
								{kind === 'avatar' ?
                'Sube una foto o genera tu avatar con Inteligencia Artificial (1:1)' :
                'Sube un banner panorámico o diséñalo con Inteligencia Artificial'}
							</p>
						</div>
					</div>
					<button data-ev-id="ev_c3db8e78fb"
          type="button"
          onClick={onClose}
          disabled={generating || saving || uploading}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
          aria-label="Cerrar modal">
            
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Tabs */}
				<div data-ev-id="ev_8bd401e645" className="flex border-b border-border bg-surface-2/40 px-6">
					<button data-ev-id="ev_373ac8d4cc"
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`relative flex items-center gap-2 py-3 text-sm font-semibold transition-colors ${
          activeTab === 'upload' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
          }>
            
						<Upload className="h-4 w-4" />
						Subir imagen
						{activeTab === 'upload' &&
            <span data-ev-id="ev_4ecae0bceb" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
            }
					</button>
					<button data-ev-id="ev_81cb2a2708"
          type="button"
          onClick={() => setActiveTab('ai')}
          className={`relative ml-6 flex items-center gap-2 py-3 text-sm font-semibold transition-colors ${
          activeTab === 'ai' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
          }>
            
						<Sparkles className="h-4 w-4" />
						Crear con IA
						<span data-ev-id="ev_72a20bffe5" className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
							3 créditos
						</span>
						{activeTab === 'ai' &&
            <span data-ev-id="ev_7e46ad66bf" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
            }
					</button>
				</div>

				{/* Modal Body */}
				<div data-ev-id="ev_eb3bbd4ba0" className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
					{/* Tab 1: Upload */}
					{activeTab === 'upload' &&
          <div data-ev-id="ev_51c9b8f4c6" className="flex flex-col gap-4">
							<div data-ev-id="ev_84e12837fc"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              void handleFileProcess(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
            isDragging ?
            'border-primary bg-primary/5 scale-[0.99]' :
            'border-border bg-surface-2/50 hover:border-primary/50 hover:bg-surface-2'}`
            }>
              
								<input data-ev-id="ev_d4081dd3f2"
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => void handleFileProcess(e.target.files?.[0])} />
              
								<div data-ev-id="ev_c52af3bd40" className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-3 text-primary shadow-inner group-hover:scale-105 transition-transform">
									{uploading ?
                <Loader2 className="h-6 w-6 animate-spin text-primary" /> :

                <Upload className="h-6 w-6" />
                }
								</div>
								<h3 data-ev-id="ev_be4ebc1485" className="text-sm font-bold text-foreground">
									{uploading ? 'Subiendo imagen...' : 'Arrastra tu imagen aquí o haz clic para buscar'}
								</h3>
								<p data-ev-id="ev_005990f8af" className="mt-1 text-xs text-muted-foreground">
									{kind === 'avatar' ?
                'Recomendado: Cuadrado 1024x1024 px o superior (PNG, JPG o WebP)' :
                'Recomendado: Panorámico 1536x1024 px (PNG, JPG o WebP)'}
								</p>
								<p data-ev-id="ev_046fa3c6ec" className="mt-1 text-[11px] text-muted-foreground/70">Tamaño máximo de archivo: 15 MB</p>
							</div>
						</div>
          }

					{/* Tab 2: AI Generation */}
					{activeTab === 'ai' &&
          <div data-ev-id="ev_0d0af9936d" className="flex flex-col gap-4">
							{/* Credits & Info bar */}
							<div data-ev-id="ev_8f6798b95c" className="flex items-center justify-between rounded-xl border border-border bg-surface-2/60 px-4 py-2.5">
								<div data-ev-id="ev_c6be61fd03" className="flex items-center gap-2">
									<Wand2 className="h-4 w-4 text-primary" />
									<span data-ev-id="ev_f8994967e2" className="text-xs font-semibold text-foreground">
										Generación con Inteligencia Artificial
									</span>
								</div>
								<div data-ev-id="ev_fae616acae" className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Coins className="h-3.5 w-3.5 text-amber-400" />
									<span data-ev-id="ev_9c73488f87">Costo: 3 créditos</span>
									<span data-ev-id="ev_1361ed514d" className="text-border">•</span>
									<span data-ev-id="ev_1689694d1e" className="font-semibold text-primary">{credits} disponibles</span>
								</div>
							</div>

							{/* Prompt input */}
							<div data-ev-id="ev_237853457f" className="flex flex-col gap-1.5">
								<label data-ev-id="ev_e5c6c2cc1d" className="text-xs font-semibold text-muted-foreground">
									Describe tu {kind === 'avatar' ? 'avatar' : 'portada'}:
								</label>
								<textarea data-ev-id="ev_cb6b68e9ec"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={generating}
              rows={3}
              maxLength={500}
              placeholder={
              kind === 'avatar' ?
              'Ej: Retrato artístico de artista musical con chaqueta brillante, iluminación neón púrpura y azul...' :
              'Ej: Escenario de festival nocturno con lásers futuristas, humo envolvente y multitud...'
              }
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-50" />
              
								<div data-ev-id="ev_d75c640e7a" className="flex justify-between text-[11px] text-muted-foreground">
									<span data-ev-id="ev_3bdfe2c84a">Sé descriptivo con la iluminación, el fondo y el estado de ánimo</span>
									<span data-ev-id="ev_ce0a0b6f1d">{prompt.length}/500</span>
								</div>
							</div>

							{/* Style presets */}
							<div data-ev-id="ev_28c5875d69" className="flex flex-col gap-1.5">
								<span data-ev-id="ev_c45453807f" className="text-xs font-semibold text-muted-foreground">Estilo visual:</span>
								<div data-ev-id="ev_0ab9f35c34" className="flex flex-wrap gap-1.5">
									{STYLES.map((st) =>
                <button data-ev-id="ev_72244234b1"
                key={st.id}
                type="button"
                disabled={generating}
                onClick={() => setSelectedStyle(st.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                selectedStyle === st.id ?
                'border-primary bg-primary/10 text-primary shadow-sm' :
                'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`
                }>
                  
											{st.label}
										</button>
                )}
								</div>
							</div>

							{/* Ideas chips */}
							<div data-ev-id="ev_21493a8b5e" className="flex flex-col gap-1.5">
								<span data-ev-id="ev_ae99aba54d" className="text-xs font-semibold text-muted-foreground">Ideas sugeridas (haz clic para usar):</span>
								<div data-ev-id="ev_446bf1b613" className="flex flex-wrap gap-1.5">
									{suggestions.map((sug, idx) =>
                <button data-ev-id="ev_a7ce250a2c"
                key={idx}
                type="button"
                disabled={generating}
                onClick={() => setPrompt(sug)}
                className="rounded-lg border border-border/80 bg-surface-2/40 px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-surface-2 hover:text-foreground">
                  
											{sug}
										</button>
                )}
								</div>
							</div>

							{/* Generate trigger */}
							<button data-ev-id="ev_6121b54290"
            type="button"
            onClick={() => void handleGenerateAI()}
            disabled={generating || prompt.trim().length < 3 || credits < 3}
            className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50">
              
								{generating ?
              <>
										<Loader2 className="h-4 w-4 animate-spin" />
										{progressText || 'Generando con IA...'}
									</> :

              <>
										<Sparkles className="h-4 w-4" />
										Generar {kind === 'avatar' ? 'avatar' : 'portada'} con IA (3 créditos)
									</>
              }
							</button>
						</div>
          }

					{/* Feedback & Progress */}
					{error &&
          <Notice tone="error">
							<div data-ev-id="ev_15d3c33a3e" className="flex items-center gap-2">
								<AlertCircle className="h-4 w-4 flex-none" />
								<span data-ev-id="ev_51056305be">{error}</span>
							</div>
						</Notice>
          }

					{/* Live Preview Section */}
					<div data-ev-id="ev_f33e68ff34" className="rounded-2xl border border-border bg-surface-2/40 p-4 flex flex-col gap-3">
						<div data-ev-id="ev_cb0a1932cd" className="flex items-center justify-between">
							<span data-ev-id="ev_d5972d42c5" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Vista previa del resultado
							</span>
							{isNewImage &&
              <div data-ev-id="ev_20645cc49e" className="flex items-center gap-2">
									<span data-ev-id="ev_03c48d68be" className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
										<Sparkles className="h-3 w-3" /> Nueva imagen lista
									</span>
									<button data-ev-id="ev_b08ef4a5dc"
                type="button"
                onClick={() => setPreviewUrl(currentUrl)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  
										<RotateCcw className="h-3 w-3" /> Restaurar
									</button>
								</div>
              }
						</div>

						{/* Preview Frame */}
						<div data-ev-id="ev_47b9697738" className="flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-black/40 p-4">
							{kind === 'avatar' ?
              <div data-ev-id="ev_b9cbbd4fcc" className="relative flex flex-col items-center">
									<div data-ev-id="ev_2eead47226" className="relative h-32 w-32 md:h-36 md:w-36 overflow-hidden rounded-full border-4 border-primary/40 shadow-xl bg-surface-3">
										<img data-ev-id="ev_e080000e50"
                  src={coverUrl(previewUrl)}
                  alt="Vista previa de avatar"
                  className="h-full w-full object-cover" />
                  
									</div>
									<span data-ev-id="ev_49186568eb" className="mt-2 text-xs font-semibold text-foreground/80">{artistName || 'Artista'}</span>
									<span data-ev-id="ev_630b789f4a" className="text-[11px] text-muted-foreground">Formato circular 1:1</span>
								</div> :

              <div data-ev-id="ev_a6fb302013" className="w-full flex flex-col gap-1.5">
									<div data-ev-id="ev_3996f13eb2" className="relative h-36 md:h-44 w-full overflow-hidden rounded-xl border border-border/80 shadow-inner bg-surface-3">
										<img data-ev-id="ev_034c67eaaa"
                  src={coverUrl(previewUrl)}
                  alt="Vista previa de portada"
                  className="h-full w-full object-cover" />
                  
									</div>
									<div data-ev-id="ev_59da9d5d81" className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
										<span data-ev-id="ev_ff2f957d80">Vista panorámica de cabecera</span>
										<span data-ev-id="ev_6b1e673d35">Proporción recomendada 3:2</span>
									</div>
								</div>
              }
						</div>
					</div>
				</div>

				{/* Footer: Editar y Guardar o Salvar */}
				<div data-ev-id="ev_92324a2a42" className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-6 py-4">
					<button data-ev-id="ev_af96bb0c74"
          type="button"
          onClick={onClose}
          disabled={generating || saving || uploading}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-40">
            
						Cancelar
					</button>

					<div data-ev-id="ev_e72984c77b" className="flex flex-wrap items-center gap-2.5">
						<button data-ev-id="ev_b62a064f44"
            type="button"
            onClick={handleApplyToForm}
            disabled={!previewUrl || generating || saving || uploading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
            title="Aplica la imagen al formulario para que puedas editar otros campos antes de guardar">
              
							<Check className="h-4 w-4" />
							Aplicar al formulario
						</button>

						<button data-ev-id="ev_fa91815b83"
            type="button"
            onClick={() => void handleSaveDirect()}
            disabled={!previewUrl || generating || saving || uploading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:scale-[1.02] hover:brightness-110 disabled:opacity-50"
            title="Guarda la imagen inmediatamente en la base de datos de tu perfil de artista">
              
							{saving ?
              <>
									<Loader2 className="h-4 w-4 animate-spin" />
									Guardando...
								</> :

              <>
									<Save className="h-4 w-4" />
									Guardar en mi perfil
								</>
              }
						</button>
					</div>
				</div>
			</div>
		</div>,
    document.body
  );
}