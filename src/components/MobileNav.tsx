import { AudioWaveform, Clapperboard, Home, Library, Search, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { usePlayer } from '@/hooks/usePlayer';
import { useModules } from '@/hooks/useModules';
import { useI18n } from '@/hooks/useI18n';

const ITEMS = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/estudio', label: 'Crear', icon: Sparkles },
  { to: '/shorts', label: 'Shorts', icon: Clapperboard },
  { to: '/studio', label: 'DAW', icon: AudioWaveform },
  { to: '/buscar', label: 'Buscar', icon: Search },
  { to: '/biblioteca', label: 'Biblioteca', icon: Library },
];


export function MobileNav() {
  const { pathname } = useLocation();
  const { current } = usePlayer();
  const { isEnabled } = useModules();
  const { t } = useI18n();
  const items = ITEMS.filter((item) => (item.to !== '/estudio' || isEnabled('studio')) && (item.to !== '/studio' || isEnabled('daw')));

  return (
    <nav data-ev-id="ev_d59f6df99c" className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-surface/95 py-2 backdrop-blur-xl lg:hidden">
			{items.map(({ to, label, icon: Icon }) => {
        const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
        return (
          <Link data-ev-id="ev_7a687b95f4" key={to} to={to} className={`flex flex-col items-center gap-1 px-2 text-[11px] font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
						<Icon className="h-5 w-5" />
						{t(label)}
					</Link>);

      })}
		</nav>);

}