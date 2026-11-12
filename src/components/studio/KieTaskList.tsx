import { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { copyText, deleteKieTask, wordsToLrc, type KieTask } from '@/lib/kie';

const LABELS: Record<string, string> = {
  wav: 'Studio WAV',
  video: 'Music video MP4',
  timestamped_lyrics: 'Synced lyrics',
  cover_image: 'AI cover art',
  persona: 'Create persona',
  lyrics: 'Generate lyrics'
};

const linkBtn = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary';

function CopyButton({ text }: {text: string;}) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button data-ev-id="ev_kt_copy" type="button" onClick={() => {copyText(text);setDone(true);window.setTimeout(() => setDone(false), 1500);}} className={linkBtn}>
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? t('Copied') : t('Copy')}
    </button>);

}

function Result({ task }: {task: KieTask;}) {
  const { t } = useI18n();
  const r = task.result ?? {};
  if (task.service === 'wav' && typeof r.url === 'string') {
    return <a data-ev-id="ev_kt_wav" href={r.url} target="_blank" rel="noreferrer" download className={linkBtn}><Download className="h-3.5 w-3.5" /> {t('Download WAV')}</a>;
  }
  if (task.service === 'video' && typeof r.url === 'string') {
    return (
      <div data-ev-id="ev_kt_video" className="flex flex-col gap-2">
        <video data-ev-id="ev_kt_video_el" src={r.url} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
        <a data-ev-id="ev_kt_video_dl" href={r.url} target="_blank" rel="noreferrer" download className={`${linkBtn} self-start`}><Download className="h-3.5 w-3.5" /> {t('Download MP4')}</a>
      </div>);

  }
  if (task.service === 'cover_image' && Array.isArray(r.images)) {
    return (
      <div data-ev-id="ev_kt_imgs" className="grid grid-cols-2 gap-2">
        {(r.images as string[]).map((src) =>
        <a data-ev-id="ev_kt_img" key={src} href={src} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-lg">
            <img data-ev-id="ev_kt_img_el" src={src} alt={t('AI cover art')} loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
            <ExternalLink className="absolute right-2 top-2 h-4 w-4 text-white opacity-0 drop-shadow group-hover:opacity-100" />
          </a>
        )}
      </div>);

  }
  if (task.service === 'lyrics' && Array.isArray(r.lyrics)) {
    return (
      <div data-ev-id="ev_kt_lyrics" className="flex flex-col gap-3">
        {(r.lyrics as {title: string;text: string;}[]).map((l, i) =>
        <div data-ev-id="ev_kt_lyric" key={i} className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
            <div data-ev-id="ev_kt_lyric_h" className="flex items-center justify-between gap-2">
              <span data-ev-id="ev_kt_lyric_t" className="truncate text-xs font-bold">{l.title || t('Option {n}', { n: i + 1 })}</span>
              <CopyButton text={l.text} />
            </div>
            <pre data-ev-id="ev_kt_lyric_b" className="max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">{l.text}</pre>
          </div>
        )}
      </div>);

  }
  if (task.service === 'timestamped_lyrics' && Array.isArray(r.words)) {
    const words = r.words as {word: string;start: number;}[];
    const lrc = wordsToLrc(words);
    return (
      <div data-ev-id="ev_kt_sync" className="flex flex-col gap-2">
        <span data-ev-id="ev_kt_sync_n" className="text-xs text-muted-foreground">{t('{count} words synced', { count: words.length })}</span>
        <pre data-ev-id="ev_kt_sync_b" className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-xs leading-relaxed text-muted-foreground">{lrc}</pre>
        <div data-ev-id="ev_kt_sync_a"><CopyButton text={lrc} /></div>
      </div>);

  }
  if (task.service === 'persona') {
    return <p data-ev-id="ev_kt_persona" className="text-xs text-pretty text-primary">{t('Persona “{name}” saved. Pick it in “Choose persona” › “My voices”.', { name: String(r.name ?? '') })}</p>;
  }
  return null;
}

/** Results of the AI services that don't create a new song (WAV, video, lyrics, persona, cover art). */
export function KieTaskList({ tasks, userId, onDeleted }: {tasks: KieTask[];userId: string;onDeleted: (id: string) => void;}) {
  const { t, locale } = useI18n();
  if (tasks.length === 0) return null;
  return (
    <ul data-ev-id="ev_kt_list" className="flex flex-col gap-2">
      {tasks.map((task) =>
      <li data-ev-id="ev_kt_item" key={task.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <div data-ev-id="ev_kt_item_h" className="flex items-center justify-between gap-2">
            <div data-ev-id="ev_kt_item_meta" className="flex min-w-0 flex-col">
              <span data-ev-id="ev_kt_item_l" className="truncate text-sm font-bold">{t(LABELS[task.service] ?? task.service)}</span>
              <span data-ev-id="ev_kt_item_d" className="truncate text-[11px] text-muted-foreground">
                {new Date(task.created_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })} · {t('{count} credits', { count: task.credits_spent })}
                {task.service === 'lyrics' && task.title ? ` · ${task.title}` : ''}
              </span>
            </div>
            {task.status === 'generating' ?
          <span data-ev-id="ev_kt_item_gen" className="flex flex-none items-center gap-1 text-[11px] font-bold uppercase text-accent"><Loader2 className="h-3 w-3 animate-spin" /> {t('Working')}</span> :
          <button data-ev-id="ev_kt_item_del" type="button" aria-label={t('Delete')} title={t('Delete')} onClick={() => void deleteKieTask(task.id, userId).then((err) => !err && onDeleted(task.id))} className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
          }
          </div>
          {task.status === 'error' && <p data-ev-id="ev_kt_item_err" className="text-xs text-destructive">{task.error_message ?? t('The service failed')} · {t('Credits refunded')}</p>}
          {task.status === 'ready' && <Result task={task} />}
        </li>
      )}
    </ul>);

}
