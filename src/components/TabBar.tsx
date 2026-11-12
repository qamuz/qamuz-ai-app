import type { LucideIcon } from 'lucide-react';

interface TabBarProps<T extends string> {
  tabs: {id: T;label: string;icon?: LucideIcon;}[];
  value: T;
  onChange: (value: T) => void;
}

export function TabBar<T extends string>({ tabs, value, onChange }: TabBarProps<T>) {
  return (
    <div data-ev-id="ev_0fd73349c1" role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
			{tabs.map(({ id, label, icon: Icon }) => {
        const active = id === value;
        return (
          <button data-ev-id="ev_2e0ce2731d"
          key={id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(id)}
          className={`flex min-h-10 flex-none items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'}`}>
            
						{Icon && <Icon className="h-4 w-4" />}
						{label}
					</button>);

      })}
		</div>);

}