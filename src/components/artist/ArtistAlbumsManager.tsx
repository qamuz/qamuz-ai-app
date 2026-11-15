import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	Check,
	CheckCircle2,
	ChevronRight,
	Disc,
	Disc3,
	Edit3,
	Layers,
	Loader2,
	Music,
	Plus,
	Sparkles,
	Trash2,
	Upload,
	Wand2,
	X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { uploadMedia } from '@/lib/media';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import {
	ALBUM_MARKET_FORMATS,
	fetchAlbumTracks,
	fetchOwnAlbums,
	fetchOwnTracks,
	saveAlbumWithTracks,
	type AlbumMarketFormat,
	type OwnTrack,
} from '@/lib/artist-panel';
import { createCreation, fetchCreation, refreshCreation } from '@/lib/studio';
import type { OwnedArtist } from '@/contexts/account-context';
import type { Album } from '@/types/music';
import { inputClass, primaryButton } from '@/lib/ui';

const COVER_AI_STYLES = [
	{ label: '💿 Vinilo Vintage 80s', prompt: 'estilo carátula de disco de vinilo retro de los 80, grano analógico, tipografía retro e ilustración vintage' },
	{ label: '🌆 Neón Cyberpunk', prompt: 'estilo cyberpunk futurista, iluminación de neón turquesa y vino, destellos luminosos y alto contraste cinemático' },
	{ label: '📐 Minimalismo Moderno', prompt: 'diseño gráfico editorial minimalista suizo, composición geométrica elegante, tipografía artística limpia' },
	{ label: '📸 Editorial 35mm', prompt: 'fotografía analógica editorial 35mm, retrato artístico con iluminación suave de estudio, estética cinematográfica' },
	{ label: '🎨 Pintura Psicodélica', prompt: 'estilo pintura al óleo psicodélica y abstracta, colores vibrantes, pinceladas ricas y fluidas' },
	{ label: '💎 Render 3D Cromo', prompt: 'estilo render 3D hiperrealista, formas geométricas de cromo líquido brillante y vidrio con refracciones' },
];

