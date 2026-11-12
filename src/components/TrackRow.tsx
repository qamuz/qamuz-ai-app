import { Heart, Pause, Play } from 'lucide-react';
import { Link } from 'react-router';
import { usePlayer } from '@/hooks/usePlayer';
import { useLikes } from '@/hooks/useLikes';
import { useAuth } from '@/hooks/useAuth';
import { coverUrl } from '@/lib/covers';
import { formatCount, formatTime } from '@/lib/format';
import { EqualizerBars } from '@/components/EqualizerBars';
import { TrackMenu } from '@/components/TrackMenu';
import type { TrackWithArtist } from '@/types/music';
import { useI18n } from '@/hooks/useI18n';

interface TrackRowProps {
  track: TrackWithArtist;
  index: number;
  context: TrackWithArtist[];
  showPlays?: boolean;
}

export function TrackRow({ track, index, context, showPlays = true }: TrackRowProps) {
  const { current, isPlaying, playTracks } = usePlayer();
  const { isLiked, toggleLike } = useLikes();
  const { user } = useAuth();
  const { t } = useI18n();
  const active = current?.id === track.id;
  const liked = isLiked(track.id);

  return (
    <div data-ev-id="ev_f22c0cd5d3" className={`group grid grid-cols-[2rem_1fr_auto] items-center gap-4 rounded-md px-3 py-2 transition-colors hover:bg-surface-2 md:grid-cols-[2rem_1fr_8rem_6rem_auto] ${active ? 'bg-surface-2' : ''}`}>
			<button data-ev-id="ev_3c449b7666"
      type="button"
      onClick={() => playTracks(context, index)}
      className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted-foreground transition-colors hover:text-foreground"
      aria-label={active && isPlaying ? t('Pause {title}', { title: track.title }) : t('Play {title}', { title: track.title })}>
        
				{active ?
        <span data-ev-id="ev_bc421140de" className="group-hover:hidden">
						<EqualizerBars playing={isPlaying} />
					</span> :

        <span data-ev-id="ev_c48348b7d1" className="group-hover:hidden">{index + 1}</span>
        }
				<span data-ev-id="ev_ce40bb534f" className="hidden group-hover:block">{active && isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}</span>
			</button>

			<div data-ev-id="ev_cc9e842b1a" className="flex min-w-0 items-center gap-3">
				<img data-ev-id="ev_2dbb61efda" src={coverUrl(track.cover_key)} width={40} height={40} loading="lazy" alt="" className="h-10 w-10 flex-none rounded object-cover" />
				<div data-ev-id="ev_22457c2fc2" className="flex min-w-0 flex-col">
					<button data-ev-id="ev_ba1ed2f34b" type="button" onClick={() => playTracks(context, index)} className={`truncate text-left text-sm font-medium ${active ? 'text-primary' : 'text-foreground'}`}>
						{track.title}
					</button>
					{track.artist &&
          <Link data-ev-id="ev_a3d615c6f3" to={`/artista/${track.artist.slug}`} className="truncate text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline">
							{track.artist.name}
						</Link>
          }
				</div>
			</div>

			<div data-ev-id="ev_6aed4a7bcc" className="hidden text-xs text-muted-foreground md:block">{track.genre}</div>
			<div data-ev-id="ev_cc4d64fa9e" className="hidden text-xs tabular-nums text-muted-foreground md:block">{showPlays ? t('{count} plays', { count: formatCount(track.plays) }) : ''}</div>

			<div data-ev-id="ev_47f55a2476" className="flex items-center justify-end gap-2">
				{user &&
        <button data-ev-id="ev_f2cfbbf680"
        type="button"
        onClick={() => void toggleLike(track.id)}
        aria-label={liked ? t('Remove from Liked Songs') : t('Save to Liked Songs')}
        className={`transition-colors ${liked ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground'}`}>
          
						<Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
					</button>
        }
				<span data-ev-id="ev_74910156cf" className="text-xs tabular-nums text-muted-foreground">{formatTime(track.duration_seconds)}</span>
				<TrackMenu track={track} buttonClassName="md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" />
			</div>
		</div>);

}