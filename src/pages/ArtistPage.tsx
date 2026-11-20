import { useEffect, useState } from 'react';
import { ExternalLink, Play, UserPlus, UserCheck } from 'lucide-react';
import { ModuleDisabled } from '@/components/ModuleDisabled';
import { useModules } from '@/hooks/useModules';
import { useI18n } from '@/hooks/useI18n';

const SOCIAL_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', spotify: 'Spotify', web: 'Sitio web' };
import { useParams } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { MediaCard } from '@/components/MediaCard';
import { Shelf } from '@/components/Shelf';
import { TrackRow } from '@/components/TrackRow';
import { ArtistGallery } from '@/components/ArtistGallery';
import { usePlayer } from '@/hooks/usePlayer';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { fetchArtistAlbums, fetchArtistBySlug, fetchArtistTracks } from '@/lib/queries';
import { coverUrl } from '@/lib/covers';
import { formatCount } from '@/lib/format';
import { sanitizeExternalUrl } from '@/lib/safeUrl';
import type { Album, Artist, TrackWithArtist } from '@/types/music';

export default function ArtistPage() {
  const { slug = '' } = useParams();
  const { playTracks } = usePlayer();
  const { user } = useAuth();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<TrackWithArtist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isEnabled } = useModules();
  const { t } = useI18n();

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchArtistBySlug(slug).then(async (found) => {
      if (!active) return;
      setArtist(found);
      if (found) {
        const [tr, al] = await Promise.all([fetchArtistTracks(found.id), fetchArtistAlbums(found.id)]);
        if (!active) return;
        setTracks(tr);
        setAlbums(al);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!supabase || !user || !artist) {
      setFollowing(false);
      return;
    }
    let active = true;
    void supabase.
    from('follows').
    select('id').
    eq('user_id', user.id).
    eq('artist_id', artist.id).
    maybeSingle().
    then(({ data }) => {
      if (active) setFollowing(Boolean(data));
    });
    return () => {
      active = false;
    };
  }, [user, artist]);

  async function toggleFollow() {
    if (!supabase || !user || !artist) return;
    if (following) {
      setFollowing(false);
      await supabase.from('follows').delete().eq('user_id', user.id).eq('artist_id', artist.id);
    } else {
      setFollowing(true);
      await supabase.from('follows').insert({ user_id: user.id, artist_id: artist.id });
    }
  }

  if (!isEnabled('artists')) {
    return <AppLayout><ModuleDisabled name="Los perfiles de artista" /></AppLayout>;
  }

  return (
    <AppLayout>
			<div data-ev-id="ev_a723a26186" className="mx-auto flex max-w-[1400px] flex-col gap-10">
				{loading && <p data-ev-id="ev_fbb460e4ee" className="text-sm text-muted-foreground">Cargando artista...</p>}
				{!loading && !artist && <p data-ev-id="ev_b0c18624ac" className="text-sm text-muted-foreground">No encontramos este artista.</p>}

				{artist &&
        <>
						<header data-ev-id="ev_429c4a847a" className="relative overflow-hidden rounded-2xl border border-border">
							<img data-ev-id="ev_e4ba263d7c" src={coverUrl(artist.banner_key)} width={1400} height={420} alt="" className="h-56 w-full object-cover md:h-72" />
							<div data-ev-id="ev_7650ac07a4" className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" aria-hidden="true" />
							<div data-ev-id="ev_6910b6fac8" className="absolute bottom-0 flex w-full flex-col gap-2 p-6">
								{artist.avatar_key && <img data-ev-id="ev_78e0c1562c" src={coverUrl(artist.avatar_key)} width={96} height={96} alt={`Foto de ${artist.name}`} className="mb-2 h-20 w-20 rounded-full border-4 border-background object-cover shadow-xl md:h-24 md:w-24" />}
								<span data-ev-id="ev_1da8c50cd5" className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Artista verificado</span>
								<h1 data-ev-id="ev_525d218f73" className="text-4xl font-black tracking-tight md:text-6xl">{artist.name}</h1>
								<p data-ev-id="ev_d74e49dea8" className="text-xs text-muted-foreground">{formatCount(artist.monthly_listeners)} oyentes mensuales</p>
							</div>
						</header>

						<div data-ev-id="ev_7254a89713" className="flex flex-wrap items-center gap-4">
							<button data-ev-id="ev_4ad6fca615" type="button" onClick={() => playTracks(tracks, 0)} disabled={tracks.length === 0} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40" aria-label="Reproducir artista">
								<Play className="h-6 w-6 translate-x-[2px] fill-current" />
							</button>
							{user &&
            <button data-ev-id="ev_484ee3b9f6" type="button" onClick={() => void toggleFollow()} className={`flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${following ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
									{following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
									{following ? 'Siguiendo' : 'Seguir'}
								</button>
            }
							{artist.bio && <p data-ev-id="ev_17b74412b7" className="max-w-xl text-sm text-pretty text-muted-foreground">{artist.bio}</p>}
							{Object.entries(artist.social_links ?? {}).length > 0 &&
            <div data-ev-id="ev_83bcbc57d2" className="flex w-full flex-wrap gap-2">
									{Object.entries(artist.social_links ?? {}).map(([key, url]) => {
                const safeHref = sanitizeExternalUrl(url);
                if (!safeHref) return null;
                return (
                  <a data-ev-id="ev_be63cc1e45" key={key} href={safeHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
											{SOCIAL_LABEL[key] ? t(SOCIAL_LABEL[key]) : key} <ExternalLink className="h-3 w-3" />
										</a>
                );
              })}
								</div>
            }
						</div>

						<Shelf title={t('Popular')}>
							<div data-ev-id="ev_730ca139a7" className="flex flex-col gap-1 rounded-xl bg-surface p-2">
								{tracks.map((track, i) =>
              <TrackRow key={track.id} track={track} index={i} context={tracks} />
              )}
							</div>
						</Shelf>

						<ArtistGallery artistId={artist.id} artistName={artist.name} />

						{albums.length > 0 &&
          <Shelf title={t('Discography')}>
								<div data-ev-id="ev_e1207fee68" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
									{albums.map((album) => {
                const albumTracks = tracks.filter((tr) => tr.album_id === album.id);
                return <MediaCard key={album.id} to={`/artista/${artist.slug}`} title={album.title} subtitle={album.release_date?.slice(0, 4)} coverKey={album.cover_key} onPlay={albumTracks.length ? () => playTracks(albumTracks, 0) : undefined} />;
              })}
								</div>
							</Shelf>
          }
					</>
        }
			</div>
		</AppLayout>);

}