import { supabase } from '@/integrations/supabase/client';
import type { AccountPlan, OwnedArtist } from '@/contexts/account-context';
import type { TrackWithArtist } from '@/types/music';

export type EngagementAction = 'view' | 'share' | 'sync';
export type ShareChannel = 'copy' | 'whatsapp' | 'x' | 'facebook' | 'telegram' | 'email' | 'native';

export interface TrackStats {
	plays: number;
	likes_count: number;
	comments_count: number;
	shares_count: number;
}

/** AI drafts (not yet published) use "ai-" ids and have no public stats. */
export function isCatalogTrack(trackId: string): boolean {
	return !trackId.startsWith('ai-');
}

/** Record a view/share (or just refresh counters) on the server. */
export async function trackEvent(trackId: string, action: EngagementAction, channel?: ShareChannel): Promise<TrackStats | null> {
	if (!supabase || !isCatalogTrack(trackId)) return null;
	const { data, error } = await supabase.functions.invoke('track-event', { body: { trackId, action, channel } });
	if (error) return null;
	return (data as { stats?: TrackStats } | null)?.stats ?? null;
}

export function shareUrl(trackId: string): string {
	return `${window.location.origin}/shorts?t=${trackId}`;
}

export function copyText(text: string): boolean {
	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	document.body.appendChild(textarea);
	textarea.select();
	let ok = false;
	try {
		ok = document.execCommand('copy');
	} catch {
		ok = false;
	}
	document.body.removeChild(textarea);
	return ok;
}

interface AccessInfo {
	artist: OwnedArtist | null;
	isAdmin: boolean;
	plan?: AccountPlan | null;
}

export function isTrackOwner(track: TrackWithArtist, { artist, isAdmin }: AccessInfo): boolean {
	if (isAdmin || !isCatalogTrack(track.id)) return true;
	return Boolean(artist && track.artist?.id === artist.id);
}

/** Downloads: the song's owner, admins, or anyone on a paid plan. */
export function canDownload(track: TrackWithArtist, access: AccessInfo): boolean {
	return isTrackOwner(track, access) || Boolean(access.plan && access.plan.slug !== 'gratis');
}

function safeName(value: string): string {
	return value.replace(/[\\/:*?"<>|]+/g, '').trim() || 'qamuz-track';
}

export function encodeWav(buffer: AudioBuffer): Blob {
	const channels = buffer.numberOfChannels;
	const rate = buffer.sampleRate;
	const frames = buffer.length;
	const bytesPerSample = 2;
	const dataSize = frames * channels * bytesPerSample;
	const view = new DataView(new ArrayBuffer(44 + dataSize));
	const write = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
	};
	write(0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	write(8, 'WAVE');
	write(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channels, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate * channels * bytesPerSample, true);
	view.setUint16(32, channels * bytesPerSample, true);
	view.setUint16(34, 16, true);
	write(36, 'data');
	view.setUint32(40, dataSize, true);
	const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
	let offset = 44;
	for (let i = 0; i < frames; i += 1) {
		for (let c = 0; c < channels; c += 1) {
			const sample = Math.max(-1, Math.min(1, data[c][i]));
			view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
			offset += 2;
		}
	}
	return new Blob([view], { type: 'audio/wav' });
}

/** Download a song as MP3 (original file) or WAV (decoded in the browser). Returns an error message or null. */
export async function downloadTrack(track: TrackWithArtist, format: 'mp3' | 'wav'): Promise<string | null> {
	try {
		const res = await fetch(track.audio_url);
		if (!res.ok) return 'Could not download this song';
		const source = await res.blob();
		let blob = source;
		let ext = 'mp3';
		if (format === 'wav') {
			const ctx = new AudioContext();
			const decoded = await ctx.decodeAudioData(await source.arrayBuffer());
			void ctx.close();
			blob = encodeWav(decoded);
			ext = 'wav';
		} else if (source.type && !source.type.includes('mpeg') && !source.type.includes('mp3')) {
			ext = source.type.split('/')[1]?.split(';')[0] || 'mp3';
		}
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${safeName(`${track.artist?.name ?? 'Qamuz'} - ${track.title}`)}.${ext}`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 4000);
		return null;
	} catch {
		return 'Could not download this song';
	}
}
