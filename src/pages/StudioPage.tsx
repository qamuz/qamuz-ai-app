import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Coins, Filter, Image as ImageIcon, Music2, Search, Upload, Video } from 'lucide-react';
import { KieToolsModal } from '@/components/studio/KieToolsModal';
import { Link, useSearchParams } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ModuleDisabled } from '@/components/ModuleDisabled';
import { CreationRow } from '@/components/studio/CreationRow';
import { SongRow } from '@/components/studio/SongRow';
import { SongPanel } from '@/components/studio/SongPanel';
import { NleEditorShell } from '@/components/studio/nle/NleEditorShell';
import { ImageForm } from '@/components/studio/ImageForm';
import { StudioForm, type FormSeed } from '@/components/studio/StudioForm';
import { characterById } from '@/lib/characters';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { useModules } from '@/hooks/useModules';
import { usePlayer } from '@/hooks/usePlayer';
import { checkModalHealth, type ModalHealth } from '@/lib/modalClient';
import {
  createCreation,
  fetchCreations,
  fetchProviders,
  refreshCreation,
  songFromVideo,
  songsFromCreation,
  songToTrack,
  videoSourceOf,
  type Creation,
  type CreationKind,
  type ProviderInfo,
  type StudioSong } from
'@/lib/studio';

const KINDS = [
{ id: 'music' as const, label: 'Music', icon: Music2 },
{ id: 'video' as const, label: 'Video', icon: Video },
{ id: 'image' as const, label: 'Image', icon: ImageIcon }];

type SongFilter = 'all' | 'published' | 'drafts' | 'liked' | 'video';
const FILTERS: {id: SongFilter;label: string;}[] = [
{ id: 'all', label: 'All' },
{ id: 'published', label: 'Published' },
{ id: 'drafts', label: 'Drafts' },
{ id: 'liked', label: 'Liked' },
{ id: 'video', label: 'With video' }];

const MIN_FORM_WIDTH = 290;
const MAX_FORM_WIDTH = 540;
const DEFAULT_FORM_WIDTH = 360;
const FORM_WIDTH_STORAGE_KEY = 'qamuz:studio:form_width';

