import React, { useState } from 'react';
import { Power, RotateCcw, X, Sparkles, Sliders } from 'lucide-react';
import { FX_LABELS, FX_PARAMS, paramValue, type FxParamSpec } from '@/lib/daw/fx';
import type { FxSlot, FxType } from '@/lib/daw/types';
import { useI18n } from '@/hooks/useI18n';
import { Knob } from '@/components/daw/mixer/Knob';

interface FxEditorProps {
  slot: FxSlot;
  trackName: string;
  color: string;
  onChange: (slot: FxSlot) => void;
  onClose: () => void;
}

const MODULE_DESIGNATIONS: Record<FxType, { code: string; title: string; desc: string; badge: string; color: 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose' }> = {
  vocal: {
    code: '01',
    title: 'EQAMUZ VOCAL FORGE',
    desc: 'PITCH RETUNE MATRIX, DE-ESSER SIBILANCE CUT & AIR SHEEN',
    badge: 'VOCAL DSP',
    color: 'cyan',
  },
  lead: {
    code: '02',
    title: 'EQAMUZ LEAD EXCITER',
    desc: 'SOLO GUITAR SUITE, REQUINTO BITE & SLAPBACK MATRIX',
    badge: 'LEAD MATRIX',
    color: 'amber',
  },
  eq: {
    code: '04',
    title: 'EQAMUZ PRO-EQ',
    desc: 'PARAMETRIC FREQUENCY EQUALIZER & MID/SIDE SHAPING',
    badge: '3-BAND PRECISION',
    color: 'cyan',
  },
  comp: {
    code: '05',
    title: 'EQAMUZ COMP',
    desc: 'OPTO/VCA DYNAMICS ENGINE & LEVELING AMPLIFIER',
    badge: 'STUDIO DYNAMICS',
    color: 'emerald',
  },
  reverb: {
    code: '08',
    title: 'EQAMUZ SPACE REVERB',
    desc: 'SPATIAL DIFFUSION CHAMBER & ALGORITHMIC REFLECTION',
    badge: 'DSP REVERB',
    color: 'purple',
  },
  delay: {
    code: '07',
    title: 'EQAMUZ DELAY MATRIX',
    desc: 'STEREO ECHO MATRIX & TAPE REPEATER',
    badge: 'TEMPO SYNC',
    color: 'amber',
  },
  saturation: {
    code: '03',
    title: 'EQAMUZ SATURATOR',
    desc: 'ANALOG TAPE & TUBE HARMONIC COLORATION',
    badge: 'TAPE WARMTH',
    color: 'rose',
  },
  filter: {
    code: '02',
    title: 'EQAMUZ DUAL FILTER',
    desc: 'BI-QUAD HIGH-PASS & LOW-PASS FREQUENCY SWEEP',
    badge: 'BI-QUAD RESONANCE',
    color: 'cyan',
  },
  chorus: {
    code: '06',
    title: 'EQAMUZ CHORUS MATRIX',
    desc: 'STEREO MULTI-VOICE MODULATION & DIMENSION',
    badge: 'STEREO SPREAD',
    color: 'purple',
  },
  imager: {
    code: '09',
    title: 'EQAMUZ STEREO IMAGER',
    desc: 'POLAR VECTORSCOPE, MID/SIDE FIELD & MONO BASS FOCUS',
    badge: 'M/S EXPANDER',
    color: 'cyan',
  },
};

