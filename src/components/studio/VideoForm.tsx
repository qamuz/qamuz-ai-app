import { useState } from 'react';
import {
	Check,
	Film,
	Loader2,
	Music2,
	Sparkles,
	Tv,
	Upload,
	Video,
	Wand2,
	Zap,
} from 'lucide-react';
import { inputClass, primaryButton } from '@/lib/ui';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { audioDuration, uploadMedia } from '@/lib/media';
import { lyricLines, type StudioSong, type VideoSource } from '@/lib/studio';
import type { ProviderInfo } from '@/components/studio/StudioForm';
import {
	MV_BACKGROUNDS,
	MV_CAMERA_MOTIONS,
	MV_CHARACTERS,
	MV_STYLES,
	MV_VIBES,
	buildMusicVideoPrompt,
	type MusicVideoKind,
	type MusicVideoMode,
} from '@/lib/music-video/presets';

interface Props {
	songs: StudioSong[];
	initialKey: string | null;
	initialExtra?: string;
	userId: string;
	provider: ProviderInfo | null;
	credits: number | null;
	submitting: boolean;
	onSubmit: (prompt: string, options: Record<string, unknown>) => void;
}

/** Turn any created song (or an uploaded one) into an AI Music Video or Lyrics Video. */
export function VideoForm({
	songs,
	initialKey,
	initialExtra = '',
	userId,
	provider,
	credits,
	submitting,
	onSubmit,
}: Props) {
	const { t } = useI18n();
	const [pick, setPick] = useState<string | null>(initialKey ?? songs[0]?.key ?? null);
	const [upload, setUpload] = useState<VideoSource | null>(null);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	// Advanced Music Video Parameters
	const [videoKind, setVideoKind] = useState<MusicVideoKind>('music-video');
	const [videoMode, setVideoMode] = useState<MusicVideoMode>('one-click');
	const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9');
	const [is30sViralHook, setIs30sViralHook] = useState(false);
	const [selectedStyle, setSelectedStyle] = useState<string>(MV_STYLES[0].id);
	const [selectedChar, setSelectedChar] = useState<string>(MV_CHARACTERS[0].name);
	const [selectedBg, setSelectedBg] = useState<string>(MV_BACKGROUNDS[0].name);
	const [selectedVibes, setSelectedVibes] = useState<string[]>(['Energetic & Dance']);
	const [cameraMotion, setCameraMotion] = useState<string>(MV_CAMERA_MOTIONS[0]);
	const [extra, setExtra] = useState(initialExtra);

	const song = songs.find((s) => s.key === pick) ?? null;
	const source: VideoSource | null =
		pick === 'upload'
			? upload
			: song
			? {
					song_key: song.key,
					audio_url: song.audioUrl,
					title: song.title,
					cover_url: song.coverUrl,
					duration: song.duration,
			  }
			: null;

	const available = Boolean(provider?.is_active);
	const cost = provider?.credit_cost ?? 0;
	const notEnough = credits !== null && credits < cost;

	async function handleFile(file: File | undefined) {
		if (!file) return;
		setUploadError(null);
		if (!file.type.startsWith('audio/')) {
			setUploadError(t('Choose an audio file (MP3, WAV…)'));
			return;
		}
		setUploading(true);
		const [res, dur] = await Promise.all([
			uploadMedia(userId, file, 'uploads'),
			audioDuration(file),
		]);
		setUploading(false);
		if (res.error || !res.url) {
			setUploadError(t('Could not upload the file'));
			return;
		}
		setUpload({
			song_key: null,
			audio_url: res.url,
			title: file.name.replace(/\.[^.]+$/, '').slice(0, 80),
			cover_url: null,
			duration: dur,
		});
		setPick('upload');
	}

	function toggleVibe(v: string) {
		setSelectedVibes((prev) =>
			prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
		);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!source) return;

		const lyrics = song && pick !== 'upload' ? song.lyrics : null;

		const compiledPrompt = buildMusicVideoPrompt({
			title: source.title,
			lyrics,
			extraPrompt: extra,
			videoType: videoKind,
			is30sViralHook,
			character: selectedChar,
			background: selectedBg,
			style: selectedStyle,
			vibeTags: selectedVibes,
			videoGenMode: videoMode,
			cameraMotion,
		});

		onSubmit(compiledPrompt, {
			style: selectedStyle,
			aspect,
			videoKind,
			videoMode,
			is30sViralHook,
			character: selectedChar,
			background: selectedBg,
			cameraMotion,
			source,
		});
	}

	const chip = (on: boolean) =>
		`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
			on
				? 'border-primary bg-primary/10 text-primary shadow-sm'
				: 'border-border text-muted-foreground hover:text-foreground'
		}`;

	return (
		<form
			data-ev-id="ev_vf_form"
			onSubmit={handleSubmit}
			className="flex flex-col gap-6 rounded-2xl bg-surface-2 p-5 border border-border/70 shadow-xl"
		>
			{/* Video Kind Selector (Music Video vs Animated Lyrics Video) */}
			<div className="flex flex-col gap-2">
				<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
					Tipo de Producción Audiovisual
				</span>
				<div className="grid grid-cols-2 gap-2.5">
					<button
						type="button"
						onClick={() => setVideoKind('music-video')}
						className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
							videoKind === 'music-video'
								? 'border-cyan-500 bg-cyan-950/25 text-cyan-300 shadow-md shadow-cyan-500/20'
								: 'border-border bg-surface hover:bg-surface-3 text-muted-foreground'
						}`}
					>
						<Film className="h-5 w-5 flex-none" />
						<div>
							<p className="text-xs font-black">Music Video Oficial</p>
							<p className="text-[10px] opacity-75">Cinemática, actuación y atmósfera 8K</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => setVideoKind('lyrics-video')}
						className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
							videoKind === 'lyrics-video'
								? 'border-purple-500 bg-purple-950/25 text-purple-300 shadow-md shadow-purple-500/20'
								: 'border-border bg-surface hover:bg-surface-3 text-muted-foreground'
						}`}
					>
						<Tv className="h-5 w-5 flex-none" />
						<div>
							<p className="text-xs font-black">Video de Letras Animadas</p>
							<p className="text-[10px] opacity-75">Tipografía cinética al ritmo del audio</p>
						</div>
					</button>
				</div>
			</div>

			{/* Song Selection Bay */}
			<div data-ev-id="ev_vf_pick" className="flex flex-col gap-2">
				<span data-ev-id="ev_vf_pick_l" className="text-sm font-bold">
					{t('Choose a song')}
				</span>
				<p data-ev-id="ev_vf_pick_h" className="text-xs text-muted-foreground">
					{t('Your songs and uploads become the soundtrack of the video.')}
				</p>

				<label
					data-ev-id="ev_vf_upload"
					className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5 text-sm font-semibold transition-colors ${
						pick === 'upload'
							? 'border-primary bg-primary/10 text-primary'
							: 'border-border text-muted-foreground hover:text-foreground'
					}`}
				>
					{uploading ? (
						<Loader2 className="h-4 w-4 flex-none animate-spin" />
					) : pick === 'upload' ? (
						<Check className="h-4 w-4 flex-none" />
					) : (
						<Upload className="h-4 w-4 flex-none" />
					)}
					<span data-ev-id="ev_vf_upload_t" className="truncate">
						{uploading
							? t('Uploading…')
							: upload
							? upload.title
							: t('Upload a song (MP3, WAV)')}
					</span>
					<input
						data-ev-id="ev_vf_file"
						type="file"
						accept="audio/*"
						className="sr-only"
						onChange={(e) => void handleFile(e.target.files?.[0])}
					/>
				</label>
				{uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

				{songs.length === 0 ? (
					<p className="rounded-xl bg-surface px-3 py-3 text-xs text-muted-foreground">
						{t('No songs yet. Create one in the Music tab or upload a file.')}
					</p>
				) : (
					<ul className="no-scrollbar flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-border/60 bg-surface p-1">
						{songs.map((s) => {
							const on = pick === s.key;
							return (
								<li key={s.key}>
									<button
										type="button"
										onClick={() => setPick(s.key)}
										aria-pressed={on}
										className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
											on ? 'bg-primary/15' : 'hover:bg-surface-2'
										}`}
									>
										<img
											src={coverUrl(s.coverUrl)}
											alt=""
											width={36}
											height={36}
											loading="lazy"
											className="h-9 w-9 flex-none rounded-lg object-cover"
										/>
										<span className="flex min-w-0 flex-1 flex-col">
											<span
												className={`truncate text-xs font-bold ${
													on ? 'text-primary' : 'text-foreground'
												}`}
											>
												{s.title}
											</span>
											<span className="truncate text-[10px] text-muted-foreground">
												{[
													s.version ? t('Version {n}', { n: s.version }) : null,
													s.duration ? formatTime(s.duration) : null,
												]
													.filter(Boolean)
													.join(' · ')}
											</span>
										</span>
										{on && <Check className="h-4 w-4 flex-none text-primary" />}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{/* Format & Social Viral Hook Switcher */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div className="flex flex-col gap-2">
					<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
						Formato de Pantalla
					</span>
					<div className="grid grid-cols-2 gap-2">
						<button
							type="button"
							onClick={() => setAspect('16:9')}
							className={chip(aspect === '16:9')}
						>
							Horizontal 16:9 (YouTube)
						</button>
						<button
							type="button"
							onClick={() => setAspect('9:16')}
							className={chip(aspect === '9:16')}
						>
							Vertical 9:16 (Shorts/Reels)
						</button>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
						Gancho Viral para Redes
					</span>
					<button
						type="button"
						onClick={() => setIs30sViralHook((v) => !v)}
						className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
							is30sViralHook
								? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/20'
								: 'bg-surface text-muted-foreground border-border'
						}`}
					>
						<span className="flex items-center gap-2">
							<Zap className="h-4 w-4 text-amber-400" />
							Gancho de 30s (TikTok / Reels)
						</span>
						<span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
							{is30sViralHook ? 'ACTIVO' : 'OFF'}
						</span>
					</button>
				</div>
			</div>

			{/* Visual Styles Showcase Grid */}
			<div className="flex flex-col gap-2">
				<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
					Estilo Visual Cinemático
				</span>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					{MV_STYLES.map((st) => {
						const on = selectedStyle === st.id;
						return (
							<button
								key={st.id}
								type="button"
								onClick={() => setSelectedStyle(st.id)}
								className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
									on
										? 'border-cyan-400 ring-2 ring-cyan-400/30'
										: 'border-border/70 hover:border-foreground/30'
								}`}
							>
								<img
									src={st.img}
									alt={st.name}
									className="h-16 w-full object-cover transition-transform group-hover:scale-105"
								/>
								<div className="p-2 bg-surface">
									<p className="text-[11px] font-bold truncate text-foreground">{st.name}</p>
								</div>
								{on && (
									<div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-cyan-400 flex items-center justify-center text-black">
										<Check className="h-2.5 w-2.5" />
									</div>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Lead Performer / Character Selection */}
			{videoKind === 'music-video' && (
				<div className="flex flex-col gap-2">
					<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
						Personaje Principal / Avatar del Artista
					</span>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
						{MV_CHARACTERS.map((char) => {
							const on = selectedChar === char.name;
							return (
								<button
									key={char.id}
									type="button"
									onClick={() => setSelectedChar(char.name)}
									className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
										on
											? 'border-primary bg-primary/10 shadow-sm'
											: 'border-border bg-surface hover:bg-surface-3'
									}`}
								>
									{char.img ? (
										<img
											src={char.img}
											alt=""
											className="h-9 w-9 rounded-full object-cover border border-white/10 flex-none"
										/>
									) : (
										<div className="h-9 w-9 rounded-full bg-surface-3 flex items-center justify-center text-muted-foreground text-[10px] font-bold flex-none">
											AUTO
										</div>
									)}
									<span className="text-xs font-semibold truncate text-foreground">
										{char.name}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* Stage Background Environment */}
			<div className="flex flex-col gap-2">
				<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
					Escenario y Fondo
				</span>
				<div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
					{MV_BACKGROUNDS.map((bg) => {
						const on = selectedBg === bg.name;
						return (
							<button
								key={bg.id}
								type="button"
								onClick={() => setSelectedBg(bg.name)}
								className={`flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
									on
										? 'border-purple-400 ring-2 ring-purple-400/30'
										: 'border-border bg-surface hover:border-foreground/30'
								}`}
							>
								<img src={bg.img} alt="" className="h-12 w-full object-cover" />
								<div className="p-1.5 bg-surface">
									<p className="text-[10px] font-bold truncate text-foreground">{bg.name}</p>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			{/* Camera Motion & Vibe Pills */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div className="flex flex-col gap-2">
					<label htmlFor="camera-motion" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
						Movimiento de Cámara
					</label>
					<select
						id="camera-motion"
						value={cameraMotion}
						onChange={(e) => setCameraMotion(e.target.value)}
						className={`${inputClass} text-xs font-semibold`}
					>
						{MV_CAMERA_MOTIONS.map((cm) => (
							<option key={cm} value={cm}>
								{cm}
							</option>
						))}
					</select>
				</div>

				<div className="flex flex-col gap-2">
					<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
						Vibra y Tono Emocional
					</span>
					<div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
						{MV_VIBES.map((v) => {
							const on = selectedVibes.includes(v);
							return (
								<button
									key={v}
									type="button"
									onClick={() => toggleVibe(v)}
									className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
										on
											? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
											: 'bg-surface text-muted-foreground border-border hover:text-foreground'
									}`}
								>
									{v}
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* Extra Direction Prompt */}
			<label data-ev-id="ev_vf_extra" className="flex flex-col gap-2 text-sm font-semibold">
				{t('Extra direction (optional)')}
				<textarea
					data-ev-id="ev_vf_extra_t"
					value={extra}
					onChange={(e) => setExtra(e.target.value)}
					rows={2}
					maxLength={500}
					placeholder={t(
						'Luces de neón en Santo Domingo, lluvia sobre el asfalto, cámara lenta al llegar el coro...'
					)}
					className={`${inputClass} resize-none leading-relaxed text-xs`}
				/>
			</label>

			{!available && (
				<p
					data-ev-id="ev_vf_noprov"
					className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-xs text-pretty text-muted-foreground"
				>
					{t(
						'There is no active provider for creating {what} yet. The administrator can enable it in the dashboard.',
						{ what: t('videos') }
					)}
				</p>
			)}

			{/* Submit & Credit Cost Footer */}
			<div
				data-ev-id="ev_vf_foot"
				className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
			>
				<span data-ev-id="ev_vf_cost" className="text-xs text-muted-foreground font-medium">
					{provider
						? `${provider.name} · ${t('{count} credits', { count: cost })}`
						: t('No provider')}
					{notEnough && (
						<span data-ev-id="ev_vf_notenough" className="block text-destructive font-semibold">
							{t("You don't have enough credits")}
						</span>
					)}
				</span>
				<button
					data-ev-id="ev_vf_submit"
					type="submit"
					disabled={!available || submitting || notEnough || !source || uploading}
					className={`${primaryButton} cursor-pointer`}
				>
					{submitting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Sparkles className="h-4 w-4" />
					)}
					{videoKind === 'lyrics-video' ? 'Generar Lyrics Video' : 'Generar Music Video'}
				</button>
			</div>
		</form>
	);
}
