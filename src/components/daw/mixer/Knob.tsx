import React, { useRef, useState, useCallback } from 'react';

export interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  def?: number;
  unit?: string;
  badge?: string;
  sublabel?: string;
  log?: boolean;
  color?: 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose';
  size?: number;
  onChange: (val: number) => void;
  onReset?: () => void;
}

const COLOR_MAP = {
  cyan: {
    stroke: '#00f2fe',
    glow: 'rgba(0, 242, 254, 0.4)',
    badgeBg: 'rgba(0, 242, 254, 0.15)',
    badgeText: '#00f2fe'
  },
  emerald: {
    stroke: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#34d399'
  },
  amber: {
    stroke: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeText: '#fbbf24'
  },
  purple: {
    stroke: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.4)',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    badgeText: '#a78bfa'
  },
  rose: {
    stroke: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.4)',
    badgeBg: 'rgba(244, 63, 94, 0.15)',
    badgeText: '#fb7185'
  }
};

export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  def,
  unit = '',
  badge,
  sublabel,
  log = false,
  color = 'cyan',
  size = 54,
  onChange,
  onReset
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{startY: number;startVal: number;} | null>(null);

  // Normalize 0..1
  const getNorm = useCallback(
    (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      if (log && min > 0 && max > 0) {
        return Math.log(clamped / min) / Math.log(max / min);
      }
      return (clamped - min) / (max - min || 1);
    },
    [min, max, log]
  );

  const fromNorm = useCallback(
    (norm: number) => {
      const clamped = Math.max(0, Math.min(1, norm));
      if (log && min > 0 && max > 0) {
        const v = min * Math.pow(max / min, clamped);
        return Math.round(v);
      }
      const v = min + clamped * (max - min);
      if (step < 1) {
        const dec = Math.round(-Math.log10(step));
        return Number(v.toFixed(Math.max(1, dec)));
      }
      return Math.round(v / step) * step;
    },
    [min, max, step, log]
  );

  const norm = getNorm(value);

  // SVG circular arc (r = 20 inside viewBox 48x48)
  const radius = 18;
  const circumference = 2 * Math.PI * radius; // ~113.1
  // 270 degree arc: sweep from -135deg to +135deg
  const arcLength = circumference * 0.75; // 75% of circle
  const dashOffset = arcLength * (1 - norm);
  const rotation = -135 + norm * 270;

  const cStyle = COLOR_MAP[color] || COLOR_MAP.cyan;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragRef.current = { startY: e.clientY, startVal: norm };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    const travel = e.shiftKey ? 400 : 130; // Shift for precision
    const nextNorm = Math.max(0, Math.min(1, dragRef.current.startVal + dy / travel));
    const nextVal = fromNorm(nextNorm);
    onChange(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {

        /* pointer already released */}
    }
  };

  const handleDoubleClick = () => {
    if (def !== undefined) {
      onChange(def);
    } else if (onReset) {
      onReset();
    }
  };

  const formatValue = (v: number) => {
    if (unit === 'Hz') {
      return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`;
    }
    if (unit === 'dB') {
      return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
    }
    if (unit === ':1') {
      return `${v.toFixed(1)}:1`;
    }
    if (unit === 's') {
      return `${v.toFixed(1)}s`;
    }
    if (unit === 'ms') {
      return `${Math.round(v)}ms`;
    }
    if (unit === '%') {
      return `${Math.round(v)}%`;
    }
    if (step < 1) {
      return v.toFixed(1);
    }
    return `${Math.round(v)}`;
  };

  return (
    <div data-ev-id="ev_53d36237ff" className="flex flex-col items-center gap-1 select-none">
      <div data-ev-id="ev_90f3cdaf1e" className="flex items-center gap-1 w-full justify-between px-0.5">
        <span data-ev-id="ev_6ac1cbeb8e" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 truncate max-w-[55px]">
          {label}
        </span>
        {badge &&
        <span data-ev-id="ev_29fec4e570"
        className="text-[8px] font-mono font-semibold px-1 py-0.2 rounded"
        style={{ background: cStyle.badgeBg, color: cStyle.badgeText }}>
          
            {badge}
          </span>
        }
      </div>

      <div data-ev-id="ev_5d6fde661d"
      className="relative cursor-ns-resize touch-none flex items-center justify-center group"
      style={{ width: size, height: size }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      title={`${label}: ${formatValue(value)}${unit} (Doble clic para reiniciar)`}>
        
        <svg data-ev-id="ev_c062a6799d" className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 48 48">
          {/* Background track arc */}
          <circle data-ev-id="ev_a5f0ee04c3"
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="#182230"
          strokeWidth="3.5"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={-circumference * 0.125}
          strokeLinecap="round" />
          
          {/* Active colored arc */}
          <circle data-ev-id="ev_18b319a351"
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={cStyle.stroke}
          strokeWidth="3.5"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset - circumference * 0.125}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${cStyle.glow})` }} />
          
        </svg>

        {/* Center metallic rotary cap */}
        <div data-ev-id="ev_1ecc8e5f29"
        className="absolute rounded-full border border-white/10 shadow-inner flex items-center justify-center transition-transform"
        style={{
          width: size - 16,
          height: size - 16,
          background: 'radial-gradient(circle at 40% 35%, #2a3547 0%, #151b26 80%, #0d121b 100%)',
          boxShadow: isDragging ? `0 0 8px ${cStyle.glow}, inset 0 1px 1px rgba(255,255,255,0.15)` : 'inset 0 1px 1px rgba(255,255,255,0.1)'
        }}>
          
          {/* Notch pointer indicator */}
          <div data-ev-id="ev_7f501242c3"
          className="absolute top-1 w-[2px] h-[5px] rounded-full transition-transform"
          style={{
            background: cStyle.stroke,
            transformOrigin: `50% ${(size - 16) / 2 - 4}px`,
            transform: `rotate(${rotation}deg)`,
            boxShadow: `0 0 4px ${cStyle.stroke}`
          }} />
          
        </div>
      </div>

      <div data-ev-id="ev_357c542a7e" className="flex flex-col items-center">
        <span data-ev-id="ev_7a768b4080" className="font-mono text-[10px] font-bold tabular-nums text-foreground/90">
          {formatValue(value)}
          <span data-ev-id="ev_34617ef186" className="text-[9px] text-muted-foreground/60 ml-0.5 font-normal">{unit}</span>
        </span>
        {sublabel &&
        <span data-ev-id="ev_05cba3c99e" className="text-[8px] font-medium text-muted-foreground/50 tracking-tight text-center">
            {sublabel}
          </span>
        }
      </div>
    </div>);

}