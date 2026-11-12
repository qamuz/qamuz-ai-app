/** Format seconds as m:ss. */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format a big number as 1.9 M / 842 K. */
export function formatCount(value: number): string {
	if (value >= 1000000) return `${(value / 1000000).toFixed(1)} M`;
	if (value >= 1000) return `${Math.round(value / 1000)} K`;
	return String(value);
}

/** English greeting key based on the local hour — pass through t() to localize. */
export function greeting(date = new Date()): string {
	const hour = date.getHours();
	if (hour < 6) return 'Good evening';
	if (hour < 12) return 'Good morning';
	if (hour < 19) return 'Good afternoon';
	return 'Good evening';
}
