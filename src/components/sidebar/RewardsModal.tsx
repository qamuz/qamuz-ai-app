import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Check,
  Coins,
  Gem,
  Gift,
  Share2,
  Sparkles,
  X } from
'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';

interface RewardsModalProps {
  open: boolean;
  onClose: () => void;
  credits: number | null;
}

export function RewardsModal({ open, onClose, credits }: RewardsModalProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function copyReferralLink() {
    const url = `${window.location.origin}/signup?ref=${user?.id?.slice(0, 8) || 'qamuz'}`;
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      data-ev-id="ev_rewards_modal_backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}>
      
      <div
        data-ev-id="ev_rewards_modal_box"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}>
        
        {/* Glow ambient background */}
        <div data-ev-id="ev_49afbe6924" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-[#00ffaa]/20 to-primary/20 blur-3xl" />
        <div data-ev-id="ev_62b525fb01" className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-gradient-to-tr from-accent/20 to-primary/20 blur-3xl" />

        {/* Header */}
        <div data-ev-id="ev_5da73e5e8c" className="flex items-center justify-between pb-4 border-b border-border">
          <div data-ev-id="ev_714e144c6f" className="flex items-center gap-3">
            <span data-ev-id="ev_3ae3e6b3f0" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00ffaa] to-primary text-black shadow-lg shadow-[#00ffaa]/25">
              <Gift className="h-5 w-5" />
            </span>
            <div data-ev-id="ev_b1b417fde3">
              <h2 data-ev-id="ev_b3c7b2b71f" className="text-base font-black tracking-tight text-foreground leading-tight">
                Qamuz Rewards
              </h2>
              <p data-ev-id="ev_b5f8a1a30b" className="text-xs text-muted-foreground">{t('Gana créditos y ventajas exclusivas')}</p>
            </div>
          </div>
          <button data-ev-id="ev_0132be5174"
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors">
            
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Balance Card */}
        <div data-ev-id="ev_899635efe5" className="my-5 flex items-center justify-between rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-surface-2 to-transparent p-4">
          <div data-ev-id="ev_58d78402e7" className="flex items-center gap-3">
            <Coins className="h-7 w-7 text-primary" />
            <div data-ev-id="ev_142fdfbc4d">
              <span data-ev-id="ev_0d3ef2e08b" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t('Tu balance actual')}
              </span>
              <p data-ev-id="ev_e418856742" className="text-2xl font-black text-foreground font-mono leading-none mt-0.5">
                {credits ?? 0}{' '}
                <span data-ev-id="ev_e4648461ac" className="text-xs font-semibold text-primary font-sans">{t('créditos IA')}</span>
              </p>
            </div>
          </div>
          <Link data-ev-id="ev_8f6da692db"
          to="/planes"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-primary-foreground shadow-md hover:brightness-110 active:scale-95 transition-all">
            
            <Gem className="h-3.5 w-3.5" />
            {t('Recargar')}
          </Link>
        </div>

        {/* Ways to earn */}
        <div data-ev-id="ev_540ccfb2b4" className="flex flex-col gap-2.5">
          <span data-ev-id="ev_8c05c1f407" className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
            {t('Formas de ganar recompensas')}
          </span>

          {/* Daily streak */}
          <div data-ev-id="ev_6e7471e0d4" className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <span data-ev-id="ev_e2597a213a" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <div data-ev-id="ev_3bf6e7ac5f" className="flex-1 min-w-0">
              <h3 data-ev-id="ev_52fcd6dab4" className="text-xs font-bold text-foreground leading-tight">{t('Racha de Creación Diaria')}</h3>
              <p data-ev-id="ev_c1223a12b7" className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {t('Genera música a diario para desbloquear bonificaciones continuas en tu cuenta.')}
              </p>
            </div>
          </div>

          {/* Referral link */}
          <div data-ev-id="ev_b27a8ccb02" className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <span data-ev-id="ev_6758be8b2e" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Share2 className="h-4 w-4" />
            </span>
            <div data-ev-id="ev_9d06e08039" className="flex-1 min-w-0">
              <h3 data-ev-id="ev_d7343ebbea" className="text-xs font-bold text-foreground leading-tight">{t('Invita a Productores & Artistas')}</h3>
              <p data-ev-id="ev_0801fc8430" className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {t('Comparte tu enlace de recomendación y gana 50 créditos por cada nuevo creador.')}
              </p>
              <button data-ev-id="ev_9b9eaf32ee"
              type="button"
              onClick={copyReferralLink}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-3 px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
                
                {copied ? <Check className="h-3 w-3 text-primary" /> : <Share2 className="h-3 w-3" />}
                {copied ? t('¡Enlace copiado!') : t('Copiar enlace de invitación')}
              </button>
            </div>
          </div>

          {/* Subscribe plan booster */}
          <div data-ev-id="ev_de4b7e2d1a" className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <span data-ev-id="ev_cf4a2084e7" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Gem className="h-4 w-4" />
            </span>
            <div data-ev-id="ev_def084a2ed" className="flex-1 min-w-0">
              <h3 data-ev-id="ev_096068ce8f" className="text-xs font-bold text-foreground leading-tight">{t('Planes Creator & Pro Studio')}</h3>
              <p data-ev-id="ev_be2688726f" className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {t('Obtén cuotas mensuales masivas de créditos, generación prioritaria y modelos Suno v5.')}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div data-ev-id="ev_8beedfa74b" className="mt-5 pt-3 border-t border-border flex items-center justify-between">
          <span data-ev-id="ev_a29a1e8b81" className="text-[11px] text-muted-foreground">{t('Sujeto a términos de uso de créditos')}</span>
          <Link data-ev-id="ev_6c28b31173"
          to="/planes"
          onClick={onClose}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
            
            {t('Ver catálogo de planes')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>);

}