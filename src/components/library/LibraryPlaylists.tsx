import { useEffect, useMemo, useState } from 'react';
import { Heart, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { MediaCard } from '@/components/MediaCard';
import { EmptyNote, MoreButton } from '@/components/home/MoreButton';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { matchesQuery, usePaged } from '@/hooks/usePaged';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserPlaylists } from '@/lib/queries';
import type { Playlist } from '@/types/music';

const PAGE = 15;

/** Playlists tab: create a playlist, Liked Songs shortcut and the user's playlists. */
export function LibraryPlaylists({ query }: { query: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchUserPlaylists(user.id).then((data) => {
      if (active) setPlaylists(data);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const filtered = useMemo(() => playlists.filter((p) => matchesQuery(query, p.title, p.description)), [playlists, query]);
  const { shown, hasMore, more } = usePaged(filtered, PAGE, query);

  async function createPlaylist(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !user || !title.trim()) return;
    setCreating(true);
    setError(null);
    const { data, error: insertError } = await supabase.
    from('playlists').
    insert({ user_id: user.id, title: title.trim(), cover_key: `cover-${playlists.length % 6 + 1}` }).
    select('id, title, description, cover_key, is_public, is_featured, user_id').
    single();
    if (insertError) setError(insertError.message);else
    if (data) {
      setPlaylists((prev) => [data as Playlist, ...prev]);
      setTitle('');
    }
    setCreating(false);
  }

  return (
    <div data-ev-id="ev_lpl_root" className="flex flex-col gap-6">
      <form data-ev-id="ev_lpl_form" onSubmit={createPlaylist} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
        <input data-ev-id="ev_lpl_input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('New playlist name')} aria-label={t('New playlist name')} className="flex-1 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" />
        <button data-ev-id="ev_lpl_create" type="submit" disabled={creating || !title.trim()} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
          <Plus className="h-4 w-4" /> {creating ? t('Creating...') : t('Create playlist')}
        </button>
      </form>
      {error && <p data-ev-id="ev_lpl_err" className="text-sm text-destructive">{error}</p>}

      <div data-ev-id="ev_lpl_grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Link data-ev-id="ev_lpl_liked" to="/me-gusta" className="flex flex-col justify-end gap-2 rounded-xl bg-gradient-to-br from-primary/80 to-accent/70 p-4 text-primary-foreground transition-transform hover:scale-[1.02]">
          <Heart className="h-7 w-7 fill-current" />
          <span data-ev-id="ev_lpl_liked_t" className="text-base font-black">{t('Liked Songs')}</span>
          <span data-ev-id="ev_lpl_liked_s" className="text-xs opacity-80">{t('Your saved songs')}</span>
        </Link>
        {shown.map((playlist) =>
        <MediaCard key={playlist.id} to={`/lista/${playlist.id}`} title={playlist.title} subtitle={playlist.description ?? t('Personal playlist')} coverKey={playlist.cover_key} />
        )}
      </div>
      {query && filtered.length === 0 && <EmptyNote searching text="" />}
      {hasMore && <MoreButton onClick={more} />}
    </div>);

}
