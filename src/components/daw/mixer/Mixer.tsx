import React, { useEffect, useRef, useState } from 'react';
import { Plus, Power, X, Sliders, Volume2, Sparkles, AudioWaveform } from 'lucide-react';
import type { DawEngine } from '@/lib/daw/engine';
import { FX_LABELS, FX_TYPES, MAX_FX, newFx } from '@/lib/daw/fx';
import { uid } from '@/lib/daw/projects';
import type { FxSlot, FxType, Lane, MasterSettings } from '@/lib/daw/types';
import { FxEditor } from '@/components/daw/mixer/FxEditor';
import { Knob } from '@/components/daw/mixer/Knob';
import { StudioFader, toDbString } from '@/components/daw/mixer/StudioFader';
import { useI18n } from '@/hooks/useI18n';

/** Meter height for a linear peak: −60 dB → 0%, 0 dB → 100%. */
const meterPct = (peak: number) =>
  peak <= 0.001 ? 0 : Math.min(100, Math.max(0, ((20 * Math.log10(peak) + 60) / 60) * 100));

const INSERT_CATEGORIES: { category: string; items: FxType[] }[] = [
  { category: 'VOCAL & GUITAR', items: ['vocal', 'lead'] },
  { category: 'EQ & DYNAMICS', items: ['eq', 'comp'] },
  { category: 'TIME & SPACE', items: ['reverb', 'delay'] },
  { category: 'TONE & COLOR', items: ['saturation', 'filter', 'chorus'] },
  { category: 'STEREO & FIELD', items: ['imager'] },
];

const FX_SHORT_NAMES: Record<FxType, string> = {
  vocal: 'VOCAL FORGE',
  lead: 'LEAD EXCITER',
  eq: 'PRO-EQ',
  comp: 'COMP',
  reverb: 'REVERB',
  delay: 'DELAY',
  saturation: 'SATURATOR',
  filter: 'FILTER',
  chorus: 'CHORUS',
  imager: 'IMAGER M/S',
};

const FX_THEME_COLORS: Record<FxType, string> = {
  vocal: '#00f2fe',
  lead: '#f59e0b',
  eq: '#00f2fe',
  comp: '#10b981',
  reverb: '#8b5cf6',
  delay: '#f59e0b',
  saturation: '#f43f5e',
  filter: '#06b6d4',
  chorus: '#a855f7',
  imager: '#38bdf8',
};

