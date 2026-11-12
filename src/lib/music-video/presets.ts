export type MusicVideoKind = 'music-video' | 'lyrics-video';
export type MusicVideoMode = 'one-click' | 'storyboard';
export type MusicVideoRatio = '16:9' | '9:16' | '3:4' | '4:3';

export const MV_CHARACTERS = [
	{ id: 'character-none', name: 'Sin personaje (Atmósfera & Entorno)', img: '' },
	{
		id: 'character-1',
		name: 'Cyber Singer A',
		img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'character-2',
		name: 'Cyber Singer B',
		img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'character-3',
		name: 'Urban Vocalist',
		img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'character-4',
		name: 'Futuristic Diva',
		img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'character-5',
		name: 'Neon Pop Idol',
		img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'character-6',
		name: 'Anime Vocalist',
		img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80',
	},
] as const;

export const MV_BACKGROUNDS = [
	{
		id: 'bg-office',
		name: 'Office Neon',
		img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'bg-garden',
		name: 'Pink Garden',
		img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'bg-cyber',
		name: 'Cyber Grid',
		img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'bg-stage',
		name: 'Concert Stage',
		img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'bg-studio',
		name: 'Studio Lights',
		img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
	},
] as const;

export const MV_STYLES = [
	{
		id: 'Cinematic',
		name: 'Cinematográfico Ultra-HD',
		img: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'Retro neon',
		name: 'Retro Neon 80s',
		img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'Synthwave',
		name: 'Synthwave Glow',
		img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'Ink style',
		name: 'Ink Style / Anime',
		img: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'Liminal space',
		name: 'Liminal Space',
		img: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'Vintage film',
		name: 'Vintage 35mm Film',
		img: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'Cyberweird',
		name: 'Cyberpunk Futurista',
		img: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80',
	},
	{
		id: 'Dark realism',
		name: 'Dark Realism Urbano',
		img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
	},
] as const;

export const MV_VIBES = [
	'Chill & Vibey',
	'Sad & Melancholic',
	'Romantic',
	'Nostalgic',
	'Dreamy',
	'Energetic & Dance',
	'Viral Hook 30s',
	'Hard Beat & Bass',
	'Latin Fire & Merengue',
	'Bachata Midnight',
] as const;

export const MV_CAMERA_MOTIONS = [
	'Zoom in y barrido dinámico',
	'Drone sweep panorámico',
	'Slow orbit alrededor del artista',
	'Handheld shake estilo cámara en mano',
	'Fast tracking rítmico',
	'Tomas cenitales y contrapicados',
] as const;

export interface MusicVideoPromptInput {
	title: string;
	lyrics?: string | null;
	extraPrompt?: string | null;
	videoType: MusicVideoKind;
	is30sViralHook: boolean;
	character?: string | null;
	background?: string | null;
	style: string;
	vibeTags: string[];
	videoGenMode: MusicVideoMode;
	cameraMotion?: string;
}

export function buildMusicVideoPrompt(input: MusicVideoPromptInput): string {
	const lyrics = String(input.lyrics || '')
		.replace(/\[[^\]]+\]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 420);
	const vibes = input.vibeTags.filter(Boolean).join(', ');
	const camera = input.cameraMotion || 'Zoom in y barrido dinámico';

	const parts = [
		input.videoType === 'lyrics-video'
			? `Animated kinetic typography lyrics video for the song “${input.title}”, synchronized readable sung words, vibrant lettering on screen, rhythmic music-driven motion, aesthetic glowing text`
			: `Cinematic official music video for the song “${input.title}”, performance energy, high-end music video lighting, cinematic framing`,
		input.is30sViralHook
			? '30-second viral hook clip optimized for TikTok, Instagram Reels and YouTube Shorts: instant explosive hook, intense visual climax, maximum retention opening'
			: 'Full music-video atmosphere opening into the emotional climax of the track',
		input.videoGenMode === 'storyboard'
			? 'Multi-shot storyboard continuous flow: opening frame, narrative development, energetic climax'
			: 'One-click AI director mode with fluid scene transitions',
		input.style ? `${input.style} visual aesthetic` : '',
		`Camera movement: ${camera}`,
		input.character && input.character !== 'Sin personaje (Atmósfera & Entorno)'
			? `Lead performer / character: ${input.character}`
			: 'No human lead, focus on hyper-detailed environment, lighting and atmosphere',
		input.background ? `Setting & environment: ${input.background}` : '',
		vibes ? `Emotional tone and energy: ${vibes}` : '',
		lyrics
			? input.videoType === 'lyrics-video'
				? `On-screen kinetic lyrics inspired by: ${lyrics}`
				: `Visual storytelling and metaphors inspired by these lyrics: ${lyrics}`
			: '',
		input.extraPrompt?.trim() || '',
		'photorealistic cinematography, 8k resolution, volumetric smoke and lighting, color graded, no watermark, no logo, award-winning music video style',
	];

	return parts.filter(Boolean).join('. ');
}

