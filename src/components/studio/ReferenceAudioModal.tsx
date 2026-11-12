import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  AudioWaveform,
  Check,
  Link as LinkIcon,
  Loader2,
  Music,
  Pause,
  Play,
  Sparkles,
  Trash2,
  UploadCloud,
  X } from
'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { uploadMedia } from '@/lib/media';
import { estimateTempoBpm } from '@/lib/daw/detectTempo';

export interface ReferenceAudio {
  url: string;
  name: string;
  bpm?: number | null;
  duration?: number;
}

interface Props {
  isOpen: boolean;
  current?: ReferenceAudio | null;
  onClose: () => void;
  onApply: (ref: ReferenceAudio | null) => void;
}

export function ReferenceAudioModal({ isOpen, current, onClose, onApply }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();

  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>(current?.url ?? '');
  const [audioName, setAudioName] = useState<string>(current?.name ?? '');
  const [bpm, setBpm] = useState<number | null>(current?.bpm ?? null);
  const [duration, setDuration] = useState<number>(current?.duration ?? 0);

  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mini player
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAudioUrl(current?.url ?? '');
      setAudioName(current?.name ?? '');
      setBpm(current?.bpm ?? null);
      setDuration(current?.duration ?? 0);
      setError(null);
      setFile(null);
      setPlaying(false);
      setCurrentTime(0);
    }
  }, [isOpen, current]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTimeUpdate = () => setCurrentTime(a.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTimeUpdate);
      a.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  if (!isOpen) return null;

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  const handleFileSelect = async (selected: File) => {
    setError(null);
    if (!selected.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(selected.name)) {
      setError(t('Por favor selecciona un archivo de audio (MP3, WAV, M4A...)'));
      return;
    }

    if (selected.size > 15 * 1024 * 1024) {
      setError(t('El archivo debe pesar menos de 15 MB'));
      return;
    }

    setFile(selected);
    setAudioName(selected.name);
    setAnalyzing(true);

    // Local object URL for immediate playback & analysis
    const localUrl = URL.createObjectURL(selected);
    setAudioUrl(localUrl);

    // Analyze BPM & duration via Web Audio API
    try {
      const arrayBuffer = await selected.arrayBuffer();
      const AudioContextClass = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext;}).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);
      setDuration(Math.round(buffer.duration));

      const detectedBpm = estimateTempoBpm(buffer);
      if (detectedBpm) {
        setBpm(detectedBpm);
      }
      await audioCtx.close();
    } catch (err) {
      console.warn('Could not extract BPM from reference audio:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!audioUrl) return;

    // If a local file was selected, upload it to storage
    if (file && user) {
      setUploading(true);
      setError(null);
      const res = await uploadMedia(user.id, file, 'references');
      setUploading(false);

      if (res.error || !res.url) {
        setError(res.error || t('No se pudo subir el archivo de audio'));
        return;
      }

      onApply({
        url: res.url,
        name: file.name,
        bpm: bpm,
        duration: duration
      });
      onClose();
      return;
    }

    // URL reference
    onApply({
      url: audioUrl,
      name: audioName || t('Audio de Referencia'),
      bpm: bpm,
      duration: duration
    });
    onClose();
  };

  const handleClear = () => {
    onApply(null);
    onClose();
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div data-ev-id="ev_fc844e2724" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
			<div data-ev-id="ev_ce8dd40b9d" className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d141e] shadow-2xl">
				{/* Top Glow Bar */}
				<div data-ev-id="ev_2aa23b1e9b" className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-primary" />

				{/* Header */}
				<div data-ev-id="ev_6c6c58302f" className="flex items-start justify-between border-b border-white/5 p-6 pb-4">
					<div data-ev-id="ev_c9eb0edf8f" className="flex items-center gap-3">
						<span data-ev-id="ev_626d51c566" className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
							<AudioWaveform className="h-5 w-5" />
						</span>
						<div data-ev-id="ev_edc5a2cbe9">
							<h2 data-ev-id="ev_a777d82e0e" className="text-lg font-bold text-foreground">{t('Audio de Referencia')}</h2>
							<p data-ev-id="ev_f5dcd54ae2" className="text-xs text-muted-foreground">
								{t('Acondiciona el estilo, ritmo o tímbrica de tu nueva creación con IA')}
							</p>
						</div>
					</div>
					<button data-ev-id="ev_27a4f1097d"
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
            
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Tabs */}
				<div data-ev-id="ev_f1a2797197" className="flex border-b border-white/5 px-6">
					<button data-ev-id="ev_f575b2244b"
          type="button"
          onClick={() => setTab('upload')}
          className={`flex items-center gap-2 border-b-2 py-3 text-xs font-bold transition-colors ${
          tab === 'upload' ?
          'border-cyan-400 text-cyan-400' :
          'border-transparent text-muted-foreground hover:text-foreground'}`
          }>
            
						<UploadCloud className="h-4 w-4" />
						{t('Subir Archivo')}
					</button>
					<button data-ev-id="ev_2eb62cb6be"
          type="button"
          onClick={() => setTab('url')}
          className={`ml-6 flex items-center gap-2 border-b-2 py-3 text-xs font-bold transition-colors ${
          tab === 'url' ?
          'border-cyan-400 text-cyan-400' :
          'border-transparent text-muted-foreground hover:text-foreground'}`
          }>
            
						<LinkIcon className="h-4 w-4" />
						{t('Pegar Enlace')}
					</button>
				</div>

				{/* Body */}
				<div data-ev-id="ev_01a65c2ccf" className="flex flex-col gap-4 p-6">
					{error &&
          <div data-ev-id="ev_5af2301261" className="flex items-center gap-2 rounded-lg bg-destructive/15 p-3 text-xs font-medium text-destructive">
							<AlertTriangle className="h-4 w-4 flex-none" />
							<span data-ev-id="ev_257ce7fcd8">{error}</span>
						</div>
          }

					{tab === 'upload' ?
          <div data-ev-id="ev_a7313d5f9b">
							<input data-ev-id="ev_1ddc526c6a"
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileSelect(f);
            }} />
            
							<div data-ev-id="ev_84b95bb167"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFileSelect(f);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-8 text-center transition-all hover:border-cyan-500/60 hover:bg-cyan-500/10">
              
								<div data-ev-id="ev_cfface71ee" className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
									<UploadCloud className="h-6 w-6" />
								</div>
								<p data-ev-id="ev_bdb64b12b1" className="mt-3 text-sm font-semibold text-foreground">
									{t('Arrastra tu audio aquí o haz clic para explorar')}
								</p>
								<p data-ev-id="ev_b457fa25a5" className="mt-1 text-xs text-muted-foreground">
									{t('MP3, WAV, M4A o OGG (máx. 15 MB)')}
								</p>
							</div>
						</div> :

          <div data-ev-id="ev_82cce24142" className="flex flex-col gap-3">
							<label data-ev-id="ev_49a483d4c8" className="text-xs font-semibold text-muted-foreground">
								{t('Enlace de Audio')}
							</label>
							<div data-ev-id="ev_571936e887" className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 border border-white/5 focus-within:border-cyan-500/50">
								<LinkIcon className="h-4 w-4 text-muted-foreground flex-none" />
								<input data-ev-id="ev_44326b01ae"
              type="url"
              value={audioUrl}
              onChange={(e) => {
                setAudioUrl(e.target.value);
                if (!audioName) setAudioName(t('Audio Web'));
              }}
              placeholder="https://.../audio.mp3"
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
              
							</div>

							<div data-ev-id="ev_a0fa4b0c07" className="flex items-center gap-4">
								<div data-ev-id="ev_3dc60ddeeb" className="flex-1">
									<label data-ev-id="ev_b30d57b49e" className="text-xs font-semibold text-muted-foreground">
										{t('Nombre / Título de Referencia')}
									</label>
									<input data-ev-id="ev_e9f5dda311"
                type="text"
                value={audioName}
                onChange={(e) => setAudioName(e.target.value)}
                placeholder="Mi referencia favorita"
                className="mt-1 w-full rounded-xl bg-surface-2 px-3 py-2 text-xs text-foreground outline-none border border-white/5" />
                
								</div>
								<div data-ev-id="ev_a5b44bdb12" className="w-28">
									<label data-ev-id="ev_8e3ce4910c" className="text-xs font-semibold text-muted-foreground">
										{t('BPM (Opcional)')}
									</label>
									<input data-ev-id="ev_a48e040afb"
                type="number"
                min={60}
                max={220}
                value={bpm ?? ''}
                onChange={(e) => setBpm(e.target.value ? Number(e.target.value) : null)}
                placeholder="130"
                className="mt-1 w-full rounded-xl bg-surface-2 px-3 py-2 text-xs text-foreground outline-none border border-white/5" />
                
								</div>
							</div>
						</div>
          }

					{/* Preview Card */}
					{audioUrl &&
          <div data-ev-id="ev_c7dab797e6" className="flex flex-col gap-3 rounded-xl border border-white/10 bg-surface-2 p-4">
							<div data-ev-id="ev_8be63b7a0f" className="flex items-center justify-between">
								<div data-ev-id="ev_c364cbd52f" className="flex items-center gap-2.5 min-w-0">
									<span data-ev-id="ev_20c43682bf" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
										<Music className="h-4 w-4" />
									</span>
									<div data-ev-id="ev_21d842dfa6" className="min-w-0">
										<p data-ev-id="ev_f241ca0e88" className="truncate text-xs font-bold text-foreground">
											{audioName || t('Pista cargada')}
										</p>
										<p data-ev-id="ev_4582e9e29d" className="text-[11px] text-muted-foreground">
											{duration > 0 ? formatSec(duration) : t('Audio listo')}
										</p>
									</div>
								</div>

								<div data-ev-id="ev_bfcee66cca" className="flex items-center gap-2">
									{analyzing &&
                <span data-ev-id="ev_2ebee2462e" className="inline-flex items-center gap-1 rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
											<Loader2 className="h-3 w-3 animate-spin" /> {t('Analizando...')}
										</span>
                }
									{bpm && !analyzing &&
                <span data-ev-id="ev_997f2bcdac" className="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
											{bpm} BPM
										</span>
                }
									<button data-ev-id="ev_f44f55932c"
                type="button"
                onClick={togglePlay}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-black hover:bg-cyan-400 transition-colors">
                  
										{playing ?
                  <Pause className="h-4 w-4 fill-current" /> :

                  <Play className="h-4 w-4 fill-current translate-x-0.5" />
                  }
									</button>
								</div>
							</div>

							{/* Progress Bar */}
							<div data-ev-id="ev_1698e227fb" className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
								<span data-ev-id="ev_853c0dd5c3">{formatSec(currentTime)}</span>
								<div data-ev-id="ev_485904dd35" className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
									<div data-ev-id="ev_2bd5787f8d"
                className="h-full bg-cyan-400 transition-all"
                style={{
                  width: `${duration > 0 ? currentTime / duration * 100 : 0}%`
                }} />
                
								</div>
								<span data-ev-id="ev_6e0930349d">{formatSec(duration)}</span>
							</div>

							<audio data-ev-id="ev_4c459bea46" ref={audioRef} src={audioUrl} preload="auto" />
						</div>
          }
				</div>

				{/* Footer */}
				<div data-ev-id="ev_5e2ea034c9" className="flex items-center justify-between border-t border-white/5 bg-[#090e15] px-6 py-4">
					{current ?
          <button data-ev-id="ev_2af080bf82"
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline">
            
							<Trash2 className="h-3.5 w-3.5" />
							{t('Quitar Referencia')}
						</button> :

          <div data-ev-id="ev_7e19885810" />
          }

					<div data-ev-id="ev_d7054c15a3" className="flex items-center gap-2">
						<button data-ev-id="ev_4adfc11b57"
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-white/5 hover:text-foreground">
              
							{t('Cancelar')}
						</button>
						<button data-ev-id="ev_ef7c471483"
            type="button"
            disabled={!audioUrl || analyzing || uploading}
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-bold text-black shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40">
              
							{uploading ?
              <Loader2 className="h-4 w-4 animate-spin" /> :

              <Check className="h-4 w-4" />
              }
							{uploading ? t('Subiendo audio...') : t('Usar como Referencia')}
						</button>
					</div>
				</div>
			</div>
		</div>,
    document.body
  );
}