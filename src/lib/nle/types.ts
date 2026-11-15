import type { StudioSong } from '@/lib/studio';

export type NleMediaType = 'video' | 'image' | 'audio' | 'text';

export type NleAspectRatio = '16:9' | '9:16' | '21:9';

export type NleTransition =
	| 'none'
	| 'cross-dissolve'
	| 'fade-black'
	| 'slide-left'
	| 'zoom-in';

export type NleCameraMotion =
	| 'none'
	| 'zoom-in'
	| 'zoom-out'
	| 'pan-left'
	| 'pan-right';

export type NleToolMode = 'select' | 'razor';

export interface NleColorAdjust {
	brightness: number; // 50..150, default 100
	contrast: number; // 50..150, default 100
	saturate: number; // 0..200, default 100
}

export interface NleTextOverlay {
	text: string;
	fontSize: number; // px relative to 720p base (e.g. 28..56)
	color: string;
	bgOpacity: number; // 0..1
	position: 'top' | 'center' | 'bottom';
	fontWeight: 'medium' | 'bold' | 'black';
}

export interface NleClip {
	id: string;
	trackId: string;
	type: NleMediaType;
	title: string;
	sourceUrl: string;
	thumbnailUrl?: string | null;
	startTime: number; // seconds on timeline
	duration: number; // seconds on timeline
	trimStart: number; // seconds into source media
	opacity: number; // 0..1
	speed: number; // 0.5..2
	volume: number; // 0..1
	lutId: string; // 'inherit' or preset id
	colorAdjust: NleColorAdjust;
	cameraMotion: NleCameraMotion;
	transitionIn: NleTransition;
	textData?: NleTextOverlay;
	aiPrompt?: string;
}

export interface NleTrack {
	id: string;
	channelLabel: string;
	name: string;
	kind: 'text' | 'video' | 'audio';
	muted: boolean;
	hidden: boolean;
	locked: boolean;
	volume: number;
	clips: NleClip[];
}

export interface NleProjectFx {
	lutId: string;
	letterbox: boolean;
	grain: boolean;
	lightLeak: boolean;
	vignette: boolean;
}

export interface NleMediaAsset {
	id: string;
	kind: 'video' | 'image' | 'audio' | 'song';
	title: string;
	url: string;
	thumbnailUrl?: string | null;
	duration: number;
	subtitle?: string;
	songRef?: StudioSong;
	creationId?: string;
	status?: 'queued' | 'generating' | 'ready' | 'error';
}

export const DEFAULT_COLOR_ADJUST: NleColorAdjust = {
	brightness: 100,
	contrast: 100,
	saturate: 100,
};

export const NLE_TRANSITIONS: { id: NleTransition; label: string }[] = [
	{ id: 'none', label: 'Corte directo' },
	{ id: 'cross-dissolve', label: 'Disolvencia' },
	{ id: 'fade-black', label: 'Fundido a negro' },
	{ id: 'slide-left', label: 'Deslizar lateral' },
	{ id: 'zoom-in', label: 'Zoom de entrada' },
];

export const NLE_MOTIONS: { id: NleCameraMotion; label: string }[] = [
	{ id: 'none', label: 'Estático' },
	{ id: 'zoom-in', label: 'Zoom In lento' },
	{ id: 'zoom-out', label: 'Zoom Out' },
	{ id: 'pan-left', label: 'Paneo izquierda' },
	{ id: 'pan-right', label: 'Paneo derecha' },
];
