/**
 * studio-stems.ts
 * 1-Click bridge to send any song (catalog track, AI Studio generation, or separated stem set)
 * directly into the QAMUZ DAW Studio timeline.
 */

export interface SongForStudio {
	id?: string;
	title?: string;
	audioUrl?: string;
	prompt?: string;
	genre?: string;
	bpm?: number;
	isInstrumental?: boolean;
}

function bpmFromPrompt(text: string | undefined): number | null {
	if (!text) return null;
	const match = text.match(/(\d{2,3})\s*bpm\b/i) || text.match(/\btempo[:\s]+(\d{2,3})\b/i);
	if (!match) return null;
	const bpm = Number(match[1]);
	if (bpm < 60 || bpm > 220) return null;
	return bpm;
}

export function songSessionTitle(song: SongForStudio): string {
	const title = (song.title ?? '').trim();
	if (title && !/^generated track$/i.test(title)) return title.slice(0, 80);
	const prompt = (song.prompt ?? '').trim();
	const first = prompt.split(/[\n.!?]/)[0]?.trim() ?? '';
	return (first || title || 'Canción QAMUZ').slice(0, 80);
}

export interface OpenStudioOptions {
	extractStems?: boolean;
	forceNew?: boolean;
}

/**
 * Builds the URL to launch the DAW Studio with pre-loaded track or stem parameters.
 */
export function buildStudioUrl(song: SongForStudio, options: OpenStudioOptions = {}): string {
	const params = new URLSearchParams();

	if (song.id) {
		params.set('track', song.id);
	}
	if (song.audioUrl) {
		params.set('audio', song.audioUrl);
	}

	const session = songSessionTitle(song);
	if (session) {
		params.set('title', session);
	}

	const bpm = song.bpm ?? bpmFromPrompt(song.prompt ?? song.title);
	if (bpm) {
		params.set('bpm', String(bpm));
	}

	if (options.extractStems) {
		params.set('extractStems', '1');
	}

	return `/studio?${params.toString()}`;
}

/**
 * Open QAMUZ DAW Studio with this song.
 */
export function openSongInStudio(
	navigate: (path: string) => void,
	song: SongForStudio,
	options: OpenStudioOptions = {}
): void {
	const url = buildStudioUrl(song, options);
	navigate(url);
}

/**
 * Open QAMUZ DAW Studio with stem extraction enabled.
 */
export function openSongStemsInStudio(
	navigate: (path: string) => void,
	song: SongForStudio
): void {
	openSongInStudio(navigate, song, { extractStems: true });
}

