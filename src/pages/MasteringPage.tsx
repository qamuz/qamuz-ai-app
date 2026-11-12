import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SlidersHorizontal } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ModuleDisabled } from '@/components/ModuleDisabled';
import { SongPicker } from '@/components/tools/SongPicker';
import { MasteringConsole } from '@/components/mastering/MasteringConsole';
import { useModules } from '@/hooks/useModules';
import { useI18n } from '@/hooks/useI18n';
import { useOwnSongs } from '@/hooks/useOwnSongs';

function MasteringWorkspace() {
  const { t } = useI18n();
  const { songs, loading } = useOwnSongs();
  const [params] = useSearchParams();
  const wanted = params.get('song');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId || songs.length === 0) return;
    const match = wanted ? songs.find((s) => s.id === wanted || s.aliases.includes(wanted)) : null;
    setSelectedId((match ?? songs[0]).id);
  }, [wanted, songs, selectedId]);

  const selected = songs.find((s) => s.id === selectedId) ?? null;

  return (
    <div data-ev-id="ev_33c8ffdab2" className="flex flex-col gap-5 p-4 sm:p-6">
			<header data-ev-id="ev_4e601f0a8d" className="flex items-center gap-3">
				<span data-ev-id="ev_c9dc2d8244" className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
					<SlidersHorizontal className="h-5 w-5" />
				</span>
				<div data-ev-id="ev_98ef7003ab" className="flex flex-col">
					<h1 data-ev-id="ev_424ee000e6" className="text-2xl font-black tracking-tight text-balance">{t('Mastering')}</h1>
					<p data-ev-id="ev_78295ed04f" className="text-sm text-pretty text-muted-foreground">{t('Give your songs a finished, release-ready sound.')}</p>
				</div>
			</header>
			<div data-ev-id="ev_4cdaccc91e" className="grid gap-5 lg:grid-cols-[300px_1fr]">
				<SongPicker songs={songs} selectedId={selectedId} loading={loading} onSelect={(s) => setSelectedId(s.id)} emptyText={t('Create or publish a song to start mastering.')} />
				{selected ?
        <MasteringConsole song={selected} /> :

        !loading && <div data-ev-id="ev_433b3b0422" className="flex items-center justify-center rounded-xl border border-dashed border-border p-10 text-sm text-muted-foreground">{t('Choose a song to master')}</div>
        }
			</div>
		</div>);

}

export default function MasteringPage() {
  const { isEnabled } = useModules();
  const { t } = useI18n();

  useEffect(() => {
    const previous = document.title;
    document.title = `${t('Mastering')} · Qamuz AI`;
    return () => {
      document.title = previous;
    };
  }, [t]);

  return (
    <AppLayout>
			{isEnabled('mastering') ?
      <ProtectedRoute>
					<MasteringWorkspace />
				</ProtectedRoute> :

      <ModuleDisabled name={t('Mastering')} />
      }
		</AppLayout>);

}