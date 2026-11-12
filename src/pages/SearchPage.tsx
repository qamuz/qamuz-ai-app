import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { MediaCard } from '@/components/MediaCard';
import { Shelf } from '@/components/Shelf';
import { TrackRow } from '@/components/TrackRow';
import { fetchArtists, searchCatalog } from '@/lib/queries';
import type { Artist, Playlist, TrackWithArtist } from '@/types/music';
import { useI18n } from '@/hooks/useI18n';

export default function SearchPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [term, setTerm] = useState(query);
  const [tracks, setTracks] = useState<TrackWithArtist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [browse, setBrowse] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTerm(query);
  }, [query]);

  useEffect(() => {
    let active = true;
    void fetchArtists().then((data) => {
      if (active) setBrowse(data);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setTracks([]);
      setArtists([]);
      setPlaylists([]);
      return;
    }
    let active = true;
    setLoading(true);
    void searchCatalog(query).then((result) => {
      if (!active) return;
      setTracks(result.tracks);
      setArtists(result.artists);
      setPlaylists(result.playlists);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [query]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setParams(term.trim() ? { q: term.trim() } : {});
  }

  const empty = query.trim() && !loading && tracks.length === 0 && artists.length === 0 && playlists.length === 0;

  return (
    <AppLayout>
			<div data-ev-id="ev_a4b4134871" className="mx-auto flex max-w-[1400px] flex-col gap-10">
				<form data-ev-id="ev_ebe518363f" onSubmit={submit} className="flex flex-col gap-3">
					<h1 data-ev-id="ev_773e63013b" className="text-3xl font-black tracking-tight">{t('Search')}</h1>
					<input data-ev-id="ev_11a78f5bf6"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          type="search"
          placeholder={t('What do you want to listen to?')}
          aria-label={t('Search the catalog')}
          className="w-full max-w-xl rounded-full border border-border bg-surface px-5 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" />
          
				</form>

				{loading && <p data-ev-id="ev_e055049e6c" className="text-sm text-muted-foreground">Buscando...</p>}
				{empty && <p data-ev-id="ev_b62690d143" className="text-sm text-muted-foreground">No encontramos resultados para “{query}”.</p>}

				{tracks.length > 0 &&
        <Shelf title={t('Songs')}>
						<div data-ev-id="ev_582108f216" className="flex flex-col gap-1 rounded-xl bg-surface p-2">
							{tracks.map((track, i) =>
            <TrackRow key={track.id} track={track} index={i} context={tracks} />
            )}
						</div>
					</Shelf>
        }

				{artists.length > 0 &&
        <Shelf title={t('Artists')}>
						<div data-ev-id="ev_99dde123f4" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
							{artists.map((artist) =>
            <MediaCard key={artist.id} to={`/artista/${artist.slug}`} title={artist.name} subtitle="Artista" coverKey={artist.avatar_key} rounded />
            )}
						</div>
					</Shelf>
        }

				{playlists.length > 0 &&
        <Shelf title={t('Playlists')}>
						<div data-ev-id="ev_8a56d587e8" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
							{playlists.map((playlist) =>
            <MediaCard key={playlist.id} to={`/lista/${playlist.id}`} title={t(playlist.title)} subtitle={playlist.description ? t(playlist.description) : null} coverKey={playlist.cover_key} />
            )}
						</div>
					</Shelf>
        }

				{!query.trim() &&
        <Shelf title={t('Browse artists')}>
						<div data-ev-id="ev_e50ae7da64" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
							{browse.map((artist) =>
            <MediaCard key={artist.id} to={`/artista/${artist.slug}`} title={artist.name} subtitle="Artista" coverKey={artist.avatar_key} rounded />
            )}
						</div>
					</Shelf>
        }
			</div>
		</AppLayout>);

}