import { useState, type ReactNode } from 'react';
import { AudioWaveform, Disc3, Loader2, Mic, Music2, Sparkles, Wand2, X } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { invokeStudio, type CreationKind } from '@/lib/studio';
import { checkModalHealth, writeLyricsWithModal } from '@/lib/modalClient';
import { StudioTemplatesModal } from '@/components/studio/StudioTemplatesModal';
import { MakeABeatModal } from '@/components/studio/MakeABeatModal';
import { ReferenceAudioModal, type ReferenceAudio } from '@/components/studio/ReferenceAudioModal';
import { VocalSelectorModal, type VocalPersona } from '@/components/studio/VocalSelectorModal';
import type { MusicTemplate } from '@/lib/music-templates';

export interface ProviderInfo {
  name: string;
  kind: string;
  is_active: boolean;
  credit_cost: number;
}

/** Values used to pre-fill the form (Remix/Edit, links from the player menu). */
export interface FormSeed {
  mode?: 'simple' | 'custom';
  prompt?: string;
  lyrics?: string;
  style?: string;
  title?: string;
  /** Voice style pre-selected from the Home «Character» section. */
  persona?: VocalPersona;
}

const MUSIC_STYLES = ['Pop', 'Reggaeton', 'Bachata', 'Rock', 'Electronic', 'Lo-fi', 'Ballad', 'Trap', 'Jazz', 'Cumbia', 'Acoustic'];
const IMAGE_STYLES = ['Photographic', 'Illustration', 'Neon', 'Watercolor', '3D render', 'Album cover'];
const SIZES = [
{ id: '1024x1024', label: 'Square' },
{ id: '1536x1024', label: 'Landscape' },
{ id: '1024x1536', label: 'Portrait' }];

type Vocal = 'any' | 'm' | 'f';

interface StudioFormProps {
  kind: CreationKind;
  provider: ProviderInfo | null;
  credits: number | null;
  submitting: boolean;
  seed?: FormSeed | null;
  onSubmit: (prompt: string, options: Record<string, unknown>) => void;
}

function Card({ children }: {children: ReactNode;}) {
  return <div data-ev-id="ev_sf_card" className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">{children}</div>;
}

const areaClass = 'w-full resize-y bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-40';

