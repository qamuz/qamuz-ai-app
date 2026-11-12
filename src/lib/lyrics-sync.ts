export type TimedLyricLine = {
	text: string;
	/** Start time in seconds. */
	start: number;
	end?: number;
	/** True when the source had an explicit timestamp / vocal alignment. */
	timed: boolean;
	section?: string;
};

const LRC_LINE = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/;
const SECTION_TAG = /^\[([^\]]+)\]$/;

const SECTION_WEIGHT: Record<string, number> = {
	intro: 0.85,
	instrumental: 0.9,
	solo: 0.9,
	verse: 1.15,
	canto: 1.15,
	'pre-chorus': 0.85,
	prechorus: 0.85,
	chorus: 1.35,
	coro: 1.35,
	mambo: 1.4,
	hook: 1.25,
	bridge: 1.0,
	breakdown: 0.9,
	outro: 1.05,
	ending: 1.05,
	end: 0.8,
};

function normalizeSection(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/\d+/g, '')
		.replace(/[:\-_/]+/g, ' ')
		.trim();
}

function sectionKey(label: string): string {
	const n = normalizeSection(label);
	for (const key of Object.keys(SECTION_WEIGHT)) {
		if (n === key || n.startsWith(key) || n.includes(key)) return key;
	}
	return 'verse';
}

function isSectionOnly(text: string): boolean {
	return SECTION_TAG.test(text.trim());
}

function parseSectionLabel(text: string): string | null {
	const match = text.trim().match(SECTION_TAG);
	return match ? match[1].trim() : null;
}

/**
 * Split raw lyrics into display lines, preserving LRC timestamps when present.
 * Empty structural markers ([Intro], [Instrumental], [Coro], [Mambo]...) are kept as section boundaries.
 */
export function parseLyricSource(raw: string): Array<{
	text: string;
	start: number | null;
	section?: string;
	boundary?: boolean;
}> {
	const text = (raw || '').replace(/\r\n/g, '\n').trim();
	if (!text) return [];

	let currentSection: string | undefined;
	const rows: Array<{
		text: string;
		start: number | null;
		section?: string;
		boundary?: boolean;
	}> = [];

	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (!line) continue;

		const match = line.match(LRC_LINE);
		if (match) {
			const minutes = Number(match[1]);
			const seconds = Number(match[2]);
			const fracRaw = match[3] || '0';
			const frac = fracRaw.length <= 2 ? Number(fracRaw) / 100 : Number(fracRaw) / 1000;
			const body = (match[4] || '').trim();
			if (!body || isSectionOnly(body)) {
				const label = parseSectionLabel(body || '') || parseSectionLabel(line);
				if (label) {
					currentSection = label;
					rows.push({ text: '', start: null, section: label, boundary: true });
				}
				continue;
			}
			rows.push({
				text: body,
				start: minutes * 60 + seconds + (Number.isFinite(frac) ? frac : 0),
				section: currentSection,
			});
			continue;
		}

		const label = parseSectionLabel(line);
		if (label && isSectionOnly(line)) {
			currentSection = label;
			rows.push({ text: '', start: null, section: label, boundary: true });
			continue;
		}

		const leading = line.match(/^\[([^\]]+)\]\s*(.+)$/);
		if (leading) currentSection = leading[1].trim();
		const cleaned = line.replace(/^\[[^\]]+\]\s*/, '').trim();
		if (!cleaned) continue;
		rows.push({ text: cleaned, start: null, section: currentSection });
	}

	const sung = rows.filter((r) => !r.boundary && r.text);
	if (sung.length === 1 && sung[0].start == null && sung[0].text.length > 72) {
		const phrases = sung[0].text
			.split(/(?<=[,.!?;:])\s+|\s+[—–-]\s+/)
			.map((part) => part.trim())
			.filter((part) => part.length > 0);
		if (phrases.length > 1) {
			const rebuilt: typeof rows = [];
			for (const row of rows) {
				if (row === sung[0]) {
					for (const part of phrases) {
						rebuilt.push({ text: part, start: null, section: row.section });
					}
				} else {
					rebuilt.push(row);
				}
			}
			return rebuilt;
		}
	}

	return rows;
}

type SectionBlock = {
	label: string;
	key: string;
	lines: Array<{ text: string; section?: string }>;
};

function groupIntoSections(
	parsed: Array<{ text: string; start: number | null; section?: string; boundary?: boolean }>
): SectionBlock[] {
	const blocks: SectionBlock[] = [];
	let current: SectionBlock | null = null;

	for (const row of parsed) {
		if (row.boundary && row.section) {
			current = {
				label: row.section,
				key: sectionKey(row.section),
				lines: [],
			};
			blocks.push(current);
			continue;
		}
		const label = row.section || current?.label || 'Verse';
		const key = sectionKey(label);
		if (!current || current.label !== label) {
			current = { label, key, lines: [] };
			blocks.push(current);
		}
		if (row.text) current.lines.push({ text: row.text, section: label });
	}

	return blocks.filter((b) => b.lines.length > 0 || ['intro', 'instrumental', 'solo', 'outro', 'ending'].includes(b.key));
}

