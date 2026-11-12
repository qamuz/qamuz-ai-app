import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Play, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { audioDuration, uploadMedia } from '@/lib/media';
import { coverUrl } from '@/lib/covers';
import { formatCount, formatTime } from '@/lib/format';
import { fetchOwnAlbums, fetchOwnTracks, toPlayable, type OwnTrack } from '@/lib/artist-panel';
import type { OwnedArtist } from '@/contexts/account-context';
import type { Album } from '@/types/music';
import { Field, Notice, PrimaryButton, Select, TextInput } from '@/components/ui/Field';

export function ArtistTracksManager({ artist }: {artist: OwnedArtist;}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { playTracks } = usePlayer();
  const [tracks, setTracks] = useState<OwnTrack[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{tone: 'error' | 'success';text: string;} | null>(null);

  const load = useCallback(async () => {
    const [tr, al] = await Promise.all([fetchOwnTracks(artist.id), fetchOwnAlbums(artist.id)]);
    setTracks(tr);
    setAlbums(al);
  }, [artist.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !user || !audio || !title.trim()) return;
    setBusy(true);
    setStatus(null);
    const [audioRes, coverRes, duration] = await Promise.all([
    uploadMedia(user.id, audio, 'audio'),
    cover ? uploadMedia(user.id, cover, 'covers') : Promise.resolve({ url: undefined, error: undefined }),
    audioDuration(audio)]
    );
    if (audioRes.error || !audioRes.url) {
      setBusy(false);
      setStatus({ tone: 'error', text: t(audioRes.error ?? "Couldn't upload the audio") });
      return;
    }
    const { error } = await supabase.from('tracks').insert({
      artist_id: artist.id,
      title: title.trim(),
      genre: genre.trim() || null,
      album_id: albumId || null,
      audio_url: audioRes.url,
      cover_key: coverRes.url ?? albums.find((a) => a.id === albumId)?.cover_key ?? null,
      duration_seconds: duration,
      is_published: true
    });
    setBusy(false);
    if (error) {
      setStatus({ tone: 'error', text: error.message });
      return;
    }
    setTitle('');
    setGenre('');
    setAudio(null);
    setCover(null);
    (event.target as HTMLFormElement).reset();
    setStatus({ tone: 'success', text: t('Song published') });
    void load();
  }

  async function togglePublish(track: OwnTrack) {
    if (!supabase) return;
    await supabase.from('tracks').update({ is_published: !track.is_published }).eq('id', track.id);
    void load();
  }

  async function remove(track: OwnTrack) {
    if (!supabase || !window.confirm(t('Delete "{title}"? This cannot be undone.', { title: track.title }))) return;
    await supabase.from('tracks').delete().eq('id', track.id);
    void load();
  }

  return (
    <div data-ev-id="ev_c87c0a1d72" className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr]">
			<form data-ev-id="ev_136a1406c1" onSubmit={submit} className="flex h-fit flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
				<h2 data-ev-id="ev_8e845af298" className="text-lg font-bold">{t('Upload song')}</h2>
				<Field label={t('Title')}>
					<TextInput value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
				</Field>
				<div data-ev-id="ev_d34b5b32f5" className="grid grid-cols-2 gap-3">
					<Field label={t('Genre')}>
						<TextInput value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Pop" maxLength={40} />
					</Field>
					<Field label={t('Album')}>
						<Select value={albumId} onChange={(e) => setAlbumId(e.target.value)}>
							<option data-ev-id="ev_6af33267cb" value="">{t('Single')}</option>
							{albums.map((a) =>
              <option data-ev-id="ev_6fc1b12a9a" key={a.id} value={a.id}>
									{a.title}
								</option>
              )}
						</Select>
					</Field>
				</div>
				<Field label={t('Audio file')} hint={t('MP3, WAV or M4A')}>
					<input data-ev-id="ev_f711ebec2f" type="file" accept="audio/*" required onChange={(e) => setAudio(e.target.files?.[0] ?? null)} className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground" />
				</Field>
				<Field label={t('Cover (optional)')}>
					<input data-ev-id="ev_f5caded77e" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground" />
				</Field>
				{status && <Notice tone={status.tone}>{status.text}</Notice>}
				<PrimaryButton type="submit" disabled={busy || !audio || !title.trim()}>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
					{busy ? t('Uploading...') : t('Publish song')}
				</PrimaryButton>
			</form>

			<section data-ev-id="ev_5d24834086" className="flex flex-col gap-3">
				<h2 data-ev-id="ev_240b36ba93" className="text-lg font-bold">{t('Your songs ({count})', { count: tracks.length })}</h2>
				{tracks.length === 0 && <p data-ev-id="ev_e2e85cb430" className="text-sm text-muted-foreground">{t("You haven't uploaded any songs yet.")}</p>}
				<div data-ev-id="ev_7a4bb8335b" className="flex flex-col gap-1 rounded-xl bg-surface p-2">
					{tracks.map((track, i) =>
          <div data-ev-id="ev_2126409560" key={track.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
							<button data-ev-id="ev_2852f12214" type="button" onClick={() => playTracks(tracks.map((x) => toPlayable(x, artist)), i)} aria-label={t('Play {title}', { title: track.title })} className="relative flex-none">
								<img data-ev-id="ev_4b7eb9b887" src={coverUrl(track.cover_key)} alt="" width={44} height={44} className="h-11 w-11 rounded object-cover" />
								<span data-ev-id="ev_0e0c1b1bcb" className="absolute inset-0 flex items-center justify-center rounded bg-black/50 opacity-0 transition-opacity hover:opacity-100">
									<Play className="h-4 w-4 fill-current" />
								</span>
							</button>
							<div data-ev-id="ev_2dab3f37de" className="flex min-w-0 flex-1 flex-col">
								<span data-ev-id="ev_042d306c5a" className="truncate text-sm font-semibold">{track.title}</span>
								<span data-ev-id="ev_bb6d62947d" className="text-xs text-muted-foreground">
									{track.genre ?? t('No genre')} · {formatTime(track.duration_seconds)} · {t('{count} plays', { count: formatCount(track.plays) })}
								</span>
							</div>
							<span data-ev-id="ev_06bb0c4434" className={`hidden rounded-md px-2 py-1 text-xs font-semibold sm:block ${track.is_published ? 'bg-primary/15 text-primary' : 'bg-surface-3 text-muted-foreground'}`}>{track.is_published ? t('Public') : t('Hidden')}</span>
							<button data-ev-id="ev_eb0329b288" type="button" onClick={() => void togglePublish(track)} aria-label={track.is_published ? t('Hide') : t('Publish')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-foreground">
								{track.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
							<button data-ev-id="ev_46d8d3f31a" type="button" onClick={() => void remove(track)} aria-label={t('Delete')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-destructive">
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
          )}
				</div>
			</section>
		</div>);

}
