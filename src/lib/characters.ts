import type { VocalPersona } from '@/components/studio/VocalSelectorModal';
import darren from '@/assets/generated/char-darren.webp';
import wayne from '@/assets/generated/char-wayne.webp';
import candice from '@/assets/generated/char-candice.webp';
import mandy from '@/assets/generated/char-mandy.webp';
import rodrick from '@/assets/generated/char-rodrick.webp';
import agatha from '@/assets/generated/char-agatha.webp';
import talia from '@/assets/generated/char-talia.webp';
import bella from '@/assets/generated/char-bella.webp';
import mateo from '@/assets/generated/char-mateo.webp';
import lucia from '@/assets/generated/char-lucia.webp';
import stan from '@/assets/generated/char-stan.webp';
import gemma from '@/assets/generated/char-gemma.webp';
import cathy from '@/assets/generated/char-cathy.webp';
import charles from '@/assets/generated/char-charles.webp';
import feng from '@/assets/generated/char-feng.webp';
import anhe from '@/assets/generated/char-anhe.webp';
import yuki from '@/assets/generated/char-yuki.webp';
import lin from '@/assets/generated/char-lin.webp';
import axel from '@/assets/generated/char-axel.webp';
import yara from '@/assets/generated/char-yara.webp';
import kofi from '@/assets/generated/char-kofi.webp';
import iris from '@/assets/generated/char-iris.webp';
import ramon from '@/assets/generated/char-ramon.webp';
import nina from '@/assets/generated/char-nina.webp';
import zane from '@/assets/generated/char-zane.webp';
import marina from '@/assets/generated/char-marina.webp';

/** AI singer characters: picking one opens the Studio with that voice style applied. */
export interface Character extends VocalPersona {
	image: string;
	/** Short card line, e.g. "pop · raspy". */
	label: string;
}

