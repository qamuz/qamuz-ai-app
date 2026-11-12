import { useState } from 'react';
import { Blocks, Bot, CreditCard, LayoutDashboard, Library, Users } from 'lucide-react';
import { Link } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TabBar } from '@/components/TabBar';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminContent } from '@/components/admin/AdminContent';
import { AdminPlans } from '@/components/admin/AdminPlans';
import { AdminProviders } from '@/components/admin/AdminProviders';
import { AdminModules } from '@/components/admin/AdminModules';
import { useAccount } from '@/hooks/useAccount';

type Tab = 'overview' | 'users' | 'content' | 'plans' | 'providers' | 'modules';

const TABS = [
{ id: 'overview' as const, label: 'Resumen', icon: LayoutDashboard },
{ id: 'users' as const, label: 'Usuarios', icon: Users },
{ id: 'content' as const, label: 'Contenido', icon: Library },
{ id: 'plans' as const, label: 'Planes', icon: CreditCard },
{ id: 'providers' as const, label: 'Proveedores IA', icon: Bot },
{ id: 'modules' as const, label: 'Módulos', icon: Blocks }];


function AdminContentArea() {
  const { isAdmin, loading } = useAccount();
  const [tab, setTab] = useState<Tab>('overview');

  if (loading) return <p data-ev-id="ev_a5b429d067" className="text-sm text-muted-foreground">Cargando...</p>;
  if (!isAdmin) {
    return (
      <div data-ev-id="ev_bb28270146" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-10 text-center">
				<h1 data-ev-id="ev_05cf8f5f72" className="text-xl font-bold">Acceso restringido</h1>
				<p data-ev-id="ev_ead0d4ee88" className="text-sm text-muted-foreground">Esta sección es solo para administradores.</p>
				<Link data-ev-id="ev_db37143778" to="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
					Volver al inicio
				</Link>
			</div>);

  }

  return (
    <div data-ev-id="ev_e478272b15" className="mx-auto flex max-w-[1400px] flex-col gap-6">
			<div data-ev-id="ev_c54b6f7724" className="flex flex-col gap-1">
				<span data-ev-id="ev_b4dd0415c8" className="text-sm font-semibold text-primary">Administración</span>
				<h1 data-ev-id="ev_3fa0e562f5" className="text-3xl font-black tracking-tight md:text-4xl">Panel de control</h1>
			</div>
			<TabBar<Tab> tabs={TABS} value={tab} onChange={setTab} />
			{tab === 'overview' && <AdminOverview />}
			{tab === 'users' && <AdminUsers />}
			{tab === 'content' && <AdminContent />}
			{tab === 'plans' && <AdminPlans />}
			{tab === 'providers' && <AdminProviders />}
			{tab === 'modules' && <AdminModules />}
		</div>);

}

export default function AdminPage() {
  return (
    <AppLayout>
			<ProtectedRoute>
				<AdminContentArea />
			</ProtectedRoute>
		</AppLayout>);

}