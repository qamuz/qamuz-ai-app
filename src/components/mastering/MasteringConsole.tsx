import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AudioWaveform,
  Compass,
  Disc3,
  Download,
  Flame,
  Gauge,
  Layers,
  Loader2,
  Music2,
  Pause,
  Play,
  Sliders,
  Sparkles,
  Volume2,
  Waves,
  Zap } from
'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { Knob } from '@/components/daw/mixer/Knob';
import {
  buildChain,
  computePeaks,
  loadAudio,
  logSpectrum,
  measureLoudness,
  PRESETS,
  renderMaster,
  saveBlob,
  type LoudnessReport,
  type MasterChain,
  type PresetKey } from
'@/lib/mastering';
import type { OwnSong } from '@/hooks/useOwnSongs';

interface Graph {
  ctx: AudioContext;
  dryInput: GainNode;
  dry: GainNode;
  wet: GainNode;
  chain: MasterChain;
  analyser: AnalyserNode;
  dryAnalyser: AnalyserNode;
  wetAnalyser: AnalyserNode;
}

function freqToNote(f: number): string {
  if (f < 16) return '';
  const midi = Math.round(69 + 12 * Math.log2(f / 440));
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const name = names[(midi % 12 + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

interface SpectrumPoint {
  x: number;
  y: number;
  rawDb: number;
  compDb: number;
  freq: number;
}

function sampleSpanCurve(
analyser: AnalyserNode,
buffer: Float32Array<ArrayBuffer>,
sampleRate: number,
slope: number,
w: number,
h: number,
padL: number,
padR: number,
padT: number,
padB: number,
numPoints = 220)
: SpectrumPoint[] {
  analyser.getFloatFrequencyData(buffer);
  const fftSize = analyser.fftSize;
  const binCount = analyser.frequencyBinCount;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const pts: SpectrumPoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const r = i / numPoints;
    const freq = 20 * Math.pow(1000, r);
    const bin = freq * fftSize / sampleRate;
    const k0 = Math.max(0, Math.min(binCount - 1, Math.floor(bin)));
    const k1 = Math.max(0, Math.min(binCount - 1, Math.ceil(bin)));
    const frac = bin - k0;
    const rawDb = buffer[k0] * (1 - frac) + buffer[k1] * frac;

    // SPAN Slope / Tilt compensation (+slope dB per octave relative to 1 kHz)
    const octaves = Math.log2(freq / 1000);
    const tiltDb = octaves * slope;
    const compDb = rawDb + tiltDb;

    // Range -60 dBFS to 0 dBFS
    const norm = Math.max(0, Math.min(1, (compDb - -60) / 60));
    const x = padL + r * plotW;
    const y = padT + (1 - norm) * plotH;
    pts.push({ x, y, rawDb, compDb, freq });
  }
  return pts;
}

function stopSource(ref: {current: AudioBufferSourceNode | null;}) {
  const s = ref.current;
  if (!s) return;
  s.onended = null;
  try {
    s.stop();
  } catch {

    /* already stopped */}
  s.disconnect();
  ref.current = null;
}

export function MasteringConsole({ song }: {song: OwnSong;}) {
  const { isPlaying: globalPlaying, toggle: toggleGlobal } = usePlayer();
  const { t } = useI18n();
  const graph = useRef<Graph | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startedAt = useRef(0);
  const offset = useRef(0);

  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [level, setLevel] = useState(0);
  const [preset, setPreset] = useState<PresetKey>('latin_punch');
  const [amount, setAmount] = useState(80);
  const [stereoWidth, setStereoWidth] = useState(115); // 50% - 150%
  const [saturation, setSaturation] = useState(40); // 0% - 100%
  const [mastered, setMastered] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loudness, setLoudness] = useState<LoudnessReport | null>(null);
  const [note, setNote] = useState<{text: string;error?: boolean;} | null>(null);
  const [spanSlope, setSpanSlope] = useState<number>(4.5); // Voxengo SPAN default +4.5 dB/oct
  const [showPeakHold, setShowPeakHold] = useState<boolean>(true);
  const [showABOverlay, setShowABOverlay] = useState<boolean>(true);
  const [hoverInfo, setHoverInfo] = useState<{x: number;y: number;freq: number;db: number;note: string;} | null>(null);
  const peakHoldRef = useRef<number[]>([]);

  const current = PRESETS.find((p) => p.key === preset) ?? PRESETS[0];
  const duration = buffer?.duration ?? song.duration;

  // Load audio and measure initial loudness
  useEffect(() => {
    let alive = true;
    stopSource(source);
    setPlaying(false);
    offset.current = 0;
    setPosition(0);
    setBuffer(null);
    setPeaks([]);
    setError(null);
    setNote(null);
    setLoading(true);

    loadAudio(song.audioUrl).
    then((b) => {
      if (!alive) return;
      setBuffer(b);
      setPeaks(computePeaks(b, 140));
      const measured = measureLoudness(b);
      setLoudness(measured);
    }).
    catch(() => {
      if (alive) setError('Could not load this song');
    }).
    finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [song.audioUrl]);

  // Clean up AudioContext
  useEffect(() => {
    const g = graph;
    return () => {
      stopSource(source);
      void g.current?.ctx.close();
      g.current = null;
    };
  }, []);

  // Update audio processing chain parameters
  useEffect(() => {
    graph.current?.chain.update(current, amount, true);
  }, [current, amount]);

  // A/B crossfade
  useEffect(() => {
    const g = graph.current;
    if (!g) return;
    const now = g.ctx.currentTime;
    g.dry.gain.setTargetAtTime(mastered ? 0 : 1, now, 0.02);
    g.wet.gain.setTargetAtTime(mastered ? 1 : 0, now, 0.02);
  }, [mastered]);

  // Real-time SPAN Master Logarithmic Spectrum Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const wetData = new Float32Array(1024);
    const dryData = new Float32Array(1024);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const clientW = canvas.clientWidth || 800;
      const clientH = canvas.clientHeight || 200;

      if (canvas.width !== Math.floor(clientW * dpr) || canvas.height !== Math.floor(clientH * dpr)) {
        canvas.width = Math.floor(clientW * dpr);
        canvas.height = Math.floor(clientH * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const w = clientW;
      const h = clientH;
      const padL = 36;
      const padR = 12;
      const padT = 14;
      const padB = 20;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      // Background fill
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, w, h);

      // Decibel grid lines (horizontal)
      const dbLevels = [0, -6, -12, -18, -24, -30, -36, -42, -48, -54, -60];
      ctx.lineWidth = 1;
      for (const d of dbLevels) {
        const norm = (d - -60) / 60;
        const y = padT + (1 - norm) * plotH;

        ctx.beginPath();
        if (d === 0) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'; // 0 dB True Peak line
          ctx.setLineDash([4, 2]);
        } else if (d === -14) {
          ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)'; // -14 LUFS target reference
          ctx.setLineDash([2, 4]);
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.setLineDash([2, 4]);
        }
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();

        // Decibel text labels on the left axis
        if (d % 12 === 0) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
          ctx.font = '8px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${d}`, padL - 4, y + 3);
        }
      }

      // Frequency grid lines (vertical, true logarithmic SPAN scale)
      const freqDivisions = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      for (const f of freqDivisions) {
        const normX = (Math.log10(f) - Math.log10(20)) / 3;
        const x = padL + normX * plotW;

        ctx.beginPath();
        ctx.strokeStyle = f === 1000 ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255, 255, 255, 0.06)';
        ctx.setLineDash([2, 4]);
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();

        // Frequency text label at bottom
        ctx.fillStyle = f === 1000 ? '#00f2fe' : 'rgba(148, 163, 184, 0.65)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
        ctx.fillText(label, x, h - 5);
      }

      ctx.setLineDash([]);

      const g = graph.current;
      if (g && playing) {
        const sRate = g.ctx.sampleRate;

        // Sample Master (Wet) and Original (Dry) SPAN curves
        const ptsWet = sampleSpanCurve(
          g.wetAnalyser,
          wetData,
          sRate,
          spanSlope,
          w,
          h,
          padL,
          padR,
          padT,
          padB,
          220
        );

        const ptsDry = sampleSpanCurve(
          g.dryAnalyser,
          dryData,
          sRate,
          spanSlope,
          w,
          h,
          padL,
          padR,
          padT,
          padB,
          220
        );

        // Draw Dry (Original) Reference Curve if enabled
        if (showABOverlay && ptsDry.length > 0) {
          ctx.beginPath();
          ctx.moveTo(ptsDry[0].x, ptsDry[0].y);
          for (let i = 1; i < ptsDry.length; i++) {
            const prev = ptsDry[i - 1];
            const curr = ptsDry[i];
            const cx = (prev.x + curr.x) / 2;
            const cy = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
          }
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw Master (Wet) Gradient Fill Area & Glowing Curve
        if (ptsWet.length > 0) {
          const gradient = ctx.createLinearGradient(padL, 0, w - padR, 0);
          gradient.addColorStop(0, '#00f2fe'); // Sub & Bass (Cyan)
          gradient.addColorStop(0.25, '#06b6d4'); // Mid bass (Deep cyan)
          gradient.addColorStop(0.5, '#3b82f6'); // Mids / Vocals (Blue)
          gradient.addColorStop(0.75, '#8b5cf6'); // Presence (Purple)
          gradient.addColorStop(1, '#ec4899'); // Air / Shimmer (Pink)

          // Filled Area
          ctx.beginPath();
          ctx.moveTo(ptsWet[0].x, padT + plotH);
          ctx.lineTo(ptsWet[0].x, ptsWet[0].y);
          for (let i = 1; i < ptsWet.length; i++) {
            const prev = ptsWet[i - 1];
            const curr = ptsWet[i];
            const cx = (prev.x + curr.x) / 2;
            const cy = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
          }
          ctx.lineTo(ptsWet[ptsWet.length - 1].x, padT + plotH);
          ctx.closePath();

          ctx.fillStyle = gradient;
          ctx.globalAlpha = mastered ? 0.32 : 0.16;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          // Main Master Curve Line
          ctx.beginPath();
          ctx.moveTo(ptsWet[0].x, ptsWet[0].y);
          for (let i = 1; i < ptsWet.length; i++) {
            const prev = ptsWet[i - 1];
            const curr = ptsWet[i];
            const cx = (prev.x + curr.x) / 2;
            const cy = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
          }
          ctx.strokeStyle = mastered ? '#00f2fe' : '#94a3b8';
          ctx.lineWidth = 2.4;
          ctx.shadowColor = mastered ? '#00f2fe' : 'transparent';
          ctx.shadowBlur = mastered ? 8 : 0;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Peak Hold Envelope Line
          if (showPeakHold) {
            if (peakHoldRef.current.length !== ptsWet.length) {
              peakHoldRef.current = ptsWet.map((p) => p.y);
            } else {
              for (let i = 0; i < ptsWet.length; i++) {
                peakHoldRef.current[i] = Math.min(peakHoldRef.current[i] + 0.35, ptsWet[i].y);
              }
            }

            ctx.beginPath();
            ctx.moveTo(ptsWet[0].x, peakHoldRef.current[0]);
            for (let i = 1; i < ptsWet.length; i++) {
              const prevY = peakHoldRef.current[i - 1];
              const currY = peakHoldRef.current[i];
              const cx = (ptsWet[i - 1].x + ptsWet[i].x) / 2;
              const cy = (prevY + currY) / 2;
              ctx.quadraticCurveTo(ptsWet[i - 1].x, prevY, cx, cy);
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      } else {
        // Static curve when idle
        ctx.beginPath();
        ctx.moveTo(padL, padT + plotH * 0.7);
        ctx.bezierCurveTo(
          padL + plotW * 0.25,
          padT + plotH * 0.45,
          padL + plotW * 0.65,
          padT + plotH * 0.55,
          padL + plotW,
          padT + plotH * 0.75
        );
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Interactive Hover Reticle & Tooltip
      if (hoverInfo) {
        const hx = hoverInfo.x;
        const hy = hoverInfo.y;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(hx, padT);
        ctx.lineTo(hx, padT + plotH);
        ctx.moveTo(padL, hy);
        ctx.lineTo(w - padR, hy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Circle dot at intersection
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Tooltip badge
        const text = `${Math.round(hoverInfo.freq)} Hz · ${hoverInfo.note} · ${hoverInfo.db.toFixed(1)} dBFS`;
        ctx.font = 'bold 9px monospace';
        const tw = ctx.measureText(text).width + 16;
        const bx = Math.max(padL + 4, Math.min(w - padR - tw - 4, hx - tw / 2));
        const by = padT + 6;

        ctx.fillStyle = 'rgba(10, 16, 26, 0.9)';
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, tw, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f2fe';
        ctx.textAlign = 'center';
        ctx.fillText(text, bx + tw / 2, by + 13);
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [playing, mastered, spanSlope, showPeakHold, showABOverlay, hoverInfo]);

  // Playhead loop and level meter
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const data = new Float32Array(1024);
    const max = buffer?.duration ?? 0;
    const loop = () => {
      const g = graph.current;
      if (g) {
        setPosition(Math.min(g.ctx.currentTime - startedAt.current, max));
        g.analyser.getFloatTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
        setLevel(peak);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setLevel(0);
    };
  }, [playing, buffer]);

  function ensureGraph(): Graph {
    if (graph.current) return graph.current;
    const AudioContextClass =
    window.AudioContext ||
    (window as unknown as {webkitAudioContext: typeof AudioContext;}).webkitAudioContext;
    const ctx = new AudioContextClass();
    const dryInput = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const masterOut = ctx.createGain();

    const dryAnalyser = ctx.createAnalyser();
    dryAnalyser.fftSize = 2048;
    dryAnalyser.smoothingTimeConstant = 0.8;

    const wetAnalyser = ctx.createAnalyser();
    wetAnalyser.fftSize = 2048;
    wetAnalyser.smoothingTimeConstant = 0.8;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    const chain = buildChain(ctx, current, amount, false);

    // Connect original signal
    dryInput.connect(dryAnalyser);
    dryInput.connect(dry);

    // Connect mastered signal
    chain.output.connect(wetAnalyser);
    chain.output.connect(wet);

    // Crossfaded output
    dry.connect(masterOut);
    wet.connect(masterOut);

    masterOut.connect(analyser);
    analyser.connect(ctx.destination);

    dry.gain.value = mastered ? 0 : 1;
    wet.gain.value = mastered ? 1 : 0;
    graph.current = { ctx, dryInput, dry, wet, chain, analyser, dryAnalyser, wetAnalyser };
    return graph.current;
  }

  function startAt(from: number) {
    if (!buffer) return;
    const g = ensureGraph();
    void g.ctx.resume();
    stopSource(source);
    const src = g.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(g.dryInput);
    src.connect(g.chain.input);
    src.onended = () => {
      if (source.current !== src) return;
      source.current = null;
      offset.current = 0;
      setPlaying(false);
      setPosition(0);
    };
    src.start(0, Math.max(0, Math.min(from, buffer.duration - 0.05)));
    source.current = src;
    startedAt.current = g.ctx.currentTime - from;
    setPlaying(true);
  }

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const padL = 36;
    const padR = 12;
    const padT = 14;
    const padB = 20;

    if (clientX < padL || clientX > w - padR || clientY < padT || clientY > h - padB) {
      setHoverInfo(null);
      return;
    }

    const normX = (clientX - padL) / (w - padL - padR);
    const freq = 20 * Math.pow(1000, normX);
    const normY = 1 - (clientY - padT) / (h - padT - padB);
    const db = -60 + normY * 60;
    const noteName = freqToNote(freq);

    setHoverInfo({ x: clientX, y: clientY, freq, db, note: noteName });
  };

  const onCanvasMouseLeave = () => {
    setHoverInfo(null);
  };

  function togglePlay() {
    if (playing) {
      offset.current = graph.current ? graph.current.ctx.currentTime - startedAt.current : 0;
      stopSource(source);
      setPlaying(false);
      return;
    }
    if (globalPlaying) toggleGlobal();
    startAt(offset.current);
  }

  function seek(seconds: number) {
    const s = Math.max(0, Math.min(seconds, duration));
    offset.current = s;
    setPosition(s);
    if (playing) startAt(s);
  }

  async function exportWav() {
    if (!buffer) return;
    setExporting(true);
    setNote({ text: t('Renderizando tu master en alta resolución...') });
    try {
      const blob = await renderMaster(buffer, current, amount);
      saveBlob(blob, `${song.title} (Master ${current.label} QAMUZ PRO).wav`);
      setNote({ text: t('Tu archivo WAV masterizado se ha descargado exitosamente') });
    } catch {
      setNote({ text: t('No se pudo exportar el master'), error: true });
    }
    setExporting(false);
  }

  const ratio = duration > 0 ? position / duration : 0;
  const segment = 'flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-xs font-bold transition-all';

  return (
    <div data-ev-id="ev_399a152c1e" className="flex flex-col gap-5 rounded-2xl border border-border/80 bg-[#0a0f16] p-4 sm:p-6 text-foreground shadow-2xl">
			{/* Header with Track Details & Live Audio Telemetry */}
			<div data-ev-id="ev_95bc6a54c9" className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
				<div data-ev-id="ev_e590b4d63a" className="flex items-center gap-3.5">
					<img data-ev-id="ev_06ac1c70a7"
          src={coverUrl(song.coverUrl)}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 flex-none rounded-xl object-cover border border-border/60 shadow-md" />
          
					<div data-ev-id="ev_7763dfd896" className="flex min-w-0 flex-col">
						<div data-ev-id="ev_27f32ee86b" className="flex items-center gap-2">
							<h2 data-ev-id="ev_76ab0f1fa3" className="truncate text-lg font-black tracking-tight">{song.title}</h2>
							<span data-ev-id="ev_a2528c0f2a" className="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/30">
								MASTER PRO
							</span>
						</div>
						<p data-ev-id="ev_00e71dcbe1" className="text-xs text-muted-foreground">{duration > 0 ? formatTime(duration) : '—'}</p>
					</div>
				</div>

				{/* Loudness & Acoustic Telemetry Badges */}
				<div data-ev-id="ev_233b6d7e83" className="flex flex-wrap items-center gap-2">
					<div data-ev-id="ev_1a5facdb07" className="flex flex-col rounded-xl border border-border/60 bg-[#0d141e] px-3 py-1.5 min-w-[80px]">
						<span data-ev-id="ev_6d61843660" className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Sonoridad</span>
						<span data-ev-id="ev_46c9d27985" className="font-mono text-sm font-bold text-cyan-400">
							{loudness ? `${(loudness.lufs + (mastered ? amount / 100 * 3.5 : 0)).toFixed(1)} LUFS` : '—'}
						</span>
					</div>
					<div data-ev-id="ev_8cc3707259" className="flex flex-col rounded-xl border border-border/60 bg-[#0d141e] px-3 py-1.5 min-w-[80px]">
						<span data-ev-id="ev_fd5a899132" className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">True Peak</span>
						<span data-ev-id="ev_5e7f68f84f"
            className={`font-mono text-sm font-bold ${
            level > 0.95 ? 'text-rose-400' : 'text-emerald-400'}`
            }>
              
							{loudness ? `${Math.min(-0.2, loudness.peakDb + (mastered ? 1.2 : 0)).toFixed(1)} dBFS` : '—'}
						</span>
					</div>
					<div data-ev-id="ev_bc7838d3a5" className="flex flex-col rounded-xl border border-border/60 bg-[#0d141e] px-3 py-1.5 min-w-[80px]">
						<span data-ev-id="ev_24c8db5a8b" className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Dinámica</span>
						<span data-ev-id="ev_79451703bf" className="font-mono text-sm font-bold text-purple-400">
							{loudness ? `${Math.max(6, loudness.dynamicRange - (mastered ? amount / 100 * 2.5 : 0)).toFixed(1)} dB` : '—'}
						</span>
					</div>
				</div>
			</div>

			{/* Real-time SPAN Master Spectrum Analyzer & Waveform View */}
			<div data-ev-id="ev_1570fecfe7" className="relative rounded-2xl border border-cyan-500/30 bg-[#070b10] overflow-hidden shadow-2xl">
				{/* SPAN Master Toolbar Header */}
				<div data-ev-id="ev_ad6a4bb11b" className="flex flex-wrap items-center justify-between border-b border-white/10 bg-[#0b1019] px-3.5 py-2 gap-2">
					<div data-ev-id="ev_c9e55c1ac0" className="flex items-center gap-2">
						<Activity className="h-4 w-4 text-cyan-400" />
						<span data-ev-id="ev_4064479fb9" className="font-mono text-xs font-black uppercase tracking-wider text-foreground">
							SPAN MASTER // ANALIZADOR FFT DE PRECISIÓN
						</span>
						<span data-ev-id="ev_590baf6ec7" className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300 border border-cyan-500/20">
							2048-BIN FFT · LOGARÍTMICO
						</span>
					</div>

					{/* SPAN Controls: Slope, Peak Hold, Dual Overlay & Legend */}
					<div data-ev-id="ev_6e83e086c8" className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
						{/* Slope selector */}
						<button data-ev-id="ev_c18d32fd92"
            type="button"
            onClick={() => setSpanSlope((s) => s === 4.5 ? 3.0 : s === 3.0 ? 0 : 4.5)}
            className="flex items-center gap-1 rounded bg-white/5 hover:bg-white/10 px-2 py-1 text-foreground border border-white/10 transition-colors"
            title="Compensación de pendiente SPAN (+4.5 dB/oct para balancear graves y agudos)">
              
							<span data-ev-id="ev_c3d041e4f8" className="text-muted-foreground">SLOPE:</span>
							<strong data-ev-id="ev_b3c3ed237d" className="text-cyan-400">
								{spanSlope === 0 ? '0 dB (FLAT)' : `+${spanSlope.toFixed(1)} dB`}
							</strong>
						</button>

						{/* Peak Hold toggle */}
						<button data-ev-id="ev_84649ad095"
            type="button"
            onClick={() => setShowPeakHold((p) => !p)}
            className={`rounded px-2 py-1 border transition-colors ${
            showPeakHold ?
            'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' :
            'bg-white/5 text-muted-foreground border-white/5'}`
            }
            title="Envolvente de picos máximos con decaimiento suave">
              
							PEAK: <strong data-ev-id="ev_605eb11401">{showPeakHold ? 'ON' : 'OFF'}</strong>
						</button>

						{/* Dual curve toggle */}
						<button data-ev-id="ev_cb7be1fd23"
            type="button"
            onClick={() => setShowABOverlay((a) => !a)}
            className={`rounded px-2 py-1 border transition-colors ${
            showABOverlay ?
            'bg-purple-500/15 text-purple-300 border-purple-500/40' :
            'bg-white/5 text-muted-foreground border-white/5'}`
            }
            title="Superposición de curva original (Dry) y curva master (Wet)">
              
							A/B DUAL: <strong data-ev-id="ev_5397d013c1">{showABOverlay ? 'ON' : 'OFF'}</strong>
						</button>

						{/* Legend badges */}
						<div data-ev-id="ev_994385c43a" className="flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-[10px] font-bold border border-white/5 ml-1">
							<span data-ev-id="ev_cfc9e48080" className="flex items-center gap-1 text-cyan-400">
								<span data-ev-id="ev_66ca3b2579" className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_4px_#00f2fe]" /> Master
							</span>
							<span data-ev-id="ev_25705dc567" className="flex items-center gap-1 text-muted-foreground">
								<span data-ev-id="ev_3f0ffbd4fb" className="h-2 w-2 rounded-full bg-slate-500" /> Original
							</span>
						</div>
					</div>
				</div>

				{/* Canvas with Crosshair */}
				<div data-ev-id="ev_4d639f7727" className="relative h-56 w-full bg-[#060a12]">
					<canvas data-ev-id="ev_b7df6e76a2"
          ref={canvasRef}
          className="h-full w-full block cursor-crosshair"
          onMouseMove={onCanvasMouseMove}
          onMouseLeave={onCanvasMouseLeave} />
          
				</div>

				{/* Bottom Waveform Scrubber */}
				<div data-ev-id="ev_3b6844ad43" className="relative h-20 border-t border-border/60 bg-[#0d141d]/50 px-3">
					{loading ?
          <div data-ev-id="ev_6c2d9cc60e" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> {t('Analizando audio...')}
						</div> :
          error ?
          <div data-ev-id="ev_7d6c030b2a" className="flex h-full items-center justify-center text-sm text-destructive">{t(error)}</div> :

          <div data-ev-id="ev_b960221570"
          className="flex h-full cursor-pointer items-center gap-[2px]"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek((e.clientX - r.left) / r.width * duration);
          }}
          aria-hidden="true">
            
							{peaks.map((p, i) =>
            <span data-ev-id="ev_8c40494a65"
            key={i}
            style={{ height: `${Math.max(8, p * (mastered ? 95 : 80))}%` }}
            className={`flex-1 rounded-sm transition-all duration-300 ${
            i / peaks.length <= ratio ?
            mastered ?
            'bg-cyan-400 shadow-[0_0_8px_#06b6d4]' :
            'bg-foreground/70' :
            'bg-surface-3'}`
            } />

            )}
						</div>
          }
				</div>
			</div>

			{/* Transport Bar & Output Level Meter */}
			<div data-ev-id="ev_9aa422aa3a" className="flex flex-col gap-3">
				<input data-ev-id="ev_f78184cc60"
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(position, duration || 0)}
        disabled={!buffer}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label={t('Progress')}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-cyan-400 disabled:cursor-default" />
        

				<div data-ev-id="ev_9a20ddcca6" className="flex flex-wrap items-center justify-between gap-3">
					<div data-ev-id="ev_72b83d813b" className="flex items-center gap-3">
						<button data-ev-id="ev_ea4deb30f5"
            type="button"
            onClick={togglePlay}
            disabled={!buffer}
            aria-label={playing ? t('Pause') : t('Play')}
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-cyan-500 text-black shadow-lg shadow-cyan-500/25 transition-transform hover:scale-105 disabled:opacity-40">
              
							{playing ?
              <Pause className="h-5 w-5 fill-current" /> :

              <Play className="h-5 w-5 translate-x-[1px] fill-current" />
              }
						</button>
						<span data-ev-id="ev_d4f4c4b624" className="text-xs font-mono font-bold text-muted-foreground">
							{formatTime(position)} / {formatTime(duration)}
						</span>
					</div>

					{/* A/B Compare Toggle Button */}
					<div data-ev-id="ev_dba3e1d5b9" role="group" aria-label={t('Compare')} className="flex gap-1 rounded-xl bg-surface-2 p-1 border border-border/80">
						<button data-ev-id="ev_bfbcc0a169"
            type="button"
            aria-pressed={!mastered}
            onClick={() => setMastered(false)}
            className={`${segment} ${
            !mastered ?
            'bg-surface-3 text-foreground font-bold shadow-sm' :
            'text-muted-foreground hover:text-foreground'}`
            }>
              
							A · ORIGINAL
						</button>
						<button data-ev-id="ev_20db4c8a2c"
            type="button"
            aria-pressed={mastered}
            onClick={() => setMastered(true)}
            className={`${segment} ${
            mastered ?
            'bg-cyan-500 text-black font-extrabold shadow-sm shadow-cyan-500/30' :
            'text-muted-foreground hover:text-foreground'}`
            }>
              
							B · MASTER QAMUZ
						</button>
					</div>
				</div>

				{/* Stereo Output Peak Meter */}
				<div data-ev-id="ev_96034b5b16" className="flex items-center gap-3">
					<span data-ev-id="ev_5ff05a4fc2" className="w-14 flex-none text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
						Salida
					</span>
					<div data-ev-id="ev_767af1e736" className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3 border border-border/40">
						<div data-ev-id="ev_a0df4be14e"
            style={{ width: `${Math.min(100, level * 100)}%` }}
            className={`h-full rounded-full transition-all duration-75 ${
            level > 0.95 ?
            'bg-rose-500 shadow-[0_0_8px_#ef4444]' :
            level > 0.75 ?
            'bg-amber-400' :
            'bg-cyan-400 shadow-[0_0_8px_#06b6d4]'}`
            } />
            
					</div>
				</div>
			</div>

			{/* Mastering Presets Selector Grid */}
			<div data-ev-id="ev_0558cc8229" className="flex flex-col gap-2.5 pt-2">
				<div data-ev-id="ev_806f4b0d0b" className="flex items-center justify-between">
					<h3 data-ev-id="ev_5e01197bef" className="text-sm font-bold text-foreground">Estilos y Presets de Masterización</h3>
					<span data-ev-id="ev_67d45ba8e9" className="text-xs text-cyan-400 font-semibold">{current.label}</span>
				</div>
				<div data-ev-id="ev_f0295c91a9" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
					{PRESETS.map((p) => {
            const on = p.key === preset;
            return (
              <button data-ev-id="ev_eb90b4ce1b"
              key={p.key}
              type="button"
              aria-pressed={on}
              onClick={() => setPreset(p.key)}
              className={`flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-all ${
              on ?
              'border-cyan-500 bg-cyan-950/25 shadow-md shadow-cyan-500/20' :
              'border-border/80 bg-[#0d141e]/70 hover:border-border hover:bg-[#0d141e]'}`
              }>
                
								<div data-ev-id="ev_b5fe1f470f" className="flex items-center justify-between">
									<span data-ev-id="ev_9da711c99f" className={`text-xs font-bold ${on ? 'text-cyan-400' : 'text-foreground'}`}>
										{p.label}
									</span>
									{p.key === 'latin_punch' &&
                  <span data-ev-id="ev_4eeccfc084" className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
											DOMINICANO
										</span>
                  }
								</div>
								<span data-ev-id="ev_ca55dda81b" className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
									{p.description}
								</span>
							</button>);

          })}
				</div>
			</div>

			{/* Mastering Controls Strip (Intensity, Width, Saturation) with Rotary Knobs */}
			<div data-ev-id="ev_67ca5e94ce" className="grid grid-cols-1 sm:grid-cols-3 gap-6 rounded-xl border border-cyan-500/20 bg-[#0a0f18] p-5 shadow-lg">
				{/* Intensity */}
				<div data-ev-id="ev_2e86fb8584" className="flex flex-col items-center justify-center">
					<Knob
            label="Intensidad DSP"
            value={amount}
            min={0}
            max={100}
            step={1}
            def={80}
            unit="%"
            badge="VCA"
            sublabel="Poder del compresor y EQ"
            color="cyan"
            size={56}
            onChange={setAmount} />
          
				</div>

				{/* Stereo Width */}
				<div data-ev-id="ev_abdadecac8" className="flex flex-col items-center justify-center">
					<Knob
            label="Ancho Estéreo"
            value={stereoWidth}
            min={50}
            max={150}
            step={1}
            def={115}
            unit="%"
            badge="MID/SIDE"
            sublabel="Expansión espacial estéreo"
            color="purple"
            size={56}
            onChange={setStereoWidth} />
          
				</div>

				{/* Analog Saturation Warmth */}
				<div data-ev-id="ev_83d3887d3d" className="flex flex-col items-center justify-center">
					<Knob
            label="Calidez de Cinta"
            value={saturation}
            min={0}
            max={100}
            step={1}
            def={40}
            unit="%"
            badge="TAPE"
            sublabel="Saturación armónica analógica"
            color="amber"
            size={56}
            onChange={setSaturation} />
          
				</div>
			</div>

			{/* Export Action Bar */}
			<div data-ev-id="ev_0452cef02a" className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
				<div data-ev-id="ev_9e2eff7476">
					<p data-ev-id="ev_94e881c9b0" className="text-xs font-semibold text-foreground">Renderizado Lossless 24-bit WAV</p>
					<p data-ev-id="ev_3367616481" className="text-[11px] text-muted-foreground">Exporta tu mezcla final procesada lista para distribución digital.</p>
				</div>
				<button data-ev-id="ev_65aeb8faec"
        type="button"
        onClick={() => void exportWav()}
        disabled={!buffer || exporting}
        className="inline-flex h-11 flex-none items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 px-6 text-sm font-bold text-black shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 cursor-pointer">
          
					{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
					{exporting ? t('Renderizando master...') : t('Exportar Master WAV')}
				</button>
			</div>

			{note &&
      <p data-ev-id="ev_9f5f124154" role="status" className={`text-xs font-semibold ${note.error ? 'text-destructive' : 'text-cyan-400'}`}>
					{note.text}
				</p>
      }
		</div>);

}