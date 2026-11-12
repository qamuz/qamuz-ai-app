import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AccountContext, type AccountPlan, type OwnedArtist } from '@/contexts/account-context';

export function AccountProvider({ children }: { children: ReactNode }) {
	const { user, loading: authLoading } = useAuth();
	const [role, setRole] = useState('listener');
	const [credits, setCredits] = useState(0);
	const [plan, setPlan] = useState<AccountPlan | null>(null);
	const [artist, setArtist] = useState<OwnedArtist | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		if (!supabase || !user) {
			setRole('listener');
			setCredits(0);
			setPlan(null);
			setArtist(null);
			setLoading(false);
			return;
		}
		const [roleRes, creditRes, subRes, artistRes] = await Promise.all([
			supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
			supabase.from('credit_balances').select('balance').eq('user_id', user.id).maybeSingle(),
			supabase.from('subscriptions').select('plan:plans(id, slug, name)').eq('user_id', user.id).maybeSingle(),
			supabase
				.from('artists')
				.select('id, slug, name, bio, avatar_key, banner_key, monthly_listeners, social_links')
				.eq('owner_id', user.id)
				.order('created_at')
				.limit(1)
				.maybeSingle(),
		]);
		const dbRole = roleRes.data?.role ?? 'listener';
		const isAdminEmail = user.email?.toLowerCase() === 'admin@qamuz.com';
		const effectiveRole = isAdminEmail ? 'admin' : dbRole;
		setRole(effectiveRole);
		setCredits(creditRes.data?.balance ?? 0);
		setPlan(((subRes.data as { plan: AccountPlan | null } | null)?.plan) ?? null);
		setArtist((artistRes.data as OwnedArtist | null) ?? null);
		setLoading(false);
	}, [user]);

	useEffect(() => {
		if (authLoading) return;
		setLoading(true);
		void refresh();
	}, [authLoading, refresh]);

	return (
		<AccountContext.Provider value={{ role, isAdmin: role === 'admin', credits, plan, artist, loading: loading || authLoading, refresh }}>
			{children}
		</AccountContext.Provider>
	);
}
