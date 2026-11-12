import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Loader2, Music2, Search } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LibrarySongRow } from '@/components/library/LibrarySongRow';
import { LibraryPlaylists } from '@/components/library/LibraryPlaylists';
import { LibraryVideos } from '@/components/library/LibraryVideos';
import { CharactersSection } from '@/components/home/CharactersSection';
import { CreationRow } from '@/components/studio/CreationRow';
import { EmptyNote, MoreButton } from '@/components/home/MoreButton';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { useLikes } from '@/hooks/useLikes';
import { useI18n } from '@/hooks/useI18n';
import { matchesQuery, usePaged } from '@/hooks/usePaged';
import { fetchCreations, songToTrack, type Creation } from '@/lib/studio';
import { buildLibrary, songPath } from '@/lib/library';

const TABS = ['workspace', 'songs', 'videos', 'playlists', 'character'] as const;
type Tab = (typeof TABS)[number];
const FILTERS = ['all', 'liked', 'disliked', 'published', 'studio'] as const;
type Filter = (typeof FILTERS)[number];
const PAGE = 20;

const TAB_LABEL: Record<Tab, string> = { workspace: 'Workspace', songs: 'Songs', videos: 'Videos', playlists: 'Playlists', character: 'Character' };
const FILTER_LABEL: Record<Filter, string> = { all: 'All songs', liked: 'Liked', disliked: 'Disliked', published: 'Published', studio: 'Studio' };
const SEARCH_HINT: Record<Tab, string> = { workspace: 'Search your creations', songs: 'Enter song title', videos: 'Search videos', playlists: 'Search playlists', character: 'Search characters' };

