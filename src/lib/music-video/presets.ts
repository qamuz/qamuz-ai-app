export type MusicVideoKind = 'music-video' | 'lyrics-video' | 'short-film' | 'film-trailer' | 'art-visualizer';
export type MusicVideoMode = 'one-click' | 'storyboard' | 'narrative-scene';
export type MusicVideoRatio = '16:9' | '9:16' | '21:9' | '4:3';

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

export const MV_SFX_PRESETS = [
	{ id: 'sfx-none', name: 'Sin SFX adicional (Solo música original)', desc: 'Mantiene únicamente la pista musical' },
	{ id: 'sfx-impact', name: 'Impacto Cinemático & Sub-Drop', desc: 'Golpe de bajo profundo para momentos de clímax' },
	{ id: 'sfx-riser', name: 'Riser de Sintetizador Épico', desc: 'Subida progresiva antes del coro o cambio de ritmo' },
	{ id: 'sfx-rain', name: 'Lluvia y Truenos Nocturnos', desc: 'Textura ambiental melancólica y cinematográfica' },
	{ id: 'sfx-stadium', name: 'Multitud y Aplausos de Concierto', desc: 'Ambiente en vivo con energía de festival' },
	{ id: 'sfx-vinyl', name: 'Crepitar de Vinilo Retro', desc: 'Cálido ruido de aguja y textura vintage lo-fi' },
	{ id: 'sfx-cyber', name: 'Sirenas y Atmósfera Urbana Cyberpunk', desc: 'Ecos de ciudad nocturna con sirenas distantes' },
	{ id: 'sfx-glitch', name: 'Chispas Láser y Glitches Digitales', desc: 'Efectos futuristas de alta tensión' },
] as const;

export const MV_LIP_SYNC_MODES = [
	{ id: 'phoneme', name: 'Precisión Fonética Rítmica', desc: 'Sincronización exacta con cada vocal y consonante al tempo' },
	{ id: 'expressive', name: 'Expresividad Emocional', desc: 'Gesticulación vocal dramática con énfasis en coros y ganchos' },
	{ id: 'natural', name: 'Natural Studio Sync', desc: 'Movimiento labial suave y orgánico de cantante profesional' },
] as const;

export const MV_ACTOR_FRAMINGS = [
	{ id: 'close-up', name: 'Primer Plano (Lip-Sync Focus)', desc: 'Enfoque en rostro, labios y mirada del artista' },
	{ id: 'medium', name: 'Plano Medio (Performance & Baile)', desc: 'Cuerpo superior, gesticulación y actitud' },
	{ id: 'wide', name: 'Plano General Épico (Escenario & Luces)', desc: 'Atmósfera total con el artista en el entorno' },
] as const;

export const MV_ACTOR_EXPRESSIONS = [
	'Pasional e Intenso (Clímax vocal y dramatismo)',
	'Sonriente y Enérgico (Vibra festiva y dance)',
	'Desafiante y Urbano (Actitud Trap / Hip-Hop)',
	'Melancólico y Enigmático (Balada / R&B íntimo)',
	'Futurista y Sereno (Cyberpunk / Synthwave)',
] as const;

export const AUTEUR_DIRECTORS = [
	{ id: 'auteur-none', name: 'Estilo Director Natural / Neutral', desc: 'Dirección equilibrada' },
	{ id: 'auteur-villeneuve', name: 'Denis Villeneuve', desc: 'Escala épica, arquitectura brutalista, atmósfera monumental y niebla' },
	{ id: 'auteur-wong', name: 'Wong Kar-wai', desc: 'Luces de neón melancólicas, colores saturados, paso a paso poético y desenfoque' },
	{ id: 'auteur-nolan', name: 'Christopher Nolan', desc: 'Fotografía IMAX 70mm, dinamismo temporal, realismo práctico y tensión dramática' },
	{ id: 'auteur-fincher', name: 'David Fincher', desc: 'Baja iluminación precisa, tonos verde-dorados oscuros, misterio y control quirúrgico' },
	{ id: 'auteur-anderson', name: 'Wes Anderson', desc: 'Simetría visual perfecta, paletas pastel cálidas y composición teatral única' },
	{ id: 'auteur-deltoro', name: 'Guillermo del Toro', desc: 'Atmósfera gótica fantástica, texturas orgánicas y claroscuro ámbar' },
] as const;

