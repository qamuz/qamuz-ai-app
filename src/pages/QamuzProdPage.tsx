import { useState } from 'react';
import { Link } from 'react-router';
import {
  Apple,
  Bot,
  CheckCircle2,
  Cpu,
  FolderSync,
  Layers,
  Monitor,
  Music4,
  Play,
  Sliders,
  Sparkles,
  Terminal,
  Volume2,
  Wand2,
  AudioWaveform } from
'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { QamuzMark } from '@/components/QamuzMark';

interface CapabilityCard {
  id: string;
  badge: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  quotePrompt: string;
  tag: string;
}

export function QamuzProdPage() {
  const [activeTab, setActiveTab] = useState<'mac' | 'windows'>('mac');

  const capabilities: CapabilityCard[] = [
  {
    id: 'conversation',
    badge: 'Capacidades',
    title: 'Una conversación, cualquier proceso',
    desc: 'Audio de referencia, remix, extensiones, inpainting, clonación vocal, exportación de stems y acordes MIDI: todo hablando.',
    icon: Bot,
    quotePrompt: 'Haz remix de esta pista, separa las voces, extiende el coro y añade stem a la pista 4.',
    tag: 'All tools, one dialogue'
  },
  {
    id: 'library',
    badge: 'Librería Inteligente',
    title: 'Toda tu librería accesible al instante',
    desc: 'Apunta a archivos por nombre o ruta. Qamuz Prod busca y analiza tu librería completa sin necesidad de subidas manuales.',
    icon: FolderSync,
    quotePrompt: 'Usa la guitarra acústica de /temas/bachata_v2.wav o aquel requinto brillante de la semana pasada.',
    tag: 'Local files as context'
  },
  {
    id: 'workflow',
    badge: 'Flujo sin Fricción',
    title: 'Generación directa en tu DAW',
    desc: 'Crea pistas directamente en tu sesión. Itera en segundos sin saltar entre pestañas de navegador ni lidiar con descargas.',
    icon: Sliders,
    quotePrompt: 'Genera un beat de trap latino en la pista 1, oscurece el bajo 808 y añade reverb stereo.',
    tag: 'No downloads, no imports'
  }];


  return (
    <AppLayout>
      <div data-ev-id="ev_qamuz_prod_page" className="mx-auto max-w-6xl flex flex-col gap-16 pb-20">
        {/* Hero Section */}
        <div data-ev-id="ev_0c63b9184d" className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface via-background to-background p-6 sm:p-12 shadow-2xl">
          {/* Ambient glow backdrop */}
          <div data-ev-id="ev_5791559c4c" className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-gradient-to-br from-primary/15 via-[#00ffaa]/15 to-transparent blur-3xl" />
          <div data-ev-id="ev_5a5ef3a80d" className="pointer-events-none absolute -right-20 top-40 h-96 w-96 rounded-full bg-gradient-to-bl from-accent/20 via-primary/10 to-transparent blur-3xl" />

          {/* Top Brand Header Pill */}
          <div data-ev-id="ev_809cff7121" className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-black text-primary backdrop-blur">
            <QamuzMark className="h-4 w-4 fill-current" />
            <span data-ev-id="ev_4c104b16cd">Qamuz Prod · Desktop & DAW AI Agent</span>
          </div>

          {/* Main Hero Headline */}
          <div data-ev-id="ev_6cd6417c10" className="mt-6 max-w-3xl flex flex-col gap-4">
            <h1 data-ev-id="ev_2c320f580a" className="text-3xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.08]">
              Stop Jumping Between Tools.{' '}
              <span data-ev-id="ev_79365b2b0d" className="bg-gradient-to-r from-primary via-[#00ffaa] to-accent bg-clip-text text-transparent">
                Start Talking to One.
              </span>
            </h1>
            <p data-ev-id="ev_4d33fe71f9" className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Tu librería local de música. Tu sesión de DAW. El poder total de generación de Qamuz.
              Qamuz Prod conecta todo para que solo tengas que describir lo que quieres.
            </p>
          </div>

          {/* 3 Core Highlights */}
          <div data-ev-id="ev_2beda709fb" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-2xl">
            <div data-ev-id="ev_ef529c7b82" className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 backdrop-blur">
              <FolderSync className="h-6 w-6 text-primary flex-none" />
              <div data-ev-id="ev_a058cea24f">
                <span data-ev-id="ev_0d746f75b6" className="text-xs font-black text-foreground uppercase tracking-wider block">
                  Local Files
                </span>
                <span data-ev-id="ev_02c484cfa6" className="text-[11px] text-muted-foreground">Acceso a tus pistas y samples</span>
              </div>
            </div>

            <div data-ev-id="ev_d3a6de050d" className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 backdrop-blur">
              <Bot className="h-6 w-6 text-accent flex-none" />
              <div data-ev-id="ev_122f6b58dd">
                <span data-ev-id="ev_5f9d6ea310" className="text-xs font-black text-foreground uppercase tracking-wider block">
                  AI Conversational
                </span>
                <span data-ev-id="ev_7a4f15fdc8" className="text-[11px] text-muted-foreground">Todo en lenguaje natural</span>
              </div>
            </div>

            <div data-ev-id="ev_896ea60c37" className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 backdrop-blur">
              <AudioWaveform className="h-6 w-6 text-primary flex-none" />
              <div data-ev-id="ev_806bf25211">
                <span data-ev-id="ev_e76266272e" className="text-xs font-black text-foreground uppercase tracking-wider block">
                  DAW Control
                </span>
                <span data-ev-id="ev_690b777bcd" className="text-[11px] text-muted-foreground">Control directo de sesión</span>
              </div>
            </div>
          </div>

          {/* Action Download & Web Buttons */}
          <div data-ev-id="ev_44fc1767b7" className="mt-8 flex flex-wrap items-center gap-3">
            <button data-ev-id="ev_3dcb647afc"
            type="button"
            onClick={() => alert('Descarga Qamuz Prod Desktop para macOS disponible próximamente en beta')}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer">
              
              <Apple className="h-4 w-4" />
              <span data-ev-id="ev_159f1054c3">Download Mac OS</span>
            </button>

            <button data-ev-id="ev_42d842c929"
            type="button"
            onClick={() => alert('Descarga Qamuz Prod Desktop para Windows disponible próximamente en beta')}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-5 py-3 text-sm font-black text-foreground hover:bg-surface-3 active:scale-95 transition-all cursor-pointer">
              
              <Monitor className="h-4 w-4" />
              <span data-ev-id="ev_bc3b138b6e">Download Windows</span>
            </button>

            <Link data-ev-id="ev_6215f12bda"
            to="/studio"
            className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-black text-primary hover:bg-primary/20 active:scale-95 transition-all">
              
              <AudioWaveform className="h-4 w-4" />
              <span data-ev-id="ev_aa38d7a497">Abrir QAMUZ Studio Web</span>
            </Link>
          </div>
        </div>

        {/* Section: See it in Action */}
        <div data-ev-id="ev_3f82e0a855" className="flex flex-col gap-6">
          <div data-ev-id="ev_99892f5f90">
            <span data-ev-id="ev_e9445daf78" className="text-xs font-extrabold uppercase tracking-widest text-primary">
              Capacidades
            </span>
            <h2 data-ev-id="ev_e4c2a48e11" className="text-2xl sm:text-3xl font-black text-foreground mt-1">
              Míralo en Acción
            </h2>
            <p data-ev-id="ev_80ad710adb" className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Una muestra de cómo se siente tener a un productor musical co-piloto en tu sesión.
            </p>
          </div>

          <div data-ev-id="ev_1ad42f5c0c" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 */}
            <div data-ev-id="ev_f2394e1672" className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-xl transition-all hover:border-primary/40">
              <div data-ev-id="ev_94afa77bbb" className="flex flex-col gap-3">
                <div data-ev-id="ev_adf3253978" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Terminal className="h-5 w-5" />
                </div>
                <h3 data-ev-id="ev_9579e4fa51" className="text-base font-black text-foreground">DAW sin la curva de aprendizaje</h3>
                <p data-ev-id="ev_309e6ca6a3" className="text-xs text-muted-foreground leading-relaxed">
                  Habla con tu DAW en lenguaje natural. Dile qué quieres: pistas, efectos, BPM, exportar todo sin complicaciones.
                </p>
              </div>
              <div data-ev-id="ev_4a4dbfb0eb" className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span data-ev-id="ev_ec8b6bad96">Talk to DAW</span>
                <span data-ev-id="ev_c3b68beb5c" className="font-mono text-primary font-bold">Auto-pilot</span>
              </div>
            </div>

            {/* Card 2 */}
            <div data-ev-id="ev_c6b1d4475e" className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-xl transition-all hover:border-primary/40">
              <div data-ev-id="ev_61903d7927" className="flex flex-col gap-3">
                <div data-ev-id="ev_2b967e6489" className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 data-ev-id="ev_04394a005e" className="text-base font-black text-foreground">De la idea a la sesión completa</h3>
                <p data-ev-id="ev_432bf81edf" className="text-xs text-muted-foreground leading-relaxed">
                  Describe una canción. Qamuz la genera completa y luego importa cada stem a tu DAW alineado al compás.
                </p>
              </div>
              <div data-ev-id="ev_ece6cd28cb" className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span data-ev-id="ev_941a4c422e">One Prompt, Full Session</span>
                <span data-ev-id="ev_5b2c89d66b" className="font-mono text-accent font-bold">Beat-aligned</span>
              </div>
            </div>

            {/* Card 3 */}
            <div data-ev-id="ev_d21c78c368" className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-xl transition-all hover:border-primary/40">
              <div data-ev-id="ev_39a8f36fd3" className="flex flex-col gap-3">
                <div data-ev-id="ev_75c4e066a0" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 data-ev-id="ev_76b7e0a38d" className="text-base font-black text-foreground">Añade una pista, dile cómo</h3>
                <p data-ev-id="ev_b1aa802e41" className="text-xs text-muted-foreground leading-relaxed">
                  Basado en cualquier pista de tu sesión, genera un nuevo instrumento o voz que encaje a la perfección.
                </p>
              </div>
              <div data-ev-id="ev_95b36dc35d" className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span data-ev-id="ev_595ef1b992">Smart Gaps Fill</span>
                <span data-ev-id="ev_8c213578e5" className="font-mono text-primary font-bold">Context-aware</span>
              </div>
            </div>

            {/* Card 4 */}
            <div data-ev-id="ev_cb99d9bfa9" className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-xl transition-all hover:border-primary/40">
              <div data-ev-id="ev_f5e3cb16af" className="flex flex-col gap-3">
                <div data-ev-id="ev_78fd1917ac" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Volume2 className="h-5 w-5" />
                </div>
                <h3 data-ev-id="ev_ea00dac7f2" className="text-base font-black text-foreground">Tu Productor Musical IA</h3>
                <p data-ev-id="ev_3f507a279a" className="text-xs text-muted-foreground leading-relaxed">
                  Music Advisor lee tu sesión completa y te da una opinión honesta de productor, además de sugerencias y ajustes instantáneos.
                </p>
              </div>
              <div data-ev-id="ev_1e4a2523d8" className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span data-ev-id="ev_c188f3e6a3">Pro Ear Advice</span>
                <span data-ev-id="ev_494a155c13" className="font-mono text-primary font-bold">Always ready</span>
              </div>
            </div>

            {/* Card 5 */}
            <div data-ev-id="ev_5e5d31f2b6" className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-xl transition-all hover:border-primary/40">
              <div data-ev-id="ev_bb12204bf5" className="flex flex-col gap-3">
                <div data-ev-id="ev_9d2333b6d3" className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Music4 className="h-5 w-5" />
                </div>
                <h3 data-ev-id="ev_c262bb0a50" className="text-base font-black text-foreground">Tus archivos, infinitas opciones</h3>
                <p data-ev-id="ev_d97cfd3a5f" className="text-xs text-muted-foreground leading-relaxed">
                  Sube tu propio audio, imágenes o video para usar como referencia de estilo, remix, extensión, extracción de stems y clonación vocal.
                </p>
              </div>
              <div data-ev-id="ev_bbf38e27b3" className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span data-ev-id="ev_dde2068148">Infinite Starting Point</span>
                <span data-ev-id="ev_447465c950" className="font-mono text-accent font-bold">Universal I/O</span>
              </div>
            </div>

            {/* Card 6 (Action) */}
            <div data-ev-id="ev_a5806d6bb7" className="flex flex-col justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface p-5 shadow-xl">
              <div data-ev-id="ev_918b667679" className="flex flex-col gap-3">
                <div data-ev-id="ev_f4174b7e9e" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 data-ev-id="ev_6a352cdfc2" className="text-base font-black text-foreground">Integra con Qamuz DAW</h3>
                <p data-ev-id="ev_29c0bbc0a4" className="text-xs text-muted-foreground leading-relaxed">
                  Abre tus proyectos directamente en el DAW web integrado con la consola analógica, SPAN analyzer y sampler latino.
                </p>
              </div>
              <Link data-ev-id="ev_00fda2bf0e"
              to="/studio"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary py-2 text-xs font-black text-primary-foreground hover:brightness-110 active:scale-95 transition-all">
                
                <span data-ev-id="ev_16dd7de29d">Probar en DAW Web</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Section: Why Qamuz Prod Changes Everything */}
        <div data-ev-id="ev_841a4b3332" className="rounded-3xl border border-border bg-surface p-6 sm:p-10 flex flex-col gap-6">
          <div data-ev-id="ev_117ff43b36">
            <span data-ev-id="ev_8a96095956" className="text-xs font-extrabold uppercase tracking-widest text-primary">
              Productividad Radical
            </span>
            <h2 data-ev-id="ev_74f110bdcb" className="text-2xl sm:text-3xl font-black text-foreground mt-1">
              Por Qué Qamuz Prod lo Cambia Todo
            </h2>
            <p data-ev-id="ev_62e2bc2648" className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Qamuz Prod crea un puente directo entre tu computadora, tu DAW y la IA en un solo flujo continuo.
            </p>
          </div>

          <div data-ev-id="ev_40c05de4fc" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {capabilities.map((c, i) =>
            <div data-ev-id="ev_16c0a05483"
            key={c.id}
            className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
            i === 0 ?
            'border-primary/40 bg-primary/5 shadow-lg shadow-primary/5' :
            'border-border bg-surface-2'}`
            }>
              
                <div data-ev-id="ev_0b6da84fd0" className="flex flex-col gap-2">
                  <span data-ev-id="ev_acdd11d039" className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                    {c.badge}
                  </span>
                  <h3 data-ev-id="ev_780d059adf" className="text-sm font-extrabold text-foreground">{c.title}</h3>
                  <p data-ev-id="ev_9d08a1b355" className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>

                <div data-ev-id="ev_c4cfe2a994" className="mt-4 rounded-xl border border-border bg-surface-3 p-3 flex flex-col gap-1.5">
                  <span data-ev-id="ev_b5bed78314" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Pruébalo diciendo:
                  </span>
                  <p data-ev-id="ev_133193640c" className="text-xs font-medium italic text-foreground leading-snug">
                    "{c.quotePrompt}"
                  </p>
                </div>

                <span data-ev-id="ev_c75e58dcde" className="mt-4 inline-block self-start rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[9px] font-bold text-primary">
                  {c.tag}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Steps Section */}
        <div data-ev-id="ev_f0c3e558bf" className="flex flex-col gap-6">
          <div data-ev-id="ev_0b2865c701">
            <span data-ev-id="ev_5088189d3a" className="text-xs font-extrabold uppercase tracking-widest text-primary">
              Flujo de Trabajo
            </span>
            <h2 data-ev-id="ev_01bce60374" className="text-2xl sm:text-3xl font-black text-foreground mt-1">
              De la Idea a tu DAW en 4 Pasos
            </h2>
          </div>

          <div data-ev-id="ev_df801bc217" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div data-ev-id="ev_74587ec4ea" className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-2">
              <span data-ev-id="ev_acb7f43a1e" className="text-2xl font-black text-primary">01</span>
              <h3 data-ev-id="ev_40f91c63bb" className="text-sm font-bold text-foreground">Describe en lenguaje natural</h3>
              <p data-ev-id="ev_6a881e6de4" className="text-xs text-muted-foreground">
                Dile a Qamuz qué deseas: un instrumento, una vibración, una tarea técnica. Sin términos complejos.
              </p>
            </div>

            <div data-ev-id="ev_bb68f90455" className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-2">
              <span data-ev-id="ev_5109a88daa" className="text-2xl font-black text-accent">02</span>
              <h3 data-ev-id="ev_9cf4c07724" className="text-sm font-bold text-foreground">Qamuz crea la música</h3>
              <p data-ev-id="ev_26322ff000" className="text-xs text-muted-foreground">
                Analiza el contexto de tu sesión y genera exactamente las partes que encajan en tiempo y afinación.
              </p>
            </div>

            <div data-ev-id="ev_7720788d9b" className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-2">
              <span data-ev-id="ev_42e9f2893f" className="text-2xl font-black text-primary">03</span>
              <h3 data-ev-id="ev_5b32188125" className="text-sm font-bold text-foreground">Control automático de pistas</h3>
              <p data-ev-id="ev_1cdf88b0eb" className="text-xs text-muted-foreground">
                Sin clics manuales ni menús enredados: Qamuz Prod opera los canales en tu sesión por ti.
              </p>
            </div>

            <div data-ev-id="ev_ab01dd1ff7" className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-2">
              <span data-ev-id="ev_484031c126" className="text-2xl font-black text-accent">04</span>
              <h3 data-ev-id="ev_78af9b8ef3" className="text-sm font-bold text-foreground">Listo para mezclar</h3>
              <p data-ev-id="ev_02a30344e3" className="text-xs text-muted-foreground">
                Tus pistas quedan colocadas en la línea de tiempo. Escucha, da feedback y continúa creando.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>);

}

export default QamuzProdPage;