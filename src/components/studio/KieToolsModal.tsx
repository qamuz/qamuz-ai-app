import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Clapperboard,
  Coins,
  FastForward,
  FileAudio,
  Image as ImageIcon,
  ListMusic,
  Loader2,
  Lock,
  Mic,
  Music,
  PenLine,
  Repeat,
  Scissors,
  Sparkles,
  Upload,
  UserRound,
  X,
  type LucideIcon } from
'lucide-react';
import { Link } from 'react-router';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { coverUrl } from '@/lib/covers';
import { audioDuration, uploadMedia } from '@/lib/media';
import type { Creation, StudioSong } from '@/lib/studio';
import { fetchKiePrices, fetchKieTasks, NEEDS_AI_SONG, planAllows, refreshKieTask, runKie, SONG_SERVICES, type KiePrice, type KieService, type KieTask } from '@/lib/kie';
import { KieTaskList } from '@/components/studio/KieTaskList';

type FieldType = 'text' | 'textarea' | 'number' | 'toggle' | 'vocal';
interface Field {key: string;label: string;type: FieldType;max?: number;required?: boolean;placeholder?: string;}

const F = {
  title: { key: 'title', label: 'Title', type: 'text', max: 80 } as Field,
  style: { key: 'style', label: 'Style', type: 'text', max: 1000, placeholder: 'e.g. bachata, romantic, requinto guitar' } as Field,
  styleReq: { key: 'style', label: 'Style', type: 'text', max: 1000, required: true, placeholder: 'e.g. reggaeton, dark synths, 95 bpm' } as Field,
  lyrics: { key: 'lyrics', label: 'Lyrics (optional)', type: 'textarea', max: 5000 } as Field,
  continueAt: { key: 'continue_at', label: 'Continue from second (optional)', type: 'number' } as Field,
  instrumental: { key: 'instrumental', label: 'Instrumental (no vocals)', type: 'toggle' } as Field,
  vocal: { key: 'vocal', label: 'Vocal', type: 'vocal' } as Field
};

const TOOLS: {id: KieService;label: string;desc: string;icon: LucideIcon;fields: Field[];}[] = [
{ id: 'extend', label: 'Extend song', desc: 'Continue the song from any second with new lyrics or style.', icon: FastForward, fields: [F.title, F.style, F.lyrics, F.continueAt, F.instrumental, F.vocal] },
{ id: 'cover', label: 'Cover / re-version', desc: 'Re-sing and re-arrange it in a new style.', icon: Repeat, fields: [F.title, F.style, F.lyrics, F.instrumental, F.vocal] },
{ id: 'upload_extend', label: 'Upload and extend', desc: 'Upload your audio and let AI continue it.', icon: Upload, fields: [F.title, F.style, F.lyrics, F.continueAt, F.instrumental, F.vocal] },
{ id: 'add_vocals', label: 'Add vocals', desc: 'Sing on top of an instrumental.', icon: Mic, fields: [F.title, F.styleReq, F.lyrics, F.vocal] },
{ id: 'add_instrumental', label: 'Add instrumental', desc: 'Build a backing track under a vocal.', icon: Music, fields: [F.title, F.styleReq] },
{ id: 'replace_section', label: 'Replace a section', desc: 'Rewrite 10+ seconds without touching the rest.', icon: Scissors, fields: [
  { key: 'start', label: 'From second', type: 'number', required: true },
  { key: 'end', label: 'To second', type: 'number', required: true },
  F.style,
  { key: 'lyrics', label: 'New lyrics for this section', type: 'textarea', max: 5000 },
  { key: 'full_lyrics', label: 'Full song lyrics', type: 'textarea', max: 5000, required: true }]
},
{ id: 'wav', label: 'Studio WAV', desc: 'Lossless WAV file of this song.', icon: FileAudio, fields: [] },
{ id: 'video', label: 'Music video MP4', desc: 'An MP4 visualizer video for this song.', icon: Clapperboard, fields: [{ key: 'author', label: 'Artist name on the video', type: 'text', max: 50 }] },
{ id: 'timestamped_lyrics', label: 'Synced lyrics', desc: 'Word-by-word timing for karaoke.', icon: ListMusic, fields: [] },
{ id: 'cover_image', label: 'AI cover art', desc: 'New cover artwork made for this song.', icon: ImageIcon, fields: [] },
{ id: 'persona', label: 'Create persona', desc: 'Save this voice and reuse it in new songs.', icon: UserRound, fields: [
  { key: 'name', label: 'Persona name', type: 'text', max: 80, required: true },
  { key: 'description', label: 'Describe the voice', type: 'text', max: 300, required: true, placeholder: 'e.g. warm male tenor, Caribbean accent' },
  { key: 'vocal_start', label: 'Voice starts at second', type: 'number' },
  { key: 'vocal_end', label: 'Voice ends at second (10–30 s later)', type: 'number' }]
},
{ id: 'lyrics', label: 'Generate lyrics', desc: 'Full song lyrics from a short idea.', icon: PenLine, fields: [{ key: 'prompt', label: 'Your idea', type: 'textarea', max: 200, required: true, placeholder: 'e.g. a summer love story in Santo Domingo' }] }];


