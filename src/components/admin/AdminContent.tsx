import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { supabase } from '@/integrations/supabase/client';
import { coverUrl } from '@/lib/covers';
import { formatCount } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

interface TrackRowData {
  id: string;
  title: string;
  cover_key: string | null;
  plays: number;
  is_published: boolean;
  artist: {name: string;slug: string;} | null;
}

interface ArtistRowData {
  id: string;
  name: string;
  slug: string;
  avatar_key: string | null;
  monthly_listeners: number;
}

export function AdminContent() {
  const { t } = useI18n();
  const [tracks, setTracks] = useState<TrackRowData[]>([]);
  const [artists, setArtists] = useState<ArtistRowData[]>([]);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    const [tr, ar] = await Promise.all([
    client.from('tracks').select('id, title, cover_key, plays, is_published, artist:artists(name, slug)').order('created_at', { ascending: false }).limit(200),
    client.from('artists').select('id, name, slug, avatar_key, monthly_listeners').order('created_at', { ascending: false }).limit(200)]
    );
    setTracks(tr.data as unknown as TrackRowData[] | null ?? []);
    setArtists(ar.data as ArtistRowData[] | null ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePublish(track: TrackRowData) {
    if (!supabase) return;
    await supabase.from('tracks').update({ is_published: !track.is_published }).eq('id', track.id);
    void load();
  }

  async function removeTrack(track: TrackRowData) {
    if (!supabase || !window.confirm(t('Delete "{title}" from the platform?', { title: track.title }))) return;
    await supabase.from('tracks').delete().eq('id', track.id);
    void load();
  }

  async function removeArtist(artist: ArtistRowData) {
    if (!supabase || !window.confirm(t('Delete the artist "{name}" and all their songs?', { name: artist.name }))) return;
    await supabase.from('artists').delete().eq('id', artist.id);
    void load();
  }

  return (
    <div data-ev-id="ev_17526506de" className="grid gap-6 xl:grid-cols-[1fr_24rem]">
			<section data-ev-id="ev_994ee49f93" className="flex flex-col gap-3">
				<h2 data-ev-id="ev_98f17666ae" className="text-base font-bold">{t('Songs ({count})', { count: tracks.length })}</h2>
				<div data-ev-id="ev_255b644678" className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2">
					{tracks.map((track) =>
          <div data-ev-id="ev_bc01f030ed" key={track.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
							<img data-ev-id="ev_ae552d9930" src={coverUrl(track.cover_key)} alt="" width={40} height={40} className="h-10 w-10 flex-none rounded object-cover" />
							<div data-ev-id="ev_1e29246994" className="flex min-w-0 flex-1 flex-col">
								<span data-ev-id="ev_e5acc3183b" className="truncate text-sm font-semibold">{track.title}</span>
								<span data-ev-id="ev_8ecc69032c" className="truncate text-xs text-muted-foreground">
									{track.artist?.name ?? t('No artist')} · {t('{count} plays', { count: formatCount(track.plays) })}
								</span>
							</div>
							<span data-ev-id="ev_af524c0cee" className={`hidden rounded-md px-2 py-1 text-xs font-semibold sm:block ${track.is_published ? 'bg-primary/15 text-primary' : 'bg-surface-3 text-muted-foreground'}`}>{track.is_published ? t('Public') : t('Hidden')}</span>
							<button data-ev-id="ev_117f046c55" type="button" onClick={() => void togglePublish(track)} aria-label={track.is_published ? t('Hide song') : t('Publish song')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-foreground">
								{track.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
							<button data-ev-id="ev_51c35033f6" type="button" onClick={() => void removeTrack(track)} aria-label={t('Delete song')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-destructive">
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
          )}
				</div>
			</section>

			<section data-ev-id="ev_becf6965a1" className="flex flex-col gap-3">
				<h2 data-ev-id="ev_b52b337761" className="text-base font-bold">{t('Artists ({count})', { count: artists.length })}</h2>
				<div data-ev-id="ev_4024110336" className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2">
					{artists.map((a) =>
          <div data-ev-id="ev_ebecb085aa" key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
							<img data-ev-id="ev_aa59528c11" src={coverUrl(a.avatar_key)} alt="" width={40} height={40} className="h-10 w-10 flex-none rounded-full object-cover" />
							<Link data-ev-id="ev_0847e48089" to={`/artista/${a.slug}`} className="flex min-w-0 flex-1 flex-col">
								<span data-ev-id="ev_bf42cc27f4" className="truncate text-sm font-semibold hover:underline">{a.name}</span>
								<span data-ev-id="ev_e32adf3033" className="text-xs text-muted-foreground">{t('{count} listeners', { count: formatCount(a.monthly_listeners) })}</span>
							</Link>
							<button data-ev-id="ev_8e344344c1" type="button" onClick={() => void removeArtist(a)} aria-label={t('Delete artist')} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-destructive">
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
          )}
				</div>
			</section>
		</div>);

}
