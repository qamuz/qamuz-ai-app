import React, { useRef, useState, useCallback } from 'react';

interface StudioFaderProps {
  value: number; // linear gain (0..1.4 or 0..2)
  max?: number;
  unityValue?: number; // default reset on dblclick
  height?: number;
  meterRef?: (el: HTMLDivElement | null) => void;
  peakLabelRef?: (el: HTMLSpanElement | null) => void;
  onChange: (val: number) => void;
}

const UNITY_POS = 0.72; // Unity 0 dB sits 72% up the throw

// eslint-disable-next-line react-refresh/only-export-components
export function toDbString(v: number): string {
  if (v <= 0.0001) return '-∞';
  const db = 20 * Math.log10(v);
  return `${db > 0 ? '+' : ''}${db.toFixed(1)}`;
}

export function StudioFader({
  value,
  max = 1.4,
  unityValue = 0.8,
  height = 150,
  meterRef,
  onChange
}: StudioFaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Convert linear gain to 0..1 throw position
  const toPos = useCallback(
    (gain: number) => {
      if (gain <= 0.0001) return 0;
      if (gain <= 1.0) {
        return Math.pow(gain, 0.5) * UNITY_POS;
      }
      return UNITY_POS + (gain - 1) / (max - 1) * (1 - UNITY_POS);
    },
    [max]
  );

  // Convert 0..1 throw position to linear gain
  const toGain = useCallback(
    (pos: number) => {
      const p = Math.max(0, Math.min(1, pos));
      if (p <= 0.005) return 0;
      if (p <= UNITY_POS) {
        return Math.pow(p / UNITY_POS, 2);
      }
      return 1 + (p - UNITY_POS) / (1 - UNITY_POS) * (max - 1);
    },
    [max]
  );

  const pos = toPos(value);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !trackRef.current) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = trackRef.current.getBoundingClientRect();
    const p = 1 - (e.clientY - rect.top) / rect.height;
    onChange(toGain(p));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const p = 1 - (e.clientY - rect.top) / rect.height;
    onChange(toGain(p));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {

        /* pointer already released */}
    }
  };

  const handleDoubleClick = () => {
    onChange(unityValue);
  };

  return (
    <div data-ev-id="ev_aba7e7cff6" className="flex items-center gap-1.5 select-none" style={{ height }}>
      {/* dB Scale Markings */}
      <div data-ev-id="ev_20a7013a55" className="flex flex-col justify-between h-full text-[8px] font-mono font-semibold text-muted-foreground/60 py-1 text-right select-none w-4">
        <span data-ev-id="ev_c4ff3c6705">+6</span>
        <span data-ev-id="ev_7763b0d7d8" className="text-primary font-bold">0</span>
        <span data-ev-id="ev_496161c52b">-6</span>
        <span data-ev-id="ev_2eeb311355">-12</span>
        <span data-ev-id="ev_195097286b">-24</span>
        <span data-ev-id="ev_569433139a">-48</span>
        <span data-ev-id="ev_e47abade40">-∞</span>
      </div>

      {/* Fader Track & Thumb */}
      <div data-ev-id="ev_9b3a0cc0e6"
      ref={trackRef}
      className="relative w-7 h-full flex items-center justify-center cursor-ns-resize touch-none group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      title={`Volumen: ${toDbString(value)} dB (Doble clic para 0 dB)`}>
        
        {/* Track groove */}
        <div data-ev-id="ev_6278fa9a83" className="absolute w-2 h-full rounded-full bg-[#0a0f17] border border-white/5 shadow-inner">
          {/* Unity reference notch */}
          <div data-ev-id="ev_e6539e064a"
          className="absolute left-0 right-0 h-[1.5px] bg-primary/40 -translate-y-1/2 pointer-events-none"
          style={{ bottom: `${UNITY_POS * 100}%` }} />
          
          {/* Active level fill */}
          <div data-ev-id="ev_a9d7fd1065"
          className="absolute bottom-0 inset-x-0 rounded-full bg-gradient-to-t from-cyan-600/30 to-cyan-400/50"
          style={{ height: `${pos * 100}%` }} />
          
        </div>

        {/* Fader Cap (Hardware console slider thumb) */}
        <div data-ev-id="ev_51fcf1de36"
        className="absolute left-0 right-0 h-8 rounded-[4px] border border-white/20 shadow-md transition-shadow group-hover:border-primary/60"
        style={{
          bottom: `calc(${pos * 100}% - 16px)`,
          background: isDragging ?
          'linear-gradient(180deg, #374151 0%, #1f2937 45%, #111827 55%, #1f2937 100%)' :
          'linear-gradient(180deg, #2d3748 0%, #1a202c 45%, #0f172a 55%, #1a202c 100%)',
          boxShadow: isDragging ?
          '0 0 10px rgba(0, 242, 254, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3)' :
          '0 2px 5px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
        }}>
          
          {/* Metallic ridges on cap */}
          <div data-ev-id="ev_87e67031ed" className="absolute inset-x-1 top-1.5 flex flex-col gap-0.5 opacity-40">
            <div data-ev-id="ev_1a1e40651d" className="h-[1px] bg-white/40" />
            <div data-ev-id="ev_17141f6c56" className="h-[1px] bg-white/40" />
          </div>

          {/* Center line notch */}
          <div data-ev-id="ev_83bb4a4878" className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-cyan-400 shadow-[0_0_4px_#00f2fe]" />

          <div data-ev-id="ev_946f50d41d" className="absolute inset-x-1 bottom-1.5 flex flex-col gap-0.5 opacity-40">
            <div data-ev-id="ev_a06b6f0145" className="h-[1px] bg-white/40" />
            <div data-ev-id="ev_fe7fe04cd6" className="h-[1px] bg-white/40" />
          </div>
        </div>
      </div>

      {/* Stereo LED Peak Meter Bar */}
      <div data-ev-id="ev_ef744f5f15" className="relative h-full w-2.5 rounded-[3px] bg-[#070b12] border border-white/10 overflow-hidden shadow-inner flex flex-col justify-end">
        {/* Background graduation grid lines */}
        <div data-ev-id="ev_7c8d29ab86" className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none z-10 opacity-30">
          <div data-ev-id="ev_3cadbccf1c" className="h-[1px] bg-red-500 w-full" />
          <div data-ev-id="ev_e2fff1e931" className="h-[1px] bg-amber-400 w-full" />
          <div data-ev-id="ev_c21d973d25" className="h-[1px] bg-cyan-400 w-full" />
          <div data-ev-id="ev_d6c53470fb" className="h-[1px] bg-cyan-400 w-full" />
        </div>

        {/* Dynamic Level Bar (animated by ref) */}
        <div data-ev-id="ev_0b11fe6629"
        ref={meterRef}
        className="w-full h-0 transition-[height] duration-75 ease-out rounded-b-[2px]"
        style={{
          background: 'linear-gradient(to top, #00f2fe 0%, #10b981 60%, #f59e0b 85%, #ef4444 100%)',
          boxShadow: '0 0 6px rgba(0, 242, 254, 0.3)'
        }} />
        
      </div>
    </div>);

}