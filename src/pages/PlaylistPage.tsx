import { useEffect, useState } from 'react';
import { Play, Shuffle } from 'lucide-react';
import { useParams } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { TrackRow } from '@/components/TrackRow';
import { usePlayer } from '@/hooks/usePlayer';
import { fetchPlaylist, fetchPlaylistTracks } from '@/lib/queries';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import type { Playlist, TrackWithArtist } from '@/types/music';
import { useI18n } from '@/hooks/useI18n';

export default function PlaylistPage() {
  const { t } = useI18n();
  const { id = '' } = useParams();
  const { playTracks, toggleShuffle, shuffle } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<TrackWithArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([fetchPlaylist(id), fetchPlaylistTracks(id)]).then(([pl, tr]) => {
      if (!active) return;
      setPlaylist(pl);
      setTracks(tr);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const totalSeconds = tracks.reduce((sum, t) => sum + t.duration_seconds, 0);

  return (
    <AppLayout>
			<div data-ev-id="ev_e82eff3b2b" className="mx-auto flex max-w-[1400px] flex-col gap-8">
				{loading && <p data-ev-id="ev_42dbbd053a" className="text-sm text-muted-foreground">{t('Loading playlist...')}</p>}
				{!loading && !playlist && <p data-ev-id="ev_18152fc874" className="text-sm text-muted-foreground">{t("This playlist doesn't exist or isn't public.")}</p>}

				{playlist &&
        <>
						<header data-ev-id="ev_ceb4cbd23b" className="flex flex-col gap-6 md:flex-row md:items-end">
							<img data-ev-id="ev_9639c00cd2" src={coverUrl(playlist.cover_key)} width={240} height={240} alt={t('Cover of {title}', { title: playlist.title })} className="h-48 w-48 rounded-xl object-cover shadow-2xl shadow-black/50" />
							<div data-ev-id="ev_20faaab9db" className="flex flex-col gap-3">
								<span data-ev-id="ev_54ad58282f" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{t('Playlist')}</span>
								<h1 data-ev-id="ev_b5866a1032" className="text-4xl font-black tracking-tight text-balance md:text-6xl">{t(playlist.title)}</h1>
								{playlist.description && <p data-ev-id="ev_7185076581" className="max-w-xl text-sm text-pretty text-muted-foreground">{t(playlist.description)}</p>}
								<p data-ev-id="ev_d90b5b29aa" className="text-xs text-muted-foreground">
									{t(tracks.length === 1 ? '{count} song' : '{count} songs', { count: tracks.length })} · {formatTime(totalSeconds)}
								</p>
							</div>
						</header>

						<div data-ev-id="ev_4c7de37aca" className="flex items-center gap-4">
							<button data-ev-id="ev_05785e3784" type="button" onClick={() => playTracks(tracks, 0)} disabled={tracks.length === 0} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40" aria-label={t('Play playlist')}>
								<Play className="h-6 w-6 translate-x-[2px] fill-current" />
							</button>
							<button data-ev-id="ev_8d21d2ebcd" type="button" onClick={toggleShuffle} className={`flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${shuffle ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
								<Shuffle className="h-4 w-4" /> {t('Shuffle')}
							</button>
						</div>

						<div data-ev-id="ev_fb1c476f85" className="flex flex-col gap-1 rounded-xl bg-surface p-2">
							{tracks.map((track, i) =>
            <TrackRow key={track.id} track={track} index={i} context={tracks} />
            )}
							{tracks.length === 0 && <p data-ev-id="ev_70d6b84c8d" className="px-3 py-6 text-sm text-muted-foreground">{t("This playlist doesn't have any songs yet.")}</p>}
						</div>
					</>
        }
			</div>
		</AppLayout>);

}