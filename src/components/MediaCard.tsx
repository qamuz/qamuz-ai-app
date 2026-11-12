import { Play } from 'lucide-react';
import { Link } from 'react-router';
import { coverUrl } from '@/lib/covers';
import { useI18n } from '@/hooks/useI18n';

interface MediaCardProps {
  to: string;
  title: string;
  subtitle?: string | null;
  coverKey?: string | null;
  rounded?: boolean;
  onPlay?: () => void;
}

export function MediaCard({ to, title, subtitle, coverKey, rounded = false, onPlay }: MediaCardProps) {
  const { t } = useI18n();
  return (
    <div data-ev-id="ev_3f875b19cc" className="group relative flex w-full flex-col gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface-2">
			<div data-ev-id="ev_514e1e6123" className="relative">
				<img data-ev-id="ev_e58a0d751d"
        src={coverUrl(coverKey)}
        width={300}
        height={300}
        loading="lazy"
        alt={t('Cover of {title}', { title })}
        className={`aspect-square w-full object-cover ${rounded ? 'rounded-full' : 'rounded-lg'}`} />
        
				{onPlay &&
        <button data-ev-id="ev_fdcea6bbb3"
        type="button"
        onClick={onPlay}
        aria-label={t('Play {title}', { title })}
        className="absolute bottom-2 right-2 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg shadow-black/40 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100">
          
						<Play className="h-5 w-5 fill-current" />
					</button>
        }
			</div>
			<Link data-ev-id="ev_98289a63d9" to={to} className="flex flex-col gap-1">
				<span data-ev-id="ev_24eb9705e8" className="truncate text-sm font-semibold text-foreground">{title}</span>
				{subtitle && <span data-ev-id="ev_e5d78f3982" className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</span>}
				<span data-ev-id="ev_fdf0fcb07b" className="absolute inset-0" aria-hidden="true" />
			</Link>
		</div>);

}