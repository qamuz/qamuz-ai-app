import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { PlayerBar } from '@/components/PlayerBar';
import { NowPlaying } from '@/components/NowPlaying';
import { MobileNav } from '@/components/MobileNav';
import { useModules } from '@/hooks/useModules';
import { usePlayer } from '@/hooks/usePlayer';

export function AppLayout({ children }: {children: ReactNode;}) {
  const { isEnabled } = useModules();
  const playerOn = isEnabled('player');
  const { expanded, current } = usePlayer();
  const panelOpen = playerOn && expanded && Boolean(current);
  return (
    <div data-ev-id="ev_560a620173" className="flex min-h-screen bg-background text-foreground">
			<Sidebar />
			<div data-ev-id="ev_0a513bdc02" className="flex min-w-0 flex-1 flex-col">
				<TopBar />
				<main data-ev-id="ev_95bf42c7f7" className={`flex-1 px-4 pb-48 pt-6 transition-[padding] duration-300 md:px-6 lg:pb-32 ${panelOpen ? 'lg:pr-[404px]' : ''}`}>{children}</main>
			</div>
			<MobileNav />
			{playerOn && <PlayerBar />}
			{playerOn && <NowPlaying />}
		</div>);

}