import { useState } from 'react';
import {
	Clapperboard,
	Image as ImageIcon,
	Layers,
	Loader2,
	Sparkles,
	Upload,
	User,
} from 'lucide-react';
import { inputClass } from '@/lib/ui';
import { useI18n } from '@/hooks/useI18n';
import { uploadMedia } from '@/lib/media';
import { CHARACTERS } from '@/lib/characters';
import { magicEnhancePrompt } from '@/lib/nle/maestroDirector';
import type { Creation, ProviderInfo } from '@/lib/studio';

interface ImageFormProps {
	provider: ProviderInfo | null;
	credits: number | null;
	submitting: boolean;
	userId: string;
	creations: Creation[];
	onSubmit: (prompt: string, options: Record<string, unknown>) => void;
}

type ImageMode = 'text' | 'image-to-image' | 'actor-runway' | 'cinema-poster';

const FORMATS = [
	{ id: '1024x1024', aspect: '1:1', desc: 'Portada' },
	{ id: '1024x1536', aspect: '2:3', desc: 'Póster' },
	{ id: '1792x1024', aspect: '16:9', desc: 'YouTube' },
	{ id: '1024x1792', aspect: '9:16', desc: 'Reels' },
	{ id: '1365x1024', aspect: '4:3', desc: 'Clásico' },
	{ id: '1536x1024', aspect: '3:2', desc: 'Foto' },
];

const STYLES = [
	{ id: 'Photographic 8K', name: 'Fotografía Editorial 8K' },
	{ id: 'Album cover vinyl', name: 'Portada de Vinilo' },
	{ id: 'Cyberpunk Neon', name: 'Cyberpunk & Neón' },
	{ id: 'Urban Trap Streetwear', name: 'Urbano Trap & Moda' },
	{ id: 'Psychedelic Oil Painting', name: 'Pintura Psicodélica' },
	{ id: '3D Octane Render', name: '3D Render Futurista' },
	{ id: 'Minimalist Editorial', name: 'Minimalismo Editorial' },
	{ id: 'Vintage 90s Flash', name: 'Cámara 90s Vintage' },
];

const CINEMA_POSTER_STYLES = [
	{ id: 'hollywood-blockbuster', name: 'Blockbuster IMAX', desc: 'Destellos anamórficos' },
	{ id: 'a24-auteur', name: 'Cine de Autor A24', desc: 'Claroscuro poético' },
	{ id: 'retro-illustrated', name: 'Ilustrado 80s', desc: 'Pintura clásica' },
	{ id: 'cyber-noir', name: 'Neo-Noir Lluvia', desc: 'Sombras y neón' },
	{ id: 'fantasy-epic', name: 'Fantasía Épica', desc: 'Paisajes míticos' },
];

const LIGHTING_OPTIONS = [
	'Luz de Estudio Softbox Profesional',
	'Golden Hour Cálido al Atardecer',
	'Neón Nocturno de Ciudad Cyberpunk',
	'Luces de Concierto Estroboscópicas',
	'Claroscuro Dramático (Rembrandt)',
	'Luz de Luna Azulada y Lluvia',
];

const LENS_OPTIONS = [
	'85mm f/1.4 Retrato con Bokeh Profundo',
	'35mm Cinemático Anamórfico',
	'24mm Gran Angular Dinámico',
	'50mm Fotografía Documental Natural',
	'Macro Detallado de Texturas',
];

const ACTOR_OUTFITS = [
	'Streetwear de lujo contemporáneo con joyas',
	'Traje de gala de alta costura vanguardista',
	'Chaqueta de cuero cyberpunk con luces led',
	'Ropa urbana deportiva retro de los 90s',
	'Ropa bohemia de festival con accesorios',
	'Traje minimalista monocromático futurista',
];

const ACTOR_EXPRESSIONS = [
	'Mirada intensa y carismática hacia la cámara',
	'Sonrisa radiante y llena de energía',
	'Actitud desafiante y segura estilo trapper',
	'Melancólica y enigmática en introspección',
	'Serena y elegante con mirada perdida',
];