function StudioContent() {
  const { user } = useAuth();
  const { credits, artist, refresh: refreshAccount } = useAccount();
  const { isEnabled } = useModules();
  const { current, playTracks, setSidePanelOpen } = usePlayer();
  const { t } = useI18n();

  const [params, setParams] = useSearchParams();
  const urlKind = params.get('kind');
  const urlPrompt = params.get('prompt') ?? '';
  const [kind, setKind] = useState<CreationKind>(urlKind === 'video' || urlKind === 'image' ? urlKind : 'music');

  const [formWidth, setFormWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_FORM_WIDTH;
    const saved = localStorage.getItem(FORM_WIDTH_STORAGE_KEY);
    const parsed = saved ? Number(saved) : DEFAULT_FORM_WIDTH;
    return Number.isFinite(parsed) && parsed >= MIN_FORM_WIDTH && parsed <= MAX_FORM_WIDTH ? parsed : DEFAULT_FORM_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isSideBySide, setIsSideBySide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);

  useEffect(() => {
    const onResize = () => {
      const wide = window.innerWidth >= 768;
      setIsSideBySide(wide);
      if (wide) {
        const ratioCap = window.innerWidth < 1100 ? 0.40 : 0.44;
        const maxAllowed = Math.min(MAX_FORM_WIDTH, Math.floor(window.innerWidth * ratioCap));
        setFormWidth((prev) => prev > maxAllowed ? Math.max(MIN_FORM_WIDTH, maxAllowed) : prev);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Broadcast current Studio kind so Sidebar auto-collapses in Video mode
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('qamuz:studio-kind', { detail: kind }));
    if (params.get('kind') !== kind) {
      const next = new URLSearchParams(params);
      next.set('kind', kind);
      setParams(next, { replace: true });
    }
    return () => {
      window.dispatchEvent(new CustomEvent('qamuz:studio-kind', { detail: null }));
    };
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = formWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const ratioCap = window.innerWidth < 1100 ? 0.40 : 0.44;
      const maxAllowed = Math.min(MAX_FORM_WIDTH, Math.floor(window.innerWidth * ratioCap));
      const nextWidth = Math.min(maxAllowed, Math.max(MIN_FORM_WIDTH, startWidth + deltaX));
      setFormWidth(nextWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
      setIsResizing(false);

      const deltaX = upEvent.clientX - startX;
      const ratioCap = window.innerWidth < 1100 ? 0.40 : 0.44;
      const maxAllowed = Math.min(MAX_FORM_WIDTH, Math.floor(window.innerWidth * ratioCap));
      const finalWidth = Math.min(maxAllowed, Math.max(MIN_FORM_WIDTH, startWidth + deltaX));
      try {
        localStorage.setItem(FORM_WIDTH_STORAGE_KEY, String(finalWidth));
      } catch {
        // ignore
      }};

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [formWidth]);

  const urlCharacter = characterById(params.get('character'));
  const [seed, setSeed] = useState<{n: number;value: FormSeed | null;}>({
    n: 0,
    value: (urlPrompt || urlCharacter) && urlKind !== 'video' ?
    { mode: 'simple', prompt: urlPrompt.slice(0, 450), persona: urlCharacter ?? undefined } :
    null
  });
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [modalHealth, setModalHealth] = useState<ModalHealth | null>(null);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: 'ok' | 'error';text: string;} | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panelVideo, setPanelVideo] = useState<string | null>(null);
  const [videoPick, setVideoPick] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SongFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setCreations(await fetchCreations(user.id));
  }, [user]);

  useEffect(() => {
    void load();
    void fetchProviders().then(setProviders);
    void checkModalHealth().then(setModalHealth);

    const onCreationsUpdated = () => {
      void load();
      void refreshAccount();
    };
    window.addEventListener('qamuz:creations-updated', onCreationsUpdated);
    return () => window.removeEventListener('qamuz:creations-updated', onCreationsUpdated);
  }, [load, refreshAccount]);

  const pendingKey = creations.filter((c) => c.status === 'generating').map((c) => c.id).join(',');

  useEffect(() => {
    if (!pendingKey) return;
    const ids = pendingKey.split(',');
    const timer = window.setInterval(() => {
      void Promise.all(ids.map((id) => refreshCreation(id))).
      then(() => load()).
      then(() => refreshAccount());
    }, 8000);
    return () => window.clearInterval(timer);
  }, [pendingKey, load, refreshAccount]);

  const provider = useMemo(() => {
    const list = providers.filter((p) => p.kind === kind);
    const dbMatch = list.find((p) => p.is_active && p.is_default) ?? list.find((p) => p.is_active) ?? list[0] ?? null;
    if (modalHealth?.visionConfigured && modalHealth?.visionAuthOk && (kind === 'image' || kind === 'video')) {
      if (dbMatch && dbMatch.is_active) {
        return { ...dbMatch, credit_cost: 0 };
      }
      return {
        id: `local-modal-${kind}`,
        slug: kind === 'image' ? 'modal-image' : 'modal-video',
        name: kind === 'image' ? 'Modal · Qamuz Vision' : 'Modal · Qamuz Video',
        kind,
        secret_name: 'QAMUZ_SERVICE_TOKEN',
        model: kind === 'image' ? 'qamuz-image-flux' : 'qamuz-video-svd',
        is_active: true,
        is_default: true,
        credit_cost: 0,
        notes: 'Conectado por AI Studio Secrets',
      } satisfies ProviderInfo;
    }
    return dbMatch;
  }, [providers, kind, modalHealth]);

  const creationById = useMemo(() => new Map(creations.map((c) => [c.id, c])), [creations]);
  const aiSongs = useMemo(() => creations.flatMap(songsFromCreation), [creations]);
  const readySongs = useMemo(() => aiSongs.filter((s) => creationById.get(s.creationId)?.status === 'ready'), [aiSongs, creationById]);

  const { videoBySong, videoSongs } = useMemo(() => {
    const keys = new Set(aiSongs.map((s) => s.key));
    const map = new Map<string, string>();
    const extra: StudioSong[] = [];
    for (const c of creations) {
      if (c.kind !== 'video') continue;
      const src = videoSourceOf(c);
      if (!src) continue;
      if (src.song_key && keys.has(src.song_key)) {
        if (c.status === 'ready' && c.result_urls[0] && !map.has(src.song_key)) map.set(src.song_key, c.result_urls[0]);
      } else {
        extra.push(songFromVideo(c, src));
        if (c.status === 'ready' && c.result_urls[0]) map.set(`video:${c.id}`, c.result_urls[0]);
      }
    }
    return { videoBySong: map, videoSongs: extra };
  }, [creations, aiSongs]);

  const artistRef = artist ? { id: artist.id, name: artist.name, slug: artist.slug } : null;
  const queue = useMemo(() => aiSongs.map((s) => songToTrack(s, artistRef)), [aiSongs, artistRef?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const allSongs = useMemo(() => [...aiSongs, ...videoSongs], [aiSongs, videoSongs]);
  const selected = allSongs.find((s) => s.key === selectedKey) ?? null;

  useEffect(() => {
    setSidePanelOpen(Boolean(selected));
    return () => setSidePanelOpen(false);
  }, [selected, setSidePanelOpen]);

  useEffect(() => {
    if (!selectedKey || !current) return;
    const s = allSongs.find((x) => x.trackId === current.id);
    if (s && s.key !== selectedKey) {
      setSelectedKey(s.key);
      setPanelVideo(null);
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openSong(song: StudioSong, video: string | null = null) {
    const idx = queue.findIndex((q) => q.id === song.trackId);
    if (idx >= 0) playTracks(queue, idx);else
    playTracks([songToTrack(song, artistRef)], 0);
    setSelectedKey(song.key);
    setPanelVideo(video);
  }

  function openVideo(c: Creation) {
    const src = videoSourceOf(c);
    if (!src) return;
    const song = allSongs.find((s) => s.key === src.song_key) ?? allSongs.find((s) => s.key === `video:${c.id}`);
    if (song) openSong(song, c.result_urls[0] ?? null);
  }

  // Hand-off from the Library: /estudio?remix=<songKey> or /estudio?video=<songKey>
  const handoffDone = useRef(false);
  useEffect(() => {
    if (handoffDone.current) return;
    const remixKey = params.get('remix');
    const videoKey = params.get('video');
    const key = remixKey ?? videoKey;
    if (!key) {
      handoffDone.current = true;
      return;
    }
    const song = allSongs.find((s) => s.key === key);
    if (!song) return;
    handoffDone.current = true;
    if (remixKey) remix(song);else
    makeVideo(song);
  }, [allSongs]); // eslint-disable-line react-hooks/exhaustive-deps

  function makeVideo(song: StudioSong) {
    setVideoPick(song.key);
    setKind('video');
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function remix(song: StudioSong) {
    setKind('music');
    setMessage(null);
    setSeed((prev) => ({ n: prev.n + 1, value: { mode: 'custom', lyrics: song.lyrics ?? '', style: song.style ?? '', title: song.title } }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleCreate(prompt: string, options: Record<string, unknown>) {
    setSubmitting(true);
    setMessage(null);
    const { error } = await createCreation(kind, prompt, options);
    if (error) setMessage({ type: 'error', text: error });else
    setMessage({ type: 'ok', text: kind === 'image' ? t('Image created.') : t('Your creation is on its way. It will appear in your workspace in a few minutes.') });
    setSubmitting(false);
    void load();
    void refreshAccount();
  }

  const visible = creations.filter((c) => c.kind === kind);
  const removeCreation = (id: string) => setCreations((prev) => prev.filter((x) => x.id !== id));
  const q = query.trim().toLowerCase();

  function songMatches(s: StudioSong): boolean {
    if (q && !`${s.title} ${s.style ?? ''}`.toLowerCase().includes(q)) return false;
    if (filter === 'published') return Boolean(s.publishedTrackId);
    if (filter === 'drafts') return !s.publishedTrackId;
    if (filter === 'liked') return s.liked;
    if (filter === 'video') return videoBySong.has(s.key);
    return true;
  }

  const rows = kind === 'music' ?
  visible.flatMap((c) => {
    const songs = songsFromCreation(c);
    if (songs.length === 0) {
      if (filter !== 'all' && filter !== 'drafts') return [];
      if (q && !c.prompt.toLowerCase().includes(q)) return [];
      return [<CreationRow key={c.id} creation={c} onChange={() => void load()} onDeleted={removeCreation} />];
    }
    return songs.filter(songMatches).map((s) =>
    <SongRow
      key={s.key}
      song={s}
      creation={c}
      selected={selectedKey === s.key}
      hasVideo={videoBySong.has(s.key)}
      generating={c.status === 'generating'}
      onSelect={() => openSong(s)}
      onMakeVideo={() => makeVideo(s)}
      onPreviewVideo={() => openSong(s, videoBySong.get(s.key) ?? null)}
      onRemix={() => remix(s)}
      onChanged={() => void load()}
      onDeleted={() => {
        if (selectedKey === s.key) setSelectedKey(null);
        void load();
      }} />
    );
  }) :
  visible.
  filter((c) => !q || `${c.title ?? ''} ${c.prompt}`.toLowerCase().includes(q)).
  map((c) =>
  <CreationRow key={c.id} creation={c} onChange={() => void load()} onDeleted={removeCreation} onOpen={c.kind === 'video' ? () => openVideo(c) : undefined} />
  );

  const effectiveFormWidth = useMemo(() => {
    if (!isSideBySide) return undefined;
    if (typeof window === 'undefined') return formWidth;
    const maxCap = window.innerWidth < 1100 ? Math.floor(window.innerWidth * 0.38) : MAX_FORM_WIDTH;
    return Math.max(MIN_FORM_WIDTH, Math.min(formWidth, maxCap));
  }, [isSideBySide, formWidth]);

  if (kind === 'video' && user) {
    return (
      <NleEditorShell
        kind={kind}
        onChangeKind={(next) => {
          setKind(next);
          setMessage(null);
        }}
        userId={user.id}
        songs={readySongs}
        creations={creations}
        videoProvider={provider}
        credits={credits}
        initialSongKey={videoPick}
        onWorkspaceUpdated={() => {
          void load();
          void refreshAccount();
        }}
      />
    );
  }

  return (
    <div data-ev-id="ev_ff56bda520" className={`flex w-full flex-col gap-6 transition-[padding] md:flex-row md:gap-0 ${selected ? 'xl:pr-[392px]' : ''}`}>
      {/* Left: creation panel (resizable) */}
      <aside
        data-ev-id="ev_st_left"
        style={{
          width: effectiveFormWidth ? `${effectiveFormWidth}px` : undefined,
          minWidth: effectiveFormWidth ? `${effectiveFormWidth}px` : undefined,
          maxWidth: effectiveFormWidth ? `${effectiveFormWidth}px` : undefined
        }}
        className="relative no-scrollbar flex flex-none flex-col gap-3 md:sticky md:top-[76px] md:max-h-[calc(100vh-92px)] md:self-start md:overflow-y-auto md:border-r md:border-border md:pr-4">
        
        <div data-ev-id="ev_st_kinds" className="flex items-center justify-between gap-2">
          <div data-ev-id="ev_st_kinds_l" role="tablist" className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
            {KINDS.map((k) => {
              const Icon = k.icon;
              const on = kind === k.id;
              return (
                <button data-ev-id="ev_st_kind" key={k.id} type="button" role="tab" aria-selected={on} onClick={() => {setKind(k.id);setMessage(null);}} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors ${on ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="h-3.5 w-3.5" /> {t(k.label)}
                </button>);
            })}
          </div>
          <span data-ev-id="ev_1d2d903693" className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs font-bold tabular-nums">
            <Coins className="h-3.5 w-3.5 text-primary" /> {credits ?? 0}
            {isEnabled('payments') && <Link data-ev-id="ev_3ca6ccdf73" to="/planes" className="ml-1 font-semibold text-primary hover:underline">{t('Get more')}</Link>}
          </span>
        </div>

        {message &&
        <p data-ev-id="ev_eb8ffecc91" role="status" className={`rounded-lg px-3 py-2 text-xs ${message.type === 'ok' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{message.text}</p>
        }

        {kind === 'image' && user ? (
          <ImageForm key="image-form" provider={provider} credits={credits} submitting={submitting} userId={user.id} creations={creations} onSubmit={(p, o) => void handleCreate(p, o)} />
        ) : (
          <StudioForm key={`${kind}-${seed.n}`} kind={kind} seed={kind === 'music' ? seed.value : null} provider={provider} credits={credits} submitting={submitting} onSubmit={(p, o) => void handleCreate(p, o)} />
        )}

        {kind === 'music' && !artist && isEnabled('artists') &&
        <p data-ev-id="ev_a52a1d8984" className="text-xs text-muted-foreground">
            {t('Want to publish your songs?')}{' '}
            <Link data-ev-id="ev_a0b0ca2367" to="/artista-panel" className="font-semibold text-primary hover:underline">{t('Create your artist profile')}</Link>
          </p>
        }

        {/* Drag Resizer Handle (mouse resize with limits) */}
        <div data-ev-id="ev_e104a54cbf"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('Resize creations panel')}
        title="Arrastra para ensanchar o reducir el panel (Doble clic para restablecer)"
        onMouseDown={handleMouseDown}
        onDoubleClick={() => {
          setFormWidth(DEFAULT_FORM_WIDTH);
          try {
            localStorage.setItem(FORM_WIDTH_STORAGE_KEY, String(DEFAULT_FORM_WIDTH));
          } catch {

            // ignore
          }}}
        className={`group absolute -right-2 top-0 bottom-0 z-20 hidden w-4 cursor-col-resize select-none items-center justify-center md:flex ${
        isResizing ? 'cursor-col-resize' : ''}`
        }>
          
          <div data-ev-id="ev_6f83e43895"
          className={`h-full w-1 rounded-full transition-colors ${
          isResizing ? 'bg-primary shadow-sm shadow-primary/50' : 'bg-transparent group-hover:bg-primary/50'}`
          } />
          
          <div data-ev-id="ev_55880c7ae4"
          className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-full bg-surface-3 px-0.5 py-1.5 shadow-md transition-opacity ${
          isResizing ? 'opacity-100 ring-1 ring-primary' : 'opacity-0 group-hover:opacity-100'}`
          }>
            
            <div data-ev-id="ev_948f9a66e9" className={`h-1 w-1 rounded-full ${isResizing ? 'bg-primary' : 'bg-muted-foreground'}`} />
            <div data-ev-id="ev_370d5ee9d9" className={`h-1 w-1 rounded-full ${isResizing ? 'bg-primary' : 'bg-muted-foreground'}`} />
            <div data-ev-id="ev_a5f63c2c86" className={`h-1 w-1 rounded-full ${isResizing ? 'bg-primary' : 'bg-muted-foreground'}`} />
          </div>
        </div>
      </aside>

      {/* Right: workspace (always beside the form on md+) */}
      <section data-ev-id="ev_82782513c9" className="flex min-w-0 flex-1 flex-col gap-4 md:pl-5">
        <div data-ev-id="ev_st_ws_h" className="flex items-baseline justify-between gap-3">
          <h1 data-ev-id="ev_2db8ae36db" className="text-lg font-bold tracking-tight">{t('My workspace')}</h1>
          <div data-ev-id="ev_st_ws_r" className="flex items-center gap-3">
            {kind === 'music' &&
            <button data-ev-id="ev_st_upload" type="button" onClick={() => setUploadOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary">
                <Upload className="h-3.5 w-3.5" /> {t('Upload audio')}
              </button>
            }
            <span data-ev-id="ev_cr_count" className="text-xs tabular-nums text-muted-foreground">{rows.length}</span>
          </div>
        </div>
        {uploadOpen && <KieToolsModal open song={null} onClose={() => setUploadOpen(false)} />}

        <div data-ev-id="ev_st_tools" className="flex items-center gap-2">
          <label data-ev-id="ev_st_search" className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 focus-within:border-primary">
            <Search className="h-4 w-4 flex-none text-muted-foreground" />
            <input data-ev-id="ev_st_search_i" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search song title')} aria-label={t('Search song title')} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </label>
          {kind === 'music' &&
          <div data-ev-id="ev_st_filter" className="relative">
              <button data-ev-id="ev_st_filter_b" type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((v) => !v)} className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${filter !== 'all' ? 'border-primary text-primary' : 'border-border bg-surface-2 text-foreground'}`}>
                <Filter className="h-3.5 w-3.5" /> <span data-ev-id="ev_st_filter_t" className="hidden sm:inline">{filter === 'all' ? t('Filters') : t(FILTERS.find((f) => f.id === filter)?.label ?? 'All')}</span> <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {filterOpen &&
            <>
                  <button data-ev-id="ev_st_filter_bg" type="button" aria-label={t('Close')} className="fixed inset-0 z-30 cursor-default" onClick={() => setFilterOpen(false)} />
                  <ul data-ev-id="ev_st_filter_m" className="absolute right-0 top-11 z-40 flex w-44 flex-col rounded-xl border border-border bg-surface p-1 shadow-xl">
                    {FILTERS.map((f) =>
                <li data-ev-id="ev_st_filter_li" key={f.id}>
                        <button data-ev-id="ev_st_filter_o" type="button" onClick={() => {setFilter(f.id);setFilterOpen(false);}} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${filter === f.id ? 'font-bold text-primary' : 'text-foreground'}`}>
                          {t(f.label)}
                        </button>
                      </li>
                )}
                  </ul>
                </>
            }
            </div>
          }
        </div>

        {visible.length === 0 ?
        <div data-ev-id="ev_9f845735d1" className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{t('Nothing here yet. Describe an idea and press “Create”.')}</div> :
        rows.length === 0 ?
        <div data-ev-id="ev_st_nomatch" className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{t('No songs match your search.')}</div> :
        <ul data-ev-id="ev_st_songs" className="flex flex-col gap-1">{rows}</ul>
        }
      </section>

      {selected &&
      <SongPanel
        song={selected}
        creation={creationById.get(selected.creationId)}
        videoUrl={panelVideo ?? videoBySong.get(selected.key) ?? null}
        queue={queue}
        onClose={() => setSelectedKey(null)}
        onChanged={() => void load()}
        onMakeVideo={makeVideo} />
      }
    </div>);

}

export default function StudioPage() {
  const { isEnabled } = useModules();
  return (
    <AppLayout>
      {isEnabled('studio') ?
      <ProtectedRoute>
          <StudioContent />
        </ProtectedRoute> :
      <ModuleDisabled name="AI Studio" />
      }
    </AppLayout>);

}