const SONG_TOOLS: KieService[] = ['extend', 'cover', 'add_vocals', 'add_instrumental', 'replace_section', 'wav', 'video', 'timestamped_lyrics', 'cover_image', 'persona'];
const FILE_TOOLS: KieService[] = ['cover', 'upload_extend', 'add_vocals', 'add_instrumental', 'lyrics'];

const input = 'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The song to work on; null opens the "upload audio" tools. */
  song: StudioSong | null;
  creation?: Creation;
}

/** Kie Suno services for one song (or an uploaded file): each run charges the credits shown. */
export function KieToolsModal({ open, onClose, song, creation }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { credits, artist, plan, refresh } = useAccount();
  const [prices, setPrices] = useState<Record<string, KiePrice>>({});
  const [tool, setTool] = useState<KieService>(song ? 'extend' : 'cover');
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [upload, setUpload] = useState<{url: string;name: string;} | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{text: string;error?: boolean;} | null>(null);
  const [tasks, setTasks] = useState<KieTask[]>([]);

  const aiSong = Boolean(song && creation && (creation.provider_slug === 'kie-suno' || creation.provider_slug === 'kie-suno-jobs') && creation.items?.[song.index]?.id);
  const available = useMemo(() => TOOLS.filter((x) => (song ? SONG_TOOLS : FILE_TOOLS).includes(x.id) && prices[x.id]?.enabled !== false), [song, prices]);
  const current = TOOLS.find((x) => x.id === tool) ?? available[0];
  const locked = Boolean(song && NEEDS_AI_SONG.includes(tool) && !aiSong);
  const planLocked = Boolean(prices[tool]) && !planAllows(prices[tool], plan?.slug);
  const needsFile = !song && tool !== 'lyrics';
  const cost = prices[tool]?.user_credits ?? 0;

  // Primitive keys: the parent rebuilds `song` objects on every refresh, which must not reset the form.
  const songKey = song?.key ?? null;
  const creationId = song?.creationId ?? null;
  const songIndex = song?.index ?? 0;
  const loadTasks = useCallback(async () => {
    if (!user) return;
    const list = await fetchKieTasks(user.id, creationId);
    setTasks(creationId ? list.filter((x) => x.item_index === songIndex) : list);
  }, [user, creationId, songIndex]);

  useEffect(() => {
    if (!open) return;
    void fetchKiePrices().then(setPrices);
    void loadTasks();
    setNote(null);
    setUpload(null);
    setValues({ title: song?.title ?? '', style: song?.style ?? '', full_lyrics: song?.lyrics ?? '', author: artist?.name ?? '', vocal: 'any' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, songKey]);

  const pending = tasks.filter((x) => x.status === 'generating').map((x) => x.id).join(',');
  useEffect(() => {
    if (!open || !pending) return;
    const timer = window.setInterval(() => {
      void Promise.all(pending.split(',').map((id) => refreshKieTask(id))).then(() => loadTasks()).then(() => refresh());
    }, 6000);
    return () => window.clearInterval(timer);
  }, [open, pending, loadTasks, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined' || !current) return null;

  async function pickFile(file: File | undefined) {
    if (!file || !user) return;
    setNote(null);
    if (!file.type.startsWith('audio/')) return setNote({ text: t('Choose an audio file (MP3, WAV, M4A).'), error: true });
    if (file.size > 50 * 1024 * 1024) return setNote({ text: t('The file is larger than 50 MB.'), error: true });
    const seconds = await audioDuration(file);
    if (seconds > 480) return setNote({ text: t('The audio can be up to 8 minutes long.'), error: true });
    setUploading(true);
    const res = await uploadMedia(user.id, file, 'kie-uploads');
    setUploading(false);
    if (res.error || !res.url) return setNote({ text: t(res.error ?? 'Upload failed'), error: true });
    setUpload({ url: res.url, name: file.name });
  }

  async function submit() {
    if (!current) return;
    for (const f of current.fields) {
      if (f.required && !String(values[f.key] ?? '').trim()) return setNote({ text: t('Fill in “{field}”.', { field: t(f.label) }), error: true });
    }
    if (needsFile && !upload) return setNote({ text: t('Upload an audio file first'), error: true });
    setBusy(true);
    setNote(null);
    const params: Record<string, unknown> = {};
    for (const f of current.fields) {
      const v = values[f.key];
      if (f.type === 'toggle') params[f.key] = Boolean(v);else
      if (f.type === 'vocal') {if (v === 'm' || v === 'f') params.vocal = v;} else
      if (v !== undefined && String(v).trim() !== '') params[f.key] = f.type === 'number' ? Number(v) : String(v).trim();
    }
    if (upload) params.upload_url = upload.url;
    const { data, error } = await runKie(tool, song ? { creation_id: song.creationId, index: song.index } : null, params);
    setBusy(false);
    void refresh();
    if (error || !data) return setNote({ text: t(error ?? 'Something went wrong'), error: true });
    if (data.kind === 'creation') {
      setNote({ text: t('Started! The new song will appear in your workspace in a few minutes.') });
      window.dispatchEvent(new Event('qamuz:creations-updated'));
    } else {
      setNote({ text: t('Started! The result will appear below.') });
      await loadTasks();
    }
  }

  const set = (k: string, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }));

  return createPortal(
    <div data-ev-id="ev_km_bg" className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div data-ev-id="ev_km_panel" role="dialog" aria-modal="true" aria-label={t('AI tools')} onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl shadow-black/60 sm:rounded-2xl">
        <header data-ev-id="ev_km_head" className="flex items-center gap-3 border-b border-border px-4 py-3">
          {song ?
          <img data-ev-id="ev_km_cover" src={coverUrl(song.coverUrl)} alt="" width={44} height={44} className="h-11 w-11 flex-none rounded-lg object-cover" /> :
          <span data-ev-id="ev_km_icon" className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary/15 text-primary"><Upload className="h-5 w-5" /></span>
          }
          <div data-ev-id="ev_km_titles" className="flex min-w-0 flex-1 flex-col">
            <span data-ev-id="ev_km_kicker" className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary"><Sparkles className="h-3 w-3" /> {t('AI tools')}</span>
            <h2 data-ev-id="ev_km_title" className="truncate text-base font-black tracking-tight">{song ? song.title : t('Upload your audio')}</h2>
          </div>
          <span data-ev-id="ev_km_credits" className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold tabular-nums sm:flex"><Coins className="h-3.5 w-3.5 text-primary" /> {credits ?? 0}</span>
          <button data-ev-id="ev_km_close" type="button" onClick={onClose} aria-label={t('Close')} className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </header>

        <div data-ev-id="ev_km_body" className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[260px_1fr] md:overflow-hidden">
          <nav data-ev-id="ev_km_tools" aria-label={t('AI tools')} className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-border p-3 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
            {available.map((x) => {
              const Icon = x.icon;
              const on = x.id === tool;
              const off = Boolean(song && NEEDS_AI_SONG.includes(x.id) && !aiSong);
              return (
                <button data-ev-id="ev_km_tool" key={x.id} type="button" onClick={() => {setTool(x.id);setNote(null);}} aria-pressed={on} className={`flex min-w-[150px] flex-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors md:min-w-0 ${on ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-surface-2'} ${off ? 'opacity-50' : ''}`}>
                  <Icon className="h-4 w-4 flex-none" />
                  <span data-ev-id="ev_km_tool_l" className="min-w-0 flex-1 truncate text-sm font-semibold">{t(x.label)}</span>
                  {prices[x.id] && !planAllows(prices[x.id], plan?.slug) ?
                  <Lock aria-label={t('Paid plans only')} className="h-3.5 w-3.5 flex-none text-muted-foreground" /> :
                  <span data-ev-id="ev_km_tool_c" className="flex-none text-[11px] font-bold tabular-nums text-muted-foreground">{prices[x.id]?.user_credits ?? '·'}</span>
                  }
                </button>);

            })}
          </nav>

          <div data-ev-id="ev_km_main" className="flex min-h-0 flex-col gap-4 p-4 md:overflow-y-auto">
            <div data-ev-id="ev_km_intro" className="flex flex-col gap-1">
              <h3 data-ev-id="ev_km_tool_t" className="text-lg font-black tracking-tight text-balance">{t(current.label)}</h3>
              <p data-ev-id="ev_km_tool_d" className="text-sm text-pretty text-muted-foreground">{t(current.desc)}</p>
            </div>

            {locked ?
            <p data-ev-id="ev_km_locked" className="rounded-lg bg-surface-2 p-3 text-sm text-pretty text-muted-foreground">{t('This option only works with songs created in Qamuz AI')}</p> :
            planLocked ?
            <div data-ev-id="ev_km_plan" className="flex flex-col items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <span data-ev-id="ev_km_plan_t" className="flex items-start gap-2 text-sm text-pretty"><Lock className="mt-0.5 h-4 w-4 flex-none text-primary" /> {t('This tool is included in the Pro, Artista and Empresa plans. Upgrade your plan to use it.')}</span>
                <Link data-ev-id="ev_km_plan_l" to="/planes" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">{t('See plans')}</Link>
              </div> :

            <form data-ev-id="ev_km_form" className="flex flex-col gap-3" onSubmit={(e) => {e.preventDefault();void submit();}}>
                {needsFile &&
              <label data-ev-id="ev_km_file" className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 p-3 hover:border-primary">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
                    <span data-ev-id="ev_km_file_t" className="flex min-w-0 flex-col">
                      <span data-ev-id="ev_km_file_n" className="truncate text-sm font-semibold">{upload ? upload.name : t('Choose an audio file')}</span>
                      <span data-ev-id="ev_km_file_h" className="text-[11px] text-muted-foreground">{t('MP3, WAV or M4A · up to 8 minutes')}</span>
                    </span>
                    <input data-ev-id="ev_km_file_i" type="file" accept="audio/*" className="sr-only" disabled={uploading} onChange={(e) => void pickFile(e.target.files?.[0])} />
                  </label>
              }

                {current.fields.map((f) =>
              f.type === 'toggle' ?
              <label data-ev-id="ev_km_toggle" key={f.key} className="flex items-center gap-2 text-sm font-semibold">
                      <input data-ev-id="ev_km_toggle_i" type="checkbox" checked={Boolean(values[f.key])} onChange={(e) => set(f.key, e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                      {t(f.label)}
                    </label> :
              f.type === 'vocal' ?
              values.instrumental ? null :
              <div data-ev-id="ev_km_vocal" key={f.key} className="flex flex-col gap-1.5">
                      <span data-ev-id="ev_km_vocal_l" className="text-xs font-bold">{t(f.label)}</span>
                      <div data-ev-id="ev_km_vocal_o" className="flex gap-1.5">
                        {[{ id: 'any', label: 'Any' }, { id: 'm', label: 'Male' }, { id: 'f', label: 'Female' }].map((o) =>
                  <button data-ev-id="ev_km_vocal_b" key={o.id} type="button" onClick={() => set('vocal', o.id)} className={`h-8 rounded-lg border px-3 text-xs font-bold ${values.vocal === o.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{t(o.label)}</button>
                  )}
                      </div>
                    </div> :

              <label data-ev-id="ev_km_field" key={f.key} className="flex flex-col gap-1.5">
                      <span data-ev-id="ev_km_field_l" className="text-xs font-bold">{t(f.label)}{f.required && <span data-ev-id="ev_1942f5e743" className="text-primary"> *</span>}</span>
                      {f.type === 'textarea' ?
                <textarea data-ev-id="ev_km_field_ta" rows={f.key === 'full_lyrics' ? 6 : 4} maxLength={f.max} value={String(values[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder ? t(f.placeholder) : undefined} className={`${input} resize-y`} /> :
                <input data-ev-id="ev_km_field_i" type={f.type === 'number' ? 'number' : 'text'} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 0.1 : undefined} maxLength={f.max} value={String(values[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder ? t(f.placeholder) : undefined} className={input} />
                }
                    </label>
              )}

                <div data-ev-id="ev_km_actions" className="flex flex-wrap items-center gap-3 pt-1">
                  <button data-ev-id="ev_km_submit" type="submit" disabled={busy || uploading || (credits ?? 0) < cost} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {t('Run · {count} credits', { count: cost })}
                  </button>
                  {(credits ?? 0) < cost && <span data-ev-id="ev_km_nocred" className="text-xs text-destructive">{t('You need {count} credits', { count: cost })}</span>}
                  {SONG_SERVICES.includes(tool) && <span data-ev-id="ev_km_hint" className="text-xs text-muted-foreground">{t('Creates a new song; the original stays untouched.')}</span>}
                </div>
              </form>
            }

            {note && <p data-ev-id="ev_km_note" role="status" className={`rounded-lg px-3 py-2 text-xs ${note.error ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{note.text}</p>}

            {user && tasks.length > 0 &&
            <section data-ev-id="ev_km_results" className="flex flex-col gap-2 border-t border-border pt-4">
                <h4 data-ev-id="ev_km_results_t" className="text-sm font-bold">{t('Results')}</h4>
                <KieTaskList tasks={tasks} userId={user.id} onDeleted={(id) => setTasks((list) => list.filter((x) => x.id !== id))} />
              </section>
            }
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}