import { Link } from 'react-router';
import {
  Apple,
  ArrowRight,
  AudioWaveform,
  Bot,
  ExternalLink,
  FolderSync,
  Monitor,
  Sparkles,
  X } from
'lucide-react';
import { QamuzMark } from '@/components/QamuzMark';

interface QamuzProdModalProps {
  open: boolean;
  onClose: () => void;
}

export function QamuzProdModal({ open, onClose }: QamuzProdModalProps) {
  if (!open) return null;

  return (
    <div
      data-ev-id="ev_qamuz_prod_modal_backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}>
      
      <div
        data-ev-id="ev_qamuz_prod_modal_box"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}>
        
        {/* Glow ambient background */}
        <div data-ev-id="ev_b8b3ddb7cf" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-[#00ffaa]/20 to-primary/20 blur-3xl" />
        <div data-ev-id="ev_60d86a49a2" className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-gradient-to-tr from-accent/20 to-primary/20 blur-3xl" />

        {/* Header */}
        <div data-ev-id="ev_4c0f39745d" className="flex items-center justify-between pb-4 border-b border-border">
          <div data-ev-id="ev_120b52394b" className="flex items-center gap-3">
            <span data-ev-id="ev_3ac673de9a" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00ffaa] via-[#10b981] to-primary text-black shadow-lg shadow-[#00ffaa]/25">
              <QamuzMark className="h-5 w-5 fill-current" />
            </span>
            <div data-ev-id="ev_ab807a94f4">
              <div data-ev-id="ev_37932acbc2" className="flex items-center gap-2">
                <h2 data-ev-id="ev_f7317b66e2" className="text-base font-black tracking-tight text-foreground leading-tight">
                  Qamuz Prod
                </h2>
                <span data-ev-id="ev_8b31b3e594" className="rounded-md border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-primary">
                  Desktop AI
                </span>
              </div>
              <p data-ev-id="ev_b7d23ceddc" className="text-xs text-muted-foreground">Stop Jumping Between Tools. Start Talking to One.</p>
            </div>
          </div>
          <button data-ev-id="ev_5ca820df49"
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors">
            
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <div data-ev-id="ev_31abb2ff51" className="my-4 rounded-2xl border border-border bg-surface-2 p-4 text-xs text-foreground/80 leading-relaxed flex flex-col gap-2">
          <p data-ev-id="ev_2db62cae81" className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Tu Co-Productor IA para el DAW
          </p>
          <p data-ev-id="ev_136fdec992" className="text-muted-foreground">
            Qamuz Prod conecta tu librería local de samples, tu sesión de DAW y el motor de IA de Qamuz
            para que generes stems, compases y arreglos hablando en lenguaje natural.
          </p>
        </div>

        {/* Highlights */}
        <div data-ev-id="ev_c041b90df7" className="grid grid-cols-3 gap-2 py-1">
          <div data-ev-id="ev_03f466833e" className="flex flex-col items-center text-center rounded-xl border border-border bg-surface-2 p-2.5">
            <FolderSync className="h-4 w-4 text-primary mb-1" />
            <span data-ev-id="ev_ecf6c481af" className="text-[10px] font-bold text-foreground">Archivos Locales</span>
            <span data-ev-id="ev_d803d5ce4a" className="text-[9px] text-muted-foreground">Tus samples directos</span>
          </div>
          <div data-ev-id="ev_44abfab591" className="flex flex-col items-center text-center rounded-xl border border-border bg-surface-2 p-2.5">
            <Bot className="h-4 w-4 text-accent mb-1" />
            <span data-ev-id="ev_4a67ebfe17" className="text-[10px] font-bold text-foreground">IA Conversacional</span>
            <span data-ev-id="ev_41046a9e1e" className="text-[9px] text-muted-foreground">1 solo diálogo</span>
          </div>
          <div data-ev-id="ev_41d95d55f2" className="flex flex-col items-center text-center rounded-xl border border-border bg-surface-2 p-2.5">
            <AudioWaveform className="h-4 w-4 text-primary mb-1" />
            <span data-ev-id="ev_a0d02ecbfd" className="text-[10px] font-bold text-foreground">Control DAW</span>
            <span data-ev-id="ev_502897c6e7" className="text-[9px] text-muted-foreground">Operación directa</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div data-ev-id="ev_1637876f6f" className="mt-5 flex flex-col gap-2.5">
          <Link data-ev-id="ev_541ac9cfb9"
          to="/qamuz-prod"
          onClick={onClose}
          className="flex items-center justify-between rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground shadow-md hover:brightness-110 active:scale-95 transition-all">
            
            <span data-ev-id="ev_bea9840dbc" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span data-ev-id="ev_0e18c519f9">Ver Landing Page Completa de Qamuz Prod</span>
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div data-ev-id="ev_5f18921bd9" className="grid grid-cols-2 gap-2">
            <button data-ev-id="ev_7b7e126227"
            type="button"
            onClick={() => alert('Beta de Qamuz Prod para Mac en camino')}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 py-2 text-xs font-bold text-foreground hover:bg-surface-3 transition-colors">
              
              <Apple className="h-3.5 w-3.5" />
              <span data-ev-id="ev_9db71d77eb">Mac OS Beta</span>
            </button>
            <button data-ev-id="ev_58820b4e7a"
            type="button"
            onClick={() => alert('Beta de Qamuz Prod para Windows en camino')}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 py-2 text-xs font-bold text-foreground hover:bg-surface-3 transition-colors">
              
              <Monitor className="h-3.5 w-3.5" />
              <span data-ev-id="ev_1e2979b22a">Windows Beta</span>
            </button>
          </div>
        </div>
      </div>
    </div>);

}