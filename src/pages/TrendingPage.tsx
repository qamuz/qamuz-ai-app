import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Clapperboard, Eye, Flame, Globe, Heart, Music2, Pause, Play, Share2, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { TrackRow } from '@/components/TrackRow';
import { TrackMenu } from '@/components/TrackMenu';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatCount } from '@/lib/format';
import { fetchTrending } from '@/lib/queries';
import { fetchLastfmTopTags, fetchLastfmTagTracks, type LastfmTag, type LastfmTrack } from '@/lib/lastfm';
import type { TrackWithArtist } from '@/types/music';
import trendingHero from '@/assets/generated/trending-hero.webp';

function PodiumCard({ track, rank, list }: {track: TrackWithArtist;rank: number;list: TrackWithArtist[];}) {
  const { current, isPlaying, playTracks } = usePlayer();
  const { t } = useI18n();
  const playing = current?.id === track.id && isPlaying;
  return (
    <article data-ev-id="ev_tr_podium" className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:bg-surface-2">
      <div data-ev-id="ev_tr_pod_media" className="relative overflow-hidden rounded-xl">
        <img data-ev-id="ev_tr_pod_img" src={coverUrl(track.cover_key)} width={400} height={400} loading="lazy" alt={t('Cover of {title}', { title: track.title })} className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span data-ev-id="ev_tr_pod_rank" className="absolute left-3 top-2 text-6xl font-black leading-none text-foreground drop-shadow-[0_2px_8px_#000000cc]">{rank}</span>
        <button data-ev-id="ev_tr_pod_play" type="button" onClick={() => playTracks(list, rank - 1)} aria-label={playing ? t('Pause {title}', { title: track.title }) : t('Play {title}', { title: track.title })} className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105">
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-[1px] fill-current" />}
        </button>
      </div>
      <div data-ev-id="ev_tr_pod_body" className="flex items-start gap-2">
        <div data-ev-id="ev_tr_pod_titles" className="flex min-w-0 flex-1 flex-col">
          <h3 data-ev-id="ev_tr_pod_title" className="truncate text-base font-bold">{track.title}</h3>
          {track.artist &&
          <Link data-ev-id="ev_tr_pod_artist" to={`/artista/${track.artist.slug}`} className="truncate text-sm text-muted-foreground hover:text-foreground hover:underline">
              {track.artist.name}
            </Link>
          }
        </div>
        <TrackMenu track={track} />
      </div>
      <div data-ev-id="ev_tr_pod_stats" className="flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
        <span data-ev-id="ev_tr_pod_views" className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatCount(track.plays)}</span>
        <span data-ev-id="ev_tr_pod_likes" className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {formatCount(track.likes_count ?? 0)}</span>
        <span data-ev-id="ev_tr_pod_shares" className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> {formatCount(track.shares_count ?? 0)}</span>
      </div>
    </article>);

}

