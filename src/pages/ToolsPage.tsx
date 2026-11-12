import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  FileCode,
  Film,
  Grid3X3,
  Headphones,
  Library,
  Mic,
  Music2,
  Scissors,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Split,
  Wand2,
  Wrench,
  Clapperboard } from
'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { TrimModal } from '@/components/tools/TrimModal';

interface ToolItem {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  href: string;
  vip?: boolean;
  badge?: string;
  comingSoon?: boolean;
}

export function ToolsPage() {
  const navigate = useNavigate();
  const [trimModalOpen, setTrimModalOpen] = useState(false);

  // Recommended Tools (Matching layout / functionality)
  const recommendTools: ToolItem[] = [
  {
    id: 'score',
    title: 'Score',
    vip: true,
    desc: 'Turn any song into sheet music and MIDI scores',
    icon: Music2,
    href: '/studio'
  },
  {
    id: 'edit',
    title: 'Edit',
    vip: true,
    desc: 'Rewrite, inpaint and polish any part of your song',
    icon: Wand2,
    href: '/studio'
  }];


  // All Tools (Section 2)
  const allTools: ToolItem[] = [
  {
    id: 'edit',
    title: 'Edit',
    vip: true,
    desc: 'Rewrite any part of your song',
    icon: Wand2,
    href: '/studio'
  },
  {
    id: 'score',
    title: 'Score',
    vip: true,
    desc: 'Turn any song into score',
    icon: Music2,
    href: '/studio'
  },
  {
    id: 'extend',
    title: 'Extend',
    vip: true,
    desc: 'Extend any song with your own lyrics',
    icon: Share2,
    href: '/studio'
  },
  {
    id: 'trim',
    title: 'Trim',
    desc: 'Cut your audio with precision',
    icon: Scissors,
    href: '#trim'
  },
  {
    id: 'speech',
    title: 'Speech',
    desc: 'Create speech with lifelike AI voices',
    icon: Mic,
    href: '/studio'
  },
  {
    id: 'splitter',
    title: 'Splitter',
    vip: true,
    desc: 'Split any song into vocals and stems',
    icon: Split,
    href: '/stems'
  },
  {
    id: 'mastering',
    title: 'Mastering',
    vip: true,
    desc: 'Professional analog DSP & SPAN analyzer mastering',
    icon: SlidersHorizontal,
    href: '/mastering'
  },
  {
    id: 'videos',
    title: 'Music Video',
    vip: true,
    desc: 'Generate cinematic AI music videos synced to rhythm',
    icon: Film,
    href: '/videos'
  },
  {
    id: 'sampler',
    title: 'Sampler',
    vip: true,
    desc: '24-channel Dominican & Latin percussion drum sampler',
    icon: Grid3X3,
    href: '/studio'
  },
  {
    id: 'shorts',
    title: 'Shorts Stage',
    badge: 'LIVE',
    desc: 'Vertical YouTube Shorts stage with real-time lyrics',
    icon: Clapperboard,
    href: '/shorts'
  }];


  return (
    <AppLayout>
      <div data-ev-id="ev_tools_page" className="mx-auto max-w-6xl flex flex-col gap-8 pb-12">
        {/* Top Header */}
        <div data-ev-id="ev_d486f3c052" className="flex items-center justify-between border-b border-border pb-4">
          <div data-ev-id="ev_6588e44563" className="flex items-center gap-3">
            <span data-ev-id="ev_e9af004a45" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
              <Wrench className="h-5 w-5" />
            </span>
            <div data-ev-id="ev_4dc1bf3c72">
              <h1 data-ev-id="ev_a3c113bfe2" className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                Tools
              </h1>
              <p data-ev-id="ev_8cb6c86cf7" className="text-xs text-muted-foreground">
                Suite avanzada de producción musical e inteligencia artificial
              </p>
            </div>
          </div>

          <Link data-ev-id="ev_c6d3426a16"
          to="/biblioteca"
          className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs font-bold text-foreground/80 hover:bg-surface-3 hover:text-foreground transition-colors">
            
            <span data-ev-id="ev_326dd41a46">Library</span>
            <Library className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>

        {/* Section 1: Recommend */}
        <div data-ev-id="ev_a1dc2ac026" className="flex flex-col gap-3">
          <div data-ev-id="ev_49a6468fc4" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 data-ev-id="ev_f0027cfd6e" className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              Recommend
            </h2>
          </div>

          <div data-ev-id="ev_8833f72292" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recommendTools.map((t) => {
              const Icon = t.icon;
              return (
                <div data-ev-id="ev_ac33df8383"
                key={`rec-${t.id}`}
                onClick={() => navigate(t.href)}
                className="group relative flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xl backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-2 cursor-pointer">
                  
                  <div data-ev-id="ev_441e3126e4" className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-inner transition-transform group-hover:scale-105 group-hover:border-primary/60">
                    <Icon className="h-6 w-6" />
                  </div>

                  <div data-ev-id="ev_4857f01f1d" className="flex flex-col min-w-0 flex-1">
                    <div data-ev-id="ev_6f99616544" className="flex items-center gap-2">
                      <span data-ev-id="ev_4807bf3ce1" className="text-base font-black text-foreground group-hover:text-primary transition-colors">
                        {t.title}
                      </span>
                      {t.vip &&
                      <span data-ev-id="ev_78dfe8ccdf" className="rounded-md border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">
                          VIP
                        </span>
                      }
                    </div>
                    <p data-ev-id="ev_d32f427478" className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-1">
                      {t.desc}
                    </p>
                  </div>
                </div>);

            })}
          </div>
        </div>

        {/* Section 2: All Tools */}
        <div data-ev-id="ev_f9861f6f7e" className="flex flex-col gap-3">
          <h2 data-ev-id="ev_1c443a2e36" className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            All
          </h2>

          <div data-ev-id="ev_2a8720a67b" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {allTools.map((t) => {
              const Icon = t.icon;
              return (
                <div data-ev-id="ev_b5e3a2d259"
                key={`all-${t.id}`}
                onClick={() => {
                  if (t.id === 'trim') {
                    setTrimModalOpen(true);
                  } else {
                    navigate(t.href);
                  }
                }}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-lg backdrop-blur-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-2 cursor-pointer min-h-[110px]">
                  
                  <div data-ev-id="ev_e77a283ef5" className="flex items-start justify-between gap-3">
                    <div data-ev-id="ev_4e16ba81ef" className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform group-hover:scale-105">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    {t.vip &&
                    <span data-ev-id="ev_60fa5a341c" className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">
                        VIP
                      </span>
                    }
                    {t.badge &&
                    <span data-ev-id="ev_e5c4d09d80" className="rounded border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-300">
                        {t.badge}
                      </span>
                    }
                  </div>

                  <div data-ev-id="ev_bbba2422e4" className="mt-3">
                    <h3 data-ev-id="ev_ce901a2f68" className="text-sm font-extrabold text-foreground group-hover:text-primary transition-colors">
                      {t.title}
                    </h3>
                    <p data-ev-id="ev_05dd9d6bbf" className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                      {t.desc}
                    </p>
                  </div>
                </div>);

            })}
          </div>
        </div>
      </div>

      {/* Trim Modal with Source Selection -> Processing -> Waveform Editor */}
      <TrimModal open={trimModalOpen} onClose={() => setTrimModalOpen(false)} />
    </AppLayout>);

}

export default ToolsPage;