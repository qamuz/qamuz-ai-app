import { useEffect, useState } from 'react';
import { Disc3, Headphones, Music2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchOwnTracks, type OwnTrack } from '@/lib/artist-panel';
import { formatCount } from '@/lib/format';
import type { OwnedArtist } from '@/contexts/account-context';
import { useI18n } from '@/hooks/useI18n';

export function ArtistStats({ artist }: {artist: OwnedArtist;}) {
  const { t: tr } = useI18n();
  const [tracks, setTracks] = useState<OwnTrack[]>([]);
  const [followers, setFollowers] = useState(0);

  useEffect(() => {
    void fetchOwnTracks(artist.id).then(setTracks);
    if (!supabase) return;
    void supabase.
    from('follows').
    select('id', { count: 'exact', head: true }).
    eq('artist_id', artist.id).
    then(({ count }) => setFollowers(count ?? 0));
  }, [artist.id]);

  const totalPlays = tracks.reduce((sum, t) => sum + t.plays, 0);
  const top = [...tracks].sort((a, b) => b.plays - a.plays).slice(0, 6);
  const max = Math.max(1, ...top.map((t) => t.plays));

  const cards = [
  { label: tr('Reproducciones'), value: formatCount(totalPlays), icon: Headphones },
  { label: tr('Oyentes mensuales'), value: formatCount(artist.monthly_listeners), icon: Disc3 },
  { label: tr('Seguidores'), value: formatCount(followers), icon: Users },
  { label: tr('Canciones'), value: String(tracks.length), icon: Music2 }];


  return (
    <div data-ev-id="ev_beee0dc579" className="flex flex-col gap-6">
			<div data-ev-id="ev_820b00c2cd" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{cards.map(({ label, value, icon: Icon }) =>
        <div data-ev-id="ev_a72bd2d42d" key={label} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
						<Icon className="h-5 w-5 text-primary" />
						<span data-ev-id="ev_633d9eafa9" className="text-2xl font-black tabular-nums md:text-3xl">{value}</span>
						<span data-ev-id="ev_07e1f988f5" className="text-xs text-muted-foreground">{label}</span>
					</div>
        )}
			</div>

			<section data-ev-id="ev_5e91cde0bd" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
				<h2 data-ev-id="ev_248b67bb84" className="text-lg font-bold">{tr('Canciones más escuchadas')}</h2>
				{top.length === 0 && <p data-ev-id="ev_2351f1b3a2" className="text-sm text-muted-foreground">{tr('Sin datos todavía.')}</p>}
				<div data-ev-id="ev_bfbdbebbd0" className="flex flex-col gap-3">
					{top.map((t) =>
          <div data-ev-id="ev_b0aa2e1145" key={t.id} className="flex flex-col gap-1.5">
							<div data-ev-id="ev_8398db26d3" className="flex justify-between gap-3 text-sm">
								<span data-ev-id="ev_081f3daea3" className="truncate font-medium">{t.title}</span>
								<span data-ev-id="ev_4166f8b0fd" className="tabular-nums text-muted-foreground">{formatCount(t.plays)}</span>
							</div>
							<div data-ev-id="ev_030fb3c1af" className="h-2 rounded-full bg-surface-3">
								<div data-ev-id="ev_d1d8c72eff" className="h-2 rounded-full bg-primary" style={{ width: `${t.plays / max * 100}%` }} />
							</div>
						</div>
          )}
				</div>
			</section>
		</div>);

}