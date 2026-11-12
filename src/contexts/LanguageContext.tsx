import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nContext } from '@/contexts/i18n-context';
import { readStoredLang, setCurrentLang, storeLang, translate, type Lang, type TranslateVars } from '@/i18n/core';

const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR' };

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [lang, setLangState] = useState<Lang>(() => readStoredLang());

	useEffect(() => {
		document.documentElement.lang = lang;
	}, [lang]);

	const setLang = useCallback((next: Lang) => {
		setCurrentLang(next);
		storeLang(next);
		setLangState(next);
	}, []);

	const value = useMemo(() => {
		setCurrentLang(lang);
		return {
			lang,
			setLang,
			locale: LOCALES[lang],
			t: (key: string, vars?: TranslateVars) => translate(key, vars, lang),
		};
	}, [lang, setLang]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
