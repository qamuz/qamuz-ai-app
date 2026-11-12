import { createContext } from 'react';

export interface OwnedArtist {
	id: string;
	slug: string;
	name: string;
	bio: string | null;
	avatar_key: string | null;
	banner_key: string | null;
	monthly_listeners: number;
	social_links: Record<string, string>;
}

export interface AccountPlan {
	id: string;
	slug: string;
	name: string;
}

export interface AccountContextType {
	role: string;
	isAdmin: boolean;
	credits: number;
	plan: AccountPlan | null;
	artist: OwnedArtist | null;
	loading: boolean;
	refresh: () => Promise<void>;
}

export const AccountContext = createContext<AccountContextType | null>(null);
