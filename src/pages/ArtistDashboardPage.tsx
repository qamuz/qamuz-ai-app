import { useState } from 'react';
import { BarChart3, Disc3, FileText, Images, Music2, UserRound } from 'lucide-react';
import { ArtistGalleryManager } from '@/components/artist/ArtistGalleryManager';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ModuleDisabled } from '@/components/ModuleDisabled';
import { TabBar } from '@/components/TabBar';
import { CreateArtistForm } from '@/components/artist/CreateArtistForm';
import { ArtistProfileForm } from '@/components/artist/ArtistProfileForm';
import { ArtistTracksManager } from '@/components/artist/ArtistTracksManager';
import { ArtistAlbumsManager } from '@/components/artist/ArtistAlbumsManager';
import { LyricsEditor } from '@/components/artist/LyricsEditor';
import { ArtistStats } from '@/components/artist/ArtistStats';
import { useAccount } from '@/hooks/useAccount';
import { useModules } from '@/hooks/useModules';

type Tab = 'stats' | 'tracks' | 'albums' | 'gallery' | 'lyrics' | 'profile';

const TABS = [
{ id: 'stats' as const, label: 'Estadísticas', icon: BarChart3 },
{ id: 'tracks' as const, label: 'Canciones', icon: Music2 },
{ id: 'albums' as const, label: 'Álbumes', icon: Disc3 },
{ id: 'gallery' as const, label: 'Galería', icon: Images },
{ id: 'lyrics' as const, label: 'Letras', icon: FileText },
{ id: 'profile' as const, label: 'Perfil', icon: UserRound }];


function PanelContent() {
  const { artist, loading } = useAccount();
  const [tab, setTab] = useState<Tab>('stats');

  if (loading) return <p data-ev-id="ev_2d8b723cc1" className="text-sm text-muted-foreground">Cargando...</p>;
  if (!artist) return <CreateArtistForm />;

  return (
    <div data-ev-id="ev_140e217149" className="mx-auto flex max-w-[1400px] flex-col gap-6">
			<div data-ev-id="ev_2df4c69094" className="flex flex-col gap-1">
				<span data-ev-id="ev_5de2ecb677" className="text-sm font-semibold text-primary">Panel del artista</span>
				<h1 data-ev-id="ev_c664419d4b" className="text-3xl font-black tracking-tight md:text-4xl">{artist.name}</h1>
			</div>
			<TabBar tabs={TABS} value={tab} onChange={(id) => setTab(id as Tab)} />
			{tab === 'stats' && <ArtistStats artist={artist} />}
			{tab === 'tracks' && <ArtistTracksManager artist={artist} />}
			{tab === 'albums' && <ArtistAlbumsManager artist={artist} />}
			{tab === 'gallery' && <ArtistGalleryManager artist={artist} />}
			{tab === 'lyrics' && <LyricsEditor artist={artist} />}
			{tab === 'profile' && <ArtistProfileForm key={artist.id} artist={artist} />}
		</div>);

}

export default function ArtistDashboardPage() {
  const { isEnabled } = useModules();
  return (
    <AppLayout>
			{isEnabled('artists') ?
      <ProtectedRoute>
					<PanelContent />
				</ProtectedRoute> :

      <ModuleDisabled name="El panel de artista" />
      }
		</AppLayout>);

}