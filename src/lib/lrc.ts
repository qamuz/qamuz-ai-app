export interface DraftLine {
	time_ms: number;
	text: string;
}

export function formatLrcTime(ms: number): string {
	const total = Math.max(0, Math.round(ms / 10));
	const cs = total % 100;
	const s = Math.floor(total / 100) % 60;
	const m = Math.floor(total / 6000);
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Parse LRC text: lines like "[01:23.45] text". Lines without a timestamp are ignored. */
export function parseLrc(text: string): DraftLine[] {
	const out: DraftLine[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
		if (stamps.length === 0) continue;
		const lyric = raw.replace(/\[[^\]]*\]/g, '').trim();
		if (!lyric) continue;
		for (const st of stamps) {
			const frac = st[3] ? Number(st[3].padEnd(3, '0')) : 0;
			out.push({ time_ms: Number(st[1]) * 60000 + Number(st[2]) * 1000 + frac, text: lyric });
		}
	}
	return out.sort((a, b) => a.time_ms - b.time_ms);
}

export function toLrc(lines: DraftLine[]): string {
	return lines.map((l) => `[${formatLrcTime(l.time_ms)}] ${l.text}`).join('\n');
}
