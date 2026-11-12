import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';

export interface AuthResult {
	success: boolean;
	error?: string;
	needsEmailConfirmation?: boolean;
}

export interface AuthContextType {
	user: User | null;
	displayName: string;
	loading: boolean;
	signUp: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
	signIn: (email: string, password: string) => Promise<AuthResult>;
	signOut: () => Promise<void>;
	resetPassword: (email: string) => Promise<AuthResult>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
