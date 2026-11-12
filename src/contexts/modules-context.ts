import { createContext } from 'react';

export type ModuleKey = 'player' | 'lyrics' | 'studio' | 'artists' | 'payments' | 'daw' | 'mastering' | 'stems' | 'videos';

export interface AppModule {
	key: string;
	name: string;
	description: string | null;
	enabled: boolean;
	sort: number;
}

export interface ModulesContextType {
	modules: AppModule[];
	loading: boolean;
	isEnabled: (key: ModuleKey) => boolean;
	refresh: () => Promise<void>;
}

export const ModulesContext = createContext<ModulesContextType | null>(null);
