import { useEffect, useState } from 'react';
import { Hand, Loader2, Play, RotateCcw, Save, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/hooks/usePlayer';
import { fetchLyrics } from '@/lib/queries';
import { fetchOwnTracks, toPlayable, type OwnTrack } from '@/lib/artist-panel';
import { formatLrcTime, parseLrc, toLrc, type DraftLine } from '@/lib/lrc';
import type { OwnedArtist } from '@/contexts/account-context';
import { TabBar } from '@/components/TabBar';
import { Field, GhostButton, Notice, PrimaryButton, Select, TextArea } from '@/components/ui/Field';
import { invokeStudio } from '@/lib/studio';

type Mode = 'lrc' | 'tap';

export function LyricsEditor({ artist }: {artist: OwnedArtist;}) {
  const { playTracks, seek, progress, current } = usePlayer();
  const [tracks, setTracks] = useState<OwnTrack[]>([]);
  const [trackId, setTrackId] = useState('');
  const [mode, setMode] = useState<Mode>('lrc');
  const [lrc, setLrc] = useState('');
  const [plain, setPlain] = useState('');
  const [tapped, setTapped] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [status, setStatus] = useState<{tone: 'error' | 'success';text: string;} | null>(null);

  useEffect(() => {
    void fetchOwnTracks(artist.id).then((data) => {
      setTracks(data);
      if (data[0]) setTrackId((prev) => prev || data[0].id);
    });
  }, [artist.id]);

  useEffect(() => {
    if (!trackId) return;
    setStatus(null);
    setTapped([]);
    void fetchLyrics(trackId).then((lines) => {
      setLrc(toLrc(lines));
      setPlain(lines.map((l) => l.text).join('\n'));
    });
  }, [trackId]);

  const track = tracks.find((t) => t.id === trackId);
  const plainLines = plain.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isCurrent = current?.id === trackId;

  function startTap() {
    if (!track) return;
    setTapped([]);
    playTracks([toPlayable(track, artist)], 0);
    window.setTimeout(() => seek(0), 300);
  }

  function mark() {
    if (tapped.length >= plainLines.length) return;
    setTapped((prev) => [...prev, { time_ms: Math.round(progress * 1000), text: plainLines[prev.length] }]);
  }

  async function generateWithAI() {
    if (aiWriting || !track) return;
    setAiWriting(true);
    setStatus(null);
    const { data, error } = await invokeStudio<{ lyrics?: string; call_id?: string }>({
      action: 'lyrics_write',
      idea: track.title,
      title: track.title,
      lyrics: plain || lrc,
      lang: 'es',
    });
    let text = data?.lyrics ?? '';
    let failure = error ?? '';
    if (!failure && !text && data?.call_id) {
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => window.setTimeout(r, 2500));
        const res = await invokeStudio<{ status: string; lyrics?: string; error?: string }>({
          action: 'lyrics_status',
          call_id: data.call_id,
        });
        if (res.error || res.data?.status === 'FAILED') {
          failure = res.error ?? res.data?.error ?? 'Error en el motor de letras';
          break;
        }
        if (res.data?.status === 'SUCCESS') {
          text = res.data.lyrics ?? '';
          failure = '';
          break;
        }
      }
    }
    setAiWriting(false);
    if (failure || !text.trim()) {
      setStatus({ tone: 'error', text: failure || 'No se pudo generar la letra con IA' });
      return;
    }
    setPlain(text.trim());
    setStatus({ tone: 'success', text: 'Letra generada con éxito con IA (Qwen en Modal). Ahora puedes sincronizarla.' });
  }

  async function save(lines: DraftLine[]) {
    if (!supabase || !trackId) return;
    if (lines.length === 0) {
      setStatus({ tone: 'error', text: 'No hay líneas con marca de tiempo para guardar.' });
      return;
    }
    setBusy(true);
    const del = await supabase.from('lyric_lines').delete().eq('track_id', trackId);
    if (del.error) {
      setBusy(false);
      setStatus({ tone: 'error', text: del.error.message });
      return;
    }
    const { error } = await supabase.from('lyric_lines').insert(lines.map((l) => ({ track_id: trackId, time_ms: l.time_ms, text: l.text })));
    setBusy(false);
    if (error) {
      setStatus({ tone: 'error', text: error.message });
      return;
    }
    setLrc(toLrc(lines));
    setStatus({ tone: 'success', text: `${lines.length} líneas guardadas` });
  }

  if (tracks.length === 0) return <p data-ev-id="ev_1a09d2d325" className="text-sm text-muted-foreground">Sube una canción para poder añadirle letra.</p>;

  return (
    <div data-ev-id="ev_a424bf8df3" className="flex max-w-3xl flex-col gap-5">
			<Field label="Canción">
				<Select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
					{tracks.map((t) =>
          <option data-ev-id="ev_281265f85e" key={t.id} value={t.id}>
							{t.title}
						</option>
          )}
				</Select>
			</Field>

			<TabBar
        tabs={[
        { id: 'lrc', label: 'Formato LRC' },
        { id: 'tap', label: 'Sincronizar con tap', icon: Hand }]
        }
        value={mode}
        onChange={(id) => setMode(id as Mode)} />
      

			{mode === 'lrc' ?
      <div data-ev-id="ev_1b31071ee1" className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-muted-foreground">Letra con marcas de tiempo</span>
						<button
							type="button"
							onClick={() => void generateWithAI()}
							disabled={aiWriting || !track}
							className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
							title="Genera una letra para esta canción usando el motor Qwen en Modal"
						>
							{aiWriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
							{aiWriting ? 'Escribiendo con IA...' : 'Componer letra con IA'}
						</button>
					</div>
					<TextArea value={lrc} onChange={(e) => setLrc(e.target.value)} rows={14} className="font-mono text-xs leading-relaxed" placeholder="[00:12.50] Giro en silencio sobre tu ciudad..." />
					<PrimaryButton type="button" disabled={busy} onClick={() => void save(parseLrc(lrc))} className="w-fit">
						<Save className="h-4 w-4" /> Guardar letra
					</PrimaryButton>
				</div> :

      <div data-ev-id="ev_b51c3523f1" className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-muted-foreground">1. Pega o escribe la letra (una línea por verso)</span>
						<button
							type="button"
							onClick={() => void generateWithAI()}
							disabled={aiWriting || !track}
							className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
							title="Genera una letra para esta canción usando el motor Qwen en Modal"
						>
							{aiWriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
							{aiWriting ? 'Escribiendo con IA...' : plain ? 'Mejorar con IA' : 'Componer letra con IA'}
						</button>
					</div>
					<TextArea value={plain} onChange={(e) => setPlain(e.target.value)} rows={8} placeholder="Pega los versos aquí o pulsa «Componer letra con IA» para que el motor la escriba..." />
					<div data-ev-id="ev_4304975f4a" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
						<p data-ev-id="ev_5203f0fd04" className="text-sm text-muted-foreground">2. Pulsa «Empezar» y toca «Marcar» justo cuando empiece cada verso.</p>
						<div data-ev-id="ev_a00dc9c646" className="flex flex-wrap items-center gap-3">
							<GhostButton type="button" onClick={startTap} disabled={plainLines.length === 0}>
								{tapped.length > 0 ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
								{tapped.length > 0 ? 'Reiniciar' : 'Empezar'}
							</GhostButton>
							<button data-ev-id="ev_43416c7857"
            type="button"
            onClick={mark}
            disabled={!isCurrent || tapped.length >= plainLines.length}
            className="min-h-14 flex-1 rounded-xl bg-primary px-6 text-base font-black text-primary-foreground transition-transform active:scale-95 disabled:opacity-40">
              
								Marcar · {formatLrcTime(progress * 1000)}
							</button>
						</div>
						<p data-ev-id="ev_2102e2571b" className="text-lg font-bold text-balance">
							{tapped.length < plainLines.length ? plainLines[tapped.length] : '¡Listo! Revisa y guarda.'}
						</p>
						<ol data-ev-id="ev_f4bf3cbebe" className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs text-muted-foreground">
							{tapped.map((l, i) =>
            <li data-ev-id="ev_74345f2bf2" key={`${l.time_ms}-${i}`} className="font-mono">
									[{formatLrcTime(l.time_ms)}] {l.text}
								</li>
            )}
						</ol>
					</div>
					<PrimaryButton type="button" disabled={busy || tapped.length === 0} onClick={() => void save(tapped)} className="w-fit">
						<Save className="h-4 w-4" /> Guardar sincronización
					</PrimaryButton>
				</div>
      }

			{status && <Notice tone={status.tone}>{status.text}</Notice>}
		</div>);

}