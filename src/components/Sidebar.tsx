import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import {
  AudioWaveform,
  Check,
  ChevronDown,
  Clapperboard,
  Coins,
  Crown,
  Cpu,
  Film,
  Flame,
  Gift,
  Globe,
  Heart,
  Home,
  Layers,
  Library,
  LogOut,
  Mic2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  User,
  Wrench } from
'lucide-react';
import { QamuzMark } from '@/components/QamuzMark';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { useModules } from '@/hooks/useModules';
import { useI18n } from '@/hooks/useI18n';
import { LANGUAGES } from '@/i18n/core';
import { fetchUserPlaylists } from '@/lib/queries';
import { coverUrl } from '@/lib/covers';
import { RewardsModal } from '@/components/sidebar/RewardsModal';
import type { Playlist } from '@/types/music';

const itemBase = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors';
const itemCollapsed = 'flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-colors';
const itemIdle = 'text-white/70 hover:bg-white/5 hover:text-white';
const itemActive = 'bg-white/10 text-white';
const subBase = 'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors';
const subIdle = 'text-white/60 hover:bg-white/5 hover:text-white';

function Badge({ children, tone }: {children: ReactNode;tone: string;}) {
  return <span data-ev-id="ev_sb_badge" className={`ml-auto rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{children}</span>;
}

function NavItem({ to, icon, label, active, badge, collapsed }: {to: string;icon: ReactNode;label: string;active: boolean;badge?: ReactNode;collapsed?: boolean;}) {
  if (collapsed) {
    return (
      <Link data-ev-id="ev_sb_item" to={to} title={label} aria-label={label} className={`${itemCollapsed} ${active ? itemActive : itemIdle}`}>
        {icon}
      </Link>
    );
  }
  return (
    <Link data-ev-id="ev_sb_item" to={to} className={`${itemBase} ${active ? itemActive : itemIdle}`}>
      {icon}
      <span data-ev-id="ev_sb_item_l" className="truncate">{label}</span>
      {badge}
    </Link>);
}

function SubItem({ to, icon, label, active }: {to: string;icon: ReactNode;label: string;active: boolean;}) {
  return (
    <Link data-ev-id="ev_sb_sub" to={to} className={`${subBase} ${active ? 'bg-white/10 text-white' : subIdle}`}>
      {icon}
      <span data-ev-id="ev_sb_sub_l" className="truncate">{label}</span>
    </Link>);
}

export function Sidebar() {
  const { pathname, search } = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin, credits } = useAccount();
  const { isEnabled } = useModules();
  const { lang, setLang, t } = useI18n();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const urlKind = new URLSearchParams(search).get('kind');
  const [studioKind, setStudioKind] = useState<string | null>(urlKind);
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    if (pathname.startsWith('/estudio')) {
      setStudioKind(new URLSearchParams(search).get('kind'));
    } else {
      setStudioKind(null);
      setManualCollapsed(null);
    }
  }, [pathname, search]);

  useEffect(() => {
    const onStudioKind = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail ?? null;
      setStudioKind(detail);
      if (detail === 'video') {
        setManualCollapsed(null);
      }
    };
    window.addEventListener('qamuz:studio-kind', onStudioKind);
    return () => window.removeEventListener('qamuz:studio-kind', onStudioKind);
  }, []);

  const isVideoStudio = pathname.startsWith('/estudio') && studioKind === 'video';
  const collapsed = manualCollapsed !== null ? manualCollapsed : isVideoStudio;

  const isToolsActive =
  pathname === '/tools' ||
  pathname.startsWith('/videos') ||
  pathname.startsWith('/stems') ||
  pathname.startsWith('/mastering') ||
  pathname.startsWith('/artista-panel') ||
  pathname.startsWith('/shorts');
  const [toolsOpen, setToolsOpen] = useState(isToolsActive);
  const [libraryOpen, setLibraryOpen] = useState(true);

  const langRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isToolsActive) setToolsOpen(true);
  }, [isToolsActive]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLanguageOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      return;
    }
    let active = true;
    void fetchUserPlaylists(user.id).then((data) => {
      if (active) setPlaylists(data);
    });
    return () => {
      active = false;
    };
  }, [user, pathname]);

  const studioOn = isEnabled('studio');
  const dawOn = isEnabled('daw');
  const videosOn = isEnabled('videos');
  const masteringOn = isEnabled('mastering');
  const stemsOn = isEnabled('stems');
  const artistsOn = isEnabled('artists');
  const paymentsOn = isEnabled('payments');

  const currentLangObj = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const isLibraryActive = pathname === '/biblioteca' || pathname === '/me-gusta' || pathname.startsWith('/lista/');

  return (
    <>
      <aside
        data-ev-id="ev_sidebar_root"
        className={`sticky top-0 z-20 hidden h-screen max-h-screen flex-none select-none flex-col overflow-hidden p-2 transition-[width] duration-200 lg:flex ${collapsed ? 'w-[72px]' : 'w-[264px]'}`}
        aria-label={t('Main navigation')}>

        <div data-ev-id="ev_sb_unified_card" className="flex min-h-0 flex-1 flex-col gap-2">
          {/* Brand + main navigation */}
          <div data-ev-id="ev_sb_top" className={`flex flex-none flex-col gap-1 rounded-xl bg-surface ${collapsed ? 'p-1.5 items-center' : 'p-2'}`}>
            <div className={`flex items-center ${collapsed ? 'flex-col gap-1.5 py-1' : 'justify-between px-2 py-1.5'}`}>
              <Link data-ev-id="ev_sb_brand" to="/" className="group flex items-center gap-2.5" title="Qamuz AI">
                <span data-ev-id="ev_sb_logo" className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
                  <QamuzMark className="h-5 w-5" />
                </span>
                {!collapsed && (
                  <span data-ev-id="ev_sb_name" className="text-lg font-black tracking-tight text-white">
                    Qamuz <span data-ev-id="ev_sb_name_ai" className="text-primary">AI</span>
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => setManualCollapsed(!collapsed)}
                title={collapsed ? t('Expandir menú') : t('Reducir menú')}
                aria-label={collapsed ? t('Expandir menú') : t('Reducir menú')}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            <nav data-ev-id="ev_sb_primary_nav" className="flex flex-col gap-0.5 w-full">
              <NavItem to="/" icon={<Home className="h-5 w-5 flex-none" />} label={t('Home')} active={pathname === '/'} collapsed={collapsed} />
              <NavItem to="/buscar" icon={<Search className="h-5 w-5 flex-none" />} label={t('Buscar')} active={pathname.startsWith('/buscar')} collapsed={collapsed} />
              <NavItem to="/trending" icon={<Flame className="h-5 w-5 flex-none text-amber-400" />} label={t('Tendencias')} active={pathname.startsWith('/trending')} collapsed={collapsed} />
            </nav>
          </div>

          {/* Creation tools */}
          {(studioOn || dawOn) &&
          <div data-ev-id="ev_sb_create" className={`flex flex-none flex-col gap-0.5 rounded-xl bg-surface ${collapsed ? 'p-1.5 items-center' : 'p-2'}`}>
              {studioOn &&
            <NavItem
              to="/estudio"
              icon={<Sparkles className="h-5 w-5 flex-none text-primary" />}
              label={t('Create')}
              active={pathname.startsWith('/estudio')}
              badge={<Badge tone="border-primary/30 bg-primary/15 text-primary">AI</Badge>}
              collapsed={collapsed} />
            }
              {dawOn &&
            <NavItem
              to="/studio"
              icon={<AudioWaveform className="h-5 w-5 flex-none text-cyan-400" />}
              label={t('Studio')}
              active={pathname.startsWith('/studio')}
              badge={<Badge tone="border-cyan-400/30 bg-cyan-400/15 text-cyan-300">DAW</Badge>}
              collapsed={collapsed} />
            }

              {collapsed ? (
                <NavItem to="/tools" icon={<Wrench className="h-5 w-5 flex-none text-amber-400" />} label={t('Tools')} active={isToolsActive} collapsed />
              ) : (
                <div data-ev-id="ev_sb_tools" className="flex flex-col">
                  <div data-ev-id="ev_sb_tools_h" className={`${itemBase} pr-1.5 ${isToolsActive ? itemActive : itemIdle}`}>
                    <Link data-ev-id="ev_sb_tools_link" to="/tools" className="flex min-w-0 flex-1 items-center gap-3">
                      <Wrench className="h-5 w-5 text-amber-400" />
                      <span data-ev-id="ev_sb_tools_l" className="truncate">{t('Tools')}</span>
                    </Link>
                    <button
                    data-ev-id="ev_sb_tools_toggle"
                    type="button"
                    onClick={() => setToolsOpen((v) => !v)}
                    aria-label={t('Tools')}
                    aria-expanded={toolsOpen}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
                      <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {toolsOpen &&
                <div data-ev-id="ev_sb_tools_list" className="my-1 ml-5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                      {videosOn && <SubItem to="/videos" icon={<Film className="h-4 w-4 text-emerald-400" />} label={t('Vídeos Musicales IA')} active={pathname.startsWith('/videos')} />}
                      {stemsOn && <SubItem to="/stems" icon={<Layers className="h-4 w-4 text-cyan-400" />} label={t('Separador de Stems')} active={pathname.startsWith('/stems')} />}
                      {masteringOn && <SubItem to="/mastering" icon={<SlidersHorizontal className="h-4 w-4 text-amber-400" />} label={t('Mastering Suite & SPAN')} active={pathname.startsWith('/mastering')} />}
                      {user && artistsOn && <SubItem to="/artista-panel" icon={<Mic2 className="h-4 w-4 text-purple-400" />} label={t('Panel de Artista')} active={pathname.startsWith('/artista-panel')} />}
                      <SubItem to="/shorts" icon={<Clapperboard className="h-4 w-4 text-rose-400" />} label={t('Shorts')} active={pathname.startsWith('/shorts')} />
                    </div>
                }
                </div>
              )}
            </div>
          }

          {/* Library: takes the remaining height and scrolls */}
          <div data-ev-id="ev_sb_library" className={`flex min-h-0 flex-1 flex-col rounded-xl bg-surface ${collapsed ? 'p-1.5 items-center' : 'p-2'}`}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-1.5 w-full">
                <NavItem to="/biblioteca" icon={<Library className="h-5 w-5 flex-none" />} label={t('Library')} active={isLibraryActive} collapsed />
                <Link
                  data-ev-id="ev_sb_liked"
                  to="/me-gusta"
                  title={t('Canciones que te gustan')}
                  aria-label={t('Canciones que te gustan')}
                  className={`${itemCollapsed} ${pathname === '/me-gusta' ? itemActive : itemIdle}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#ff3366] to-[#be123c] text-white">
                    <Heart className="h-3.5 w-3.5 fill-current" />
                  </span>
                </Link>
              </div>
            ) : (
              <>
                <div data-ev-id="ev_sb_lib_h" className={`${itemBase} flex-none pr-1.5 ${isLibraryActive ? itemActive : itemIdle}`}>
                  <Link data-ev-id="ev_sb_lib_link" to="/biblioteca" className="flex min-w-0 flex-1 items-center gap-3">
                    <Library className="h-5 w-5" />
                    <span data-ev-id="ev_sb_lib_l" className="truncate">{t('Library')}</span>
                  </Link>
                  <Link
                  data-ev-id="ev_sb_lib_add"
                  to="/biblioteca"
                  aria-label={t('Crear playlist')}
                  title={t('Crear playlist')}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
                    <Plus className="h-4 w-4" />
                  </Link>
                  <button
                  data-ev-id="ev_sb_lib_toggle"
                  type="button"
                  onClick={() => setLibraryOpen((v) => !v)}
                  aria-label={t('Library')}
                  aria-expanded={libraryOpen}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
                    <ChevronDown className={`h-4 w-4 transition-transform ${libraryOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {libraryOpen &&
                <div data-ev-id="ev_sb_lib_list" className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
                    <Link
                    data-ev-id="ev_sb_liked"
                    to="/me-gusta"
                    className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${pathname === '/me-gusta' ? itemActive : itemIdle}`}>
                      <span data-ev-id="ev_sb_liked_i" className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-gradient-to-br from-[#ff3366] to-[#be123c] text-white">
                        <Heart className="h-4 w-4 fill-current" />
                      </span>
                      <span data-ev-id="ev_sb_liked_l" className="truncate">{t('Canciones que te gustan')}</span>
                    </Link>

                    {user ?
                  playlists.map((pl) =>
                  <Link
                    data-ev-id="ev_sb_pl"
                    key={pl.id}
                    to={`/lista/${pl.id}`}
                    className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${pathname === `/lista/${pl.id}` ? itemActive : itemIdle}`}>
                          <img data-ev-id="ev_sb_pl_img" src={coverUrl(pl.cover_key)} alt="" className="h-9 w-9 flex-none rounded-md object-cover" />
                          <span data-ev-id="ev_sb_pl_l" className="truncate">{pl.title}</span>
                        </Link>
                  ) :

                  <Link data-ev-id="ev_sb_lib_login" to="/login" className="px-2 py-2 text-[13px] text-white/50 hover:text-primary">
                        {t('Inicia sesión para guardar listas')}
                      </Link>
                  }
                  </div>
                }
              </>
            )}
          </div>

          {/* Account, plan and settings */}
          <div data-ev-id="ev_sb_secondary_nav" className={`flex flex-none flex-col gap-0.5 rounded-xl bg-surface ${collapsed ? 'p-1.5 items-center' : 'p-2'}`}>
            {paymentsOn &&
            <NavItem
              to="/planes"
              icon={<Crown className="h-5 w-5 flex-none text-amber-400" />}
              label={t('Subscribe')}
              active={pathname === '/planes'}
              badge={<Badge tone="border-amber-500/30 bg-amber-500/15 text-amber-300">PRO</Badge>}
              collapsed={collapsed} />
            }

            <button
              data-ev-id="ev_sb_rewards"
              type="button"
              onClick={() => setRewardsOpen(true)}
              title={t('Rewards')}
              aria-label={t('Rewards')}
              className={collapsed ? `${itemCollapsed} ${itemIdle}` : `${itemBase} ${itemIdle}`}
            >
              <Gift className="h-5 w-5 flex-none text-emerald-400" />
              {!collapsed && (
                <>
                  <span data-ev-id="ev_sb_rewards_l" className="truncate">{t('Rewards')}</span>
                  <span data-ev-id="ev_sb_credits" className="ml-auto flex items-center gap-1 rounded-md border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-primary">
                    <Coins className="h-3.5 w-3.5" />
                    {credits ?? 0}
                  </span>
                </>
              )}
            </button>

            <NavItem to="/qamuz-prod" icon={<Cpu className="h-5 w-5 flex-none text-primary" />} label="Qamuz Prod" active={pathname === '/qamuz-prod'} collapsed={collapsed} />

            <div data-ev-id="ev_sb_bottom_row" className={`mt-1 flex items-center gap-1 border-t border-white/10 pt-2 ${collapsed ? 'flex-col w-full' : ''}`}>
              {/* Language */}
              <div data-ev-id="ev_sb_lang" ref={langRef} className="relative">
                <button
                  data-ev-id="ev_sb_lang_btn"
                  type="button"
                  onClick={() => setLanguageOpen((v) => !v)}
                  aria-label={t('Language')}
                  title={currentLangObj.label}
                  className={collapsed ? `${itemCollapsed} text-white/70 hover:bg-white/5 hover:text-white` : 'flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white'}>
                  <Globe className="h-4 w-4" />
                  {!collapsed && <span data-ev-id="ev_sb_lang_short" className="uppercase">{currentLangObj.short}</span>}
                </button>
                {languageOpen &&
                <div data-ev-id="ev_sb_lang_menu" className="absolute bottom-full left-0 z-50 mb-1.5 flex w-48 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/80">
                    {LANGUAGES.map((l) =>
                  <button
                    data-ev-id="ev_sb_lang_opt"
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLang(l.code);
                      setLanguageOpen(false);
                    }}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${l.code === lang ? 'bg-primary/15 text-primary' : itemIdle}`}>
                        <span data-ev-id="ev_sb_lang_opt_l">{l.label}</span>
                        {l.code === lang && <Check className="h-4 w-4" />}
                      </button>
                  )}
                  </div>
                }
              </div>

              {/* Account */}
              <div data-ev-id="ev_sb_account" ref={accountRef} className={`relative ${collapsed ? 'w-full flex justify-center' : 'min-w-0 flex-1'}`}>
                {user ?
                <button
                  data-ev-id="ev_sb_account_btn"
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  title={user.email ?? undefined}
                  className={collapsed ? `${itemCollapsed} text-white/80 hover:bg-white/5` : 'flex h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white'}>
                    <span data-ev-id="ev_sb_avatar" className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-foreground">
                      {user.email ? user.email[0].toUpperCase() : <User className="h-3.5 w-3.5" />}
                    </span>
                    {!collapsed && (
                      <>
                        <span data-ev-id="ev_sb_account_name" className="truncate">{user.email?.split('@')[0]}</span>
                        <ChevronDown className={`ml-auto h-4 w-4 flex-none text-white/50 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button> :

                <Link data-ev-id="ev_sb_login" to="/login" title={t('Iniciar sesión')} className={collapsed ? `${itemCollapsed} bg-primary text-primary-foreground` : 'flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground hover:brightness-110'}>
                    {collapsed ? <User className="h-4 w-4" /> : t('Iniciar sesión')}
                  </Link>
                }

                {user && accountOpen &&
                <div data-ev-id="ev_sb_account_menu" className={`absolute bottom-full z-50 mb-1.5 flex w-56 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/80 ${collapsed ? 'left-0' : 'right-0'}`}>
                    <span data-ev-id="ev_sb_account_email" className="truncate px-2.5 py-1.5 text-xs text-white/50">{user.email}</span>
                    {isAdmin &&
                  <Link data-ev-id="ev_sb_admin" to="/admin" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/10">
                        <Shield className="h-4 w-4" />
                        Admin
                      </Link>
                  }
                    <button
                    data-ev-id="ev_sb_logout"
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      void signOut();
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-500/10">
                      <LogOut className="h-4 w-4" />
                      {t('Cerrar sesión')}
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </aside>

      <RewardsModal open={rewardsOpen} onClose={() => setRewardsOpen(false)} credits={credits} />
    </>);
}
