import { LogOut, Search, User } from 'lucide-react';
import { QamuzMark } from '@/components/QamuzMark';
import { NotificationsBell } from '@/components/NotificationsBell';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { useI18n } from '@/hooks/useI18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function TopBar() {
  const { user, displayName, signOut } = useAuth();
  const { isAdmin, plan } = useAccount();
  const [term, setTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (term.trim()) navigate(`/buscar?q=${encodeURIComponent(term.trim())}`);
  }

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  }

  return (
    <header data-ev-id="ev_610ed9d188" className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl md:px-6">
			<Link data-ev-id="ev_465b818c04" to="/" className="flex items-center gap-1.5 text-base font-black tracking-tight lg:hidden">
				<QamuzMark className="h-5 w-5 text-primary" />
				<span data-ev-id="ev_123ba4525e">Qamuz</span>
			</Link>
			<form data-ev-id="ev_18d9963061" onSubmit={handleSearch} className="relative flex-1 md:max-w-sm">
				<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<input data-ev-id="ev_369bcd33e9"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        type="search"
        placeholder={t('Search songs, artists or playlists')}
        aria-label={t('Search')}
        className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" />
        
			</form>

			<div data-ev-id="ev_0d2bd7686d" className="ml-auto flex items-center gap-2">
				<LanguageSwitcher />
				{user && <NotificationsBell />}
				{user ?
        <div data-ev-id="ev_1f2ba6cb2f" className="relative">
						<button data-ev-id="ev_50cab2b50e" type="button" onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-full bg-surface px-2 py-1.5 pr-3 text-sm font-semibold transition-colors hover:bg-surface-2">
							<span data-ev-id="ev_dd9cf6e40d" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<User className="h-4 w-4" />
							</span>
							<span data-ev-id="ev_68dd91a31a" className="hidden max-w-[8rem] truncate sm:block">{displayName || t('My account')}</span>
						</button>
						{menuOpen &&
          <div data-ev-id="ev_ec002728fa" className="absolute right-0 top-full z-40 mt-2 flex w-52 flex-col gap-1 rounded-xl border border-border bg-surface p-2 shadow-xl shadow-black/40">
								{plan && <span data-ev-id="ev_af5ce0911f" className="px-3 py-1 text-[11px] font-semibold text-primary">{t('{name} plan', { name: t(plan.name) })}</span>}
								<Link data-ev-id="ev_ba6abcf6ec" to="/estudio" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
									{t('AI Studio')}
								</Link>
								<Link data-ev-id="ev_91d61837bd" to="/artista-panel" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
									{t('Artist Dashboard')}
								</Link>
								<Link data-ev-id="ev_0599918454" to="/planes" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
									{t('Plans')}
								</Link>
								{isAdmin &&
            <Link data-ev-id="ev_6ba374bcf1" to="/admin" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
										{t('Admin')}
									</Link>
            }
								<Link data-ev-id="ev_15bf88e703" to="/biblioteca" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
									{t('Your Library')}
								</Link>
								<button data-ev-id="ev_4e8e57b9af" type="button" onClick={() => void handleSignOut()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
									<LogOut className="h-4 w-4" /> {t('Log out')}
								</button>
							</div>
          }
					</div> :

        <>
						<Link data-ev-id="ev_943db9720b" to="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
							{t('Log in')}
						</Link>
						<Link data-ev-id="ev_102bae3848" to="/registro" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105">
							{t('Sign up')}
						</Link>
					</>
        }
			</div>
		</header>);

}