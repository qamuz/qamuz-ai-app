import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Info, Layers, Loader2, Lock } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ModuleDisabled } from '@/components/ModuleDisabled';
import { SongPicker } from '@/components/tools/SongPicker';
import { StemJobCard } from '@/components/stems/StemJobCard';
import { useModules } from '@/hooks/useModules';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { useOwnSongs } from '@/hooks/useOwnSongs';
import { coverUrl } from '@/lib/covers';
import { createStemJob, fetchStemJobs, refreshStemJob, STEM_MODES, STEM_NAMES, type StemJob, type StemMode } from '@/lib/stems';
import { fetchKiePrices, planAllows, type KiePrice } from '@/lib/kie';

function StemsWorkspace() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { plan } = useAccount();
  const { songs, loading } = useOwnSongs();
  const [params] = useSearchParams();
  const wanted = params.get('song');
  const stemmable = songs.filter((s) => s.stemmable);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<StemMode>('separate_vocal');
  const [stemName, setStemName] = useState(STEM_NAMES[0]);
  const [prices, setPrices] = useState<Record<string, KiePrice>>({});
  useEffect(() => {
    void fetchKiePrices().then(setPrices);
  }, []);
  const [jobs, setJobs] = useState<StemJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{text: string;error?: boolean;} | null>(null);

  const wantedSong = wanted ? songs.find((s) => s.id === wanted || s.aliases.includes(wanted)) : undefined;

  useEffect(() => {
    if (selectedId || stemmable.length === 0) return;
    setSelectedId((wantedSong?.stemmable ? wantedSong : stemmable[0]).id);
  }, [selectedId, stemmable, wantedSong]);

  const selected = stemmable.find((s) => s.id === selectedId) ?? null;
  const modeService = STEM_MODES.find((m) => m.key === mode)?.service;
  const planLocked = Boolean(modeService && prices[modeService]) && !planAllows(prices[modeService ?? ''], plan?.slug);

  const loadJobs = useCallback(async () => {
    if (!user) return;
    setJobs(await fetchStemJobs(user.id));
  }, [user]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const pendingIds = jobs.
  filter((j) => j.status === 'generating').
  map((j) => j.id).
  join(',');

  useEffect(() => {
    if (!pendingIds) return;
    const timer = window.setInterval(async () => {
      await Promise.all(pendingIds.split(',').map((id) => refreshStemJob(id)));
      await loadJobs();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [pendingIds, loadJobs]);

  async function start() {
    if (!selected?.stemSource) return;
    setBusy(true);
    setNote(null);
    const { error } = await createStemJob(selected.stemSource, mode, stemName);
    setBusy(false);
    if (error) {
      setNote({ text: t(error), error: true });
      await loadJobs();
      return;
    }
    setNote({ text: t('Separation started — it usually takes one or two minutes.') });
    await loadJobs();
  }

  return (
    <div data-ev-id="ev_70423dd85c" className="flex flex-col gap-5 p-4 sm:p-6">
			<header data-ev-id="ev_31a5b86cad" className="flex items-center gap-3">
				<span data-ev-id="ev_632f5cf735" className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
					<Layers className="h-5 w-5" />
				</span>
				<div data-ev-id="ev_730ff27028" className="flex flex-col">
					<h1 data-ev-id="ev_139e0322fc" className="text-2xl font-black tracking-tight text-balance">{t('Stem separation')}</h1>
					<p data-ev-id="ev_5eb113d652" className="text-sm text-pretty text-muted-foreground">{t('Split your songs into vocals, drums, bass and instruments.')}</p>
				</div>
			</header>

			<div data-ev-id="ev_e10b09054d" className="grid gap-5 lg:grid-cols-[300px_1fr]">
				<SongPicker songs={stemmable} selectedId={selectedId} loading={loading} onSelect={(s) => setSelectedId(s.id)} emptyText={t('Create or upload a song to separate its stems.')} />

				<div data-ev-id="ev_c04194eec7" className="flex min-w-0 flex-col gap-5">
					{wantedSong && !wantedSong.stemmable &&
          <p data-ev-id="ev_ce3c729669" className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs text-pretty text-muted-foreground">
							<Info className="mt-0.5 h-4 w-4 flex-none" /> {t('“{title}” is still being created. Try again when it is ready.', { title: wantedSong.title })}
						</p>
          }

					{selected &&
          <section data-ev-id="ev_9c49987f6a" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
							<div data-ev-id="ev_b61fa8774d" className="flex items-center gap-3">
								<img data-ev-id="ev_0416252825" src={coverUrl(selected.coverUrl)} alt="" width={56} height={56} className="h-14 w-14 flex-none rounded-lg object-cover" />
								<h2 data-ev-id="ev_06e015d9ca" className="truncate text-lg font-black tracking-tight">{selected.title}</h2>
							</div>
							<div data-ev-id="ev_ffc64c1c64" role="radiogroup" aria-label={t('Separation type')} className="grid gap-2 sm:grid-cols-3">
								{STEM_MODES.map((m) => {
                const on = m.key === mode;
                return (
                  <button data-ev-id="ev_2def1cbee7"
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(m.key)}
                  className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${on ? 'border-primary bg-primary/10' : 'border-border hover:border-foreground/25'}`}>
                    
											<span data-ev-id="ev_df8cc76512" className="flex items-center justify-between gap-2">
												<span data-ev-id="ev_8be3db18d2" className={`text-sm font-bold ${on ? 'text-primary' : 'text-foreground'}`}>{t(m.label)}</span>
												<span data-ev-id="ev_a089521481" className="flex items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground">{prices[m.service] && !planAllows(prices[m.service], plan?.slug) && <Lock aria-label={t('Paid plans only')} className="h-3 w-3" />}{t('{count} credits', { count: prices[m.service]?.user_credits ?? m.cost })}</span>
											</span>
											<span data-ev-id="ev_1e38e54c8b" className="text-xs text-pretty text-muted-foreground">{t(m.description)}</span>
											<span data-ev-id="ev_f7810375fc" className="text-[11px] font-semibold text-muted-foreground/80">{t(m.eta)}</span>
										</button>);

              })}
							</div>
							{mode === 'split_stem_advanced' &&
            <label data-ev-id="ev_st_stemname" className="flex max-w-xs flex-col gap-1.5">
									<span data-ev-id="ev_st_stemname_l" className="text-xs font-bold">{t('Instrument to isolate')}</span>
									<select data-ev-id="ev_st_stemname_s" value={stemName} onChange={(e) => setStemName(e.target.value)} className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-primary">
										{STEM_NAMES.map((n) => <option data-ev-id="ev_07e4bac46e" key={n} value={n}>{n}</option>)}
									</select>
								</label>
            }
							{planLocked ?
            <div data-ev-id="ev_st_plan" className="flex flex-col items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
									<span data-ev-id="ev_st_plan_t" className="flex items-start gap-2 text-sm text-pretty"><Lock className="mt-0.5 h-4 w-4 flex-none text-primary" /> {t('This tool is included in the Pro, Artista and Empresa plans. Upgrade your plan to use it.')}</span>
									<Link data-ev-id="ev_st_plan_l" to="/planes" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">{t('See plans')}</Link>
								</div> :
							<button data-ev-id="ev_dc5e54bc7b" type="button" onClick={() => void start()} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
								{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />} {t('Separate stems')}
							</button>
							}
							{note &&
            <p data-ev-id="ev_6b175f6ccc" role="status" className={`text-xs ${note.error ? 'text-destructive' : 'text-primary'}`}>
									{note.text}
								</p>
            }
						</section>
          }

					<section data-ev-id="ev_10c9958d0a" className="flex flex-col gap-3">
						<h2 data-ev-id="ev_4a7e2260b2" className="text-sm font-bold">{t('Your separations')}</h2>
						{jobs.length === 0 ?
            <p data-ev-id="ev_d66e0d5813" className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t('Your separated stems will appear here.')}</p> :

            <ul data-ev-id="ev_c09c889294" className="flex flex-col gap-2">
								{jobs.map((job) =>
              <StemJobCard key={job.id} job={job} onDeleted={(id) => setJobs((js) => js.filter((j) => j.id !== id))} />
              )}
							</ul>
            }
					</section>
				</div>
			</div>
		</div>);

}

export default function StemsPage() {
  const { isEnabled } = useModules();
  const { t } = useI18n();

  useEffect(() => {
    const previous = document.title;
    document.title = `${t('Stem separation')} · Qamuz AI`;
    return () => {
      document.title = previous;
    };
  }, [t]);

  return (
    <AppLayout>
			{isEnabled('stems') ?
      <ProtectedRoute>
					<StemsWorkspace />
				</ProtectedRoute> :

      <ModuleDisabled name={t('Stem separation')} />
      }
		</AppLayout>);

}