const PRESETS: Record<FxType, { name: string; params: Record<string, number> }[]> = {
  vocal: [
    { name: 'Hard Tune (Trap)', params: { retuneSpeed: 0, humanize: 10, deEsser: -14, air: 4.5, warmth: 35 } },
    { name: 'Natural Bachata', params: { retuneSpeed: 18, humanize: 65, deEsser: -10, air: 3.0, warmth: 20 } },
    { name: 'Crisp Urban Pop', params: { retuneSpeed: 6, humanize: 35, deEsser: -16, air: 6.0, warmth: 30 } },
    { name: 'Warm Bolero Voice', params: { retuneSpeed: 25, humanize: 80, deEsser: -8, air: 2.0, warmth: 45 } },
  ],
  lead: [
    { name: 'Requinto Brillante', params: { drive: 35, bite: 3400, boost: 7.5, delayTap: 110, mix: 75 } },
    { name: 'Bachata Modern Hot', params: { drive: 55, bite: 2800, boost: 9.0, delayTap: 140, mix: 80 } },
    { name: 'Crunch Mambo Solo', params: { drive: 75, bite: 3600, boost: 10.0, delayTap: 85, mix: 70 } },
    { name: 'Acoustic Lead Clean', params: { drive: 15, bite: 3000, boost: 4.0, delayTap: 160, mix: 60 } },
  ],
  eq: [
    { name: 'Flat', params: { low: 0, mid: 0, midFreq: 1000, high: 0 } },
    { name: 'Vocal Clarity', params: { low: -2.5, mid: 2.0, midFreq: 2800, high: 3.5 } },
    { name: 'Bachata Requinto', params: { low: -4.0, mid: 3.5, midFreq: 3200, high: 4.0 } },
    { name: 'Mambo Punch', params: { low: 3.5, mid: -1.5, midFreq: 500, high: 2.0 } },
    { name: 'Warm Bass', params: { low: 4.5, mid: -2.0, midFreq: 400, high: -2.0 } },
    { name: 'Air Shine', params: { low: 0, mid: 1.0, midFreq: 4000, high: 5.5 } },
  ],
  comp: [
    { name: 'Default', params: { threshold: -18, ratio: 4, attack: 10, release: 200, makeup: 3 } },
    { name: 'Vocal Opto', params: { threshold: -16, ratio: 3, attack: 25, release: 180, makeup: 2.5 } },
    { name: 'Tambora Snap', params: { threshold: -14, ratio: 6, attack: 5, release: 80, makeup: 4 } },
    { name: 'Bus Glue', params: { threshold: -10, ratio: 2.5, attack: 30, release: 120, makeup: 1.5 } },
    { name: 'Aggressive', params: { threshold: -24, ratio: 8, attack: 2, release: 90, makeup: 6 } },
  ],
  reverb: [
    { name: 'Concert Hall', params: { size: 4.2, predelay: 35, tone: 8000, mix: 35 } },
    { name: 'Warm Plate', params: { size: 2.2, predelay: 15, tone: 6000, mix: 25 } },
    { name: 'Bachata Room', params: { size: 1.8, predelay: 20, tone: 9000, mix: 22 } },
    { name: 'Shimmer Ambient', params: { size: 6.5, predelay: 50, tone: 14000, mix: 45 } },
    { name: 'Tight Studio', params: { size: 0.9, predelay: 5, tone: 5000, mix: 15 } },
  ],
  delay: [
    { name: '1/4 Ping Pong', params: { time: 375, feedback: 35, tone: 6500, mix: 30 } },
    { name: '1/8 Slapback', params: { time: 140, feedback: 15, tone: 5000, mix: 25 } },
    { name: 'Dotted 8th', params: { time: 280, feedback: 40, tone: 7500, mix: 32 } },
    { name: 'Mambo Echo', params: { time: 220, feedback: 45, tone: 8500, mix: 28 } },
    { name: 'Dub Space', params: { time: 500, feedback: 65, tone: 3500, mix: 40 } },
  ],
  saturation: [
    { name: 'Tape Warmth', params: { drive: 25, tone: 12000, mix: 80 } },
    { name: 'Tube Drive', params: { drive: 55, tone: 9000, mix: 90 } },
    { name: 'Mambo Crunch', params: { drive: 70, tone: 14000, mix: 75 } },
    { name: 'Subtle Warmth', params: { drive: 15, tone: 16000, mix: 100 } },
  ],
  filter: [
    { name: 'Sub Cut 80Hz', params: { hp: 80, lp: 20000, q: 0.7 } },
    { name: 'Telephone Effect', params: { hp: 500, lp: 3500, q: 1.8 } },
    { name: 'Warm Air', params: { hp: 30, lp: 12000, q: 0.8 } },
  ],
  chorus: [
    { name: 'Vocal Width', params: { rate: 1.2, depth: 35, mix: 45 } },
    { name: 'Guitar Shimmer', params: { rate: 2.4, depth: 55, mix: 50 } },
    { name: 'Subtle Ensemble', params: { rate: 0.6, depth: 25, mix: 30 } },
  ],
  imager: [
    { name: 'Club Mix (Mono Bass)', params: { width: 140, monoBass: 125, airSpread: 2.5 } },
    { name: 'Wide Acoustic Guitars', params: { width: 175, monoBass: 100, airSpread: 3.5 } },
    { name: 'Streaming Radio Ready', params: { width: 125, monoBass: 140, airSpread: 1.5 } },
    { name: 'Tight Focus', params: { width: 90, monoBass: 160, airSpread: 0 } },
  ],
};

