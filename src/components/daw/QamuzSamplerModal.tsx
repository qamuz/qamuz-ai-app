import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  Disc3,
  Flame,
  Music2,
  Play,
  Power,
  Radio,
  Sliders,
  Volume2,
  Waves,
  X,
  Zap } from
'lucide-react';
import { midiToFreq, playVoice } from '@/lib/daw/synth';
import type { InstrumentPreset } from '@/lib/daw/types';

export interface SamplerPad {
  id: string;
  index: number;
  name: string;
  preset: InstrumentPreset;
  kind: 'percussion' | 'melodic' | 'bass' | 'voice';
  color: string;
  baseMidi: number;
  gain: number;
  pan: number;
}

const DEFAULT_CHANNELS: SamplerPad[] = [
// BANK A: 1-8
{ id: 'ch-1', index: 1, name: 'Requinto', preset: 'requinto', kind: 'melodic', color: '#06b6d4', baseMidi: 64, gain: 0.85, pan: -0.1 },
{ id: 'ch-2', index: 2, name: 'Segunda', preset: 'segunda', kind: 'melodic', color: '#10b981', baseMidi: 57, gain: 0.8, pan: 0.2 },
{ id: 'ch-3', index: 3, name: 'Bongó', preset: 'bongo', kind: 'percussion', color: '#f59e0b', baseMidi: 60, gain: 0.9, pan: -0.2 },
{ id: 'ch-4', index: 4, name: 'Güira', preset: 'guira', kind: 'percussion', color: '#eab308', baseMidi: 62, gain: 0.85, pan: 0.25 },
{ id: 'ch-5', index: 5, name: 'Tambora', preset: 'tambora', kind: 'percussion', color: '#ef4444', baseMidi: 48, gain: 0.95, pan: 0 },
{ id: 'ch-6', index: 6, name: 'Slap Bass', preset: 'slapBass', kind: 'bass', color: '#8b5cf6', baseMidi: 40, gain: 0.9, pan: 0 },
{ id: 'ch-7', index: 7, name: 'Piano Bachatero', preset: 'piano', kind: 'melodic', color: '#3b82f6', baseMidi: 60, gain: 0.8, pan: 0 },
{ id: 'ch-8', index: 8, name: 'Maracas', preset: 'maracas', kind: 'percussion', color: '#ec4899', baseMidi: 69, gain: 0.75, pan: 0.3 },

// BANK B: 9-16
{ id: 'ch-9', index: 9, name: 'Synth Lead', preset: 'synth', kind: 'melodic', color: '#06b6d4', baseMidi: 65, gain: 0.8, pan: 0 },
{ id: 'ch-10', index: 10, name: 'Pad Ambiente', preset: 'pad', kind: 'melodic', color: '#a855f7', baseMidi: 60, gain: 0.7, pan: 0 },
{ id: 'ch-11', index: 11, name: 'Guitar Pluck', preset: 'pluck', kind: 'melodic', color: '#14b8a6', baseMidi: 62, gain: 0.85, pan: -0.15 },
{ id: 'ch-12', index: 12, name: 'Sub Bass 808', preset: 'bass', kind: 'bass', color: '#6366f1', baseMidi: 36, gain: 0.95, pan: 0 },
{ id: 'ch-13', index: 13, name: 'Bongó Macho', preset: 'bongo', kind: 'percussion', color: '#f97316', baseMidi: 67, gain: 0.9, pan: -0.3 },
{ id: 'ch-14', index: 14, name: 'Güira Majao', preset: 'guira', kind: 'percussion', color: '#facc15', baseMidi: 65, gain: 0.85, pan: 0.3 },
{ id: 'ch-15', index: 15, name: 'Tambora Mambo', preset: 'tambora', kind: 'percussion', color: '#f43f5e', baseMidi: 53, gain: 0.95, pan: 0.05 },
{ id: 'ch-16', index: 16, name: 'Requinto Solo', preset: 'requinto', kind: 'melodic', color: '#38bdf8', baseMidi: 72, gain: 0.9, pan: 0 },

// BANK C: 17-24
{ id: 'ch-17', index: 17, name: 'Mambo Horns', preset: 'synth', kind: 'melodic', color: '#fb923c', baseMidi: 62, gain: 0.85, pan: 0.1 },
{ id: 'ch-18', index: 18, name: 'Acoustic Segunda', preset: 'segunda', kind: 'melodic', color: '#34d399', baseMidi: 55, gain: 0.8, pan: -0.2 },
{ id: 'ch-19', index: 19, name: 'Campana / Cowbell', preset: 'bongo', kind: 'percussion', color: '#fde047', baseMidi: 74, gain: 0.8, pan: 0.2 },
{ id: 'ch-20', index: 20, name: 'Clave Latina', preset: 'maracas', kind: 'percussion', color: '#f472b6', baseMidi: 76, gain: 0.85, pan: 0 },
{ id: 'ch-21', index: 21, name: 'Bajo Acústico', preset: 'bass', kind: 'bass', color: '#818cf8', baseMidi: 41, gain: 0.9, pan: 0 },
{ id: 'ch-22', index: 22, name: 'Atmosphere Strings', preset: 'pad', kind: 'melodic', color: '#c084fc', baseMidi: 64, gain: 0.75, pan: 0 },
{ id: 'ch-23', index: 23, name: 'Bongó Repique', preset: 'bongo', kind: 'percussion', color: '#fbbf24', baseMidi: 71, gain: 0.9, pan: -0.15 },
{ id: 'ch-24', index: 24, name: 'FX Riser / Hit', preset: 'pluck', kind: 'melodic', color: '#2dd4bf', baseMidi: 60, gain: 0.85, pan: 0 }];