export function ArtistAlbumsManager({ artist }: { artist: OwnedArtist }) {
	const { t } = useI18n();
	const { user } = useAuth();
	const [albums, setAlbums] = useState<Album[]>([]);
	const [allTracks, setAllTracks] = useState<OwnTrack[]>([]);
	const [tracksByAlbum, setTracksByAlbum] = useState<Record<string, OwnTrack[]>>({});
	const [loading, setLoading] = useState(true);

	// Editor Modal / Panel State
	const [isEditing, setIsEditing] = useState(false);
	const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
	const [title, setTitle] = useState('');
	const [releaseDate, setReleaseDate] = useState('');
	const [marketFormat, setMarketFormat] = useState<AlbumMarketFormat>('LP');
	const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);

	// Cover management state
	const [coverMode, setCoverMode] = useState<'upload' | 'ai'>('upload');
	const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
	const [coverFile, setCoverFile] = useState<File | null>(null);
	const [coverDimensionNotice, setCoverDimensionNotice] = useState<string | null>(null);

	// AI Cover Generation state
	const [aiCoverPrompt, setAiCoverPrompt] = useState('');
	const [aiCoverStyle, setAiCoverStyle] = useState(COVER_AI_STYLES[0].prompt);
	const [generatingCover, setGeneratingCover] = useState(false);

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	const activeFormatConfig = useMemo(
		() => ALBUM_MARKET_FORMATS.find((f) => f.id === marketFormat) || ALBUM_MARKET_FORMATS[0],
		[marketFormat]
	);

	const loadData = useCallback(async () => {
		setLoading(true);
		const [fetchedAlbums, fetchedTracks] = await Promise.all([
			fetchOwnAlbums(artist.id),
			fetchOwnTracks(artist.id),
		]);
		setAlbums(fetchedAlbums);
		setAllTracks(fetchedTracks);

		// Group tracks by album
		const trackMap: Record<string, OwnTrack[]> = {};
		for (const tr of fetchedTracks) {
			if (tr.album_id) {
				if (!trackMap[tr.album_id]) trackMap[tr.album_id] = [];
				trackMap[tr.album_id].push(tr);
			}
		}
		setTracksByAlbum(trackMap);
		setLoading(false);
	}, [artist.id]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	function openCreateAlbum() {
		setEditingAlbumId(null);
		setTitle('');
		setReleaseDate(new Date().toISOString().split('T')[0]);
		setMarketFormat('LP');
		setSelectedTrackIds([]);
		setCoverPreviewUrl(null);
		setCoverFile(null);
		setCoverDimensionNotice(null);
		setError(null);
		setSuccessMsg(null);
		setIsEditing(true);
	}

	function openEditAlbum(album: Album) {
		setEditingAlbumId(album.id);
		setTitle(album.title);
		setReleaseDate(album.release_date ?? '');
		const existingAlbumTracks = tracksByAlbum[album.id] ?? [];
		const trackCount = existingAlbumTracks.length;

		// Deduce market format from track count if possible
		let deducedFormat: AlbumMarketFormat = 'LP';
		if (trackCount <= 3) deducedFormat = 'Single';
		else if (trackCount <= 7) deducedFormat = 'EP';
		else deducedFormat = 'LP';

		setMarketFormat(deducedFormat);
		setSelectedTrackIds(existingAlbumTracks.map((t) => t.id));
		setCoverPreviewUrl(album.cover_key ? coverUrl(album.cover_key) : null);
		setCoverFile(null);
		setCoverDimensionNotice(null);
		setError(null);
		setSuccessMsg(null);
		setIsEditing(true);
	}

	// Client-side image validation: not more than 3500x3500 px with auto-optimization
	async function handleCoverFile(file: File | undefined) {
		if (!file) return;
		setError(null);
		setCoverDimensionNotice(null);

		if (!file.type.startsWith('image/')) {
			setError('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP)');
			return;
		}

		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);
			const { width, height } = img;

			if (width > 3500 || height > 3500) {
				// Resize down to 3000x3000px maximum to comply with the 3500x3500 px limit
				const maxDim = 3000;
				const scale = Math.min(maxDim / width, maxDim / height);
				const targetW = Math.round(width * scale);
				const targetH = Math.round(height * scale);

				const canvas = document.createElement('canvas');
				canvas.width = targetW;
				canvas.height = targetH;
				const ctx = canvas.getContext('2d');
				if (ctx) {
					ctx.drawImage(img, 0, 0, targetW, targetH);
					canvas.toBlob(
						(blob) => {
							if (blob) {
								const optimizedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
									type: 'image/webp',
								});
								setCoverFile(optimizedFile);
								setCoverPreviewUrl(canvas.toDataURL('image/webp'));
								setCoverDimensionNotice(
									`Dimensiones originales: ${width}×${height} px (excedían el límite de 3500×3500 px). Se optimizó automáticamente a ${targetW}×${targetH} px.`
								);
							}
						},
						'image/webp',
						0.95
					);
				}
			} else {
				setCoverFile(file);
				setCoverPreviewUrl(objectUrl);
				setCoverDimensionNotice(`Dimensiones verificadas: ${width}×${height} px (Cumple estándar ≤ 3500×3500 px)`);
			}
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			setError('No se pudo procesar la imagen de portada');
		};

		img.src = objectUrl;
	}

	async function handleGenerateAICover() {
		if (!user) return;
		setGeneratingCover(true);
		setError(null);

		const fullPrompt = `Iconic high-resolution album cover artwork for album "${title || 'Untitled'}" by artist "${artist.name}". Idea: ${aiCoverPrompt || 'breathtaking musical concept'}. Style: ${aiCoverStyle}. Album cover framing, 1:1 square ratio, 8k resolution, award-winning discographic design, no watermarks, master quality`.slice(0, 950);

		try {
			const res = await createCreation('image', fullPrompt, {
				size: '1024x1024',
				aspect_ratio: '1:1',
				style: aiCoverStyle,
			});

			if (res.error || !res.data?.id) {
				throw new Error(res.error || 'Error al iniciar la generación de la portada con IA');
			}

			// Poll for image completion
			let finishedUrl: string | null = null;
			for (let i = 0; i < 40; i++) {
				await new Promise((r) => setTimeout(r, 2500));
				await refreshCreation(res.data.id);
				const creation = await fetchCreation(res.data.id);

				if (creation?.status === 'ready' && (creation.result_urls?.[0] || creation.thumbnail_url)) {
					finishedUrl = creation.result_urls?.[0] || creation.thumbnail_url || null;
					break;
				}
				if (creation?.status === 'error') {
					throw new Error(creation.error_message || 'Falló la generación de la portada');
				}
			}

			if (finishedUrl) {
				setCoverPreviewUrl(finishedUrl);
				setCoverFile(null);
				setCoverDimensionNotice('Portada generada con éxito por IA en alta definición.');
			} else {
				throw new Error('La generación tardó demasiado. Puedes volver a intentarlo.');
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Error al generar la portada';
			setError(msg);
		} finally {
			setGeneratingCover(false);
		}
	}

	function toggleTrackSelection(trackId: string) {
		setSelectedTrackIds((prev) => {
			if (prev.includes(trackId)) {
				return prev.filter((id) => id !== trackId);
			}
			if (prev.length >= 16) {
				setError('El límite máximo de canciones por álbum es de 16 pistas.');
				return prev;
			}
			setError(null);
			return [...prev, trackId];
		});
	}

	function moveTrack(index: number, direction: 'up' | 'down') {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= selectedTrackIds.length) return;
		const next = [...selectedTrackIds];
		const temp = next[index];
		next[index] = next[targetIndex];
		next[targetIndex] = temp;
		setSelectedTrackIds(next);
	}

	async function handleSaveAlbum(e: React.FormEvent) {
		e.preventDefault();
		if (!user || !title.trim()) return;

		if (selectedTrackIds.length === 0) {
			setError('Debes seleccionar al menos 1 canción para el álbum.');
			return;
		}

		if (selectedTrackIds.length > 16) {
			setError('Un álbum no puede tener más de 16 canciones.');
			return;
		}

		setSaving(true);
		setError(null);

		let coverKey: string | null = coverPreviewUrl;

		// If a new local file was selected, upload it
		if (coverFile) {
			const uploadRes = await uploadMedia(user.id, coverFile, 'covers');
			if (uploadRes.error || !uploadRes.url) {
				setSaving(false);
				setError(uploadRes.error ?? 'No se pudo subir la portada');
				return;
			}
			coverKey = uploadRes.url;
		}

		const result = await saveAlbumWithTracks({
			artistId: artist.id,
			albumId: editingAlbumId,
			title: title.trim(),
			releaseDate: releaseDate || null,
			coverKey,
			trackIds: selectedTrackIds,
		});

		setSaving(false);

		if (result.error) {
			setError(result.error);
			return;
		}

		setSuccessMsg(editingAlbumId ? 'Álbum actualizado correctamente.' : 'Álbum creado y publicado con éxito.');
		setTimeout(() => {
			setIsEditing(false);
			void loadData();
		}, 800);
	}

	async function handleDeleteAlbum(album: Album) {
		if (
			!supabase ||
			!window.confirm(
				`¿Eliminar el álbum "${album.title}"? Las canciones asociadas se conservarán como sencillos individuales.`
			)
		) {
			return;
		}

		// Unlink tracks first
		await supabase.from('tracks').update({ album_id: null }).eq('album_id', album.id);
		await supabase.from('albums').delete().eq('id', album.id);
		void loadData();
	}

	// Calculate total runtime of selected tracks
	const selectedTracksList = useMemo(
		() =>
			selectedTrackIds
				.map((id) => allTracks.find((t) => t.id === id))
				.filter((t): t is OwnTrack => Boolean(t)),
		[selectedTrackIds, allTracks]
	);

	const totalSelectedSeconds = useMemo(
		() => selectedTracksList.reduce((acc, t) => acc + (t.duration_seconds || 0), 0),
		[selectedTracksList]
	);

	return (
		<div data-ev-id="ev_album_manager" className="flex flex-col gap-6">
			{/* Header bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-border">
				<div className="flex items-center gap-3">
					<div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
						<Disc3 className="h-6 w-6" />
					</div>
					<div>
						<h2 className="text-lg font-bold text-foreground">Discografía y Álbumes</h2>
						<p className="text-xs text-muted-foreground">
							Organiza tus lanzamientos discográficos, compila sencillos y crea portadas profesionales.
						</p>
					</div>
				</div>

				<button
					type="button"
					onClick={openCreateAlbum}
					className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 shadow-md shadow-primary/20 transition-all cursor-pointer"
				>
					<Plus className="h-4 w-4" />
					<span>Crear Nuevo Álbum</span>
				</button>
			</div>

			{/* Market Formats Guide Banner */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
				{ALBUM_MARKET_FORMATS.map((fmt) => (
					<div
						key={fmt.id}
						className="flex flex-col gap-1 p-2.5 rounded-xl bg-surface-2 border border-border/70 text-left"
					>
						<span className="text-[10px] font-bold text-primary uppercase">{fmt.badge}</span>
						<span className="text-xs font-bold text-foreground truncate">{fmt.name}</span>
						<span className="text-[10px] text-muted-foreground">
							{fmt.minTracks === fmt.maxTracks
								? `${fmt.maxTracks} canciones`
								: `${fmt.minTracks} a ${fmt.maxTracks} canciones`}
						</span>
					</div>
				))}
			</div>

			{/* Existing Albums Showcase */}
			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
						Tus Álbumes Publicados ({albums.length})
					</h3>
				</div>

				{loading ? (
					<div className="flex items-center justify-center p-12 text-muted-foreground">
						<Loader2 className="h-6 w-6 animate-spin mr-2" />
						<span>Cargando discografía...</span>
					</div>
				) : albums.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-surface-2">
						<Disc className="h-12 w-12 text-muted-foreground/50 mb-3" />
						<p className="text-sm font-bold text-foreground">Aún no has creado ningún álbum</p>
						<p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
							Selecciona entre 1 y 16 de tus canciones creadas para lanzar tu primer LP, EP o Maxi-Single.
						</p>
						<button
							type="button"
							onClick={openCreateAlbum}
							className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-3 hover:bg-surface text-foreground font-semibold text-xs border border-border"
						>
							<Plus className="h-3.5 w-3.5 text-primary" />
							Empezar Álbum
						</button>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{albums.map((album) => {
							const albumTracks = tracksByAlbum[album.id] ?? [];
							const trackCount = albumTracks.length;
							const totalSeconds = albumTracks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);

							let formatLabel = 'LP';
							if (trackCount <= 3) formatLabel = 'Maxi-Single';
							else if (trackCount <= 7) formatLabel = 'EP';
							else if (trackCount >= 12) formatLabel = 'LP Deluxe';

							return (
								<div
									key={album.id}
									className="group relative flex flex-col gap-3 rounded-2xl bg-surface p-4 border border-border/80 hover:border-primary/40 transition-all shadow-lg"
								>
									{/* Realistic Vinyl Cover Mockup */}
									<div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-3 shadow-md">
										{/* Vinyl disc peek */}
										<div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-3/4 aspect-square rounded-full bg-zinc-950 border-4 border-zinc-900 shadow-2xl flex items-center justify-center opacity-85 group-hover:translate-x-6 transition-transform duration-300">
											<div className="w-1/3 aspect-square rounded-full border-2 border-zinc-700 bg-red-600/30 flex items-center justify-center">
												<div className="w-3 h-3 rounded-full bg-zinc-950" />
											</div>
										</div>

										<img
											src={coverUrl(album.cover_key)}
											alt={album.title}
											className="relative z-10 h-full w-full object-cover rounded-xl shadow-lg border border-white/5"
										/>

										<span className="absolute top-2 left-2 z-20 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/30">
											{formatLabel}
										</span>
									</div>

									<div className="flex flex-col gap-1 min-w-0">
										<h4 className="text-sm font-bold text-foreground truncate">{album.title}</h4>
										<p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
											<span>{trackCount === 1 ? '1 canción' : `${trackCount} canciones`}</span>
											<span>·</span>
											<span>{formatTime(totalSeconds)}</span>
											{album.release_date && (
												<>
													<span>·</span>
													<span>{album.release_date.slice(0, 4)}</span>
												</>
											)}
										</p>
									</div>

									<div className="flex items-center gap-2 pt-2 border-t border-border/60">
										<button
											type="button"
											onClick={() => openEditAlbum(album)}
											className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-foreground border border-border"
										>
											<Edit3 className="h-3.5 w-3.5 text-primary" />
											<span>Editar Álbum</span>
										</button>
										<button
											type="button"
											onClick={() => void handleDeleteAlbum(album)}
											className="p-1.5 rounded-lg bg-surface-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border"
											title="Eliminar álbum"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</section>

			{/* ALBUM CREATION & EDITING MODAL */}
			{isEditing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
					<div className="relative flex flex-col gap-5 w-full max-w-4xl rounded-2xl bg-surface p-6 border border-border shadow-2xl my-8">
						{/* Modal Header */}
						<div className="flex items-center justify-between border-b border-border pb-4">
							<div className="flex items-center gap-2.5">
								<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
									<Disc3 className="h-5 w-5" />
								</div>
								<div>
									<h3 className="text-base font-bold text-foreground">
										{editingAlbumId ? 'Editar Álbum' : 'Crear y Compilar Nuevo Álbum'}
									</h3>
									<p className="text-xs text-muted-foreground">
										Organiza tu tracklist (hasta 16 canciones), formato de mercado y carátula.
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						{error && (
							<div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs">
								<AlertCircle className="h-4 w-4 flex-none" />
								<span>{error}</span>
							</div>
						)}

						{successMsg && (
							<div className="flex items-center gap-2 p-3 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs">
								<CheckCircle2 className="h-4 w-4 flex-none" />
								<span>{successMsg}</span>
							</div>
						)}

						<form onSubmit={handleSaveAlbum} className="flex flex-col gap-6">
							{/* STEP 1: Basic Info & Market Format */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="flex flex-col gap-3">
									<div className="flex flex-col gap-1.5">
										<label htmlFor="album-title-in" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Título del Álbum *
										</label>
										<input
											id="album-title-in"
											type="text"
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											placeholder="Ej: Saturno Tropical, Ilusiones 8K..."
											required
											maxLength={120}
											className={`${inputClass} text-sm font-semibold`}
										/>
									</div>

									<div className="flex flex-col gap-1.5">
										<label htmlFor="album-date-in" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Fecha de Lanzamiento
										</label>
										<input
											id="album-date-in"
											type="date"
											value={releaseDate}
											onChange={(e) => setReleaseDate(e.target.value)}
											className={`${inputClass} text-xs`}
										/>
									</div>
								</div>

								{/* Market Format Selector */}
								<div className="flex flex-col gap-1.5">
									<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
										Formato de Lanzamiento (Mercado Discográfico)
									</span>
									<div className="grid grid-cols-1 gap-1.5">
										{ALBUM_MARKET_FORMATS.map((fmt) => {
											const on = marketFormat === fmt.id;
											return (
												<button
													key={fmt.id}
													type="button"
													onClick={() => setMarketFormat(fmt.id)}
													className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
														on
															? 'border-primary bg-primary/10 text-primary'
															: 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
													}`}
												>
													<div className="min-w-0">
														<span className="text-xs font-bold block truncate text-foreground">
															{fmt.name}
														</span>
														<span className="text-[10px] text-muted-foreground block truncate">
															{fmt.description}
														</span>
													</div>
													{on && <Check className="h-4 w-4 text-primary flex-none ml-2" />}
												</button>
											);
										})}
									</div>
								</div>
							</div>

							{/* STEP 2: Song Tracklist Selection (Up to 16 tracks) */}
							<div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 border border-border">
								<div className="flex items-center justify-between">
									<div>
										<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Selección de Canciones (Tracklist)
										</h4>
										<p className="text-[11px] text-muted-foreground">
											Elige hasta 16 canciones creadas y reordénalas a tu gusto.
										</p>
									</div>
									<div className="flex items-center gap-2">
										<span className="rounded-lg bg-surface-3 px-2.5 py-1 text-xs font-mono font-bold text-primary border border-primary/20">
											{selectedTrackIds.length} / 16 pistas
										</span>
										<span className="text-xs text-muted-foreground font-mono">
											{formatTime(totalSelectedSeconds)}
										</span>
									</div>
								</div>

								{/* Ordered Selected Tracks */}
								{selectedTrackIds.length > 0 && (
									<div className="flex flex-col gap-1.5 p-2 rounded-xl bg-surface border border-border/80">
										<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
											Orden del Álbum (Tracklist Oficial):
										</span>
										<div className="flex flex-col gap-1 max-h-48 overflow-y-auto no-scrollbar">
											{selectedTrackIds.map((id, index) => {
												const tr = allTracks.find((t) => t.id === id);
												if (!tr) return null;
												return (
													<div
														key={tr.id}
														className="flex items-center gap-2 p-2 rounded-lg bg-surface-2 border border-border/50 text-xs"
													>
														<span className="font-mono text-primary font-bold w-6 text-center">
															#{String(index + 1).padStart(2, '0')}
														</span>
														<img
															src={coverUrl(tr.cover_key)}
															alt=""
															className="h-7 w-7 rounded object-cover flex-none"
														/>
														<span className="font-semibold truncate flex-1 text-foreground">
															{tr.title}
														</span>
														<span className="text-[10px] text-muted-foreground font-mono mr-2">
															{formatTime(tr.duration_seconds)}
														</span>

														{/* Move buttons */}
														<div className="flex items-center gap-1">
															<button
																type="button"
																onClick={() => moveTrack(index, 'up')}
																disabled={index === 0}
																className="p-1 rounded hover:bg-surface-3 text-muted-foreground disabled:opacity-30"
																title="Mover arriba"
															>
																<ArrowUp className="h-3.5 w-3.5" />
															</button>
															<button
																type="button"
																onClick={() => moveTrack(index, 'down')}
																disabled={index === selectedTrackIds.length - 1}
																className="p-1 rounded hover:bg-surface-3 text-muted-foreground disabled:opacity-30"
																title="Mover abajo"
															>
																<ArrowDown className="h-3.5 w-3.5" />
															</button>
															<button
																type="button"
																onClick={() => toggleTrackSelection(tr.id)}
																className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive ml-1"
																title="Quitar pista"
															>
																<X className="h-3.5 w-3.5" />
															</button>
														</div>
													</div>
												);
											})}
										</div>
									</div>
								)}

								{/* Available tracks pool to pick from */}
								<div className="flex flex-col gap-1.5">
									<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
										Canciones Disponibles en tu Catálogo ({allTracks.length}):
									</span>

									{allTracks.length === 0 ? (
										<p className="text-xs text-muted-foreground p-3 rounded-lg bg-surface">
											No tienes canciones subidas o publicadas aún. Crea canciones en el Estudio o súbelas en la pestaña Canciones.
										</p>
									) : (
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto no-scrollbar p-1">
											{allTracks.map((tr) => {
												const isSelected = selectedTrackIds.includes(tr.id);
												return (
													<button
														key={tr.id}
														type="button"
														onClick={() => toggleTrackSelection(tr.id)}
														className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
															isSelected
																? 'border-primary bg-primary/10 text-primary'
																: 'border-border bg-surface hover:bg-surface-3 text-muted-foreground hover:text-foreground'
														}`}
													>
														<div
															className={`h-4 w-4 rounded flex items-center justify-center border text-[10px] flex-none ${
																isSelected
																	? 'border-primary bg-primary text-black font-bold'
																	: 'border-border'
															}`}
														>
															{isSelected && <Check className="h-3 w-3" />}
														</div>
														<img
															src={coverUrl(tr.cover_key)}
															alt=""
															className="h-7 w-7 rounded object-cover flex-none"
														/>
														<div className="min-w-0 flex-1">
															<p className="truncate font-semibold text-foreground text-xs">{tr.title}</p>
															<p className="text-[10px] text-muted-foreground font-mono">
																{formatTime(tr.duration_seconds)} · {tr.genre ?? 'Música'}
															</p>
														</div>
													</button>
												);
											})}
										</div>
									)}
								</div>
							</div>

							{/* STEP 3: Album Cover (Upload with <=3500px check or AI generator) */}
							<div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 border border-border">
								<div className="flex items-center justify-between">
									<div>
										<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
											Portada del Álbum
										</h4>
										<p className="text-[11px] text-muted-foreground">
											Sube una imagen de alta resolución (máximo 3500×3500 px) o genérala con IA.
										</p>
									</div>

									<div className="flex items-center gap-1 rounded-xl bg-surface p-1 border border-border">
										<button
											type="button"
											onClick={() => setCoverMode('upload')}
											className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
												coverMode === 'upload'
													? 'bg-surface-3 text-foreground shadow-sm'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											Subir Archivo
										</button>
										<button
											type="button"
											onClick={() => setCoverMode('ai')}
											className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
												coverMode === 'ai'
													? 'bg-surface-3 text-primary shadow-sm'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											Crear con IA
										</button>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-center">
									{/* Vinyl Mockup Preview */}
									<div className="relative aspect-square w-44 rounded-xl bg-surface-3 overflow-hidden border border-border shadow-xl mx-auto md:mx-0">
										{coverPreviewUrl ? (
											<img
												src={coverPreviewUrl}
												alt="Portada preview"
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground">
												<Disc3 className="h-10 w-10 mb-2 opacity-40" />
												<span className="text-[11px]">Sin portada seleccionada</span>
											</div>
										)}
									</div>

									{/* Controls based on coverMode */}
									<div className="flex flex-col gap-3">
										{coverMode === 'upload' ? (
											<div className="flex flex-col gap-2">
												<label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-border bg-surface cursor-pointer hover:bg-surface-3 transition-colors">
													<Upload className="h-6 w-6 text-muted-foreground" />
													<div className="text-center">
														<span className="text-xs font-bold text-foreground block">
															Haz clic para subir portada
														</span>
														<span className="text-[10px] text-muted-foreground block">
															Estándar discográfico: Máximo 3500×3500 px (cuadrado 1:1, JPG/PNG/WebP)
														</span>
													</div>
													<input
														type="file"
														accept="image/*"
														className="sr-only"
														onChange={(e) => void handleCoverFile(e.target.files?.[0])}
													/>
												</label>

												{coverDimensionNotice && (
													<p className="text-[11px] text-cyan-400 font-medium">
														{coverDimensionNotice}
													</p>
												)}
											</div>
										) : (
											<div className="flex flex-col gap-2.5 p-3 rounded-xl bg-surface border border-border">
												<span className="text-xs font-bold text-primary flex items-center gap-1.5">
													<Sparkles className="h-4 w-4" />
													Generador de Portadas de Álbum con IA
												</span>

												<textarea
													value={aiCoverPrompt}
													onChange={(e) => setAiCoverPrompt(e.target.value)}
													rows={2}
													maxLength={300}
													placeholder="Describe tu portada: Una puesta de sol futurista sobre rascacielos con tonos violeta y cromo..."
													className={`${inputClass} text-xs resize-none`}
												/>

												<div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
													{COVER_AI_STYLES.map((st) => {
														const on = aiCoverStyle === st.prompt;
														return (
															<button
																key={st.label}
																type="button"
																onClick={() => setAiCoverStyle(st.prompt)}
																className={`p-1.5 rounded-lg border text-left text-[11px] truncate transition-colors ${
																	on
																		? 'border-primary bg-primary/10 text-primary font-bold'
																		: 'border-border bg-surface-2 text-muted-foreground'
																}`}
															>
																{st.label}
															</button>
														);
													})}
												</div>

												<button
													type="button"
													onClick={() => void handleGenerateAICover()}
													disabled={generatingCover}
													className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/20 text-primary border border-primary/40 font-bold text-xs hover:bg-primary hover:text-black transition-all cursor-pointer disabled:opacity-50"
												>
													{generatingCover ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<Wand2 className="h-4 w-4" />
													)}
													<span>Generar y Aplicar Portada con IA</span>
												</button>
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Form Actions Footer */}
							<div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
								<button
									type="button"
									onClick={() => setIsEditing(false)}
									className="px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-xs font-bold text-muted-foreground hover:text-foreground"
								>
									Cancelar
								</button>
								<button
									type="submit"
									disabled={saving || !title.trim() || selectedTrackIds.length === 0}
									className={`${primaryButton} cursor-pointer px-6`}
								>
									{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
									<span>{editingAlbumId ? 'Guardar Cambios del Álbum' : 'Publicar Álbum'}</span>
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}