interface SlotProps {
  slot?: FxSlot;
  index: number;
  open: boolean;
  picking: boolean;
  onPick: () => void;
  onChoose: (type: FxType) => void;
  onOpen: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

function Slot({
  slot,
  index,
  open,
  picking,
  onPick,
  onChoose,
  onOpen,
  onToggle,
  onRemove,
}: SlotProps) {
  const { t } = useI18n();

  if (!slot) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={onPick}
          aria-expanded={picking}
          aria-label={t('Add effect')}
          className={`group flex h-6 w-full items-center justify-between rounded px-2 text-[10px] font-mono transition-all border ${
            picking
              ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 shadow-[0_0_8px_rgba(0,242,254,0.2)]'
              : 'bg-[#090e17] border-white/5 text-muted-foreground/50 hover:border-white/20 hover:text-foreground'
          }`}
        >
          <span className="opacity-40">{index + 1}</span>
          <span className="flex items-center gap-1 font-semibold">
            <Plus className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            <span>INSERT</span>
          </span>
        </button>

        {picking && (
          <div className="absolute left-0 top-7 z-50 w-52 overflow-hidden rounded-lg border border-cyan-500/30 bg-[#0d1421] p-1 shadow-2xl backdrop-blur-md">
            <div className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-400 border-b border-white/5">
              CADENA SERIAL · SLOT {index + 1}
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {INSERT_CATEGORIES.map((cat) => (
                <div key={cat.category} className="mb-1">
                  <div className="px-2 py-0.5 text-[8px] font-mono uppercase tracking-widest text-muted-foreground/60 font-bold">
                    {cat.category}
                  </div>
                  {cat.items.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onChoose(type)}
                      className="flex w-full items-center justify-between px-2 py-1.5 rounded text-left text-[11px] font-semibold text-foreground hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: FX_THEME_COLORS[type] }}
                        />
                        {FX_SHORT_NAMES[type]}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground/60">
                        {t(FX_LABELS[type])}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const themeColor = FX_THEME_COLORS[slot.type] || '#00f2fe';

  return (
    <div
      className={`group flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-mono border transition-all ${
        open
          ? 'bg-[#131d2e] border-cyan-400/80 shadow-[0_0_10px_rgba(0,242,254,0.25)]'
          : 'bg-[#090e17] border-white/10 hover:border-white/25'
      }`}
    >
      <span className="opacity-40 text-[9px]">{index + 1}</span>

      {/* Bypass power toggle */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={slot.bypass ? t('Turn on') : t('Bypass')}
        className={`flex h-4 w-4 items-center justify-center rounded transition-colors ${
          slot.bypass
            ? 'text-muted-foreground/40 hover:text-muted-foreground'
            : 'text-cyan-400 drop-shadow-[0_0_3px_#00f2fe]'
        }`}
      >
        <Power className="h-2.5 w-2.5" />
      </button>

      {/* Plugin label & open window */}
      <button
        type="button"
        onClick={onOpen}
        className={`min-w-0 flex-1 truncate text-left font-bold transition-colors ${
          slot.bypass
            ? 'text-muted-foreground/50 line-through'
            : 'text-foreground hover:text-cyan-300'
        }`}
      >
        ⚡ {FX_SHORT_NAMES[slot.type]}
      </button>

      {/* Remove slot */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('Remove effect')}
        className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

type OpenFx = { laneId: string; fxId: string };

export function Mixer({
  lanes,
  master,
  engine,
  selectedLaneId,
  onSelectLane,
  onPatchLane,
  onMaster,
}: {
  lanes: Lane[];
  master: MasterSettings;
  engine: DawEngine;
  selectedLaneId: string | null;
  onSelectLane: (id: string) => void;
  onPatchLane: (id: string, patch: Partial<Lane>) => void;
  onMaster: (m: MasterSettings) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<OpenFx[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const meters = useRef(new Map<string, HTMLDivElement>());
  const grRef = useRef<HTMLSpanElement | null>(null);
  const grBarRef = useRef<HTMLDivElement | null>(null);

  const anySolo = lanes.some((l) => l.solo);
  const anyMuted = lanes.some((l) => l.mute);

  // Meter update straight in the DOM every frame — zero React rerenders
  useEffect(() => {
    let raf = 0;
    const shown = new Map<string, number>();
    const loop = () => {
      const levels = engine.getLevels();
      const all: [string, number][] = [
        ...Object.entries(levels.lanes),
        ['__master', levels.master],
      ];
      for (const [id, peak] of all) {
        const el = meters.current.get(id);
        if (!el) continue;
        const target = meterPct(peak);
        const prev = shown.get(id) ?? 0;
        const next = target > prev ? target : Math.max(target, prev - 2.5);
        shown.set(id, next);
        el.style.height = `${next}%`;
      }
      if (grRef.current) {
        grRef.current.textContent =
          levels.reduction < -0.1 ? `${levels.reduction.toFixed(1)} dB` : '0.0 dB';
      }
      if (grBarRef.current) {
        const grPct = Math.min(100, Math.max(0, (-levels.reduction / 12) * 100));
        grBarRef.current.style.width = `${grPct}%`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // Esc closes dropdowns or windows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (picking) setPicking(null);
      else setOpen((o) => o.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const meterRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) meters.current.set(id, el);
    else meters.current.delete(id);
  };

  const isOpen = (fxId: string) => open.some((o) => o.fxId === fxId);
  const toggleOpen = (laneId: string, fxId: string) =>
    setOpen((o) =>
      o.some((x) => x.fxId === fxId)
        ? o.filter((x) => x.fxId !== fxId)
        : [...o, { laneId, fxId }]
    );
  const close = (fxId: string) => setOpen((o) => o.filter((x) => x.fxId !== fxId));
  const setFx = (lane: Lane, fx: FxSlot[]) => onPatchLane(lane.id, { fx });

  const clearAllSolos = () => {
    lanes.forEach((l) => {
      if (l.solo) onPatchLane(l.id, { solo: false });
    });
  };

  const unmuteAll = () => {
    lanes.forEach((l) => {
      if (l.mute) onPatchLane(l.id, { mute: false });
    });
  };

  const windows = open
    .map(({ laneId, fxId }) => {
      const lane = lanes.find((l) => l.id === laneId);
      const slot = lane?.fx?.find((f) => f.id === fxId);
      return lane && slot ? { lane, slot } : null;
    })
    .filter((w): w is { lane: Lane; slot: FxSlot } => w !== null);

  return (
    <div className="flex flex-col bg-[#070b13] text-foreground select-none">
      {/* Console Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0b1019] px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-foreground">
              QAMUZ STUDIO // CONSOLA DSP
            </span>
          </div>
          <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/20">
            {lanes.length} CANALES ACTIVOS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {anySolo && (
            <button
              type="button"
              onClick={clearAllSolos}
              className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 font-mono text-[10px] font-bold text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
            >
              QUITAR SOLOS
            </button>
          )}
          {anyMuted && (
            <button
              type="button"
              onClick={unmuteAll}
              className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 font-mono text-[10px] font-bold text-red-300 border border-red-500/40 hover:bg-red-500/30 transition-colors"
            >
              DESMUTE TODO
            </button>
          )}
        </div>
      </div>

      {/* Mixer Channel Strips Carousel / Matrix */}
      <div className="overflow-x-auto p-3">
        <div className="mx-auto flex w-max items-stretch gap-2">
          {lanes.length === 0 && (
            <div className="flex w-80 items-center justify-center rounded-xl border border-white/5 bg-[#0e1624] p-12 text-center text-sm text-muted-foreground font-mono">
              {t('Add an audio or instrument track to start.')}
            </div>
          )}

          {lanes.map((lane, laneIdx) => {
            const fx = lane.fx ?? [];
            const silenced = lane.mute || (anySolo && !lane.solo);
            const selected = lane.id === selectedLaneId;

            return (
              <div
                key={lane.id}
                onMouseDown={() => onSelectLane(lane.id)}
                className={`flex w-36 flex-none flex-col gap-2.5 rounded-xl border p-2.5 transition-all shadow-md ${
                  selected
                    ? 'border-cyan-500/60 bg-[#0f1726] shadow-[0_0_15px_rgba(0,242,254,0.15)] ring-1 ring-cyan-500/30'
                    : 'border-white/5 bg-[#0a0f18] hover:border-white/20'
                }`}
              >
                {/* Channel Color Stripe & Identification */}
                <div className="flex flex-col gap-1">
                  <div
                    className="h-1.5 w-full rounded-full transition-all"
                    style={{
                      background: lane.color,
                      boxShadow: selected ? `0 0 8px ${lane.color}` : 'none',
                    }}
                  />
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="truncate text-xs font-black tracking-wide" title={lane.name}>
                      {lane.name}
                    </span>
                    <span className="font-mono text-[9px] font-bold text-muted-foreground/60 bg-white/5 px-1 rounded">
                      CH {laneIdx + 1}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/50">
                    {lane.type === 'instrument' ? lane.instrument : 'AUDIO STEM'}
                  </span>
                </div>

                {/* Inserts Bay (5 Slots) */}
                <div className="flex flex-col gap-1 rounded-lg bg-[#060910] p-1.5 border border-white/5">
                  <div className="flex items-center justify-between text-[8px] font-mono font-bold uppercase tracking-wider text-muted-foreground/60 px-0.5 pb-0.5">
                    <span>INSERTS</span>
                    <span>{fx.length}/5</span>
                  </div>

                  {Array.from({ length: MAX_FX }, (_, i) => {
                    const slot = fx[i];
                    const key = `${lane.id}:${i}`;
                    return (
                      <Slot
                        key={slot?.id ?? key}
                        slot={slot}
                        index={i}
                        open={slot ? isOpen(slot.id) : false}
                        picking={!slot && picking === key}
                        onPick={() => setPicking(picking === key ? null : key)}
                        onChoose={(type) => {
                          const created = newFx(type, uid());
                          setFx(lane, [...fx, created]);
                          setPicking(null);
                          setOpen((o) => [...o, { laneId: lane.id, fxId: created.id }]);
                        }}
                        onOpen={() => slot && toggleOpen(lane.id, slot.id)}
                        onToggle={() =>
                          slot &&
                          setFx(
                            lane,
                            fx.map((f) => (f.id === slot.id ? { ...f, bypass: !f.bypass } : f))
                          )
                        }
                        onRemove={() => {
                          if (!slot) return;
                          close(slot.id);
                          setFx(
                            lane,
                            fx.filter((f) => f.id !== slot.id)
                          );
                        }}
                      />
                    );
                  })}
                </div>

                {/* Pan Knob Bay */}
                <div className="flex justify-center py-1">
                  <Knob
                    label={t('Pan')}
                    value={lane.pan}
                    min={-1}
                    max={1}
                    step={0.02}
                    def={0}
                    color="cyan"
                    size={46}
                    badge={
                      lane.pan === 0
                        ? 'C'
                        : `${lane.pan < 0 ? 'L' : 'R'}${Math.round(Math.abs(lane.pan) * 100)}`
                    }
                    onChange={(val) => onPatchLane(lane.id, { pan: val })}
                  />
                </div>

                {/* Studio Fader & Meter Section */}
                <div className="flex flex-col items-center gap-1.5 rounded-lg bg-[#060910]/80 p-2 border border-white/5">
                  <StudioFader
                    value={lane.volume}
                    max={1.4}
                    unityValue={0.8}
                    height={150}
                    meterRef={meterRef(lane.id)}
                    onChange={(val) => onPatchLane(lane.id, { volume: val })}
                  />

                  {/* Volume dB Readout */}
                  <span
                    className={`font-mono text-[10px] font-black tabular-nums transition-colors ${
                      silenced ? 'text-muted-foreground/40' : 'text-foreground'
                    }`}
                  >
                    {toDbString(lane.volume)} dB
                  </span>
                </div>

                {/* Studio Mute & Solo Push Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPatchLane(lane.id, { mute: !lane.mute })}
                    aria-pressed={lane.mute}
                    aria-label={t('Mute')}
                    className={`h-8 rounded-lg font-mono text-[11px] font-black transition-all border ${
                      lane.mute
                        ? 'bg-red-500/25 text-red-300 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                        : 'bg-[#0f1724] text-muted-foreground/70 border-white/5 hover:text-foreground hover:bg-[#162133]'
                    }`}
                  >
                    M
                  </button>

                  <button
                    type="button"
                    onClick={() => onPatchLane(lane.id, { solo: !lane.solo })}
                    aria-pressed={lane.solo}
                    aria-label={t('Solo')}
                    className={`h-8 rounded-lg font-mono text-[11px] font-black transition-all border ${
                      lane.solo
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                        : 'bg-[#0f1724] text-muted-foreground/70 border-white/5 hover:text-foreground hover:bg-[#162133]'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>
            );
          })}

          {/* MASTER BUS STRIP */}
          <div className="flex w-44 flex-none flex-col gap-2.5 rounded-xl border border-cyan-500/40 bg-[#0c1424] p-2.5 shadow-2xl ring-1 ring-cyan-500/20">
            {/* Master Header */}
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-cyan-400 via-primary to-purple-500 shadow-[0_0_8px_#00f2fe]" />
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-mono text-xs font-black uppercase tracking-wider text-cyan-300">
                  MASTER BUS
                </span>
                <span className="rounded bg-cyan-400/10 px-1.5 py-0.2 font-mono text-[8px] font-bold text-cyan-300 border border-cyan-400/20">
                  STEREO OUT
                </span>
              </div>
            </div>

            {/* Master Brickwall Limiter Unit */}
            <div className="flex flex-col gap-2 rounded-lg bg-[#060910] p-2 border border-cyan-500/20">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-black uppercase text-cyan-400">
                  LIMITER // ISP
                </span>
                <button
                  type="button"
                  onClick={() => onMaster({ ...master, limiter: !master.limiter })}
                  aria-pressed={master.limiter}
                  className={`flex h-5 items-center gap-1 rounded px-1.5 text-[9px] font-mono font-bold border transition-colors ${
                    master.limiter
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_6px_rgba(0,242,254,0.3)]'
                      : 'bg-white/5 text-muted-foreground border-white/5'
                  }`}
                >
                  <Power className="h-2.5 w-2.5" />
                  {master.limiter ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Ceiling & Drive Knobs */}
              <div className={`grid grid-cols-2 gap-1 ${master.limiter ? '' : 'opacity-40'}`}>
                <Knob
                  label={t('Ceiling')}
                  value={master.ceiling}
                  min={-12}
                  max={0}
                  step={0.1}
                  def={-1}
                  unit="dB"
                  color="cyan"
                  size={42}
                  onChange={(val) => onMaster({ ...master, ceiling: val })}
                />
                <Knob
                  label={t('Drive')}
                  value={master.drive}
                  min={0}
                  max={12}
                  step={0.1}
                  def={0}
                  unit="dB"
                  color="amber"
                  size={42}
                  onChange={(val) => onMaster({ ...master, drive: val })}
                />
              </div>

              {/* Dynamic Gain Reduction Meter */}
              <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                <div className="flex justify-between text-[8px] font-mono text-muted-foreground">
                  <span>GR LADDER</span>
                  <span ref={grRef} className="font-bold text-cyan-300 font-mono">
                    0.0 dB
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#111827] overflow-hidden">
                  <div
                    ref={grBarRef}
                    className="h-full w-0 bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-75"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1" />

            {/* Master Studio Fader & Dual Meter */}
            <div className="flex flex-col items-center gap-1.5 rounded-lg bg-[#060910]/80 p-2 border border-white/5">
              <StudioFader
                value={master.volume}
                max={1.4}
                unityValue={1.0}
                height={150}
                meterRef={meterRef('__master')}
                onChange={(val) => onMaster({ ...master, volume: val })}
              />

              <span className="font-mono text-[10px] font-black tabular-nums text-cyan-300">
                {toDbString(master.volume)} dB
              </span>
            </div>

            <div className="h-8" />
          </div>
        </div>
      </div>

      {/* Hardware FX Rack Dock (Bottom Layer) */}
      {windows.length > 0 && (
        <div className="border-t border-white/10 bg-[#080d15] p-3 shadow-inner">
          <div className="flex items-center justify-between pb-2 px-1">
            <span className="flex items-center gap-1.5 font-mono text-xs font-black text-cyan-400 tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> RACK DE PLUGINS HARDWARE // EQAMUZ
              SUITE
            </span>
            <button
              type="button"
              onClick={() => setOpen([])}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              CERRAR TODOS ({windows.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="mx-auto flex w-max items-start gap-4 pb-2">
              {windows.map(({ lane, slot }) => (
                <FxEditor
                  key={slot.id}
                  slot={slot}
                  trackName={lane.name}
                  color={lane.color}
                  onChange={(next) =>
                    setFx(
                      lane,
                      (lane.fx ?? []).map((f) => (f.id === next.id ? next : f))
                    )
                  }
                  onClose={() => close(slot.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
