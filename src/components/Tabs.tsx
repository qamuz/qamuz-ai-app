import type { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

export function Tabs<T extends string>({ items, value, onChange }: {items: TabItem<T>[];value: T;onChange: (id: T) => void;}) {
  return (
    <div data-ev-id="ev_445a5a6a06" role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
			{items.map(({ id, label, icon: Icon }) =>
      <button data-ev-id="ev_d2f5d60c6b"
      key={id}
      type="button"
      role="tab"
      aria-selected={value === id}
      onClick={() => onChange(id)}
      className={`flex flex-none items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
      value === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`
      }>
        
					{Icon && <Icon className="h-4 w-4" />}
					{label}
				</button>
      )}
		</div>);

}