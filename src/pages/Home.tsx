import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { HomeTabs, HOME_TABS, type HomeTab } from '@/components/home/HomeTabs';
import { TemplatesSection } from '@/components/home/TemplatesSection';
import { DiscoverSection } from '@/components/home/DiscoverSection';
import { QvSection } from '@/components/home/QvSection';
import { CharactersSection } from '@/components/home/CharactersSection';
import { CreatorsSection } from '@/components/home/CreatorsSection';
import { useAuth } from '@/hooks/useAuth';
import { greeting } from '@/lib/format';
import { useI18n } from '@/hooks/useI18n';

function isTab(v: string | null): v is HomeTab {
  return HOME_TABS.some((x) => x.id === v);
}

export default function Home() {
  const { displayName } = useAuth();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const urlTab = params.get('tab');
  const tab: HomeTab = isTab(urlTab) ? urlTab : 'templates';
  const [query, setQuery] = useState('');

  function selectTab(next: HomeTab, scroll = false) {
    setParams(next === 'templates' ? {} : { tab: next }, { replace: true });
    if (scroll) document.getElementById('home-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <AppLayout>
			<div data-ev-id="ev_6f9a1ae3e8" className="mx-auto flex max-w-[1400px] flex-col gap-6">
				<h1 data-ev-id="ev_8cec550c4f" className="sr-only">Qamuz AI</h1>
				<HeroCarousel greeting={`${t(greeting())}${displayName ? `, ${displayName}` : ''}`} onTab={(next) => selectTab(next, true)} />

				<HomeTabs tab={tab} onTab={(next) => selectTab(next)} query={query} onQuery={setQuery} />

				<div data-ev-id="ev_home_panel" id="home-panel" role="tabpanel" aria-labelledby={`home-tab-${tab}`} className="min-h-[50vh] pb-6">
					{tab === 'templates' && <TemplatesSection query={query} />}
					{tab === 'discover' && <DiscoverSection query={query} />}
					{tab === 'qv' && <QvSection query={query} />}
					{tab === 'character' && <CharactersSection query={query} />}
					{tab === 'creators' && <CreatorsSection query={query} />}
				</div>
			</div>
		</AppLayout>);

}