interface QamuzSamplerModalProps {
  onClose: () => void;
  onTriggerMidiNote?: (pitch: number, velocity: number) => void;
}

export function QamuzSamplerModal({ onClose, onTriggerMidiNote }: QamuzSamplerModalProps) {
  const [channels, setChannels] = useState<SamplerPad[]>(DEFAULT_CHANNELS);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [bank, setBank] = useState(0); // 0=A, 1=B, 2=C
  const [powered, setPowered] = useState(true);
  const [masterVol, setMasterVol] = useState(0.85);
  const [activePanel, setActivePanel] = useState<'none' | 'eq' | 'chorus' | 'space' | 'dynamics'>('none');
  const [fxParams, setFxParams] = useState({ drive: 45, tone: 55, mix: 40, output: 80 });
  const [activePadHits, setActivePadHits] = useState<Set<number>>(new Set());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const activeChannel = channels[selectedIdx] ?? channels[0];
  const visiblePads = channels.slice(bank * 8, bank * 8 + 8);

  // Initialize Audio Context on demand
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext;}).webkitAudioContext;
      const ctx = new AudioContextClass({ latencyHint: 'interactive' });
      const master = ctx.createGain();
      master.gain.value = masterVol;
      master.connect(ctx.destination);
      audioCtxRef.current = ctx;
      masterGainRef.current = master;
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, master: masterGainRef.current! };
  };

  // Update master volume
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(masterVol, audioCtxRef.current.currentTime, 0.02);
    }
  }, [masterVol]);

  // Clean up Audio Context on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Play a sound from a pad
  const triggerPad = (channel: SamplerPad, noteOffset = 0) => {
    if (!powered) return;
    const { ctx, master } = getAudioContext();
    const pitch = channel.baseMidi + noteOffset;
    const velocity = channel.gain * (fxParams.output / 100);

    // Flash pad visual feedback
    setActivePadHits((prev) => new Set(prev).add(channel.index));
    setTimeout(() => {
      setActivePadHits((prev) => {
        const next = new Set(prev);
        next.delete(channel.index);
        return next;
      });
    }, 180);

    // Play synthesized instrument voice
    const voice = playVoice(ctx, master, channel.preset, pitch, ctx.currentTime, velocity, channel.kind === 'percussion' ? 0.2 : 0.45);
    setTimeout(() => voice.release(ctx.currentTime + 0.1), channel.kind === 'percussion' ? 180 : 400);

    // Trigger note in DAW if connected
    onTriggerMidiNote?.(pitch, velocity);
  };

  // Keyboard listeners for 1-8 and Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8) {
        const pad = visiblePads[num - 1];
        if (pad) {
          triggerPad(pad);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePads, powered, fxParams, onClose]);

  return createPortal(
    <div data-ev-id="ev_07e1f28796" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6" onClick={onClose}>
			<div data-ev-id="ev_53dfaaf829"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-border bg-[#0a0f14] shadow-2xl shadow-cyan-950/40 text-[#e6f1f5]">
        
				{/* Top Bar / Hardware Header */}
				<header data-ev-id="ev_c3c494b314" className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-[#070b0f] px-5 py-3">
					<div data-ev-id="ev_efd10589fa" className="flex items-center gap-4">
						<button data-ev-id="ev_d7d2949f30"
            type="button"
            onClick={() => setPowered(!powered)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
            powered ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-500/30' : 'bg-surface-2 text-muted-foreground border border-border'}`
            }>
              
							<Power className="w-3.5 h-3.5" />
							<span data-ev-id="ev_9056c71fc3">{powered ? 'ONLINE' : 'STANDBY'}</span>
						</button>
						<div data-ev-id="ev_6b8e3e4b16" className="flex items-center gap-2">
							<div data-ev-id="ev_5faee95315" className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
								<Disc3 className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
							</div>
							<div data-ev-id="ev_9ef3fa20e9">
								<div data-ev-id="ev_e821db9c77" className="flex items-center gap-1.5">
									<h2 data-ev-id="ev_da88e73469" className="text-sm font-black tracking-widest text-foreground">QAMUZ SAMPLER</h2>
									<span data-ev-id="ev_7180826bbe" className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-400">v2.0 PRO</span>
								</div>
								<p data-ev-id="ev_5403edaf85" className="text-[10px] text-muted-foreground tracking-wide">MOTOR DE RITMOS & INSTRUMENTOS LATINOS</p>
							</div>
						</div>
					</div>

					{/* Active Channel Selector & Master Controls */}
					<div data-ev-id="ev_0452f610f5" className="flex items-center gap-4">
						<div data-ev-id="ev_50876f4483" className="flex items-center gap-2 rounded-lg border border-border bg-[#0d141b] px-3 py-1 text-xs">
							<span data-ev-id="ev_5638465430" className="text-[10px] font-bold text-muted-foreground uppercase">Canal</span>
							<select data-ev-id="ev_0bb648b9b7"
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-cyan-400 focus:outline-none cursor-pointer">
                
								{channels.map((ch, idx) =>
                <option data-ev-id="ev_c5be5d4559" key={ch.id} value={idx} className="bg-[#0b1016] text-foreground">
										CH {String(ch.index).padStart(2, '0')} · {ch.name}
									</option>
                )}
							</select>
						</div>

						<div data-ev-id="ev_5fca813251" className="flex items-center gap-2">
							<Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
							<input data-ev-id="ev_7edbbd2428"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVol}
              onChange={(e) => setMasterVol(Number(e.target.value))}
              className="h-1.5 w-20 cursor-pointer accent-cyan-400"
              title={`Master: ${Math.round(masterVol * 100)}%`} />
              
						</div>

						<button data-ev-id="ev_6d267f779c"
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
              
							<X className="w-4 h-4" />
						</button>
					</div>
				</header>

				{/* DSP Effects Strip (EQAMUZ, Chorus, Delay & Reverb, Dinámica) */}
				<div data-ev-id="ev_1eb8279ebc" className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-border/60 bg-[#090e13] p-3">
					<button data-ev-id="ev_3b394415ee"
          type="button"
          onClick={() => setActivePanel(activePanel === 'eq' ? 'none' : 'eq')}
          className={`flex flex-col text-left rounded-xl p-3 border transition-all ${
          activePanel === 'eq' ? 'border-cyan-500/60 bg-cyan-950/20' : 'border-border/60 bg-[#0d141c]/60 hover:bg-[#0d141c]'}`
          }>
            
						<span data-ev-id="ev_526a5ad6cf" className="text-[10px] font-bold text-cyan-400 tracking-wider">EQAMUZ</span>
						<span data-ev-id="ev_5de171cf30" className="text-xs font-semibold text-foreground mt-0.5">Parametric EQ</span>
						<span data-ev-id="ev_53eacac05e" className="text-[9px] text-muted-foreground mt-1">Bajos · Medios · Brillo</span>
					</button>

					<button data-ev-id="ev_9ce7e4959c"
          type="button"
          onClick={() => setActivePanel(activePanel === 'chorus' ? 'none' : 'chorus')}
          className={`flex flex-col text-left rounded-xl p-3 border transition-all ${
          activePanel === 'chorus' ? 'border-amber-500/60 bg-amber-950/20' : 'border-border/60 bg-[#0d141c]/60 hover:bg-[#0d141c]'}`
          }>
            
						<span data-ev-id="ev_8e767243a3" className="text-[10px] font-bold text-amber-400 tracking-wider">CHORUS BBD</span>
						<span data-ev-id="ev_d23641f5a7" className="text-xs font-semibold text-foreground mt-0.5">Guitar Rasgueo</span>
						<span data-ev-id="ev_e0abc83cf3" className="text-[9px] text-muted-foreground mt-1">Ancho Estéreo · Calidez</span>
					</button>

					<button data-ev-id="ev_204b94958b"
          type="button"
          onClick={() => setActivePanel(activePanel === 'space' ? 'none' : 'space')}
          className={`flex flex-col text-left rounded-xl p-3 border transition-all ${
          activePanel === 'space' ? 'border-purple-500/60 bg-purple-950/20' : 'border-border/60 bg-[#0d141c]/60 hover:bg-[#0d141c]'}`
          }>
            
						<span data-ev-id="ev_cf2e268661" className="text-[10px] font-bold text-purple-400 tracking-wider">DELAY & REVERB</span>
						<span data-ev-id="ev_4c9933d34e" className="text-xs font-semibold text-foreground mt-0.5">Tape Echo & Plate</span>
						<span data-ev-id="ev_96c7e6fec8" className="text-[9px] text-muted-foreground mt-1">Ambiente de Estudio</span>
					</button>

					<button data-ev-id="ev_86332bb537"
          type="button"
          onClick={() => setActivePanel(activePanel === 'dynamics' ? 'none' : 'dynamics')}
          className={`flex flex-col text-left rounded-xl p-3 border transition-all ${
          activePanel === 'dynamics' ? 'border-rose-500/60 bg-rose-950/20' : 'border-border/60 bg-[#0d141c]/60 hover:bg-[#0d141c]'}`
          }>
            
						<span data-ev-id="ev_58245d3c5d" className="text-[10px] font-bold text-rose-400 tracking-wider">DINÁMICA & LIMIT</span>
						<span data-ev-id="ev_fdbeee28f8" className="text-xs font-semibold text-foreground mt-0.5">Punch Comp</span>
						<span data-ev-id="ev_31772262e6" className="text-[9px] text-muted-foreground mt-1">Pegada de Tambora y Bongó</span>
					</button>
				</div>

				{/* FX Controls Popover (if opened) */}
				{activePanel !== 'none' &&
        <div data-ev-id="ev_7ba466a85f" className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-[#060a0e] px-5 py-3 animate-in fade-in slide-in-from-top-1">
						<div data-ev-id="ev_7d1789f58d" className="flex items-center gap-2">
							<Sliders className="w-4 h-4 text-cyan-400" />
							<span data-ev-id="ev_6e859b06c1" className="text-xs font-bold tracking-wide uppercase text-foreground">
								DSP {activePanel.toUpperCase()} · CH {activeChannel.index} {activeChannel.name}
							</span>
						</div>
						<div data-ev-id="ev_763a13f6b6" className="flex flex-wrap items-center gap-5 text-xs">
							{(['drive', 'tone', 'mix', 'output'] as const).map((knob) =>
            <label data-ev-id="ev_6418e507fa" key={knob} className="flex items-center gap-2 text-muted-foreground font-semibold">
									<span data-ev-id="ev_a5c7230d9f" className="text-[10px] uppercase tracking-wider">{knob}</span>
									<input data-ev-id="ev_05acfd2c42"
              type="range"
              min="0"
              max="100"
              value={fxParams[knob]}
              onChange={(e) => setFxParams({ ...fxParams, [knob]: Number(e.target.value) })}
              className="h-1.5 w-16 cursor-pointer accent-cyan-400" />
              
									<span data-ev-id="ev_265e24e906" className="text-[10px] text-cyan-400 w-6 font-mono">{fxParams[knob]}%</span>
								</label>
            )}
						</div>
					</div>
        }

				{/* Bank Switcher & Actions Bar */}
				<div data-ev-id="ev_b2914c836b" className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-[#080d12] px-4 py-2">
					<div data-ev-id="ev_0e44aa511b" className="flex items-center gap-1.5">
						{[
            { id: 0, label: 'BANK A · 1–8' },
            { id: 1, label: 'BANK B · 9–16' },
            { id: 2, label: 'BANK C · 17–24' }].
            map((b) =>
            <button data-ev-id="ev_3a490d8429"
            key={b.id}
            type="button"
            onClick={() => setBank(b.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
            bank === b.id ?
            'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-500/20' :
            'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground border border-border/40'}`
            }>
              
								{b.label}
							</button>
            )}
					</div>

					<div data-ev-id="ev_124d0516dd" className="flex items-center gap-2">
						<span data-ev-id="ev_86ecf3f55c" className="hidden sm:inline text-[10px] text-muted-foreground tracking-wider">
							ATAJOS: TECLAS <kbd data-ev-id="ev_f69d08bb87" className="rounded bg-surface-3 px-1 py-0.5 text-foreground font-mono">1</kbd> A{' '}
							<kbd data-ev-id="ev_931525518c" className="rounded bg-surface-3 px-1 py-0.5 text-foreground font-mono">8</kbd>
						</span>
						<button data-ev-id="ev_adf8d22cb8"
            type="button"
            onClick={() => triggerPad(activeChannel)}
            className="flex items-center gap-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 px-3 py-1.5 text-xs font-semibold text-foreground border border-border transition-colors">
              
							<Play className="w-3 h-3 text-cyan-400" />
							<span data-ev-id="ev_66aef05559">Probar {activeChannel.name}</span>
						</button>
					</div>
				</div>

				{/* 8 Drum / Melodic Pads Grid */}
				<div data-ev-id="ev_93956400f7" className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 p-4 bg-[#0a0f15] overflow-y-auto">
					{visiblePads.map((pad, idx) => {
            const isSelected = channels[selectedIdx]?.id === pad.id;
            const isHit = activePadHits.has(pad.index);
            return (
              <button data-ev-id="ev_8bd463ddf5"
              key={pad.id}
              type="button"
              onClick={() => {
                setSelectedIdx(pad.index - 1);
                triggerPad(pad);
              }}
              style={{
                borderColor: isSelected || isHit ? pad.color : undefined,
                boxShadow: isHit ? `0 0 25px ${pad.color}88, inset 0 0 20px ${pad.color}44` : undefined
              }}
              className={`group relative flex flex-col justify-between h-36 rounded-xl border p-3 text-left transition-all cursor-pointer ${
              isSelected ?
              'bg-[#111c24] border-2 shadow-lg shadow-black/40 scale-[1.02]' :
              'bg-[#0e151c] border-border/70 hover:border-border hover:bg-[#121a22]'}`
              }>
                
								{/* Top Header of Pad */}
								<div data-ev-id="ev_6bab4818a4" className="flex items-center justify-between w-full">
									<span data-ev-id="ev_a4d4f7b908" className="text-[10px] font-mono font-bold text-muted-foreground">
										{String(pad.index).padStart(2, '0')}
									</span>
									<span data-ev-id="ev_d63c6e4388"
                  className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${pad.color}22`, color: pad.color }}>
                    
										{pad.kind}
									</span>
								</div>

								{/* Center Trigger Icon / LED */}
								<div data-ev-id="ev_ab113e2a82" className="my-auto flex flex-col items-center">
									<div data-ev-id="ev_0790884085"
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${pad.color}15`,
                    color: pad.color,
                    border: `1px solid ${pad.color}40`
                  }}>
                    
										{pad.kind === 'percussion' ?
                    <Flame className="w-5 h-5" /> :
                    pad.kind === 'bass' ?
                    <Waves className="w-5 h-5" /> :

                    <Music2 className="w-5 h-5" />
                    }
									</div>
								</div>

								{/* Bottom Pad Name */}
								<div data-ev-id="ev_0a94177569" className="w-full">
									<div data-ev-id="ev_239f5c9093" className="text-xs font-bold text-foreground truncate group-hover:text-cyan-400 transition-colors">
										{pad.name}
									</div>
									<div data-ev-id="ev_dab486048a" className="text-[9px] text-muted-foreground truncate">{pad.preset}</div>
								</div>

								{/* Hotkey Indicator */}
								<span data-ev-id="ev_3aedda0d68" className="absolute bottom-1 right-2 text-[9px] font-mono text-muted-foreground/60">
									[{idx + 1}]
								</span>
							</button>);

          })}
				</div>

				{/* Chromatic Note Keyboard for active channel */}
				<div data-ev-id="ev_22e6d78f41" className="border-t border-border/60 bg-[#070b0f] p-3">
					<div data-ev-id="ev_23915ef971" className="flex items-center justify-between mb-2">
						<span data-ev-id="ev_08b88fa4dc" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
							Teclado Cromático · {activeChannel.name}
						</span>
						<span data-ev-id="ev_1dd95ba1e9" className="text-[9px] text-muted-foreground">Toca notas para improvisar melodías y acordes</span>
					</div>
					<div data-ev-id="ev_8a4110310d" className="grid grid-cols-8 gap-1.5 h-16">
						{[
            { note: 'C', offset: 0 },
            { note: 'D', offset: 2 },
            { note: 'E', offset: 4 },
            { note: 'F', offset: 5 },
            { note: 'G', offset: 7 },
            { note: 'A', offset: 9 },
            { note: 'B', offset: 11 },
            { note: 'C+', offset: 12 }].
            map((k) =>
            <button data-ev-id="ev_52ef0150f3"
            key={k.note}
            type="button"
            onClick={() => triggerPad(activeChannel, k.offset)}
            className="flex flex-col items-center justify-end pb-2 rounded-lg bg-gradient-to-b from-[#e2e8f0] to-[#94a3b8] text-slate-900 font-bold text-xs shadow hover:brightness-110 active:brightness-90 transition-all">
              
								<span data-ev-id="ev_aae7071c3d" className="text-[11px] font-mono">{k.note}</span>
							</button>
            )}
					</div>
				</div>

				{/* Footer Bar */}
				<footer data-ev-id="ev_f0f8ff1483" className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-[#05080c] px-5 py-2.5 text-xs text-muted-foreground">
					<div data-ev-id="ev_469a66a318" className="flex items-center gap-3">
						<span data-ev-id="ev_cf9d611916" className="font-mono text-cyan-400 font-bold">CH {String(activeChannel.index).padStart(2, '0')}</span>
						<span data-ev-id="ev_86b9a8be2d" className="font-semibold text-foreground">{activeChannel.name}</span>
						<span data-ev-id="ev_a9f3d96c57" className="text-[10px] text-muted-foreground">• Pan: {activeChannel.pan > 0 ? `+${activeChannel.pan}` : activeChannel.pan}</span>
					</div>
					<div data-ev-id="ev_3bd4771562" className="flex items-center gap-3">
						<span data-ev-id="ev_55ed2c0c63" className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-semibold">
							<span data-ev-id="ev_8006469594" className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
							DSP AUDIO RENDERING ACTIVO
						</span>
					</div>
				</footer>
			</div>
		</div>,
    document.body
  );
}