export const CHARACTERS: Character[] = [
	{ id: 'char-darren', name: 'Darren', label: 'pop · raspy', gender: 'male', genre: 'Pop', description: 'Raspy male pop voice', tags: 'pop, raspy male vocals', accentColor: 'from-orange-500 to-teal-500', image: darren },
	{ id: 'char-wayne', name: 'Wayne', label: 'hip hop', gender: 'male', genre: 'Hip hop', description: 'Confident male rapper', tags: 'hip hop, male rap vocals', accentColor: 'from-red-500 to-orange-500', image: wayne },
	{ id: 'char-candice', name: 'Candice', label: 'electronic', gender: 'female', genre: 'Electronic', description: 'Bright female electronic voice', tags: 'electronic, bright female vocals', accentColor: 'from-pink-500 to-cyan-500', image: candice },
	{ id: 'char-mandy', name: 'Mandy', label: 'hip hop · energy', gender: 'female', genre: 'Hip hop', description: 'Energetic female hip hop voice', tags: 'hip hop, energetic female vocals', accentColor: 'from-blue-500 to-fuchsia-500', image: mandy },
	{ id: 'char-mateo', name: 'Mateo', label: 'reggaeton · dembow', gender: 'male', genre: 'Reggaeton', description: 'Urban male reggaeton voice', tags: 'reggaeton, dembow, urban male vocals', accentColor: 'from-teal-500 to-lime-400', image: mateo },
	{ id: 'char-rodrick', name: 'Rodrick', label: 'R&B · soul', gender: 'male', genre: 'R&B', description: 'Soulful male R&B voice', tags: 'r&b, soulful male vocals', accentColor: 'from-purple-600 to-pink-500', image: rodrick },
	{ id: 'char-agatha', name: 'Agatha', label: 'pop', gender: 'female', genre: 'Pop', description: 'Smooth female pop voice', tags: 'pop, smooth female vocals', accentColor: 'from-violet-500 to-pink-500', image: agatha },
	{ id: 'char-lucia', name: 'Lucía', label: 'bachata · romantic', gender: 'female', genre: 'Bachata', description: 'Romantic female bachata voice', tags: 'bachata, romantic female vocals', accentColor: 'from-red-500 to-amber-500', image: lucia },
	{ id: 'char-talia', name: 'Talia', label: 'country · sweet', gender: 'female', genre: 'Country', description: 'Sweet female country voice', tags: 'country, sweet female vocals', accentColor: 'from-amber-400 to-yellow-600', image: talia },
	{ id: 'char-bella', name: 'Bella', label: 'R&B · powerful', gender: 'female', genre: 'R&B', description: 'Powerful female R&B voice', tags: 'r&b, powerful female vocals', accentColor: 'from-orange-500 to-teal-600', image: bella },
	{ id: 'char-stan', name: 'Stan', label: 'pop', gender: 'male', genre: 'Pop', description: 'Cool male pop voice', tags: 'pop, cool male vocals', accentColor: 'from-blue-500 to-amber-400', image: stan },
	{ id: 'char-gemma', name: 'Gemma', label: 'R&B', gender: 'female', genre: 'R&B', description: 'Warm female R&B voice', tags: 'r&b, warm soulful female vocals', accentColor: 'from-amber-500 to-orange-600', image: gemma },
	{ id: 'char-cathy', name: 'Cathy', label: 'R&B · angelic', gender: 'female', genre: 'R&B', description: 'Angelic female R&B voice', tags: 'r&b, angelic airy female vocals', accentColor: 'from-slate-300 to-amber-200', image: cathy },
	{ id: 'char-charles', name: 'Charles', label: 'pop · soulful', gender: 'male', genre: 'Pop', description: 'Soulful male pop voice', tags: 'pop, soulful male vocals', accentColor: 'from-lime-500 to-amber-400', image: charles },
	{ id: 'char-axel', name: 'Axel', label: 'rock', gender: 'male', genre: 'Rock', description: 'Gritty male rock voice', tags: 'rock, gritty powerful male vocals', accentColor: 'from-red-700 to-zinc-800', image: axel },
	{ id: 'char-yara', name: 'Yara', label: 'salsa · merengue', gender: 'female', genre: 'Tropical', description: 'Joyful female tropical voice', tags: 'salsa, merengue, joyful female vocals', accentColor: 'from-orange-500 to-teal-400', image: yara },
	{ id: 'char-kofi', name: 'Kofi', label: 'afrobeats', gender: 'male', genre: 'Afrobeats', description: 'Smooth male afrobeats voice', tags: 'afrobeats, smooth male vocals', accentColor: 'from-green-700 to-amber-500', image: kofi },
	{ id: 'char-iris', name: 'Iris', label: 'indie · lo-fi', gender: 'female', genre: 'Indie', description: 'Whispery female indie voice', tags: 'indie, lo-fi, whispery intimate female vocals', accentColor: 'from-violet-400 to-blue-500', image: iris },
	{ id: 'char-ramon', name: 'Ramón', label: 'regional mexicano', gender: 'male', genre: 'Regional mexicano', description: 'Powerful male ranchera voice', tags: 'regional mexicano, ranchera, powerful male vocals', accentColor: 'from-amber-600 to-red-900', image: ramon },
	{ id: 'char-zane', name: 'Zane', label: 'trap · melodic', gender: 'male', genre: 'Trap', description: 'Melodic male trap voice', tags: 'melodic trap, autotune male vocals', accentColor: 'from-lime-400 to-fuchsia-500', image: zane },
	{ id: 'char-nina', name: 'Nina', label: 'jazz', gender: 'female', genre: 'Jazz', description: 'Velvety female jazz voice', tags: 'jazz, velvety female vocals', accentColor: 'from-blue-800 to-slate-400', image: nina },
	{ id: 'char-marina', name: 'Marina', label: 'bossa nova', gender: 'female', genre: 'Bossa nova', description: 'Soft female bossa nova voice', tags: 'bossa nova, soft breathy female vocals', accentColor: 'from-rose-400 to-amber-400', image: marina },
	{ id: 'char-feng', name: '风阳', label: 'ballad', gender: 'male', genre: 'Ballad', description: 'Emotional male ballad voice', tags: 'ballad, emotional male vocals', accentColor: 'from-sky-800 to-teal-500', image: feng },
	{ id: 'char-anhe', name: '安和', label: 'mandopop', gender: 'female', genre: 'Mandopop', description: 'Elegant female mandopop voice', tags: 'mandopop, elegant female vocals', accentColor: 'from-pink-400 to-violet-500', image: anhe },
	{ id: 'char-yuki', name: '夕夕', label: 'J-pop · sweet', gender: 'female', genre: 'J-pop', description: 'Sweet female J-pop voice', tags: 'j-pop, sweet bright female vocals', accentColor: 'from-orange-200 to-sky-300', image: yuki },
	{ id: 'char-lin', name: '林海', label: 'folk · acoustic', gender: 'male', genre: 'Folk', description: 'Warm male folk voice', tags: 'folk, acoustic, warm male vocals', accentColor: 'from-amber-500 to-stone-600', image: lin },
];

export function characterById(id: string | null): Character | null {
	return (id && CHARACTERS.find((c) => c.id === id)) || null;
}