function LibraryContent() {
  const { user } = useAuth();
  const { artist } = useAccount();
  const { isLiked } = useLikes();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? params.get('tab') as Tab : 'songs';
  const filter: Filter = FILTERS.includes(params.get('filter') as Filter) ? params.get('filter') as Filter : 'all';
  const [query, setQuery] = useState('');
  const [creations, setCreations] = useState<Creation[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setCreations(await fetchCreations(user.id));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => setQuery(''), [tab]);

  function setTab(next: Tab) {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    if (next !== 'songs') p.delete('filter');
    setParams(p, { replace: true });
  }

  function setFilter(next: Filter) {
    const p = new URLSearchParams(params);
    p.set('tab', 'songs');
    if (next === 'all') p.delete('filter');else
    p.set('filter', next);
    setParams(p, { replace: true });
  }

  const lib = useMemo(() => buildLibrary(creations ?? []), [creations]);
  const artistRef = artist ? { id: artist.id, name: artist.name, slug: artist.slug } : null;
  const queue = useMemo(() => lib.songs.map((s) => songToTrack(s, artistRef)), [lib.songs, artistRef?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const songPathByKey = useMemo(() => new Map(lib.songs.map((s) => [s.key, songPath(s)])), [lib.songs]);

  const songs = useMemo(() => lib.songs.filter((s) => {
    if (!matchesQuery(query, s.title, s.style)) return false;
    const liked = s.publishedTrackId ? isLiked(s.publishedTrackId) : s.liked;
    const creation = lib.creationById.get(s.creationId);
    switch (filter) {
      case 'liked':return liked;
      case 'disliked':return Boolean(s.disliked);
      case 'published':return Boolean(s.publishedTrackId);
      case 'studio':return s.origin === 'upload' || creation?.provider_slug === 'trimmed-audio';
      default:return true;
    }
  }), [lib, query, filter, isLiked]);
  const songsPaged = usePaged(songs, PAGE, `${query}|${filter}`);

  const workspace = useMemo(() => (creations ?? []).filter((c) => matchesQuery(query, c.title, c.prompt)), [creations, query]);
  const workspacePaged = usePaged(workspace, PAGE, query);

  const loading = creations === null;

  return (
    <div data-ev-id="ev_lib_root" className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <h1 data-ev-id="ev_lib_h1" className="sr-only">{t('Your Library')}</h1>

      <nav data-ev-id="ev_lib_tabs" aria-label={t('Your Library')} className="no-scrollbar flex gap-6 overflow-x-auto border-b border-border">
        {TABS.map((id) =>
        <button data-ev-id="ev_lib_tab"
        key={id}
        type="button"
        onClick={() => setTab(id)}
        aria-current={tab === id ? 'page' : undefined}
        className={`relative flex-none pb-3 text-base font-bold transition-colors ${tab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {t(TAB_LABEL[id])}
            {tab === id && <span data-ev-id="ev_lib_tab_bar" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        )}
      </nav>

      <div data-ev-id="ev_lib_bar" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {tab === 'songs' ?
        <div data-ev-id="ev_lib_filters" className="no-scrollbar flex gap-2 overflow-x-auto">
            {FILTERS.map((id) =>
          <button data-ev-id="ev_lib_filter"
          key={id}
          type="button"
          onClick={() => setFilter(id)}
          aria-pressed={filter === id}
          className={`h-9 flex-none rounded-lg border px-3.5 text-sm font-semibold transition-colors ${filter === id ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-surface-2'}`}>
                {t(FILTER_LABEL[id])}
              </button>
          )}
          </div> :
        <div data-ev-id="ev_lib_spacer" />}
        <label data-ev-id="ev_lib_search" className="flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-primary md:max-w-md">
          <Search className="h-4 w-4 flex-none text-muted-foreground" />
          <input data-ev-id="ev_lib_search_in" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(SEARCH_HINT[tab])} aria-label={t(SEARCH_HINT[tab])} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
      </div>

      {tab === 'songs' && (
      loading ?
      <Loading /> :
      lib.songs.length === 0 ?
      <NoSongs /> :
      songs.length === 0 ?
      <EmptyNote searching={Boolean(query)} text={t('No songs in this list yet')} /> :

      <div data-ev-id="ev_lib_songs" className="flex flex-col gap-6">
            <ul data-ev-id="ev_lib_song_list" className="flex flex-col gap-1">
              {songsPaged.shown.map((s) =>
          <LibrarySongRow
            key={s.key}
            song={s}
            creation={lib.creationById.get(s.creationId)}
            hasVideo={lib.videoBySong.has(s.key)}
            queue={queue}
            onChanged={() => void load()}
            onDeleted={() => void load()} />

          )}
            </ul>
            {songsPaged.hasMore && <MoreButton onClick={songsPaged.more} />}
          </div>)
      }

      {tab === 'workspace' && (
      loading ?
      <Loading /> :
      workspace.length === 0 ?
      query ? <EmptyNote searching text="" /> : <NoSongs /> :

      <div data-ev-id="ev_lib_ws" className="flex flex-col gap-6">
            <ul data-ev-id="ev_lib_ws_list" className="flex flex-col gap-2">
              {workspacePaged.shown.map((c) =>
          <CreationRow
            key={c.id}
            creation={c}
            onChange={() => void load()}
            onDeleted={() => void load()}
            onOpen={c.kind === 'music' && c.status === 'ready' ? () => navigate(songPath({ creationId: c.id, index: 0 })) : undefined} />

          )}
            </ul>
            {workspacePaged.hasMore && <MoreButton onClick={workspacePaged.more} />}
          </div>)
      }

      {tab === 'videos' && (loading ? <Loading /> : <LibraryVideos videos={lib.videos} query={query} songPathByKey={songPathByKey} />)}
      {tab === 'playlists' && <LibraryPlaylists query={query} />}
      {tab === 'character' && <CharactersSection query={query} />}
    </div>);

}

function Loading() {
  return (
    <div data-ev-id="ev_lib_loading" className="flex justify-center py-16 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>);

}

function NoSongs() {
  const { t } = useI18n();
  return (
    <div data-ev-id="ev_lib_nosongs" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <Music2 className="h-7 w-7 text-muted-foreground" />
      <p data-ev-id="ev_lib_nosongs_t" className="text-sm font-semibold text-foreground">{t('No songs here yet')}</p>
      <p data-ev-id="ev_lib_nosongs_s" className="text-sm text-muted-foreground">{t('Create your first song in the AI Studio.')}</p>
      <Link data-ev-id="ev_lib_nosongs_cta" to="/estudio" className="mt-1 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">{t('Open AI Studio')}</Link>
    </div>);

}

export default function LibraryPage() {
  return (
    <AppLayout>
      <ProtectedRoute>
        <LibraryContent />
      </ProtectedRoute>
    </AppLayout>);

}
