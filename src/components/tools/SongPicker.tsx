import { useState } from 'react';
import { Link } from 'react-router';
import { Loader2, Music2, Search } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import type { OwnSong } from '@/hooks/useOwnSongs';

interface Props {
  songs: OwnSong[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (song: OwnSong) => void;
  emptyText: string;
}

/** Compact, searchable list of the user's own songs. */
export function SongPicker({ songs, selectedId, loading, onSelect, emptyText }: Props) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const visible = query ? songs.filter((s) => s.title.toLowerCase().includes(query)) : songs;

  return (
    <div data-ev-id="ev_6556c85501" className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-surface p-3">
			<div data-ev-id="ev_87d248f8e9" className="flex items-center justify-between gap-2 px-1">
				<h2 data-ev-id="ev_b6d5368b82" className="text-sm font-bold">{t('Your songs')}</h2>
				<span data-ev-id="ev_937d486c5c" className="text-xs tabular-nums text-muted-foreground">{songs.length}</span>
			</div>
			<label data-ev-id="ev_48d7c8049d" className="flex h-10 items-center gap-2 rounded-lg bg-surface-2 px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-primary/50">
				<Search className="h-4 w-4 flex-none" />
				<input data-ev-id="ev_7113ab23f7" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search your songs')} aria-label={t('Search your songs')} className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
			</label>

			{loading ?
      <div data-ev-id="ev_d69ae5608c" className="flex items-center justify-center py-10 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" />
				</div> :
      visible.length === 0 ?
      <div data-ev-id="ev_c91bb5dfd3" className="flex flex-col items-center gap-3 px-3 py-8 text-center">
					<Music2 className="h-6 w-6 text-muted-foreground" />
					<p data-ev-id="ev_f9b0f82509" className="text-sm text-pretty text-muted-foreground">{query ? t('No songs match your search') : emptyText}</p>
					{!query &&
        <Link data-ev-id="ev_a24d9c720e" to="/estudio" className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
							{t('Go to AI Studio')}
						</Link>
        }
				</div> :

      <ul data-ev-id="ev_6267870f9a" className="no-scrollbar flex max-h-[260px] flex-col gap-1 overflow-y-auto lg:max-h-[calc(100vh-280px)]">
					{visible.map((s) => {
          const on = s.id === selectedId;
          return (
            <li data-ev-id="ev_17e7559585" key={s.id}>
								<button data-ev-id="ev_9d0e10aa32"
              type="button"
              onClick={() => onSelect(s)}
              aria-pressed={on}
              className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${on ? 'bg-primary/15' : 'hover:bg-surface-2'}`}>
                
									<img data-ev-id="ev_09f2c2bb99" src={coverUrl(s.coverUrl)} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 flex-none rounded object-cover" />
									<span data-ev-id="ev_5f73b625fd" className="flex min-w-0 flex-1 flex-col">
										<span data-ev-id="ev_4a72527b00" className={`truncate text-sm font-semibold ${on ? 'text-primary' : 'text-foreground'}`}>{s.title}</span>
										<span data-ev-id="ev_638facac51" className="text-xs tabular-nums text-muted-foreground">{s.duration > 0 ? formatTime(s.duration) : '—'}</span>
									</span>
								</button>
							</li>);

        })}
				</ul>
      }
		</div>);

}