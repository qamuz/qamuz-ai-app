import { createContext } from 'react';
import type { Lang, TFunction } from '@/i18n/core';

export interface I18nContextType {
	lang: Lang;
	setLang: (lang: Lang) => void;
	t: TFunction;
	/** BCP-47 locale for Intl formatting. */
	locale: string;
}

export const I18nContext = createContext<I18nContextType | null>(null);
