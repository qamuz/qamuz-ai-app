import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  AudioWaveform,
  Clapperboard,
  Expand,
  Heart,
  Loader2,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Tv,
  Volume2,
  VolumeX,
  X } from
'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { fetchTrack } from '@/lib/queries';
import { alignLyrics, findActiveLine, type TimedLyricLine } from '@/lib/lyrics-sync';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import type { TrackWithArtist } from '@/types/music';

const LINE_HEIGHT_NORMAL = 72;
const LINE_HEIGHT_TV = 110;

export function KaraokePage() {
  const { id } = useParams<{id?: string;}>();
  const [searchParams] = useSearchParams();
  const songId = id || searchParams.get('song') || searchParams.get('track');
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const player = usePlayer();

  const [loadedTrack, setLoadedTrack] = useState<TrackWithArtist | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTvMode, setIsTvMode] = useState(false);
  const [bgMode, setBgMode] = useState<'cover' | 'video' | 'minimal'>('cover');
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load track if an ID is passed in the URL
  useEffect(() => {
    if (!songId) return;
    let active = true;
    void (async () => {
      setLoading(true);
      const tData = await fetchTrack(songId);
      if (active && tData) {
        setLoadedTrack(tData);
        // If not already playing this track in global player, play it
        if (player.current?.id !== tData.id) {
          player.playTracks([tData], 0);
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // Use currently playing track if no ID is passed or if loaded
  const currentTrack = loadedTrack || player.current;

  // Align synchronized lyrics using lyrics-sync engine
  const timedLines = useMemo<TimedLyricLine[]>(() => {
    const lyricsText = currentTrack?.lyrics || '';
    const dur = player.duration || currentTrack?.duration_seconds || 180;
    if (!lyricsText.trim()) return [];
    return alignLyrics(lyricsText, dur);
  }, [currentTrack?.lyrics, player.duration, currentTrack?.duration_seconds]);

  const activeLineIndex = useMemo(() => {
    if (timedLines.length === 0) return -1;
    return findActiveLine(timedLines, player.progress);
  }, [timedLines, player.progress]);

  // Auto-scroll lyrics container smoothly to keep active line centered
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || activeLineIndex < 0) return;

    const lineHeight = isTvMode ? LINE_HEIGHT_TV : LINE_HEIGHT_NORMAL;
    const targetY = activeLineIndex * lineHeight - container.clientHeight / 2 + lineHeight / 2;
    container.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });
  }, [activeLineIndex, isTvMode]);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      void document.exitFullscreen().catch(() => undefined);
    }
  };

  // Keyboard shortcuts (Space = Play/Pause, Esc = Exit)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 't' || e.key === 'T') {
        setIsTvMode((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player]);

  const cover = currentTrack ? coverUrl(currentTrack.cover_key) : null;
  const videoUrl = currentTrack?.canvas_url;

  return (
    <div data-ev-id="ev_391fae3ab6" className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#070b10] text-foreground select-none">
			{/* BACKGROUND LAYER */}
			{bgMode === 'video' && videoUrl ?
      <video data-ev-id="ev_914ff0aa03"
      ref={videoRef}
      src={videoUrl}
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 h-full w-full object-cover opacity-25 filter blur-sm scale-105" /> :

      bgMode === 'cover' && cover ?
      <div data-ev-id="ev_17651150c7"
      className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-2xl scale-125 transition-all duration-1000"
      style={{ backgroundImage: `url(${cover})` }} /> :

      null}

			{/* AMBIENT GRADIENTS & VIGNETTE */}
			<div data-ev-id="ev_c2459bd9ec" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b10] via-[#070b10]/80 to-[#070b10]/60" />
			<div data-ev-id="ev_32f9dfb62b" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(7,11,16,0.85)_100%)]" />

			{/* TOP BAR / NAVIGATION */}
			<header data-ev-id="ev_0d574bdcfe" className="relative z-30 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/30 backdrop-blur-md">
				<div data-ev-id="ev_d6aaf1c2a4" className="flex items-center gap-4">
					<button data-ev-id="ev_f7c4a34e4e"
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
          title={t('Volver')}>
            
						<ArrowLeft className="h-5 w-5" />
					</button>

					<div data-ev-id="ev_6eae9753b1" className="flex items-center gap-3">
						<span data-ev-id="ev_dc403629af" className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-black shadow-lg shadow-cyan-500/20">
							<Music2 className="h-5 w-5" />
						</span>
						<div data-ev-id="ev_eb18d816cd">
							<h1 data-ev-id="ev_d40732f72e" className="text-sm font-black uppercase tracking-widest text-cyan-400">
								{t('Letras Sincronizadas')}
							</h1>
							<p data-ev-id="ev_8eed1e719e" className="text-xs font-semibold text-muted-foreground truncate max-w-xs sm:max-w-md">
								{currentTrack ? `${currentTrack.title} — ${currentTrack.artist?.name || t('Artista Qamuz')}` : t('Sincronización en tiempo real')}
							</p>
						</div>
					</div>
				</div>

				{/* Quick Controls */}
				<div data-ev-id="ev_b40c07e330" className="flex items-center gap-2">
					{videoUrl &&
          <button data-ev-id="ev_63fe2c4be2"
          type="button"
          onClick={() => setBgMode((m) => m === 'video' ? 'cover' : 'video')}
          className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all ${
          bgMode === 'video' ?
          'bg-cyan-500 text-black' :
          'bg-white/5 text-muted-foreground hover:text-foreground'}`
          }
          title={t('Fondo de Video')}>
            
							<Clapperboard className="h-3.5 w-3.5" />
							<span data-ev-id="ev_ebed47688f" className="hidden sm:inline">{t('Video')}</span>
						</button>
          }

					<button data-ev-id="ev_0c2fccc48b"
          type="button"
          onClick={() => setIsTvMode((v) => !v)}
          className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all ${
          isTvMode ?
          'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20' :
          'bg-white/5 text-muted-foreground hover:text-foreground'}`
          }
          title={t('Modo Pantalla Grande / TV')}>
            
						<Tv className="h-3.5 w-3.5" />
						<span data-ev-id="ev_398ef60230" className="hidden sm:inline">{t('Modo TV')}</span>
					</button>

					<button data-ev-id="ev_962f021b96"
          type="button"
          onClick={toggleFullscreen}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
          title={isFullscreen ? t('Salir de pantalla completa') : t('Pantalla completa')}>
            
						{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
					</button>
				</div>
			</header>

			{/* CENTER STAGE: SYNCHRONIZED RISING LYRICS */}
			<main data-ev-id="ev_66cf8f391c" className="relative z-20 flex flex-1 overflow-hidden px-4 sm:px-12">
				{loading ?
        <div data-ev-id="ev_4091fd535f" className="flex flex-1 flex-col items-center justify-center gap-3 text-cyan-400">
						<Loader2 className="h-10 w-10 animate-spin" />
						<p data-ev-id="ev_fdf4aeadea" className="text-sm font-bold tracking-wide">{t('Cargando pista y letras...')}</p>
					</div> :
        timedLines.length === 0 ?
        <div data-ev-id="ev_76fa622f63" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
						<span data-ev-id="ev_a7d73607a5" className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
							<Music2 className="h-10 w-10 opacity-40" />
						</span>
						<div data-ev-id="ev_0050360844">
							<h3 data-ev-id="ev_b1ef99e08e" className="text-lg font-bold text-foreground">{t('No hay letras sincronizadas')}</h3>
							<p data-ev-id="ev_4ae584de59" className="mt-1 text-xs text-muted-foreground max-w-sm">
								{t('Esta canción no contiene letras o es una pista puramente instrumental.')}
							</p>
						</div>
					</div> :

        <div data-ev-id="ev_14759ab3ba"
        ref={scrollContainerRef}
        className="no-scrollbar h-full w-full overflow-y-auto py-32 text-center">
          
						<div data-ev-id="ev_d212c1489d" className="flex flex-col items-center gap-6">
							{timedLines.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              const isPast = idx < activeLineIndex;
              const isUpcoming = idx === activeLineIndex + 1;

              return (
                <button data-ev-id="ev_bbdab7ed16"
                key={`${line.start}-${idx}`}
                type="button"
                onClick={() => player.seek(line.start)}
                style={{ minHeight: isTvMode ? LINE_HEIGHT_TV : LINE_HEIGHT_NORMAL }}
                className={`group flex flex-col items-center justify-center px-6 transition-all duration-500 cursor-pointer ${
                isActive ?
                `${
                isTvMode ?
                'text-4xl sm:text-6xl font-black' :
                'text-2xl sm:text-4xl font-extrabold'} text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-cyan-200 scale-105 filter drop-shadow-[0_0_25px_rgba(0,242,254,0.4)]` :

                isUpcoming ?
                `${
                isTvMode ? 'text-2xl sm:text-4xl' : 'text-lg sm:text-2xl'} font-bold text-muted-foreground/80 hover:text-foreground` :

                isPast ?
                `${
                isTvMode ? 'text-xl sm:text-3xl' : 'text-base sm:text-xl'} font-semibold text-muted-foreground/35 hover:text-muted-foreground` :

                `${
                isTvMode ? 'text-xl sm:text-3xl' : 'text-base sm:text-xl'} font-semibold text-muted-foreground/50 hover:text-foreground`}`

                }>
                  
										{line.section &&
                  <span data-ev-id="ev_e9124552a0" className="mb-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
												{line.section}
											</span>
                  }
										<span data-ev-id="ev_5d9bfedb5e" className="leading-tight transition-transform group-hover:scale-105">
											{line.text}
										</span>
									</button>);

            })}
						</div>
					</div>
        }
			</main>

			{/* BOTTOM TRANSPORT BAR */}
			<footer data-ev-id="ev_8fa639771f" className="relative z-30 flex flex-col border-t border-white/5 bg-black/50 px-6 py-4 backdrop-blur-xl">
				{/* Timeline Scrubber */}
				<div data-ev-id="ev_f06b0fbb58" className="flex items-center gap-3">
					<span data-ev-id="ev_0a592ed945" className="w-12 text-[11px] font-semibold tabular-nums text-muted-foreground">
						{formatTime(player.progress)}
					</span>
					<div data-ev-id="ev_c689b99cfb" className="relative flex flex-1 items-center">
						<input data-ev-id="ev_2cc3fbfbb2"
            type="range"
            min={0}
            max={player.duration || 100}
            step={0.1}
            value={player.progress}
            onChange={(e) => player.seek(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400 focus:outline-none" />
            
					</div>
					<span data-ev-id="ev_6cdfc8dd10" className="w-12 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
						{formatTime(player.duration)}
					</span>
				</div>

				{/* Transport Controls */}
				<div data-ev-id="ev_7213fc9cf3" className="mt-3 flex items-center justify-between">
					<div data-ev-id="ev_9b14ba960e" className="flex items-center gap-3">
						{cover &&
            <img data-ev-id="ev_0c27432d2d"
            src={cover}
            alt=""
            className="h-10 w-10 rounded-lg object-cover shadow-md border border-white/10" />

            }
						<div data-ev-id="ev_991fe00a70" className="min-w-0">
							<p data-ev-id="ev_9cb636af51" className="truncate text-sm font-bold text-foreground">
								{currentTrack?.title || t('Sin pista activa')}
							</p>
							<p data-ev-id="ev_3822ee3d1d" className="truncate text-xs text-muted-foreground">
								{currentTrack?.artist?.name || t('Artista Qamuz')}
							</p>
						</div>
					</div>

					{/* Center Play/Pause */}
					<div data-ev-id="ev_39c5732e6b" className="flex items-center gap-4">
						<button data-ev-id="ev_19272dcf38"
            type="button"
            onClick={() => player.seek(Math.max(0, player.progress - 10))}
            className="rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            title={t('Retroceder 10s')}>
              
							<RotateCcw className="h-5 w-5" />
						</button>
						<button data-ev-id="ev_b67e54e72d"
            type="button"
            onClick={() => player.toggle()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-lg shadow-cyan-500/25 hover:scale-105 transition-transform">
              
							{player.isPlaying ?
              <Pause className="h-6 w-6 fill-current" /> :

              <Play className="h-6 w-6 fill-current translate-x-0.5" />
              }
						</button>
					</div>

					{/* Volume Control */}
					<div data-ev-id="ev_b95f06d4c9" className="flex items-center gap-2">
						<button data-ev-id="ev_4fde70ce77"
            type="button"
            onClick={() => {
              const nextMuted = !muted;
              setMuted(nextMuted);
              player.setVolume(nextMuted ? 0 : volume);
            }}
            className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors">
              
							{muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
						</button>
						<input data-ev-id="ev_ea1191873d"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const val = Number(e.target.value);
              setVolume(val);
              setMuted(false);
              player.setVolume(val);
            }}
            className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400" />
            
					</div>
				</div>
			</footer>
		</div>);

}

export default KaraokePage;