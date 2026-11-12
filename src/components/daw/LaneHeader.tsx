import { useEffect, useState } from 'react';
import { AudioWaveform, Piano, Trash2, X } from 'lucide-react';
import { ROW_H, type InstrumentPreset, type Lane } from '@/lib/daw/types';
import { PRESET_LABELS } from '@/lib/daw/synth';
import { useI18n } from '@/hooks/useI18n';

interface LaneHeaderProps {
  lane: Lane;
  selected: boolean;
  onSelect: () => void;
  onPatch: (patch: Partial<Lane>) => void;
  onDelete: () => void;
}

export function LaneHeader({ lane, selected, onSelect, onPatch, onDelete }: LaneHeaderProps) {
  const { t } = useI18n();
  const Icon = lane.type === 'audio' ? AudioWaveform : Piano;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirming(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);

  function askDelete() {
    if (lane.clips.length === 0) onDelete();
    else setConfirming(true);
  }

  return (
    <div data-ev-id="ev_deb012444c"
    onPointerDown={onSelect}
    className={`relative flex flex-col justify-center gap-1.5 border-b border-border py-2 pl-3 pr-2 ${selected ? 'bg-surface-3' : 'bg-surface-2'}`}
    style={{ height: ROW_H }}>
      
			<span data-ev-id="ev_dad9f0a330" className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: lane.color }} />
			<div data-ev-id="ev_c96d35e06d" className="flex items-center gap-1.5">
				<Icon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
				<input data-ev-id="ev_c4cfbed0c1"
        value={lane.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        aria-label={t('Track name')}
        className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-xs font-semibold focus:bg-background focus:outline-none" />
        
				<button data-ev-id="ev_ed501ca601" type="button" onClick={askDelete} aria-label={t('Delete track')} title={t('Delete track')} className="flex h-6 w-6 flex-none items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-destructive">
					<Trash2 className="h-3.5 w-3.5" />
				</button>
			</div>
			<div data-ev-id="ev_10adebf4f3" className="flex items-center gap-1">
				<button data-ev-id="ev_a1a1165027"
        type="button"
        onClick={() => onPatch({ mute: !lane.mute })}
        aria-pressed={lane.mute}
        aria-label={t('Mute')}
        title={t('Mute')}
        className={`h-6 w-6 flex-none rounded text-[11px] font-bold ${lane.mute ? 'bg-destructive text-destructive-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}>
          
					M
				</button>
				<button data-ev-id="ev_5a8f5f8af1"
        type="button"
        onClick={() => onPatch({ solo: !lane.solo })}
        aria-pressed={lane.solo}
        aria-label={t('Solo')}
        title={t('Solo')}
        className={`h-6 w-6 flex-none rounded text-[11px] font-bold ${lane.solo ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}>
          
					S
				</button>
				{lane.type === 'instrument' ?
        <select data-ev-id="ev_0dc61fbd81"
        value={lane.instrument}
        onChange={(e) => onPatch({ instrument: e.target.value as InstrumentPreset })}
        aria-label={t('Instrument')}
        className="h-6 min-w-0 flex-1 rounded bg-background px-1 text-[11px] text-foreground focus:outline-none">
          
						{(Object.keys(PRESET_LABELS) as InstrumentPreset[]).map((key) =>
          <option data-ev-id="ev_a80a6b21a0" key={key} value={key}>
								{t(PRESET_LABELS[key])}
							</option>
          )}
					</select> :

        <span data-ev-id="ev_18d2a994ed" className="flex-1 truncate px-1 text-[11px] text-muted-foreground">{t('Audio track')}</span>
        }
			</div>
			<div data-ev-id="ev_3c7405aec0" className="flex items-center gap-2">
				<input data-ev-id="ev_80a3dae685"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={lane.volume}
        onChange={(e) => onPatch({ volume: Number(e.target.value) })}
        aria-label={t('Volume')}
        title={t('Volume')}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-background accent-primary" />
        
				<input data-ev-id="ev_6a59c4ada9"
        type="range"
        min={-1}
        max={1}
        step={0.05}
        value={lane.pan}
        onChange={(e) => onPatch({ pan: Number(e.target.value) })}
        onDoubleClick={() => onPatch({ pan: 0 })}
        aria-label={t('Pan')}
        title={t('Pan')}
        className="h-1 w-12 flex-none cursor-pointer appearance-none rounded-full bg-background accent-accent" />
        
			</div>
			{confirming &&
      <div data-ev-id="ev_lane_confirm" role="alertdialog" aria-label={t('Delete track?')} onPointerDown={(e) => e.stopPropagation()} className="absolute inset-0 z-20 flex flex-col justify-center gap-2 border-l-2 border-destructive bg-surface-2/95 px-3 backdrop-blur-sm animate-in fade-in duration-150">
					<div data-ev-id="ev_lane_confirm_txt" className="flex flex-col">
						<span data-ev-id="ev_lane_confirm_t" className="text-xs font-semibold text-foreground">{t('Delete track?')}</span>
						<span data-ev-id="ev_lane_confirm_s" className="truncate text-[11px] text-muted-foreground">{t('Its clips will be removed too')}</span>
					</div>
					<div data-ev-id="ev_lane_confirm_btns" className="flex items-center gap-1.5">
						<button data-ev-id="ev_lane_confirm_del" type="button" autoFocus onClick={onDelete} className="inline-flex h-7 items-center gap-1 rounded-md bg-destructive px-2.5 text-[11px] font-bold text-white hover:bg-destructive/90">
							<Trash2 className="h-3 w-3" /> {t('Delete')}
						</button>
						<button data-ev-id="ev_lane_confirm_no" type="button" onClick={() => setConfirming(false)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-background hover:text-foreground">
							<X className="h-3 w-3" /> {t('Cancel')}
						</button>
					</div>
				</div>
      }
		</div>);

}