export function FxEditor({ slot, trackName, color, onChange, onClose }: FxEditorProps) {
  const { t } = useI18n();
  const specs = FX_PARAMS[slot.type];
  const designation = MODULE_DESIGNATIONS[slot.type] || {
    code: '01',
    title: slot.type.toUpperCase(),
    desc: 'STUDIO AUDIO EFFECT',
    badge: 'DSP',
    color: 'cyan',
  };

  const [activePreset, setActivePreset] = useState<string | null>(null);

  const reset = () => {
    const params: Record<string, number> = {};
    specs.forEach((s) => (params[s.key] = s.def));
    setActivePreset(null);
    onChange({ ...slot, params });
  };

  const applyPreset = (presetName: string, presetParams: Record<string, number>) => {
    setActivePreset(presetName);
    onChange({ ...slot, params: { ...slot.params, ...presetParams } });
  };

  // Calculations for custom graphical visualizers
  const renderVisualizer = () => {
    switch (slot.type) {
      case 'vocal': {
        const retune = paramValue(slot, 'retuneSpeed');
        const humanize = paramValue(slot, 'humanize');
        const deEsser = paramValue(slot, 'deEsser');
        const air = paramValue(slot, 'air');
        const warmth = paramValue(slot, 'warmth');

        return (
          <div className="relative w-full h-24 bg-[#050912] rounded-lg border border-cyan-500/25 overflow-hidden p-2 flex flex-col justify-between">
            {/* Note pitch lanes grid */}
            <div className="absolute inset-0 flex flex-col justify-between p-1.5 pointer-events-none opacity-20 text-[7px] font-mono text-cyan-300">
              <div className="flex justify-between border-b border-cyan-500/30">
                <span>E4 (329 Hz)</span>
                <span>TARGET ROOT</span>
              </div>
              <div className="flex justify-between border-b border-cyan-500/30">
                <span>C#4 (277 Hz)</span>
                <span>SNAPPED 99.8%</span>
              </div>
              <div className="flex justify-between">
                <span>A3 (220 Hz)</span>
                <span>-50c</span>
              </div>
            </div>

            <svg viewBox="0 0 320 80" preserveAspectRatio="none" className="w-full h-12 relative z-10">
              <defs>
                <linearGradient id="vocalPitchFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Raw input vibrato curve */}
              <path
                d="M 0,55 Q 30,62 60,48 T 120,52 Q 150,25 180,18 T 240,24 Q 270,55 320,50"
                fill="none"
                stroke="#4edea3"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              {/* Cyan locked step trajectory */}
              <path
                d="M 0,52 L 70,52 L 80,20 L 220,20 L 230,52 L 320,52"
                fill="none"
                stroke="#00f2fe"
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0 0 6px #00f2fe)' }}
              />
              <path d="M 80,20 L 220,20 L 230,52 L 80,52 Z" fill="url(#vocalPitchFill)" />
              {/* Pitch tracker dot */}
              <circle cx="160" cy="20" r="4" fill="#00f2fe" style={{ filter: 'drop-shadow(0 0 6px #00f2fe)' }} />
            </svg>

            {/* Live HUD telemetry footer */}
            <div className="flex items-center justify-between text-[8px] font-mono text-cyan-300 pt-1 border-t border-cyan-500/20 z-10">
              <span>SNAP: {retune <= 1 ? 'HARD TUNE' : `${retune.toFixed(1)}ms`}</span>
              <span>HUMAN: {humanize}%</span>
              <span>DE-ESS: {deEsser}dB</span>
              <span>AIR: +{air}dB</span>
              <span>WARMTH: {warmth}%</span>
            </div>
          </div>
        );
      }

      case 'lead': {
        const drive = paramValue(slot, 'drive');
        const bite = paramValue(slot, 'bite');
        const boost = paramValue(slot, 'boost');
        const delayTap = paramValue(slot, 'delayTap');

        return (
          <div className="relative w-full h-24 bg-[#0a0c14] rounded-lg border border-amber-500/25 overflow-hidden p-2 flex flex-col justify-between">
            <svg viewBox="0 0 320 80" preserveAspectRatio="none" className="w-full h-12">
              <defs>
                <linearGradient id="leadDriveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 10,70 Q 70,60 140,25 T 230,30 T 310,55"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }}
              />
              <path d="M 10,70 Q 70,60 140,25 T 230,30 T 310,55 L 310,80 L 10,80 Z" fill="url(#leadDriveGrad)" />
              {/* Bite peak node */}
              <circle cx="140" cy="25" r="4.5" fill="#fef08a" stroke="#78350f" strokeWidth="2" />
            </svg>

            <div className="flex items-center justify-between text-[8px] font-mono text-amber-300 pt-1 border-t border-amber-500/20">
              <span>SOLO DRIVE: {drive}%</span>
              <span>BITE: {bite >= 1000 ? `${(bite / 1000).toFixed(1)}k` : bite}Hz</span>
              <span>BOOST: +{boost}dB</span>
              <span>SLAP: {delayTap}ms</span>
            </div>
          </div>
        );
      }

      case 'imager': {
        const width = paramValue(slot, 'width');
        const monoBass = paramValue(slot, 'monoBass');
        const airSpread = paramValue(slot, 'airSpread');
        const widthRatio = width / 100;

        return (
          <div className="relative w-full h-24 bg-[#050a14] rounded-lg border border-sky-500/25 overflow-hidden p-2 flex flex-col justify-between">
            <div className="relative w-full h-12 flex items-center justify-center">
              {/* Polar vectorscope crosshairs */}
              <div className="absolute inset-x-0 h-px bg-white/10" />
              <div className="absolute inset-y-0 w-px bg-white/10" />

              {/* Lissajous stereo width ellipse */}
              <svg viewBox="0 0 200 80" className="w-full h-full">
                <ellipse
                  cx="100"
                  cy="40"
                  rx={Math.max(12, 35 * widthRatio)}
                  ry="28"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  transform="rotate(40 100 40)"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.6))' }}
                />
                <ellipse
                  cx="100"
                  cy="40"
                  rx={Math.max(8, 20 * widthRatio)}
                  ry="22"
                  fill="none"
                  stroke="#4edea3"
                  strokeWidth="1.5"
                  transform="rotate(-40 100 40)"
                  opacity="0.7"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[8px] font-mono text-sky-300 pt-1 border-t border-sky-500/20">
              <span>WIDTH: {width}% ({width < 100 ? 'NARROW' : width === 100 ? 'NORMAL' : 'EXPANDED'})</span>
              <span>MONO BASS: &lt;{monoBass}Hz</span>
              <span>AIR: {airSpread > 0 ? `+${airSpread}` : airSpread}dB</span>
            </div>
          </div>
        );
      }

      case 'eq': {
        const low = paramValue(slot, 'low');
        const mid = paramValue(slot, 'mid');
        const midFreq = paramValue(slot, 'midFreq');
        const high = paramValue(slot, 'high');

        // Points across 20Hz - 20kHz
        const logMin = Math.log10(20);
        const logMax = Math.log10(20000);
        const pts: { x: number; y: number }[] = [];

        for (let i = 0; i <= 60; i++) {
          const ratio = i / 60;
          const freq = Math.pow(10, logMin + ratio * (logMax - logMin));

          // Low shelf contribution (< 300Hz)
          const lowGain = low * (1 / (1 + Math.pow(freq / 200, 2)));
          // Mid peak contribution
          const octDist = Math.abs(Math.log10(freq) - Math.log10(midFreq)) * 3.32;
          const midGain = mid * Math.exp(-0.5 * Math.pow(octDist / 1.2, 2));
          // High shelf contribution (> 2kHz)
          const highGain = high * (Math.pow(freq / 3500, 2) / (1 + Math.pow(freq / 3500, 2)));

          const totalDb = lowGain + midGain + highGain;
          const x = ratio * 320;
          // 0 dB is at y = 50 (height 100, -15dB to +15dB)
          const y = Math.max(10, Math.min(90, 50 - (totalDb / 15) * 35));
          pts.push({ x, y });
        }

        const pathD = `M 0,50 L ${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')} L 320,50`;

        return (
          <div className="relative w-full h-24 bg-[#070b13] rounded-lg border border-cyan-500/20 overflow-hidden p-2">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20 text-[8px] font-mono">
              <div className="flex justify-between border-b border-cyan-400">
                <span>+12dB</span>
                <span>100Hz</span>
                <span>1kHz</span>
                <span>10kHz</span>
              </div>
              <div className="w-full border-b border-cyan-400/50" />
              <div className="flex justify-between border-t border-cyan-400">
                <span>-12dB</span>
              </div>
            </div>

            <svg viewBox="0 0 320 100" preserveAspectRatio="none" className="w-full h-full relative z-10">
              <defs>
                <linearGradient id="eqGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={pathD} fill="url(#eqGlow)" />
              <path
                d={`M ${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`}
                fill="none"
                stroke="#00f2fe"
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0 0 4px #00f2fe)' }}
              />
            </svg>

            <div className="absolute bottom-1 right-2 z-20 flex gap-2 text-[9px] font-mono text-cyan-300/80">
              <span>L: {low > 0 ? `+${low}` : low}dB</span>
              <span>M: {mid > 0 ? `+${mid}` : mid}dB @ {midFreq >= 1000 ? `${(midFreq / 1000).toFixed(1)}k` : midFreq}Hz</span>
              <span>H: {high > 0 ? `+${high}` : high}dB</span>
            </div>
          </div>
        );
      }

      case 'comp': {
        const threshold = paramValue(slot, 'threshold');
        const ratio = paramValue(slot, 'ratio');
        const makeup = paramValue(slot, 'makeup');

        // Compression transfer curve: 0..320 x, 0..100 y (both -60 to 0 dB)
        const thrX = ((threshold + 60) / 60) * 320;
        const thrY = 100 - ((threshold + 60) / 60) * 100;
        const kneeSlope = 1 / ratio;

        return (
          <div className="relative w-full h-24 bg-[#070b13] rounded-lg border border-emerald-500/20 overflow-hidden p-2 flex flex-col justify-between">
            <svg viewBox="0 0 320 100" preserveAspectRatio="none" className="w-full h-full">
              {/* 1:1 Reference Line */}
              <line x1="0" y1="100" x2="320" y2="0" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
              {/* Compression Curve */}
              <path
                d={`M 0,100 L ${thrX},${thrY} L 320,${Math.max(0, thrY - (320 - thrX) * kneeSlope)}`}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0 0 4px #10b981)' }}
              />
            </svg>

            {/* GR Bar & Info */}
            <div className="flex items-center justify-between text-[9px] font-mono text-emerald-300/90 pt-1 border-t border-emerald-500/20">
              <span className="flex items-center gap-1.5">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">Threshold</span>
                <strong>{threshold.toFixed(1)} dB</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">Ratio</span>
                <strong>{ratio.toFixed(1)}:1</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">Makeup</span>
                <strong>+{makeup.toFixed(1)} dB</strong>
              </span>
            </div>
          </div>
        );
      }

      case 'reverb': {
        const size = paramValue(slot, 'size');
        const predelay = paramValue(slot, 'predelay');
        const mix = paramValue(slot, 'mix');

        return (
          <div className="relative w-full h-24 bg-[#070b13] rounded-lg border border-purple-500/20 overflow-hidden p-2">
            {/* Maestro Smart Acoustic Designer */}
            <div className="absolute top-2 right-2 z-20">
              <button
                type="button"
                onClick={() => {
                  const tLow = trackName.toLowerCase();
                  let smartParams = { size: 2.4, predelay: 20, tone: 8500, mix: 25 };
                  if (tLow.includes('voz') || tLow.includes('vocal') || tLow.includes('canto')) {
                    smartParams = { size: 2.2, predelay: 32, tone: 7800, mix: 22 };
                  } else if (tLow.includes('requinto') || tLow.includes('guitar')) {
                    smartParams = { size: 1.8, predelay: 18, tone: 9200, mix: 24 };
                  } else if (tLow.includes('bajo') || tLow.includes('bass')) {
                    smartParams = { size: 0.8, predelay: 5, tone: 3200, mix: 10 };
                  } else if (tLow.includes('bongo') || tLow.includes('tambora') || tLow.includes('guira') || tLow.includes('drum')) {
                    smartParams = { size: 1.2, predelay: 10, tone: 6500, mix: 16 };
                  }
                  onChange({ ...slot, params: { ...slot.params, ...smartParams } });
                }}
                className="flex items-center gap-1 rounded bg-purple-500/20 hover:bg-purple-500/35 text-[9px] font-mono font-bold text-purple-300 px-1.5 py-0.5 border border-purple-500/40 transition-colors shadow-sm"
                title="Maestro: calcular acústica óptima según el instrumento"
              >
                <Sparkles className="h-2.5 w-2.5 text-purple-300" />
                <span>✦ Maestro Room</span>
              </button>
            </div>

            <svg viewBox="0 0 320 100" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b0764" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 10,20 Q 60,35 140,65 T 240,85 T 310,95"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0 0 4px #8b5cf6)' }}
              />
              <path d="M 10,20 Q 60,35 140,65 T 240,85 T 310,95 L 320,100 L 0,100 Z" fill="url(#revGrad)" />
            </svg>
            <div className="absolute bottom-1.5 inset-x-2 flex justify-between text-[9px] font-mono text-purple-300">
              <span>RT60: {size.toFixed(1)}s</span>
              <span>PRE-DELAY: {predelay}ms</span>
              <span>WET/DRY: {mix}%</span>
            </div>
          </div>
        );
      }

      case 'delay': {
        const time = paramValue(slot, 'time');
        const feedback = paramValue(slot, 'feedback');
        const mix = paramValue(slot, 'mix');

        return (
          <div className="relative w-full h-24 bg-[#070b13] rounded-lg border border-amber-500/20 overflow-hidden p-2 flex flex-col justify-between">
            <div className="flex items-end justify-center gap-3 h-14">
              {[1, 0.72, 0.5, 0.35, 0.22, 0.12].map((tap, i) => (
                <div
                  key={i}
                  className="w-3 rounded-t bg-gradient-to-t from-amber-600 to-amber-300 transition-all duration-150"
                  style={{
                    height: `${tap * Math.max(25, feedback)}%`,
                    opacity: 0.25 + tap * 0.75,
                    boxShadow: '0 0 6px rgba(245, 158, 11, 0.3)',
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] font-mono text-amber-300 border-t border-amber-500/20 pt-1">
              <span>DELAY: {Math.round(time)} ms</span>
              <span>FEEDBACK: {feedback}%</span>
              <span>MIX: {mix}%</span>
            </div>
          </div>
        );
      }

      case 'saturation': {
        const drive = paramValue(slot, 'drive');
        const tone = paramValue(slot, 'tone');

        return (
          <div className="relative w-full h-24 bg-[#070b13] rounded-lg border border-rose-500/20 overflow-hidden p-2 flex flex-col justify-between">
            <svg viewBox="0 0 320 80" preserveAspectRatio="none" className="w-full h-12">
              <path
                d="M 10,70 C 90,70 120,40 160,40 C 200,40 230,10 310,10"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                style={{ filter: 'drop-shadow(0 0 5px #f43f5e)' }}
              />
            </svg>
            <div className="flex justify-between text-[9px] font-mono text-rose-300 border-t border-rose-500/20 pt-1">
              <span>DRIVE: {drive}%</span>
              <span>TONE: {tone >= 1000 ? `${(tone / 1000).toFixed(1)}k` : tone} Hz</span>
              <span>HARMONICS: TUBE / TAPE</span>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex w-[340px] flex-none flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1019] shadow-2xl transition-all">
      {/* Top hardware accent line */}
      <div className="h-1 w-full" style={{ background: color || '#00f2fe' }} />

      {/* Module Hardware Faceplate Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#0e1624] border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Glowing pulse LED indicator */}
          <div
            className={`h-2.5 w-2.5 rounded-full ${slot.bypass ? 'bg-muted-foreground/40' : 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f2fe]'}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-black text-foreground tracking-wider">
                ⚡ {designation.code} // {designation.title}
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/5">
                {designation.badge}
              </span>
            </div>
            <p className="truncate text-[10px] text-muted-foreground/70 font-medium">
              CANAL: <strong className="text-foreground/90">{trackName}</strong> · {designation.desc}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange({ ...slot, bypass: !slot.bypass })}
            aria-pressed={!slot.bypass}
            title={slot.bypass ? t('Turn on') : t('Bypass')}
            className={`flex h-7 items-center gap-1 px-2 rounded-md font-mono text-[10px] font-bold border transition-colors ${
              slot.bypass
                ? 'bg-surface-3 text-muted-foreground border-white/5'
                : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-[0_0_8px_rgba(0,242,254,0.25)]'
            }`}
          >
            <Power className="h-3 w-3" />
            {slot.bypass ? 'BYPASS' : 'ACTIVE'}
          </button>
          <button
            type="button"
            onClick={reset}
            title={t('Reset to defaults')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preset Quick-Bar */}
      {PRESETS[slot.type] && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#090d15] border-b border-white/5 overflow-x-auto text-[10px]">
          <span className="text-[9px] font-mono font-bold text-muted-foreground/60 uppercase tracking-wider flex-none flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5 text-amber-400" /> Presets:
          </span>
          <div className="flex items-center gap-1 min-w-0">
            {PRESETS[slot.type].map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p.name, p.params)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex-none ${
                  activePreset === p.name
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Central Interactive Display */}
      <div className={`p-3 flex flex-col gap-3 ${slot.bypass ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
        {renderVisualizer()}

        {/* Rotary Knobs Bay */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {specs.map((spec) => {
            const v = paramValue(slot, spec.key);
            return (
              <Knob
                key={spec.key}
                label={t(spec.label)}
                value={v}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                def={spec.def}
                unit={spec.unit}
                log={spec.log}
                color={designation.color}
                onChange={(next) =>
                  onChange({
                    ...slot,
                    params: { ...slot.params, [spec.key]: next },
                  })
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
