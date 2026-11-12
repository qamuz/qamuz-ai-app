import { dictionaries } from '@/i18n/dictionaries';
import { legacyDict } from '@/i18n/dict/legacy';

export type Lang = 'en' | 'es' | 'pt' | 'fr';

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
	{ code: 'en', label: 'English', short: 'EN' },
	{ code: 'es', label: 'Español', short: 'ES' },
	{ code: 'pt', label: 'Português', short: 'PT' },
	{ code: 'fr', label: 'Français', short: 'FR' },
];

export const DEFAULT_LANG: Lang = 'en';
const STORAGE_KEY = 'qamuz-lang';

export type TranslateVars = Record<string, string | number>;

function isLang(value: unknown): value is Lang {
	return LANGUAGES.some((l) => l.code === value);
}

export function readStoredLang(): Lang {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (isLang(stored)) return stored;
	} catch {
		/* storage unavailable */
	}
	return DEFAULT_LANG;
}

export function storeLang(lang: Lang) {
	try {
		window.localStorage.setItem(STORAGE_KEY, lang);
	} catch {
		/* storage unavailable */
	}
}

let current: Lang = readStoredLang();

/** Current language for non-React helpers (dates, relative time). */
export function getLang(): Lang {
	return current;
}

export function setCurrentLang(lang: Lang) {
	current = lang;
}

/**
 * Translate an English source string. English text is the key; other languages
 * fall back to English when a translation is missing. Supports {placeholders}.
 */
export function translate(key: string, vars?: TranslateVars, lang: Lang = current): string {
	// Legacy Spanish source strings resolve through legacyDict (es keeps the key).
	const legacy = legacyDict[key];
	const text =
		lang === 'en'
			? (legacy?.en ?? key)
			: lang === 'es'
				? (dictionaries.es?.[key] ?? key)
				: (dictionaries[lang]?.[key] ?? legacy?.[lang] ?? key);
	if (!vars) return text;
	return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export type TFunction = (key: string, vars?: TranslateVars) => string;
