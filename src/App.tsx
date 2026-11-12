/**
 * ⚠️ ROUTING RULES:
 * - Router is in main.tsx. Do NOT add another <BrowserRouter> here or anywhere.
 * - Use <Routes> + <Route> components ONLY. Do NOT use useRoutes().
 * - STATIC IMPORTS ONLY — no React.lazy() or dynamic import().
 * - Import from 'react-router' — NOT 'react-router-dom' (does not exist).
 */
import { Routes, Route } from 'react-router';
import Home from '@/pages/Home';
import SearchPage from '@/pages/SearchPage';
import LibraryPage from '@/pages/LibraryPage';
import SongDetailPage from '@/pages/SongDetailPage';
import LikedPage from '@/pages/LikedPage';
import PlaylistPage from '@/pages/PlaylistPage';
import ArtistPage from '@/pages/ArtistPage';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AuthCallback from '@/pages/AuthCallback';
import NotFound from '@/pages/NotFound';
import StudioPage from '@/pages/StudioPage';
import ArtistDashboard from '@/pages/ArtistDashboardPage';
import PlansPage from '@/pages/PlansPage';
import AdminPage from '@/pages/AdminPage';
import ShortsPage from '@/pages/ShortsPage';
import TrendingPage from '@/pages/TrendingPage';
import DawPage from '@/pages/DawPage';
import MasteringPage from '@/pages/MasteringPage';
import StemsPage from '@/pages/StemsPage';
import VideosPage from '@/pages/VideosPage';
import KaraokePage from '@/pages/KaraokePage';
import ToolsPage from '@/pages/ToolsPage';
import QamuzProdPage from '@/pages/QamuzProdPage';

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<Home />} />
			<Route path="/buscar" element={<SearchPage />} />
			<Route path="/biblioteca" element={<LibraryPage />} />
			<Route path="/cancion/:creationId/:index" element={<SongDetailPage />} />
			<Route path="/me-gusta" element={<LikedPage />} />
			<Route path="/lista/:id" element={<PlaylistPage />} />
			<Route path="/artista/:slug" element={<ArtistPage />} />
			<Route path="/login" element={<Login />} />
			<Route path="/registro" element={<Signup />} />
			<Route path="/recuperar" element={<ForgotPassword />} />
			<Route path="/nueva-contrasena" element={<ResetPassword />} />
			<Route path="/auth/callback" element={<AuthCallback />} />
			<Route path="/estudio" element={<StudioPage />} />
			<Route path="/artista-panel" element={<ArtistDashboard />} />
			<Route path="/planes" element={<PlansPage />} />
			<Route path="/admin" element={<AdminPage />} />
			<Route path="/shorts" element={<ShortsPage />} />
			<Route path="/trending" element={<TrendingPage />} />
			<Route path="/studio" element={<DawPage />} />
			<Route path="/mastering" element={<MasteringPage />} />
			<Route path="/stems" element={<StemsPage />} />
			<Route path="/videos" element={<VideosPage />} />
			<Route path="/karaoke" element={<KaraokePage />} />
			<Route path="/karaoke/:id" element={<KaraokePage />} />
			<Route path="/tools" element={<ToolsPage />} />
			<Route path="/qamuz-prod" element={<QamuzProdPage />} />
			<Route path="*" element={<NotFound />} />
		</Routes>
	);
}
