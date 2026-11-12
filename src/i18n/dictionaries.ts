import { coreDict } from '@/i18n/dict/core';
import { pagesDict } from '@/i18n/dict/pages';
import { studioDict } from '@/i18n/dict/studio';
import { artistDict } from '@/i18n/dict/artist';
import { adminDict } from '@/i18n/dict/admin';
import { contentDict } from '@/i18n/dict/content';
import { socialDict } from '@/i18n/dict/social';
import { dawDict } from '@/i18n/dict/daw';
import { toolsDict } from '@/i18n/dict/tools';
import { kieDict } from '@/i18n/dict/kie';
import { homeDict } from '@/i18n/dict/home';
import { libraryDict } from '@/i18n/dict/library';

export type DictChunk = { es: Record<string, string>; pt: Record<string, string>; fr: Record<string, string> };

const chunks: DictChunk[] = [coreDict, pagesDict, studioDict, artistDict, adminDict, contentDict, socialDict, dawDict, toolsDict, kieDict, homeDict, libraryDict];

function merge(lang: keyof DictChunk): Record<string, string> {
	return Object.assign({}, ...chunks.map((c) => c[lang]));
}

export const dictionaries: Partial<Record<string, Record<string, string>>> = {
	es: merge('es'),
	pt: merge('pt'),
	fr: merge('fr'),
};
