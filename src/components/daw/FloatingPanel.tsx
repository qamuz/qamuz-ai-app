import { useRef, useState, type ReactNode } from 'react';
import { GripHorizontal, PanelBottom, X } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

type Pos = {x: number;y: number;w: number;};

/**
 * Panel that sits docked under the tracks. Drag its title bar to float it anywhere on screen;
 * the dock button puts it back in place.
 */
export function FloatingPanel({ title, icon, actions, onClose, children }: {title: string;icon: ReactNode;actions?: ReactNode;onClose: () => void;children: ReactNode;}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{dx: number;dy: number;sx: number;sy: number;w: number;started: boolean;} | null>(null);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, select, a')) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, w: r.width, started: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.started && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    d.started = true;
    const w = pos?.w ?? Math.min(d.w, window.innerWidth - 16);
    const x = Math.min(window.innerWidth - 120, Math.max(120 - w, e.clientX - d.dx));
    const y = Math.min(window.innerHeight - 48, Math.max(8, e.clientY - d.dy));
    setPos({ x, y, w });
  };

  const onUp = () => {
    drag.current = null;
  };

  return (
    <section data-ev-id="ev_6d3e5f7f17"
    ref={ref}
    className={`flex flex-col overflow-hidden rounded-xl border border-border bg-surface ${pos ? 'fixed z-[80] max-h-[85vh] shadow-[0_24px_60px_-12px_#000000cc]' : ''}`}
    style={pos ? { left: pos.x, top: pos.y, width: pos.w } : undefined}>
      
			<div data-ev-id="ev_c86af74080"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="flex flex-none cursor-grab touch-none select-none flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-3 py-2 active:cursor-grabbing"
      title={t('Drag to move')}>
        
				<GripHorizontal className="h-4 w-4 text-muted-foreground" />
				<h2 data-ev-id="ev_8b86d57618" className="flex items-center gap-2 text-sm font-bold">
					<span data-ev-id="ev_38404b3ac1" className="text-primary">{icon}</span>
					{title}
				</h2>
				<div data-ev-id="ev_7f1c4bff6f" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{actions}</div>
				{pos &&
        <button data-ev-id="ev_a8d4915e25" type="button" onClick={() => setPos(null)} aria-label={t('Dock panel')} title={t('Dock panel')} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-3 hover:text-foreground">
						<PanelBottom className="h-4 w-4" />
					</button>
        }
				<button data-ev-id="ev_20b6d05a9c" type="button" onClick={onClose} aria-label={t('Close')} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-3 hover:text-foreground">
					<X className="h-4 w-4" />
				</button>
			</div>
			<div data-ev-id="ev_13ecd078b1" className="min-h-0 flex-1 overflow-auto">{children}</div>
		</section>);

}