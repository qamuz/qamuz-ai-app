import { useState } from 'react';
import { ExternalLink, Loader2, Pencil, Save, Sparkles, Upload } from 'lucide-react';
import { Link } from 'react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { uploadMedia } from '@/lib/media';
import { coverUrl } from '@/lib/covers';
import { sanitizeExternalUrl } from '@/lib/safeUrl';
import type { OwnedArtist } from '@/contexts/account-context';
import { Field, Notice, PrimaryButton, TextArea, TextInput } from '@/components/ui/Field';
import { ArtistImageModal } from '@/components/artist/ArtistImageModal';

const SOCIALS = [
	{ key: 'instagram', label: 'Instagram' },
	{ key: 'tiktok', label: 'TikTok' },
	{ key: 'youtube', label: 'YouTube' },
	{ key: 'spotify', label: 'Spotify' },
	{ key: 'web', label: 'Sitio web' },
];

export function ArtistProfileForm({ artist }: { artist: OwnedArtist }) {
	const { user } = useAuth();
	const { refresh } = useAccount();
	const [name, setName] = useState(artist.name);
	const [bio, setBio] = useState(artist.bio ?? '');
	const [avatar, setAvatar] = useState(artist.avatar_key);
	const [banner, setBanner] = useState(artist.banner_key);
	const [socials, setSocials] = useState<Record<string, string>>(artist.social_links ?? {});
	const [busy, setBusy] = useState(false);
	const [savingImage, setSavingImage] = useState<'avatar' | 'banner' | null>(null);
	const [modalKind, setModalKind] = useState<'avatar' | 'banner' | null>(null);
	const [status, setStatus] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);

	const hasAvatarChanged = avatar !== artist.avatar_key;
	const hasBannerChanged = banner !== artist.banner_key;

	async function handleQuickUpload(file: File | undefined, kind: 'avatar' | 'banner') {
		if (!file || !user) return;
		setStatus(null);
		const { url, error } = await uploadMedia(user.id, file, 'artist');
		if (error || !url) {
			setStatus({ tone: 'error', text: error ?? 'No se pudo subir la imagen' });
			return;
		}
		if (kind === 'avatar') {
			setAvatar(url);
			setStatus({ tone: 'info', text: 'Avatar actualizado. Puedes salvarlo o guardar tu perfil.' });
		} else {
			setBanner(url);
			setStatus({ tone: 'info', text: 'Portada actualizada. Puedes salvarla o guardar tu perfil.' });
		}
	}

	async function saveIndividualImage(kind: 'avatar' | 'banner') {
		if (!supabase) return;
		setSavingImage(kind);
		setStatus(null);
		const field = kind === 'avatar' ? 'avatar_key' : 'banner_key';
		const value = kind === 'avatar' ? avatar : banner;
		const { error } = await supabase
			.from('artists')
			.update({ [field]: value })
			.eq('id', artist.id);

		setSavingImage(null);
		if (error) {
			setStatus({ tone: 'error', text: error.message });
			return;
		}
		setStatus({
			tone: 'success',
			text: `${kind === 'avatar' ? 'Avatar' : 'Portada'} guardado con éxito en tu perfil`,
		});
		await refresh();
	}

	async function save(event: React.FormEvent) {
		event.preventDefault();
		if (!supabase) return;
		setBusy(true);
		setStatus(null);
		const cleaned: Record<string, string> = {};
		for (const [key, rawVal] of Object.entries(socials)) {
			const trimmed = rawVal.trim();
			if (!trimmed) continue;
			const safe = sanitizeExternalUrl(trimmed);
			if (!safe) {
				setBusy(false);
				setStatus({ tone: 'error', text: `Enlace inválido en ${key}. Usa únicamente URLs https:// o http://.` });
				return;
			}
			cleaned[key] = safe;
		}
		const { error } = await supabase
			.from('artists')
			.update({
				name: name.trim(),
				bio: bio.trim() || null,
				avatar_key: avatar,
				banner_key: banner,
				social_links: cleaned,
			})
			.eq('id', artist.id);
		setBusy(false);
		if (error) {
			setStatus({ tone: 'error', text: error.message });
			return;
		}
		setStatus({ tone: 'success', text: 'Perfil guardado con éxito' });
		await refresh();
	}

	return (
		<>
			<form onSubmit={save} className="flex flex-col gap-6">
				{/* Header Section: Banner & Avatar */}
				<div className="relative overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-sm">
					{/* Banner Image */}
					<div className="group relative h-44 w-full overflow-hidden bg-surface-3 md:h-60">
						<img
							src={coverUrl(banner)}
							alt="Portada del artista"
							className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/40 pointer-events-none" />

						{/* Banner Actions (top-right) */}
						<div className="absolute right-3 top-3 z-10 flex flex-wrap items-center gap-2">
							{hasBannerChanged && (
								<button
									type="button"
									onClick={() => void saveIndividualImage('banner')}
									disabled={savingImage === 'banner'}
									className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50"
									title="Salvar únicamente la portada directamente a la base de datos"
								>
									{savingImage === 'banner' ? (
										<>
											<Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
										</>
									) : (
										<>
											<Save className="h-3.5 w-3.5" /> Salvar portada
										</>
									)}
								</button>
							)}

							<button
								type="button"
								onClick={() => setModalKind('banner')}
								className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-background/85 px-3.5 text-xs font-bold text-foreground backdrop-blur-md transition-all hover:bg-background hover:scale-[1.02] shadow-md border border-border/60"
							>
								<Sparkles className="h-3.5 w-3.5 text-primary" />
								<Pencil className="h-3 w-3" />
								Editar portada
							</button>

							<label
								className="hidden sm:inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-background/70 px-2.5 text-xs font-semibold text-muted-foreground backdrop-blur-md hover:bg-background hover:text-foreground border border-border/40"
								title="Subir archivo rápido"
							>
								<Upload className="h-3.5 w-3.5" />
								<span className="sr-only">Subir archivo</span>
								<input
									type="file"
									accept="image/*"
									className="sr-only"
									onChange={(e) => void handleQuickUpload(e.target.files?.[0], 'banner')}
								/>
							</label>
						</div>
					</div>

					{/* Avatar Section (bottom-left overlay) */}
					<div className="relative px-5 pb-5 pt-0 -mt-14 md:-mt-16 flex flex-wrap items-end justify-between gap-4">
						<div className="flex items-end gap-3.5">
							{/* Round Avatar Container */}
							<div
								onClick={() => setModalKind('avatar')}
								className="group relative h-24 w-24 md:h-28 md:w-28 cursor-pointer overflow-hidden rounded-full border-4 border-background bg-surface shadow-2xl transition-transform hover:scale-105"
								title="Haz clic para editar tu avatar"
							>
								<img
									src={coverUrl(avatar)}
									alt="Avatar del artista"
									className="h-full w-full object-cover"
								/>
								<div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
									<div className="flex flex-col items-center gap-0.5 text-white">
										<Pencil className="h-4 w-4" />
										<span className="text-[10px] font-bold">Editar</span>
									</div>
								</div>
							</div>

							{/* Avatar Actions */}
							<div className="mb-2 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => setModalKind('avatar')}
									className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-background/90 px-3 text-xs font-bold text-foreground backdrop-blur-md shadow-md border border-border/80 transition-all hover:bg-background hover:scale-[1.02]"
								>
									<Sparkles className="h-3.5 w-3.5 text-primary" />
									<Pencil className="h-3 w-3" />
									Editar avatar
								</button>

								{hasAvatarChanged && (
									<button
										type="button"
										onClick={() => void saveIndividualImage('avatar')}
										disabled={savingImage === 'avatar'}
										className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-md transition-transform hover:scale-[1.02] disabled:opacity-50"
										title="Salvar únicamente el avatar directamente a la base de datos"
									>
										{savingImage === 'avatar' ? (
											<>
												<Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
											</>
										) : (
											<>
												<Save className="h-3.5 w-3.5" /> Salvar avatar
											</>
										)}
									</button>
								)}

								<label
									className="hidden sm:inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-background/70 px-2.5 text-xs font-semibold text-muted-foreground backdrop-blur-md hover:bg-background hover:text-foreground border border-border/40"
									title="Subir foto rápida"
								>
									<Upload className="h-3.5 w-3.5" />
									<span className="sr-only">Subir foto rápida</span>
									<input
										type="file"
										accept="image/*"
										className="sr-only"
										onChange={(e) => void handleQuickUpload(e.target.files?.[0], 'avatar')}
									/>
								</label>
							</div>
						</div>

						{/* Status badge for unsaved changes */}
						{(hasAvatarChanged || hasBannerChanged) && (
							<div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
								<Sparkles className="h-3.5 w-3.5" />
								<span>Cambios de imagen listos para salvar</span>
							</div>
						)}
					</div>
				</div>

				{/* Form Fields: Name, Bio, Socials */}
				<div className="grid gap-5 md:grid-cols-2">
					<div className="flex flex-col gap-5">
						<Field label="Nombre artístico">
							<TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
						</Field>
						<Field label="Biografía">
							<TextArea
								value={bio}
								onChange={(e) => setBio(e.target.value)}
								rows={6}
								maxLength={800}
								placeholder="Cuenta la historia de tu música, trayectoria e influencias..."
							/>
						</Field>
					</div>
					<div className="flex flex-col gap-3">
						<span className="text-xs font-semibold text-muted-foreground">Redes sociales</span>
						{SOCIALS.map((s) => (
							<TextInput
								key={s.key}
								type="url"
								aria-label={s.label}
								placeholder={`${s.label} (https://...)`}
								value={socials[s.key] ?? ''}
								onChange={(e) => setSocials((prev) => ({ ...prev, [s.key]: e.target.value }))}
							/>
						))}
					</div>
				</div>

				{status && <Notice tone={status.tone}>{status.text}</Notice>}

				<div className="flex flex-wrap items-center gap-3">
					<PrimaryButton type="submit" disabled={busy}>
						{busy ? 'Guardando...' : 'Guardar perfil'}
					</PrimaryButton>
					<Link
						to={`/artista/${artist.slug}`}
						className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
					>
						Ver perfil público <ExternalLink className="h-3.5 w-3.5" />
					</Link>
				</div>
			</form>

			{/* Modal for creating / editing Avatar and Portada with dual Upload & AI flows */}
			<ArtistImageModal
				isOpen={modalKind !== null}
				kind={modalKind ?? 'avatar'}
				currentUrl={modalKind === 'avatar' ? avatar : banner}
				artistId={artist.id}
				artistName={name}
				onClose={() => setModalKind(null)}
				onApply={(newUrl) => {
					if (modalKind === 'avatar') {
						setAvatar(newUrl);
						setStatus({
							tone: 'info',
							text: 'Avatar aplicado al formulario. Pulsa «Salvar avatar» o «Guardar perfil» para confirmar.',
						});
					} else {
						setBanner(newUrl);
						setStatus({
							tone: 'info',
							text: 'Portada aplicada al formulario. Pulsa «Salvar portada» o «Guardar perfil» para confirmar.',
						});
					}
				}}
				onSaved={(savedUrl) => {
					if (modalKind === 'avatar') {
						setAvatar(savedUrl);
						setStatus({ tone: 'success', text: '¡Avatar guardado con éxito en tu perfil!' });
					} else {
						setBanner(savedUrl);
						setStatus({ tone: 'success', text: '¡Portada guardada con éxito en tu perfil!' });
					}
				}}
			/>
		</>
	);
}
