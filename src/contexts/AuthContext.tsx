import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext, type AuthResult } from '@/contexts/auth-context';
import type { User } from '@supabase/supabase-js';
import { translate } from '@/i18n/core';

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [displayName, setDisplayName] = useState('');
	const [loading, setLoading] = useState(true);
	const initialized = useRef(false);

	useEffect(() => {
		if (!supabase) {
			setLoading(false);
			return;
		}
		if (initialized.current) return;
		initialized.current = true;

		void supabase.auth.getUser().then(({ data }) => {
			setUser(data.user ?? null);
			setLoading(false);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
		});

		return () => subscription.unsubscribe();
	}, []);

	useEffect(() => {
		if (!supabase || !user) {
			setDisplayName('');
			return;
		}
		let active = true;
		void supabase
			.from('profiles')
			.select('display_name')
			.eq('id', user.id)
			.maybeSingle()
			.then(({ data }) => {
				if (!active) return;
				const name = (data as { display_name: string | null } | null)?.display_name;
				setDisplayName(name || user.email?.split('@')[0] || '');
			});
		return () => {
			active = false;
		};
	}, [user]);

	const signUp = useCallback(async (email: string, password: string, name?: string): Promise<AuthResult> => {
		if (!supabase) return { success: false, error: translate('Backend is not connected') };
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
		});
		if (error) return { success: false, error: error.message };
		if (!data.user) return { success: false, error: translate('Could not create the account') };
		if (data.session) setUser(data.user);
		return { success: true, needsEmailConfirmation: !data.session };
	}, []);

	const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
		if (!supabase) return { success: false, error: translate('Backend is not connected') };
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) return { success: false, error: error.message };
		if (!data.user) return { success: false, error: translate('Could not log in') };
		setUser(data.user);
		return { success: true };
	}, []);

	const signOut = useCallback(async () => {
		if (!supabase) return;
		await supabase.auth.signOut();
		setUser(null);
	}, []);

	const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
		if (!supabase) return { success: false, error: translate('Backend is not connected') };
		const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` });
		if (error) return { success: false, error: error.message };
		return { success: true };
	}, []);

	return <AuthContext.Provider value={{ user, displayName, loading, signUp, signIn, signOut, resetPassword }}>{children}</AuthContext.Provider>;
}