/** Left-side creation panel: Simple / Custom modes for music, prompt + format for images. */
export function StudioForm({ kind, provider, credits, submitting, seed, onSubmit }: StudioFormProps) {
  const { t, locale } = useI18n();
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [mode, setMode] = useState<'simple' | 'custom'>(seed?.mode ?? (seed?.lyrics ? 'custom' : 'simple'));
  const [prompt, setPrompt] = useState(seed?.prompt ?? '');
  const [lyrics, setLyrics] = useState(seed?.lyrics ?? '');
  const [style, setStyle] = useState(seed?.style ?? '');
  const [title, setTitle] = useState(seed?.title ?? '');
  const [instrumental, setInstrumental] = useState(false);
  const [vocal, setVocal] = useState<Vocal>(seed?.persona?.gender === 'male' ? 'm' : seed?.persona?.gender === 'female' ? 'f' : 'any');
  const [size, setSize] = useState('1024x1024');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBeatMaker, setShowBeatMaker] = useState(false);
  const [referenceAudio, setReferenceAudio] = useState<ReferenceAudio | null>(null);
  const [showRefModal, setShowRefModal] = useState(false);
  const [vocalPersona, setVocalPersona] = useState<VocalPersona | null>(seed?.persona ?? null);
  const [showVocalModal, setShowVocalModal] = useState(false);

  function handleSelectVocalPersona(p: VocalPersona | null) {
    setVocalPersona(p);
    if (p) {
      if (p.gender === 'male') setVocal('m');else
      if (p.gender === 'female') setVocal('f');
    }
  }

  function handleApplyBeat(beatPrompt: string, styleText: string, suggestedTitle: string) {
    setInstrumental(true);
    if (custom) {
      setStyle(styleText);
      if (!title.trim()) setTitle(suggestedTitle);
      if (!lyrics.trim()) setLyrics('[Instrumental Beat]');
    } else {
      setPrompt(beatPrompt);
      setStyle(styleText.split(',')[0] || 'Bachata');
    }
  }

  function handleApplyTemplate(tmpl: MusicTemplate) {
    if (custom) {
      setStyle(tmpl.stylePrompt);
      if (!title.trim() && tmpl.suggestedTitle) {
        setTitle(tmpl.suggestedTitle);
      }
    } else {
      setPrompt(`${tmpl.name}: ${tmpl.mood}. ${tmpl.instruments.join(', ')}.`);
      setStyle(tmpl.tags[0] || 'Pop');
    }
  }

  /** Adds a Last.fm trend tag where the user can see it: style box (Custom) or description box (Simple). */
  function handleApplyTag(tagName: string) {
    const tag = tagName.trim();
    if (!tag) return;
    if (custom) {
      const parts = style.split(',').map((p) => p.trim()).filter(Boolean);
      if (!parts.some((p) => p.toLowerCase() === tag.toLowerCase())) setStyle([...parts, tag].join(', ').slice(0, 1000));
      return;
    }
    const current = prompt.trim();
    if (current.toLowerCase().includes(tag.toLowerCase())) return;
    setPrompt((current ? `${current}, ${tag}` : tag).slice(0, 450));
  }

  const available = Boolean(provider?.is_active);
  const cost = provider?.credit_cost ?? 0;
  const notEnough = credits !== null && credits < cost;
  const custom = kind === 'music' && mode === 'custom';
  const ready = custom ? instrumental ? style.trim().length >= 3 : lyrics.trim().length >= 3 || style.trim().length >= 3 : prompt.trim().length >= 3;

  function addStyle(s: string) {
    if (custom) {
      const parts = style.split(',').map((p) => p.trim()).filter(Boolean);
      const has = parts.some((p) => p.toLowerCase() === s.toLowerCase());
      setStyle((has ? parts.filter((p) => p.toLowerCase() !== s.toLowerCase()) : [...parts, s]).join(', '));
    } else {
      setStyle(style === s ? '' : s);
    }
  }

  async function writeLyrics() {
    if (writing) return;
    setWriting(true);
    setWriteError('');

    const modalHealth = await checkModalHealth();
    if ((modalHealth.visionConfigured && modalHealth.visionAuthOk) || modalHealth.vllmConfigured) {
      const modalRes = await writeLyricsWithModal({
        idea: prompt || title || style,
        style,
        title,
        lyrics,
        mode: lyrics.trim() ? 'optimize' : 'lyrics',
        language: locale,
      });
      setWriting(false);
      if (modalRes.lyrics && modalRes.lyrics.trim()) {
        setLyrics(modalRes.lyrics.trim());
        return;
      }
      if (modalRes.error) {
        setWriteError(modalRes.error);
        return;
      }
    }

    const { data, error } = await invokeStudio<{lyrics?: string;call_id?: string;}>({ action: 'lyrics_write', idea: prompt, style, title, lyrics, lang: locale });
    let text = data?.lyrics ?? '';
    let failure = error ?? '';
    if (!failure && !text && data?.call_id) {
      // The Modal engine works in the background: check every 3 s for up to 6 minutes (first run warms up the GPU).
      failure = 'The lyrics engine took too long. Try again.';
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => window.setTimeout(r, 3000));
        const res = await invokeStudio<{status: string;lyrics?: string;error?: string;}>({ action: 'lyrics_status', call_id: data.call_id });
        if (res.error || res.data?.status === 'FAILED') {
          failure = res.error ?? res.data?.error ?? 'The lyrics engine did not respond. Try again.';
          break;
        }
        if (res.data?.status === 'SUCCESS') {
          text = res.data.lyrics ?? '';
          failure = '';
          break;
        }
      }
    }
    if ((failure || !text.trim()) && modalHealth.geminiConfigured) {
      const fallbackRes = await writeLyricsWithModal({
        idea: prompt || title || style,
        style,
        title,
        lyrics,
        mode: lyrics.trim() ? 'optimize' : 'lyrics',
        language: locale,
      });
      if (fallbackRes.lyrics && fallbackRes.lyrics.trim()) {
        setWriting(false);
        setLyrics(fallbackRes.lyrics.trim());
        return;
      }
    }
    setWriting(false);
    if (failure || !text.trim()) {
      setWriteError(t(failure || 'The lyrics engine returned nothing. Try again.'));
      return;
    }
    setLyrics(text.trim());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    if (kind === 'image') {
      onSubmit(prompt.trim(), { style, size });
      return;
    }
    const refOptions = referenceAudio ? {
      reference_audio_url: referenceAudio.url,
      reference_audio_name: referenceAudio.name,
      reference_bpm: referenceAudio.bpm
    } : {};

    const personaOptions = vocalPersona ? {
      vocal_persona: vocalPersona.name,
      vocal_persona_id: vocalPersona.id,
      vocal_tags: vocalPersona.tags
    } : {};

    if (custom) {
      const main = (instrumental ? style : lyrics.trim() || style).trim();
      onSubmit(main, {
        custom: true,
        lyrics: instrumental ? '' : lyrics.trim(),
        style: style.trim(),
        title: title.trim(),
        instrumental,
        vocal: instrumental ? 'any' : vocal,
        ...refOptions,
        ...personaOptions
      });
      return;
    }
    const voice = instrumental || vocal === 'any' ? '' : vocal === 'm' ? ', male vocals' : ', female vocals';
    const personaTag = vocalPersona ? `, vocals performed in the artistic style of ${vocalPersona.name}` : '';
    onSubmit(`${prompt.trim()}${voice}${personaTag}`, {
      style,
      instrumental,
      ...refOptions,
      ...personaOptions
    });
  }

  const chip = (on: boolean) => `inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`;
  const styleOn = (s: string) => custom ? style.split(',').some((p) => p.trim().toLowerCase() === s.toLowerCase()) : style === s;
  const toolBtn = 'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors';
  const toolRow =
  <div data-ev-id="ev_sf_tools" className="grid grid-cols-3 gap-1.5">
      <button data-ev-id="ev_sf_tool_ref" type="button" onClick={() => setShowRefModal(true)} title={t('Usa un audio de referencia para condicionar el estilo')} className={`${toolBtn} ${referenceAudio ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300' : 'border-border text-muted-foreground hover:border-cyan-500/40 hover:text-cyan-400'}`}>
        <AudioWaveform className="h-3.5 w-3.5 flex-none" />
        <span data-ev-id="ev_sf_tool_ref_l" className="truncate">{t('Referencia')}</span>
      </button>
      <button data-ev-id="ev_sf_tool_beat" type="button" onClick={() => setShowBeatMaker(true)} className={`${toolBtn} border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-black`}>
        <Disc3 className="h-3.5 w-3.5 flex-none" />
        <span data-ev-id="ev_sf_tool_beat_l" className="truncate">{t('Crear Beat')}</span>
      </button>
      <button data-ev-id="ev_sf_tool_tpl" type="button" onClick={() => setShowTemplates(true)} className={`${toolBtn} border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground`}>
        <Sparkles className="h-3.5 w-3.5 flex-none" />
        <span data-ev-id="ev_sf_tool_tpl_l" className="truncate">{t('Plantillas')}</span>
      </button>
    </div>;

  const refChip = referenceAudio &&
  <div data-ev-id="ev_sf_ref_chip" className="flex items-center justify-between gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-2 text-xs">
      <div data-ev-id="ev_sf_ref_info" className="flex min-w-0 items-center gap-2">
        <AudioWaveform className="h-4 w-4 flex-none text-cyan-400" />
        <span data-ev-id="ev_sf_ref_name" className="truncate font-semibold text-foreground">{referenceAudio.name}</span>
        {referenceAudio.bpm && <span data-ev-id="ev_sf_ref_bpm" className="flex-none rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">{referenceAudio.bpm} BPM</span>}
      </div>
      <div data-ev-id="ev_sf_ref_acts" className="flex flex-none items-center gap-2">
        <button data-ev-id="ev_sf_ref_change" type="button" onClick={() => setShowRefModal(true)} className="text-[11px] font-semibold text-cyan-400 hover:underline">{t('Cambiar')}</button>
        <button data-ev-id="ev_sf_ref_rm" type="button" onClick={() => setReferenceAudio(null)} aria-label={t('Clear')} className="rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>;

  const placeholder = kind === 'image' ? t('Album cover: an astronaut floating over a sea of green lights') : t('A summer song about coming home, female vocals, bright guitars and a danceable beat');

  return (
    <form data-ev-id="ev_sf_form" onSubmit={handleSubmit} className="flex flex-col gap-3">
      {kind === 'music' &&
      <div data-ev-id="ev_sf_modes" role="tablist" className="flex items-center gap-5 border-b border-border">
          {(['simple', 'custom'] as const).map((m) =>
        <button data-ev-id="ev_sf_mode" key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`-mb-px border-b-2 pb-2 text-sm font-bold transition-colors ${mode === m ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {m === 'simple' ? t('Simple') : t('Custom')}
            </button>
        )}
        </div>
      }

      {custom ?
      <>
          <Card>
            <div data-ev-id="ev_sf_lyr_h" className="flex flex-wrap items-center justify-between gap-2">
              <span data-ev-id="ev_sf_lyr_l" className="text-sm font-bold">{t('Lyrics')}</span>
              <div data-ev-id="ev_sf_lyr_acts" className="flex items-center gap-1">
              <button data-ev-id="ev_sf_lyr_ai" type="button" onClick={() => void writeLyrics()} disabled={writing || instrumental || !(title.trim() || style.trim() || lyrics.trim())} title={t('Add a title or style, then let AI write the lyrics')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40">
                {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {writing ? t('Writing lyrics...') : lyrics.trim() ? t('Improve with AI') : t('Write with AI')}
              </button>
              {lyrics &&
              <button data-ev-id="ev_sf_lyr_clear" type="button" onClick={() => setLyrics('')} aria-label={t('Clear')} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              }
              </div>
            </div>
            {writeError && <p data-ev-id="ev_sf_lyr_err" role="alert" className="text-xs text-destructive">{writeError}</p>}
            <textarea data-ev-id="ev_sf_lyr" value={lyrics} onChange={(e) => setLyrics(e.target.value)} disabled={instrumental} rows={9} maxLength={5000} placeholder={t('Enter lyrics here or leave blank for instrumental')} className={areaClass} />
            <div data-ev-id="ev_sf_lyr_f" className="flex items-center justify-between gap-2">
              <label data-ev-id="ev_sf_inst" className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
                {t('Instrumental')}
                <input data-ev-id="ev_sf_inst_i" type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} className="peer sr-only" />
                <span data-ev-id="ev_sf_inst_t" className="relative h-5 w-9 rounded-full bg-surface-3 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
              </label>
              <span data-ev-id="ev_sf_lyr_n" className="text-[11px] tabular-nums text-muted-foreground">{lyrics.length}/5000</span>
            </div>
          </Card>

          <Card>
            <span data-ev-id="ev_sf_sty_l" className="text-sm font-bold">{t('Music style')}</span>
            {toolRow}
            {refChip}
            <textarea data-ev-id="ev_sf_sty" value={style} onChange={(e) => setStyle(e.target.value)} rows={3} maxLength={1000} placeholder={t('Enter style, mood, instruments, etc. to control the generated music')} className={areaClass} />
            <div data-ev-id="ev_sf_sty_c" className="flex flex-wrap gap-1.5">
              {MUSIC_STYLES.map((s) =>
            <button data-ev-id="ev_sf_sty_b" key={s} type="button" onClick={() => addStyle(t(s))} className={chip(styleOn(t(s)))}>{t(s)}</button>
            )}
            </div>
          </Card>
        </> :

      <Card>
          <span data-ev-id="ev_sf_desc_l" className="text-sm font-bold">{kind === 'music' ? t('Song description') : t('Describe your idea')}</span>
          {kind === 'music' && toolRow}
          {kind === 'music' && refChip}
          <textarea data-ev-id="ev_sf_desc" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} maxLength={kind === 'music' ? 450 : 1000} placeholder={placeholder} className={areaClass} />
          <div data-ev-id="ev_sf_desc_c" className="flex flex-wrap gap-1.5">
            {(kind === 'music' ? MUSIC_STYLES : IMAGE_STYLES).map((s) =>
          <button data-ev-id="ev_sf_desc_b" key={s} type="button" onClick={() => addStyle(s)} className={chip(styleOn(s))}>{t(s)}</button>
          )}
          </div>
          {kind === 'music' &&
        <label data-ev-id="ev_sf_inst2" className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
              {t('Instrumental')}
              <input data-ev-id="ev_sf_inst2_i" type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} className="peer sr-only" />
              <span data-ev-id="ev_sf_inst2_t" className="relative h-5 w-9 rounded-full bg-surface-3 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
            </label>
        }
        </Card>
      }

      {kind === 'music' && !instrumental &&
      <div data-ev-id="ev_sf_vocal" className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
          <span data-ev-id="ev_sf_vocal_l" className="text-sm font-bold">{t('Vocal')}</span>
          <div data-ev-id="ev_sf_vocal_row" className="flex flex-wrap items-center gap-2">
              <button data-ev-id="ev_bff00446f4"
          type="button"
          onClick={() => setShowVocalModal(true)}
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
          vocalPersona ?
          'border-purple-400 bg-purple-500/20 text-purple-300' :
          'border-white/10 bg-white/5 text-muted-foreground hover:border-purple-500/40 hover:text-purple-400'}`
          }
          title={t('Elegir o diseñar una identidad vocal de artista')}>
            
                <Mic className="h-3.5 w-3.5" />
                {vocalPersona ? t('Voz Asignada') : t('Elegir Persona')}
              </button>
              <div data-ev-id="ev_sf_vocal_c" className="ml-auto flex items-center gap-0.5 rounded-lg bg-surface-3 p-0.5">
                {([['any', t('Any')], ['m', t('Male')], ['f', t('Female')]] as [Vocal, string][]).map(([id, label]) =>
            <button
              data-ev-id="ev_sf_vocal_b"
              key={id}
              type="button"
              aria-pressed={vocal === id}
              onClick={() => {
                setVocal(id);
                if (vocalPersona && (id === 'm' && vocalPersona.gender === 'female' || id === 'f' && vocalPersona.gender === 'male')) {
                  setVocalPersona(null);
                }
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              vocal === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`
              }>
              
                    {label}
                  </button>
            )}
              </div>
          </div>

          {vocalPersona &&
        <div data-ev-id="ev_a6a8371ae9" className="flex items-center justify-between rounded-lg border border-purple-500/30 bg-purple-950/30 px-3 py-1.5 text-xs">
              <div data-ev-id="ev_320625b16c" className="flex items-center gap-2 min-w-0">
                <span data-ev-id="ev_3c29edd28b" className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${vocalPersona.accentColor} flex-none`} />
                <span data-ev-id="ev_5b68350d45" className="font-bold text-foreground truncate">{vocalPersona.name}</span>
                <span data-ev-id="ev_f2519c674f" className="text-[10px] text-purple-300 font-medium truncate">({vocalPersona.genre})</span>
              </div>
              <div data-ev-id="ev_00b0df84c9" className="flex flex-none items-center gap-2">
                <button data-ev-id="ev_884c5528a3"
            type="button"
            onClick={() => setShowVocalModal(true)}
            className="text-[11px] font-semibold text-purple-400 hover:underline">
              
                  {t('Cambiar')}
                </button>
                <button data-ev-id="ev_3816a08873"
            type="button"
            onClick={() => setVocalPersona(null)}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground">
              
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
        }
        </div>
      }

      {custom &&
      <label data-ev-id="ev_sf_title" className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <input data-ev-id="ev_sf_title_i" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t('Enter song title')} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          <span data-ev-id="ev_sf_title_n" className="text-[11px] tabular-nums text-muted-foreground">{title.length}/80</span>
        </label>
      }

      {kind === 'image' &&
      <div data-ev-id="ev_sf_size" className="flex flex-col gap-2 rounded-xl bg-surface-2 p-4">
          <span data-ev-id="ev_sf_size_l" className="text-sm font-bold">{t('Format')}</span>
          <div data-ev-id="ev_sf_size_c" className="grid grid-cols-3 gap-2">
            {SIZES.map((s) =>
          <button data-ev-id="ev_sf_size_b" key={s.id} type="button" onClick={() => setSize(s.id)} className={`${chip(size === s.id)} justify-center`}>{t(s.label)}</button>
          )}
          </div>
        </div>
      }

      {!available &&
      <p data-ev-id="ev_sf_noprov" className="rounded-xl border border-border px-4 py-3 text-xs text-pretty text-muted-foreground">
          {t('There is no active provider for creating {what} yet. The administrator can enable it in the dashboard.', { what: kind === 'image' ? t('images') : t('music') })}
        </p>
      }

      <div data-ev-id="ev_sf_foot" className="sticky bottom-0 z-10 flex flex-col gap-1.5 bg-background pb-1 pt-2">
        <button data-ev-id="ev_sf_submit" type="submit" disabled={!available || submitting || notEnough || !ready} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : kind === 'music' ? <Music2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {t('Create')}
        </button>
        <span data-ev-id="ev_sf_cost" className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">



        </span>
      </div>

      <StudioTemplatesModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onApplyTemplate={handleApplyTemplate}
        onApplyTag={handleApplyTag} />
      

      <MakeABeatModal
        isOpen={showBeatMaker}
        onClose={() => setShowBeatMaker(false)}
        onSubmit={handleApplyBeat} />
      

      <ReferenceAudioModal
        isOpen={showRefModal}
        current={referenceAudio}
        onClose={() => setShowRefModal(false)}
        onApply={setReferenceAudio} />
      

      <VocalSelectorModal
        isOpen={showVocalModal}
        selected={vocalPersona}
        onClose={() => setShowVocalModal(false)}
        onSelect={handleSelectVocalPersona} />
      
    </form>);

}