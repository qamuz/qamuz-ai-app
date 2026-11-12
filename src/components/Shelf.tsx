import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface ShelfProps {
  id?: string;
  title: string;
  action?: {label: string;to: string;};
  children: ReactNode;
}

export function Shelf({ id, title, action, children }: ShelfProps) {
  return (
    <section data-ev-id="ev_6adc83519a" id={id} className="flex scroll-mt-20 flex-col gap-4">
			<div data-ev-id="ev_9d3c7581c9" className="flex items-end justify-between gap-4">
				<h2 data-ev-id="ev_7ee8a50ef0" className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
				{action &&
        <Link data-ev-id="ev_a01346421d" to={action.to} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary">
						{action.label}
					</Link>
        }
			</div>
			{children}
		</section>);

}