function TrendingContent() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [source, setSource] = useState<'platform' | 'lastfm'>(params.get('source') === 'global' ? 'lastfm' : 'platform');
  const [all, setAll] = useState<TrackWithArtist[]>([]);
  const [tracks, setTracks] = useState<TrackWithArtist[]>([]);
  const [genre, setGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Last.fm live trends state
  const [lastfmTags, setLastfmTags] = useState<LastfmTag[]>([]);
  const urlTag = params.get('tag');
  const [selectedTag, setSelectedTag] = useState<string>(urlTag || 'electronic');
  const [lastfmTracks, setLastfmTracks] = useState<LastfmTrack[]>([]);
  const [loadingLastfm, setLoadingLastfm] = useState(false);

  useEffect(() => {
    void fetchTrending(100).then((data) => setAll(data));
  }, []);

  useEffect(() => {
    if (source === 'lastfm' && lastfmTags.length === 0) {
      void fetchLastfmTopTags(30).then((tags) => {
        setLastfmTags(tags);
        if (tags[0] && !urlTag) setSelectedTag(tags[0].name);
      });
    }
  }, [source, lastfmTags.length, urlTag]);

  useEffect(() => {
    if (source === 'lastfm' && selectedTag) {
      let active = true;
      setLoadingLastfm(true);
      void fetchLastfmTagTracks(selectedTag, 18).then((res) => {
        if (active) {
          setLastfmTracks(res);
          setLoadingLastfm(false);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [source, selectedTag]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchTrending(50, genre).then((data) => {
      if (!alive) return;
      setTracks(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [genre]);

  const genres = useMemo(() => Array.from(new Set(all.map((tr) => tr.genre).filter((g): g is string => Boolean(g)))).sort(), [all]);
  const podium = tracks.slice(0, 3);

  return (
    <div data-ev-id="ev_tr_root" className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <header data-ev-id="ev_tr_hero" className="relative overflow-hidden rounded-2xl border border-border">
        <img data-ev-id="ev_tr_hero_img" src={trendingHero} width={1792} height={768} alt="" className="h-56 w-full object-cover md:h-72" />
        <div data-ev-id="ev_tr_hero_shade" className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" aria-hidden="true" />
        <div data-ev-id="ev_tr_hero_body" className="absolute inset-0 flex flex-col justify-end gap-3 p-6 md:p-8">
          <span data-ev-id="ev_tr_hero_tag" className="flex w-fit items-center gap-1.5 text-sm font-bold text-primary"><Flame className="h-4 w-4" /> {t('Updated live')}</span>
          <h1 data-ev-id="ev_tr_hero_h1" className="text-4xl font-black tracking-tight text-balance md:text-6xl">{t('Trending')}</h1>
          <p data-ev-id="ev_tr_hero_p" className="max-w-md text-sm text-pretty text-muted-foreground">{t('Songs climbing right now, ranked by views, likes, comments and shares from the last 7 days.')}</p>
          <div data-ev-id="ev_a23cf0a35e" className="flex flex-wrap items-center gap-3 pt-1">
            <Link data-ev-id="ev_tr_hero_cta" to="/shorts" className="flex h-11 w-fit items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02]">
              <Clapperboard className="h-4 w-4" /> {t('Watch as Shorts')}
            </Link>
            <Link data-ev-id="ev_62b94da52a" to="/estudio" className="flex h-11 w-fit items-center gap-2 rounded-lg border border-border bg-surface/80 px-5 text-sm font-bold text-foreground backdrop-blur-md transition-colors hover:bg-surface">
              <Sparkles className="h-4 w-4 text-primary" /> {t('Crear música con IA')}
            </Link>
          </div>
        </div>
      </header>

      {/* Source Toggle */}
      <div data-ev-id="ev_c8414d3b11" className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <button data-ev-id="ev_8ada1e9f85"
        type="button"
        onClick={() => setSource('platform')}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
        source === 'platform' ?
        'bg-primary text-primary-foreground shadow-md' :
        'bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`
        }>
          
          <Flame className="h-4 w-4" />
          {t('Tendencias en Qamuz AI')}
        </button>
        <button data-ev-id="ev_68faa46930"
        type="button"
        onClick={() => setSource('lastfm')}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
        source === 'lastfm' ?
        'bg-primary text-primary-foreground shadow-md' :
        'bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`
        }>
          
          <Globe className="h-4 w-4" />
          {t('Global trends')}
        </button>
      </div>

      {source === 'platform' ?
      <>
          {genres.length > 0 &&
        <div data-ev-id="ev_tr_genres" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label={t('Categories')}>
              {[null, ...genres].map((g) =>
          <button data-ev-id="ev_tr_genre"
          key={g ?? 'all'}
          type="button"
          role="tab"
          aria-selected={genre === g}
          onClick={() => setGenre(g)}
          className={`h-10 flex-none rounded-lg border px-4 text-sm font-semibold transition-colors ${genre === g ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {g ?? t('All')}
                </button>
          )}
            </div>
        }

          {loading ?
        <div data-ev-id="ev_tr_loading" className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => <div data-ev-id="ev_tr_skel" key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface" />)}
            </div> :
        tracks.length === 0 ?
        <p data-ev-id="ev_tr_empty" className="py-12 text-center text-sm text-muted-foreground">{t('Nothing trending in this category yet.')}</p> :

        <>
              <section data-ev-id="ev_tr_podium_sec" className="grid gap-4 sm:grid-cols-3" aria-label={t('Top 3')}>
                {podium.map((track, i) => <PodiumCard key={track.id} track={track} rank={i + 1} list={tracks} />)}
              </section>
              {tracks.length > 3 &&
          <section data-ev-id="ev_tr_list" className="flex flex-col gap-1">
                  <h2 data-ev-id="ev_tr_list_h" className="mb-2 text-xl font-bold tracking-tight">{t('Top {count}', { count: tracks.length })}</h2>
                  {tracks.map((track, i) => i < 3 ? null : <TrackRow key={track.id} track={track} index={i} context={tracks} />)}
                </section>
          }
            </>
        }
        </> :

      <div data-ev-id="ev_fb6035d4cb" className="flex flex-col gap-6">
          {/* Last.fm Tags Bar */}
          <div data-ev-id="ev_8786f04a75" className="flex flex-col gap-2">
            <span data-ev-id="ev_ac4d7e9f19" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Géneros y Etiquetas en Tendencia Mundial
            </span>
            <div data-ev-id="ev_344e09b2f8" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
              {lastfmTags.map((t) =>
            <button data-ev-id="ev_dcfc37cdb2"
            key={t.name}
            type="button"
            onClick={() => setSelectedTag(t.name)}
            className={`h-9 flex-none rounded-lg px-3.5 text-xs font-semibold transition-all ${
            selectedTag === t.name ?
            'bg-primary text-primary-foreground shadow-sm' :
            'border border-border bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`
            }>
              
                  #{t.name} {t.reach > 0 && <span data-ev-id="ev_0a04d39cca" className="opacity-70">({formatCount(t.reach)})</span>}
                </button>
            )}
            </div>
          </div>

          {/* Last.fm Track Recommendations for this tag */}
          <div data-ev-id="ev_a54632988f" className="flex flex-col gap-4">
            <div data-ev-id="ev_754d03ffbe" className="flex items-center justify-between">
              <h2 data-ev-id="ev_7d50640802" className="text-xl font-bold tracking-tight text-foreground">
                Éxitos mundiales de #{selectedTag}
              </h2>
              <Link data-ev-id="ev_e9d1cbe8a7"
            to={`/estudio?prompt=${encodeURIComponent(`Canción inspirada en el género ${selectedTag}`)}&style=${encodeURIComponent(selectedTag)}`}
            className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
              
                <Sparkles className="h-3.5 w-3.5" />
                Crear canción en estilo #{selectedTag}
              </Link>
            </div>

            {loadingLastfm ?
          <div data-ev-id="ev_63c102faed" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) =>
            <div data-ev-id="ev_64e906b983" key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
            )}
              </div> :
          lastfmTracks.length === 0 ?
          <p data-ev-id="ev_aefd5fe5b0" className="py-8 text-center text-sm text-muted-foreground">No se encontraron pistas para #{selectedTag}.</p> :

          <div data-ev-id="ev_cbc2cd715c" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lastfmTracks.map((tr, index) =>
            <article data-ev-id="ev_f3038dc47d"
            key={`${tr.artist}-${tr.name}-${index}`}
            className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-surface-2">
              
                    <div data-ev-id="ev_fa80888592" className="flex items-start gap-3">
                      <div data-ev-id="ev_49fc8f35c5" className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-surface-3 text-muted-foreground">
                        <Music2 className="h-6 w-6 text-primary" />
                      </div>
                      <div data-ev-id="ev_23632c77cd" className="min-w-0 flex-1">
                        <h3 data-ev-id="ev_8bf25d55c6" className="truncate text-sm font-bold text-foreground">{tr.name}</h3>
                        <p data-ev-id="ev_a2b4450363" className="truncate text-xs text-muted-foreground">{tr.artist}</p>
                        <span data-ev-id="ev_e632c0b167" className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          #{selectedTag}
                        </span>
                      </div>
                    </div>

                    <Link data-ev-id="ev_d105f3dbf5"
              to={`/estudio?prompt=${encodeURIComponent(`Canción estilo ${selectedTag} inspirada en ${tr.name} de ${tr.artist}`)}&style=${encodeURIComponent(selectedTag)}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground">
                
                      <Sparkles className="h-3.5 w-3.5" />
                      Crear pista similar en IA
                    </Link>
                  </article>
            )}
              </div>
          }
          </div>
        </div>
      }
    </div>);

}

export default function TrendingPage() {
  return (
    <AppLayout>
      <TrendingContent />
    </AppLayout>);

}