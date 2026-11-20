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

const CAMERA_MOTION_TO_CINEMA: Record<string, string> = {
	'Zoom in y barrido dinámico': 'slow stabilized dolly-in on a gimbal with gentle horizontal drift',
	'Drone sweep panorámico': 'smooth continuous aerial crane glide moving steadily forward',
	'Slow orbit alrededor del artista': 'steady slow 15-degree Steadicam arc around the subject keeping eyes in crisp focus',
	'Handheld shake estilo cámara en mano': 'subtle grounded handheld documentary breathing with stabilized horizon',
	'Fast tracking rítmico': 'fluid forward tracking shot on a Steadicam rig matching natural walking pace',
	'Tomas cenitales y contrapicados': 'slow majestic low-angle pedestal rise revealing natural architectural depth',
};

const EXPRESSION_TO_CINEMA: Record<string, string> = {
	'Pasional e Intenso (Clímax vocal y dramatismo)': 'deeply focused emotional expression, natural micro-expressions, genuine intensity',
	'Sonriente y Enérgico (Vibra festiva y dance)': 'warm genuine smile, relaxed natural energy, charismatic presence',
	'Desafiante y Urbano (Actitud Trap / Hip-Hop)': 'confident composed gaze, subtle head movement, grounded street charisma',
	'Melancólico y Enigmático (Balada / R&B íntimo)': 'quiet introspective gaze, soft vulnerability, subtle natural blinking',
	'Futurista y Sereno (Cyberpunk / Synthwave)': 'calm composed expression illuminated by soft ambient reflections',
};

const BACKGROUND_TO_CINEMA: Record<string, string> = {
	'Office Neon': 'modern glass high-rise studio at dusk with soft warm tungsten practical lamps and distant city bokeh',
	'Pink Garden': 'real twilight botanical courtyard with natural foliage, gentle breeze moving leaves, and golden-pink sunset sky',
	'Cyber Grid': 'sleek rain-slicked nocturnal urban avenue with realistic wet asphalt reflections and soft architectural rim lights',
	'Concert Stage': 'authentic live concert stage with subtle atmospheric haze, warm tungsten backlight, and realistic depth of field',
	'Studio Lights': 'professional cinema soundstage with soft diffused key light, practical Edison bulbs, and natural filmic shadows',
};

/**
 * Calibrates SVD motion_bucket_id (42..84) for realistic, rock-steady live-action motion
 * without morphing, melting faces, or sudden frame jumps.
 */
export function deriveRecommendedMotion(cameraMotion?: string, framing?: 'close-up' | 'medium' | 'wide'): number {
	const raw = String(cameraMotion || '').toLowerCase();
	let base = 60;
	if (/close|íntim|primer plano|slow|orbit|suave|lento|static|estátic/.test(raw)) {
		base = 48;
	} else if (/drone|aerial|tracking|travelling|fast|rápid|dinámic/.test(raw)) {
		base = 74;
	} else if (/handheld|mano/.test(raw)) {
		base = 58;
	}
	if (framing === 'close-up') base = Math.min(base, 50);
	if (framing === 'wide') base = Math.min(82, base + 8);
	return Math.max(40, Math.min(84, base));
}

export function buildMusicVideoPrompt(input: MusicVideoPromptInput): string {
	const cleanExtra = String(input.extraPrompt || '').trim().slice(0, 320);
	const cleanScript = String(input.scriptScene || '').trim().slice(0, 220);
	const cameraCinema =
		CAMERA_MOTION_TO_CINEMA[input.cameraMotion || ''] ||
		(input.cameraMotion && !/[áéíóúñ]/i.test(input.cameraMotion)
			? input.cameraMotion
			: 'smooth stabilized Steadicam slow push-in');

	const framingDesc =
		input.actorFraming === 'close-up'
			? 'Intimate live-action close-up portrait framed on 85mm cinema prime lens, shallow depth of field'
			: input.actorFraming === 'wide'
			? 'Cinematic live-action wide establishing shot framed on 28mm anamorphic cinema lens, deep realistic environment'
			: 'Cinematic live-action medium shot framed on 50mm cinema prime lens, natural depth of field';

	const expressionDesc =
		EXPRESSION_TO_CINEMA[input.actorExpression || ''] ||
		'authentic understated human expression';

	const settingDesc =
		BACKGROUND_TO_CINEMA[input.background || ''] ||
		(input.background ? `realistic physical location: ${input.background}` : 'authentic real-world cinematic environment');

	const hasActor =
		Boolean(input.character) && input.character !== 'Sin personaje (Atmósfera & Entorno)';

	const actorDirective = hasActor
		? `Real human performer (${input.character}) with natural skin texture, realistic hair and wardrobe fabric folds, ${expressionDesc}${
				input.lipSync && (input.videoType === 'music-video' || input.videoType === 'short-film')
					? ', natural subtle vocal singing articulation and relaxed shoulders'
					: ', grounded natural posture and breathing'
		  }`
		: 'Pure atmospheric live-action environment with subtle natural motion in light, air, and reflections';

	const auteurDirective =
		input.auteurDirector &&
		input.auteurDirector !== 'auteur-none' &&
		!input.auteurDirector.startsWith('Estilo Director')
			? `cinematography inspired by ${input.auteurDirector}`
			: '';

	const moodTags = input.vibeTags
		.filter((v) => v && !/viral|30s|hard beat/i.test(v))
		.slice(0, 3)
		.join(', ');

	const coreParts = [
		'Single continuous unbroken live-action cinema take, shot on ARRI Alexa Mini LF 35mm film',
		framingDesc,
		cleanExtra || cleanScript || '',
		cleanExtra && cleanScript ? cleanScript : '',
		actorDirective,
		`Setting: ${settingDesc}`,
		`Camera movement: ${cameraCinema}`,
		input.style ? `${input.style} film color grade` : 'natural filmic color grade',
		auteurDirective,
		moodTags ? `Atmosphere: ${moodTags}` : '',
		'motivated practical lighting, natural film grain, physically consistent motion, steady temporal continuity, no jump cuts, no flicker, no morphing, no text or watermarks',
	].filter(Boolean);

	const joined = coreParts.join('. ');
	return joined.length <= 950 ? joined : joined.slice(0, 947).trimEnd() + '...';
}

