import { Check, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LANGUAGES } from '@/i18n/core';
import { useI18n } from '@/hooks/useI18n';

export function LanguageSwitcher({ align = 'right' }: {align?: 'left' | 'right';}) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentLang = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div data-ev-id="ev_5a4fdefc16" ref={ref} className="relative">
			<button data-ev-id="ev_2b6f413477"
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={t('Language')}
      aria-expanded={open}
      className="flex h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
        
				<Globe className="h-4 w-4" />
				{currentLang.short}
			</button>
			{open &&
      <div data-ev-id="ev_b65512be72"
      role="menu"
      className={`absolute top-full z-50 mt-2 flex w-44 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-xl shadow-black/40 ${align === 'right' ? 'right-0' : 'left-0'}`}>
        
					{LANGUAGES.map((l) =>
        <button data-ev-id="ev_74a25e63c1"
        key={l.code}
        type="button"
        role="menuitemradio"
        aria-checked={l.code === lang}
        onClick={() => {
          setLang(l.code);
          setOpen(false);
        }}
        className={`flex min-h-10 items-center justify-between rounded-lg px-3 text-left text-sm transition-colors hover:bg-surface-2 ${l.code === lang ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
          
							{l.label}
							{l.code === lang && <Check className="h-4 w-4 text-primary" />}
						</button>
        )}
				</div>
      }
		</div>);

}