const compactSelect =
	'h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary';

export function ImageForm({
	provider,
	credits,
	submitting,
	userId,
	creations,
	onSubmit,
}: ImageFormProps) {
	const { t } = useI18n();
	const [mode, setMode] = useState<ImageMode>('text');
	const [prompt, setPrompt] = useState('');
	const [selectedFormat, setSelectedFormat] = useState('1024x1024');
	const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);

	// Image to Image state
	const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
	const [refImageName, setRefImageName] = useState<string>('');
	const [uploadingRef, setUploadingRef] = useState(false);
	const [refInfluenceMode, setRefInfluenceMode] = useState<'style' | 'face' | 'structure'>('style');
	const [refStrength, setRefStrength] = useState<number>(60);

	// Runway Actor state
	const [selectedActor, setSelectedActor] = useState<string>(CHARACTERS[0]?.name ?? 'Mateo');
	const [actorOutfit, setActorOutfit] = useState<string>(ACTOR_OUTFITS[0]);
	const [actorExpression, setActorExpression] = useState<string>(ACTOR_EXPRESSIONS[0]);
	const [actorLighting, setActorLighting] = useState<string>(LIGHTING_OPTIONS[0]);
	const [actorLens, setActorLens] = useState<string>(LENS_OPTIONS[0]);
	const [keepActorConsistent, setKeepActorConsistent] = useState(true);

	// Cinema Poster state
	const [movieTitle, setMovieTitle] = useState('');
	const [movieTagline, setMovieTagline] = useState('');
	const [posterStyle, setPosterStyle] = useState(CINEMA_POSTER_STYLES[0].id);

	// Negative prompt
	const [negativePrompt, setNegativePrompt] = useState('');
	const [showNegative, setShowNegative] = useState(false);

	// AI Enhancer
	const [isEnhancing, setIsEnhancing] = useState(false);
	const [enhanceError, setEnhanceError] = useState<string | null>(null);

	const available = Boolean(provider?.is_active);
	const cost = provider?.credit_cost ?? 0;
	const notEnough = credits !== null && credits < cost;

	const pastImages = creations
		.filter((c) => (c.kind === 'image' && c.result_urls?.length) || c.thumbnail_url)
		.map((c) => ({
			url: c.result_urls?.[0] || c.thumbnail_url || '',
			title: c.title || c.prompt.slice(0, 30),
		}))
		.filter((x) => Boolean(x.url));

	async function handleUploadRef(file: File | undefined) {
		if (!file) return;
		if (!file.type.startsWith('image/')) return;
		setUploadingRef(true);
		const res = await uploadMedia(userId, file, 'covers');
		setUploadingRef(false);
		if (res.url) {
			setRefImageUrl(res.url);
			setRefImageName(file.name);
		}
	}

	function handleModeSelect(m: ImageMode) {
		setMode(m);
		if (m === 'cinema-poster') {
			setSelectedFormat('1024x1536');
		} else if (m === 'text' || m === 'actor-runway') {
			setSelectedFormat('1024x1024');
		}
	}

	async function handleEnhancePrompt() {
		if (isEnhancing) return;
		setIsEnhancing(true);
		setEnhanceError(null);
		try {
			const activeChar = CHARACTERS.find((c) => c.name === selectedActor);
			const activePoster = CINEMA_POSTER_STYLES.find((p) => p.id === posterStyle);
			const contextParts = [
				`Mode: ${mode}`,
				mode === 'cinema-poster'
					? `Movie poster "${movieTitle || 'Untitled'}"${movieTagline ? ` tagline "${movieTagline}"` : ''}, poster style: ${activePoster?.name || posterStyle}`
					: null,
				mode === 'actor-runway'
					? `Actor: ${selectedActor} (${activeChar?.genre || 'Urban'}), expression: ${actorExpression}, outfit: ${actorOutfit}, lighting: ${actorLighting}, lens: ${actorLens}`
					: null,
				mode === 'image-to-image' ? `Reference influence: ${refInfluenceMode} at ${refStrength}%` : null,
			]
				.filter(Boolean)
				.join('. ');

			const enhanced = await magicEnhancePrompt(prompt.trim() || 'Iconic music album cover concept', {
				mode: 'cover-prompt',
				style: selectedStyle,
				character: mode === 'actor-runway' ? selectedActor : undefined,
				songTitle: mode === 'cinema-poster' ? movieTitle : undefined,
				sceneContext: contextParts,
			});
			setPrompt(enhanced.slice(0, 900));
		} catch (err) {
			setEnhanceError(err instanceof Error ? err.message : 'No se pudo mejorar el prompt con IA.');
		} finally {
			setIsEnhancing(false);
		}
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!prompt.trim() && mode !== 'actor-runway' && mode !== 'cinema-poster') return;

		let finalPrompt = prompt.trim();

		if (mode === 'cinema-poster') {
			const activePoster = CINEMA_POSTER_STYLES.find((p) => p.id === posterStyle);
			const posterDetails = `Theatrical movie poster for "${movieTitle || 'Epic Film'}"${movieTagline ? ` with tagline "${movieTagline}"` : ''}, ${activePoster?.name ?? ''} aesthetic, dramatic film lighting, 8k resolution`;
			finalPrompt = prompt.trim() ? `${prompt.trim()}. ${posterDetails}` : posterDetails;
		} else if (mode === 'actor-runway') {
			const activeChar = CHARACTERS.find((c) => c.name === selectedActor);
			const baseDetails = `Portrait of ${selectedActor} (${activeChar?.genre ?? 'Pop'}), ${actorExpression}, ${actorOutfit}. ${actorLighting}, ${actorLens}. ${selectedStyle} style`;
			finalPrompt = prompt.trim() ? `${prompt.trim()}. ${baseDetails}` : baseDetails;
		}

		if (finalPrompt.length > 950) {
			finalPrompt = `${finalPrompt.slice(0, 947).trimEnd()}...`;
		}

		const formatMeta = FORMATS.find((f) => f.id === selectedFormat);
		const options: Record<string, unknown> = {
			style: selectedStyle,
			size: selectedFormat,
			aspect_ratio: formatMeta?.aspect || '1:1',
			mode,
		};

		if (negativePrompt.trim()) {
			options.negative_prompt = negativePrompt.trim();
		}

		if (mode === 'image-to-image' && refImageUrl) {
			options.reference_image_url = refImageUrl;
			options.reference_influence_mode = refInfluenceMode;
			options.reference_strength = refStrength / 100;
		}

		if (mode === 'actor-runway') {
			options.actor_name = selectedActor;
			options.actor_consistency = keepActorConsistent;
			options.actor_outfit = actorOutfit;
			options.actor_expression = actorExpression;
			options.actor_lighting = actorLighting;
			options.actor_lens = actorLens;
		}

		if (mode === 'cinema-poster') {
			options.movie_title = movieTitle;
			options.movie_tagline = movieTagline;
			options.poster_style = posterStyle;
		}

		onSubmit(finalPrompt, options);
	}

	const modes: { id: ImageMode; label: string; icon: typeof ImageIcon }[] = [
		{ id: 'text', label: 'Texto', icon: ImageIcon },
		{ id: 'image-to-image', label: 'Img a Img', icon: Layers },
		{ id: 'actor-runway', label: 'Actores', icon: User },
		{ id: 'cinema-poster', label: 'Póster', icon: Clapperboard },
	];

	return (
		<form
			data-ev-id="ev_if_form"
			onSubmit={handleSubmit}
			className="flex flex-col gap-3"
		>
			{/* Compact Mode Switcher (4 short labels in a single row) */}
			<div role="tablist" className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
				{modes.map((m) => {
					const Icon = m.icon;
					const on = mode === m.id;
					return (
						<button
							key={m.id}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => handleModeSelect(m.id)}
							className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-bold transition-colors ${
								on
									? 'bg-surface-3 text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<Icon className={`h-3 w-3 flex-none ${on ? 'text-primary' : ''}`} />
							<span className="truncate">{m.label}</span>
						</button>
					);
				})}
			</div>

			{/* MODE 2: IMAGE TO IMAGE */}
			{mode === 'image-to-image' && (
				<div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3.5">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-foreground">Imagen de referencia</span>
						{refImageUrl && (
							<button
								type="button"
								onClick={() => {
									setRefImageUrl(null);
									setRefImageName('');
								}}
								className="text-[11px] font-semibold text-destructive hover:underline"
							>
								Quitar
							</button>
						)}
					</div>

					{refImageUrl ? (
						<div className="flex items-center gap-2.5 rounded-lg bg-surface p-2">
							<img
								src={refImageUrl}
								alt="Referencia"
								className="h-11 w-11 flex-none rounded-md object-cover"
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate text-xs font-semibold text-foreground">{refImageName || 'Imagen activa'}</p>
								<p className="text-[10px] text-cyan-400">Guía de generación activa</p>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-2">
							<label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-500/40 bg-surface px-3 text-xs font-semibold text-foreground hover:border-cyan-400">
								{uploadingRef ? (
									<Loader2 className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
								) : (
									<Upload className="h-3.5 w-3.5 text-cyan-400" />
								)}
								<span className="truncate">
									{uploadingRef ? 'Subiendo...' : 'Subir imagen (PNG, JPG, WebP)'}
								</span>
								<input
									type="file"
									accept="image/*"
									className="sr-only"
									onChange={(e) => void handleUploadRef(e.target.files?.[0])}
								/>
							</label>

							{pastImages.length > 0 && (
								<div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
									{pastImages.slice(0, 8).map((img, i) => (
										<button
											key={i}
											type="button"
											onClick={() => {
												setRefImageUrl(img.url);
												setRefImageName(img.title);
											}}
											className="flex-none overflow-hidden rounded-md border border-border hover:border-cyan-400"
										>
											<img src={img.url} alt="" className="h-9 w-9 object-cover" />
										</button>
									))}
								</div>
							)}
						</div>
					)}

					<div className="grid grid-cols-3 gap-1 pt-1">
						{[
							{ id: 'style', label: 'Estilo' },
							{ id: 'face', label: 'Rostro' },
							{ id: 'structure', label: 'Estructura' },
						].map((inf) => (
							<button
								key={inf.id}
								type="button"
								onClick={() => setRefInfluenceMode(inf.id as 'style' | 'face' | 'structure')}
								className={`h-7 rounded-md border text-[11px] font-semibold transition-colors ${
									refInfluenceMode === inf.id
										? 'border-cyan-400 bg-cyan-950/40 text-cyan-300'
										: 'border-border bg-surface text-muted-foreground'
								}`}
							>
								{inf.label}
							</button>
						))}
					</div>

					<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
						<span>Fuerza</span>
						<input
							type="range"
							min={20}
							max={90}
							value={refStrength}
							onChange={(e) => setRefStrength(Number(e.target.value))}
							className="flex-1 accent-cyan-400 h-1 bg-surface-3 rounded cursor-pointer"
						/>
						<span className="font-mono text-cyan-400 w-8 text-right">{refStrength}%</span>
					</div>
				</div>
			)}

			{/* MODE 3: RUNWAY ACTOR STUDIO */}
			{mode === 'actor-runway' && (
				<div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3.5">
					<div className="flex items-center justify-between gap-2">
						<span className="text-xs font-bold text-foreground">Actor consistente</span>
						<label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
							<input
								type="checkbox"
								checked={keepActorConsistent}
								onChange={(e) => setKeepActorConsistent(e.target.checked)}
								className="rounded border-border accent-purple-500"
							/>
							<span>Face ID</span>
						</label>
					</div>

					<div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto no-scrollbar rounded-lg bg-surface p-1">
						{CHARACTERS.map((char) => {
							const on = selectedActor === char.name;
							return (
								<button
									key={char.id}
									type="button"
									onClick={() => setSelectedActor(char.name)}
									className={`flex h-9 items-center gap-2 rounded-md border px-2 text-left transition-colors ${
										on
											? 'border-purple-400 bg-purple-950/40 text-foreground'
											: 'border-transparent bg-surface-2 text-muted-foreground hover:text-foreground'
									}`}
								>
									<img
										src={char.image}
										alt=""
										className="h-6 w-6 flex-none rounded-full object-cover"
									/>
									<span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
										{char.name}
									</span>
								</button>
							);
						})}
					</div>

					<select
						id="actor-outfit-sel"
						value={actorOutfit}
						onChange={(e) => setActorOutfit(e.target.value)}
						aria-label="Vestimenta"
						className={compactSelect}
					>
						{ACTOR_OUTFITS.map((out) => (
							<option key={out} value={out}>
								{out}
							</option>
						))}
					</select>

					<select
						id="actor-expr-sel"
						value={actorExpression}
						onChange={(e) => setActorExpression(e.target.value)}
						aria-label="Expresión"
						className={compactSelect}
					>
						{ACTOR_EXPRESSIONS.map((exp) => (
							<option key={exp} value={exp}>
								{exp}
							</option>
						))}
					</select>

					<select
						id="actor-light-sel"
						value={actorLighting}
						onChange={(e) => setActorLighting(e.target.value)}
						aria-label="Iluminación"
						className={compactSelect}
					>
						{LIGHTING_OPTIONS.map((l) => (
							<option key={l} value={l}>
								{l}
							</option>
						))}
					</select>

					<select
						id="actor-lens-sel"
						value={actorLens}
						onChange={(e) => setActorLens(e.target.value)}
						aria-label="Lente"
						className={compactSelect}
					>
						{LENS_OPTIONS.map((lens) => (
							<option key={lens} value={lens}>
								{lens}
							</option>
						))}
					</select>
				</div>
			)}

			{/* MODE 4: CINEMA POSTER */}
			{mode === 'cinema-poster' && (
				<div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3.5">
					<span className="text-xs font-bold text-foreground">Datos del póster</span>
					<input
						id="movie-title-in"
						type="text"
						value={movieTitle}
						onChange={(e) => setMovieTitle(e.target.value)}
						placeholder="Título: Crónicas de Santo Domingo 2099"
						className={`${inputClass} h-9 text-xs font-semibold`}
					/>
					<input
						id="movie-tagline-in"
						type="text"
						value={movieTagline}
						onChange={(e) => setMovieTagline(e.target.value)}
						placeholder="Lema: En la oscuridad del sonido..."
						className={`${inputClass} h-9 text-xs`}
					/>
					<select
						value={posterStyle}
						onChange={(e) => setPosterStyle(e.target.value)}
						aria-label="Estilo de cartel"
						className={compactSelect}
					>
						{CINEMA_POSTER_STYLES.map((cs) => (
							<option key={cs.id} value={cs.id}>
								{cs.name} — {cs.desc}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Prompt Card (matches StudioForm main card) */}
			<div className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3.5">
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs font-bold text-foreground">
						{mode === 'actor-runway'
							? 'Escena del actor'
							: mode === 'cinema-poster'
							? 'Escena del póster'
							: 'Describe tu idea'}
					</span>
					<button
						type="button"
						onClick={() => void handleEnhancePrompt()}
						disabled={isEnhancing}
						className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
					>
						{isEnhancing ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<Sparkles className="h-3 w-3" />
						)}
						<span>{isEnhancing ? 'Pensando...' : 'Pulir con IA'}</span>
					</button>
				</div>
				{enhanceError && (
					<p className="text-[11px] text-destructive">{enhanceError}</p>
				)}

				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					rows={4}
					maxLength={900}
					placeholder={
						mode === 'cinema-poster'
							? 'Protagonista de espaldas contemplando una metrópolis futurista...'
							: mode === 'actor-runway'
							? 'Caminando bajo luces de neón lila y azul, ambiente de portada...'
							: mode === 'image-to-image'
							? 'Transformar en pintura al óleo futurista con detalles dorados...'
							: 'Portada de álbum: astronauta sobre un mar de luces violetas...'
					}
					className="w-full resize-y bg-transparent text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
				/>

				{/* Compact Visual Style Selector */}
				<div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
					{STYLES.map((st) => {
						const on = selectedStyle === st.id;
						return (
							<button
								key={st.id}
								type="button"
								onClick={() => setSelectedStyle(st.id)}
								className={`h-7 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
									on
										? 'border-primary bg-primary/10 text-primary'
										: 'border-border bg-surface text-muted-foreground hover:text-foreground'
								}`}
							>
								{st.name}
							</button>
						);
					})}
				</div>
			</div>

			{/* Format & Negative Prompt Card (clean 3x2 grid) */}
			<div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3.5">
				<span className="text-xs font-bold text-foreground">Formato</span>
				<div className="grid grid-cols-3 gap-1.5">
					{FORMATS.map((f) => {
						const on = selectedFormat === f.id;
						return (
							<button
								key={f.id}
								type="button"
								onClick={() => setSelectedFormat(f.id)}
								className={`flex h-9 flex-col items-center justify-center rounded-lg border px-1 transition-colors ${
									on
										? 'border-cyan-400 bg-cyan-950/30 text-cyan-300'
										: 'border-border bg-surface text-muted-foreground hover:text-foreground'
								}`}
							>
								<span className="text-[11px] font-bold leading-none">{f.aspect}</span>
								<span className="text-[9px] opacity-75 leading-tight mt-0.5 truncate">{f.desc}</span>
							</button>
						);
					})}
				</div>

				<button
					type="button"
					onClick={() => setShowNegative((v) => !v)}
					className="self-start text-[11px] font-semibold text-muted-foreground hover:text-foreground pt-0.5"
				>
					{showNegative ? '− Ocultar exclusiones' : '+ Exclusiones (Negative prompt)'}
				</button>
				{showNegative && (
					<input
						type="text"
						value={negativePrompt}
						onChange={(e) => setNegativePrompt(e.target.value)}
						placeholder="deformed hands, blurry, watermark, low quality"
						className={`${inputClass} h-8 text-xs`}
					/>
				)}
			</div>

			{!available && (
				<p className="rounded-xl border border-border px-3.5 py-2.5 text-xs text-muted-foreground">
					{t('There is no active provider for creating images yet.')}
				</p>
			)}

			{/* Sticky Submit Footer */}
			<div className="sticky bottom-0 z-10 flex flex-col gap-1.5 bg-background pb-1 pt-2">
				<button
					type="submit"
					disabled={
						!available ||
						submitting ||
						notEnough ||
						(!prompt.trim() && mode !== 'actor-runway' && mode !== 'cinema-poster')
					}
					className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
				>
					{submitting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Sparkles className="h-4 w-4" />
					)}
					{mode === 'cinema-poster'
						? 'Generar Póster'
						: mode === 'actor-runway'
						? 'Generar Actor'
						: mode === 'image-to-image'
						? 'Generar Remix'
						: 'Generar Imagen'}
				</button>
				<div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
					<span>
						{provider
							? `${provider.name} · ${t('{count} credits', { count: cost })}`
							: t('No provider')}
					</span>
					{notEnough && (
						<span className="text-destructive font-semibold">
							{t("You don't have enough credits")}
						</span>
					)}
				</div>
			</div>
		</form>
	);
}
