import { useEffect, useState } from 'react';
import { Heart, Play } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TrackRow } from '@/components/TrackRow';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { useLikes } from '@/hooks/useLikes';
import { fetchLikedTracks } from '@/lib/queries';
import type { TrackWithArtist } from '@/types/music';
import { useI18n } from '@/hooks/useI18n';

function LikedContent() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { playTracks } = usePlayer();
  const { likedIds } = useLikes();
  const [tracks, setTracks] = useState<TrackWithArtist[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchLikedTracks(user.id).then((data) => {
      if (active) setTracks(data);
    });
    return () => {
      active = false;
    };
  }, [user, likedIds.size]);

  return (
    <div data-ev-id="ev_f421bde8c8" className="mx-auto flex max-w-[1400px] flex-col gap-8">
			<header data-ev-id="ev_06be5ae581" className="flex flex-col gap-6 md:flex-row md:items-end">
				<div data-ev-id="ev_752420192a" className="flex h-48 w-48 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-2xl shadow-black/50">
					<Heart className="h-16 w-16 fill-current" />
				</div>
				<div data-ev-id="ev_3f8f310cce" className="flex flex-col gap-3">
					<span data-ev-id="ev_f625d7c0e1" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{t('Auto playlist')}</span>
					<h1 data-ev-id="ev_5a728eac64" className="text-4xl font-black tracking-tight md:text-6xl">{t('Liked Songs')}</h1>
					<p data-ev-id="ev_72c7d790f5" className="text-xs text-muted-foreground">{t(tracks.length === 1 ? '{count} song' : '{count} songs', { count: tracks.length })}</p>
				</div>
			</header>

			<button data-ev-id="ev_02f27ab6e8" type="button" onClick={() => playTracks(tracks, 0)} disabled={tracks.length === 0} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40" aria-label={t('Play Liked Songs')}>
				<Play className="h-6 w-6 translate-x-[2px] fill-current" />
			</button>

			<div data-ev-id="ev_90cfb083db" className="flex flex-col gap-1 rounded-xl bg-surface p-2">
				{tracks.map((track, i) =>
        <TrackRow key={track.id} track={track} index={i} context={tracks} />
        )}
				{tracks.length === 0 && <p data-ev-id="ev_55e6f8cb27" className="px-3 py-6 text-sm text-muted-foreground">{t("You haven't saved any songs yet. Tap the heart on any track.")}</p>}
			</div>
		</div>);

}

export default function LikedPage() {
  return (
    <AppLayout>
			<ProtectedRoute>
				<LikedContent />
			</ProtectedRoute>
		</AppLayout>);

}