export const FILM_GENRES = [
	'Sci-Fi Futurista & Cyberpunk',
	'Drama Psicológico / Thriller',
	'Fantasía Épica & Mística',
	'Cine Negro / Neo-Noir',
	'Biopic & Documental de Artista',
	'Acción Cinemática & Suspense',
	'Surrealismo Poético & Onírico',
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
	// New advanced options
	lipSync?: boolean;
	lipSyncMode?: 'phoneme' | 'expressive' | 'natural';
	sfxEnabled?: boolean;
	sfxPreset?: string | null;
	sfxAudioName?: string | null;
	sfxMixLevel?: number;
	actorFraming?: 'close-up' | 'medium' | 'wide';
	actorExpression?: string;
	actorConsistency?: boolean;
	// Film / Narrative cinema parameters
	filmGenre?: string;
	auteurDirector?: string;
	cinematicRatio?: '16:9' | '9:16' | '21:9' | '4:3';
	scriptScene?: string;
}

export function buildMusicVideoPrompt(input: MusicVideoPromptInput): string {
	const lyrics = String(input.lyrics || '')
		.replace(/\[[^\]]+\]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 160);
	const vibes = input.vibeTags.filter(Boolean).slice(0, 4).join(', ');
	const camera = input.cameraMotion || 'Zoom in y barrido dinámico';

	const framingDesc =
		input.actorFraming === 'close-up'
			? 'Close-up facial & mouth shot'
			: input.actorFraming === 'wide'
			? 'Epic wide stage shot'
			: 'Dynamic medium shot';

	const lipSyncDirective =
		input.lipSync && (input.videoType === 'music-video' || input.videoType === 'short-film')
			? `Lip-sync to vocals (${input.lipSyncMode || 'phoneme'})`
			: '';

	const sfxDirective =
		input.sfxEnabled && input.sfxPreset && input.sfxPreset !== 'sfx-none'
			? `SFX: ${input.sfxPreset}`
			: input.sfxAudioName
			? `SFX track: ${input.sfxAudioName}`
			: '';

	const actorDirective =
		input.character && input.character !== 'Sin personaje (Atmósfera & Entorno)'
			? `Artist: ${input.character}${input.actorConsistency ? ' (consistent likeness)' : ''}${input.actorExpression ? `, ${input.actorExpression}` : ''}`
			: 'Focus on hyper-detailed environment & lighting';

	let productionHead = '';
	if (input.videoType === 'short-film') {
		productionHead = `Short film scene "${input.title.slice(0, 50)}"${input.filmGenre ? ` (${input.filmGenre})` : ''}, anamorphic cinema lens`;
	} else if (input.videoType === 'film-trailer') {
		productionHead = `Movie trailer for "${input.title.slice(0, 50)}"${input.filmGenre ? ` (${input.filmGenre})` : ''}, high-stakes cuts`;
	} else if (input.videoType === 'art-visualizer') {
		productionHead = `Fine-art music visualizer for "${input.title.slice(0, 50)}"`;
	} else if (input.videoType === 'lyrics-video') {
		productionHead = `Kinetic typography lyrics video for "${input.title.slice(0, 50)}"`;
	} else {
		productionHead = `Official music video for "${input.title.slice(0, 50)}"`;
	}

	const auteurDirective =
		input.auteurDirector && input.auteurDirector !== 'auteur-none' && !input.auteurDirector.startsWith('Estilo Director')
			? `Style of ${input.auteurDirector}`
			: '';

	const ratioDirective = input.cinematicRatio === '21:9' ? '2.39:1 CinemaScope' : '';

	const coreParts = [
		productionHead,
		ratioDirective,
		auteurDirective,
		framingDesc,
		lipSyncDirective,
		actorDirective,
		input.scriptScene ? `Scene: ${input.scriptScene.slice(0, 180)}` : '',
		input.is30sViralHook ? '30s viral hook clip, instant explosive opening' : '',
		input.videoGenMode === 'storyboard'
			? 'Multi-shot storyboard flow'
			: input.videoGenMode === 'narrative-scene'
			? 'Continuous narrative scene'
			: '',
		input.style ? `${input.style} aesthetic` : '',
		`Camera: ${camera}`,
		input.background ? `Setting: ${input.background}` : '',
		vibes ? `Vibe: ${vibes}` : '',
		sfxDirective,
		input.extraPrompt?.trim() ? input.extraPrompt.trim().slice(0, 220) : '',
		lyrics
			? input.videoType === 'lyrics-video'
				? `Lyrics: ${lyrics}`
				: `Story from lyrics: ${lyrics}`
			: '',
		'photorealistic 8k cinematography, volumetric lighting, color graded, no watermark',
	].filter(Boolean);

	const joined = coreParts.join('. ');
	return joined.length <= 950 ? joined : joined.slice(0, 947).trimEnd() + '...';
}

