import { type ReactNode } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ModulesProvider } from '@/contexts/ModulesContext';
import { AccountProvider } from '@/contexts/AccountContext';
import { LikesProvider } from '@/contexts/LikesContext';
import { PlayerProvider } from '@/contexts/PlayerContext';

/**
 * ⚠️ App-wide providers. Add new providers here — they'll be available in all routes.
 */
export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<LanguageProvider>
			<AuthProvider>
				<ModulesProvider>
					<AccountProvider>
						<LikesProvider>
							<PlayerProvider>{children}</PlayerProvider>
						</LikesProvider>
					</AccountProvider>
				</ModulesProvider>
			</AuthProvider>
		</LanguageProvider>
	);
}