function getLineSyllableWeight(text: string): number {
	const cleaned = text.trim().toLowerCase().replace(/\[[^\]]+\]/g, '').trim();
	const words = cleaned.split(/\s+/).filter(Boolean);
	if (words.length === 0) return 1.5;
	const vowelMatches = cleaned.match(/[aeiouyáéíóúüàèìòùâêîôûãõäëïöü]+/gi);
	const syllables = vowelMatches ? vowelMatches.length : words.length * 2;
	return Math.max(1.5, words.length * 0.75 + syllables * 0.25);
}

/**
 * Structure-aware timing when no vocal alignment exists.
 * Distributes lyrics musically across song duration with realistic pacing and breathing room.
 */
export function buildStructuredTimedLyrics(raw: string, durationSec: number): TimedLyricLine[] {
	const parsed = parseLyricSource(raw);
	if (parsed.length === 0) return [];

	const duration = Number.isFinite(durationSec) && durationSec > 1 ? durationSec : 0;
	const sungRows = parsed.filter((line) => !line.boundary && line.text);
	if (sungRows.length === 0) return [];

	const hasTimestamps = sungRows.some((line) => line.start != null);
	if (hasTimestamps) {
		const known = sungRows
			.map((line, index) => ({ index, start: line.start }))
			.filter((row): row is { index: number; start: number } => row.start != null);

		return sungRows.map((line, index) => {
			if (line.start != null) {
				return {
					text: line.text,
					start: line.start,
					timed: true,
					section: line.section,
				};
			}
			let prev = known[0];
			let next = known[known.length - 1];
			for (const row of known) {
				if (row.index <= index) prev = row;
				if (row.index >= index) {
					next = row;
					break;
				}
			}
			if (prev.index === next.index) {
				return {
					text: line.text,
					start: prev.start,
					timed: true,
					section: line.section,
				};
			}
			const t = (index - prev.index) / Math.max(1, next.index - prev.index);
			return {
				text: line.text,
				start: prev.start + (next.start - prev.start) * t,
				timed: true,
				section: line.section,
			};
		});
	}

	const blocks = groupIntoSections(parsed);
	const totalDur = duration > 0 ? duration : Math.max(sungRows.length * 3.8, 60);

	const hasFirstBlockIntro =
		blocks.length > 0 && (blocks[0].key === 'intro' || blocks[0].key === 'instrumental');

	const leadIn = hasFirstBlockIntro
		? Math.min(15, Math.max(6, totalDur * 0.075))
		: Math.min(5.5, Math.max(2.2, totalDur * 0.035));

	const trail = Math.min(8, Math.max(3, totalDur * 0.04));
	const usable = Math.max(totalDur - leadIn - trail, sungRows.length * 2.2);

	const weights = blocks.map((block) => {
		const base = SECTION_WEIGHT[block.key] ?? 1.0;
		if (block.lines.length === 0) return base * 1.5;
		const blockSyllables = block.lines.reduce((sum, line) => sum + getLineSyllableWeight(line.text), 0);
		return base * blockSyllables;
	});
	const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

	const timed: TimedLyricLine[] = [];
	let cursor = leadIn;

	blocks.forEach((block, bi) => {
		const slice = (weights[bi] / weightSum) * usable;
		if (block.lines.length === 0) {
			cursor += slice;
			return;
		}

		const isIntroOrInst = block.key === 'intro' || block.key === 'instrumental';
		const sungStartPad = isIntroOrInst
			? Math.min(slice * 0.35, 5)
			: block.key === 'outro'
			? Math.min(slice * 0.1, 1.8)
			: Math.min(slice * 0.06, 1.8);
		const sungEndPad =
			block.key === 'outro' || block.key === 'ending' ? Math.min(slice * 0.3, 6) : Math.min(slice * 0.06, 1.8);

		const singSpan = Math.max(slice - sungStartPad - sungEndPad, block.lines.length * 1.6);
		const sectionStart = cursor + sungStartPad;

		const lineWeights = block.lines.map((l) => getLineSyllableWeight(l.text));
		const totalBlockWeight = lineWeights.reduce((a, b) => a + b, 0) || 1;

		let lineCursor = sectionStart;
		block.lines.forEach((line, li) => {
			const rawSlot = (lineWeights[li] / totalBlockWeight) * singSpan;
			const lineSlot = Math.max(1.4, rawSlot);
			const start = lineCursor;
			const end = start + Math.max(lineSlot - 0.25, 1.2);

			timed.push({
				text: line.text,
				start,
				end,
				timed: false,
				section: block.label,
			});

			lineCursor += lineSlot;
		});

		cursor += slice;
	});

	return timed;
}

export const LYRIC_VOICE_LAG_SEC = 0.02;

/**
 * Finds active lyric line index for a playhead time (seconds).
 */
export function activeLyricIndex(
	lines: TimedLyricLine[],
	timeSec: number,
	lagSec: number = LYRIC_VOICE_LAG_SEC
): number {
	if (lines.length === 0) return -1;
	const raw = Number.isFinite(timeSec) ? timeSec : 0;
	const lag = Number.isFinite(lagSec) ? lagSec : 0.02;
	const t = raw - lag;

	if (t < lines[0].start - 0.15) return -1;

	let lo = 0;
	let hi = lines.length - 1;
	let best = 0;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (lines[mid].start <= t + 0.12) {
			best = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	return best;
}

/** Convenience aliases for karaoke & visualizer components */
export const alignLyrics = buildStructuredTimedLyrics;
export const findActiveLine = activeLyricIndex;


