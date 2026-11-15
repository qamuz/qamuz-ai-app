import { CHARACTERS } from '@/lib/characters';
import { type StudioSong } from '@/lib/studio';

export interface StoryboardScene {
	id: string;
	sceneNumber: number;
	title: string;
	shotType: 'Primer Plano' | 'Plano Medio' | 'Plano General' | 'Cenital' | 'Travelling Dinámico';
	duration: number; // in seconds
	startTime: number;
	endTime: number;
	visualPrompt: string;
	scriptDialogue?: string;
	imageUrl: string;
	actorName?: string;
	cameraMotion: string;
	transition: 'corte' | 'disolvencia' | 'fade-to-black' | 'zoom-glitch';
}

export interface TimelineClip {
	id: string;
	trackId: string;
	title: string;
	startTime: number; // in seconds
	duration: number; // in seconds
	sourceUrl: string;
	type: 'image' | 'video' | 'audio';
	color?: string;
}

export interface TimelineTrack {
	id: string;
	name: string;
	type: 'video' | 'audio';
	channelLabel: string;
	clips: TimelineClip[];
	muted: boolean;
	volume: number; // 0 to 1
}

export interface ColorGradeFilter {
	id: string;
	name: string;
	cssFilter: string;
	overlayClass?: string;
	desc: string;
}

export const COLOR_GRADE_PRESETS: ColorGradeFilter[] = [
	{
		id: 'none',
		name: 'Original / Natural',
		cssFilter: 'none',
		desc: 'Sin corrección de color adicional',
	},
	{
		id: 'teal-orange',
		name: 'Teal & Orange Hollywood',
		cssFilter: 'contrast(1.15) saturate(1.25) sepia(0.2) hue-rotate(-15deg)',
		desc: 'Estilo cinematográfico blockbuster de alto impacto',
	},
	{
		id: 'cyberpunk-neon',
		name: 'Cyberpunk Violet & Neón',
		cssFilter: 'contrast(1.2) saturate(1.4) hue-rotate(270deg)',
		desc: 'Colores púrpuras, azules y reflejos saturados',
	},
	{
		id: 'vintage-35mm',
		name: 'Vintage 35mm Film',
		cssFilter: 'sepia(0.25) contrast(1.1) brightness(0.95) saturate(0.85)',
		desc: 'Textura nostálgica y cálida de celuloide analógico',
	},
	{
		id: 'noir-bw',
		name: 'CinemaScope Noir B&W',
		cssFilter: 'grayscale(1) contrast(1.35) brightness(0.9)',
		desc: 'Blanco y negro dramático con sombras profundas',
	},
	{
		id: 'golden-hour',
		name: 'Golden Hour Cálido',
		cssFilter: 'sepia(0.35) saturate(1.3) brightness(1.05) contrast(1.05)',
		desc: 'Tonos dorados y luz de atardecer envolvente',
	},
];

/**
 * Intelligent AI Director Script & Storyboard Generator
 * Analyzes the song parameters, genre and lyrics to create a coherent multi-scene narrative.
 */
export function generateScriptAndStoryboard({
	song,
	style,
	category,
	director,
	characterName,
	totalDurationSeconds = 60,
}: {
	song: StudioSong;
	style: string;
	category: 'artistic' | 'cinema';
	director?: string;
	characterName?: string;
	totalDurationSeconds?: number;
}): StoryboardScene[] {
	const dur = Math.max(25, Math.min(totalDurationSeconds, 180));
	const isCinema = category === 'cinema';

	// Extract clean lyrics lines
	const rawLyrics = song.lyrics || '';
	const lyricLines = rawLyrics
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('[') && !l.endsWith(']'));

	const sceneCount = dur <= 45 ? 4 : dur <= 90 ? 5 : 6;
	const sceneDuration = Math.round(dur / sceneCount);

	const actor = characterName || CHARACTERS[0]?.name || 'Mateo';

	const scenesBlueprint = isCinema
		? [
				{
					title: 'Acto I: Prólogo & Atmósfera Inicial',
					shotType: 'Plano General' as const,
					camera: 'Travelling lento de aproximación',
					script: 'La cámara se desliza entre la niebla. El protagonista contempla la inmensidad de la ciudad silenciosa.',
					prompt: `Opening wide cinema master shot of ${actor} standing on the edge of a rainy neon metropolis, inspired by ${director || 'Denis Villeneuve'}, cinematic anamorphic lens, volumetric haze, atmospheric color grading`,
				},
				{
					title: 'Acto II: El Encuentro & Tensión Creciente',
					shotType: 'Plano Medio' as const,
					camera: 'Cámara en mano con pulso tenso',
					script: 'Miradas encontradas en la penumbra. Una revelación crucial que altera el curso del destino.',
					prompt: `Dramatic medium performance shot of ${actor} turning under flickering streetlights, intense emotional expression, deep shadows, 35mm film grain, 8k cinematic resolution`,
				},
				{
					title: 'Acto III: El Clímax Dramático',
					shotType: 'Primer Plano' as const,
					camera: 'Zoom in dinámico al rostro',
					script: 'El punto de quiebre de la historia: la verdad sale a la luz y la música alcanza su clímax orquestal.',
					prompt: `Tight cinematic close-up of ${actor}'s eyes reflecting golden and cyan light, tear on cheek, passionate vocal articulation, award-winning cinematography`,
				},
				{
					title: 'Acto IV: Desenlace & Horizonte Abierto',
					shotType: 'Cenital' as const,
					camera: 'Grúa ascendente hacia el cielo',
					script: 'La tormenta amaina. La silueta solitaria se funde en el horizonte mientras los ecos de la música se apagan.',
					prompt: `Epic aerial crane shot ascending above skyscraper rooftops into twilight clouds, lone silhouette walking away, CinemaScope 2.39:1 aspect ratio, breathtaking beauty`,
				},
		  ]
		: [
				{
					title: 'Escena 1: Intro & Puesta en Escena',
					shotType: 'Plano General' as const,
					camera: 'Barrido panorámico de luces',
					script: lyricLines[0] ? `“${lyricLines[0]}”` : 'Apertura con atmósfera visual hipnótica y juego de luces.',
					prompt: `Official music video opening, ${actor} on illuminated modern stage with laser beams, vibrant smoke, ${style} aesthetic, high-fashion styling`,
				},
				{
					title: 'Escena 2: Primer Verso & Groove Rítmico',
					shotType: 'Plano Medio' as const,
					camera: 'Orbit alrededor del cantante',
					script: lyricLines[1] ? `“${lyricLines[1]}”` : 'El cantante inicia el verso con actitud carismática y gestos sincronizados.',
					prompt: `Medium shot of singer ${actor} performing with rhythmic flow, stylish outfit, neon backlighting, smooth steadycam orbit`,
				},
				{
					title: 'Escena 3: Coro & Explosión Visual',
					shotType: 'Primer Plano' as const,
					camera: 'Zoom in y cortes rápidos al compás',
					script: lyricLines[2] ? `“${lyricLines[2]}”` : 'Coro épico: sincronización labial intensa y pirotecnia de luces.',
					prompt: `Vibrant close-up of ${actor} singing the chorus with passionate lip-sync expression, dynamic lighting flashes, sharp focus, 8k resolution`,
				},
				{
					title: 'Escena 4: Clímax & Baile / Performance',
					shotType: 'Travelling Dinámico' as const,
					camera: 'Travelling frontal enérgico',
					script: lyricLines[3] ? `“${lyricLines[3]}”` : 'Máxima energía de la pista con tomas coreografiadas y reflejos.',
					prompt: `Energetic full performance wide shot, dancing silhouette against illuminated LED wall, volumetric rays, concert stadium energy`,
				},
				{
					title: 'Escena 5: Outro & Cierre Poético',
					shotType: 'Plano Medio' as const,
					camera: 'Desaceleración suave y fade out',
					script: lyricLines[4] ? `“${lyricLines[4]}”` : 'Últimas notas vocales, mirada a cámara y desvanecimiento lumínico.',
					prompt: `Poetic ending shot of ${actor} looking directly into the camera lens with subtle enigmatic smile, glowing neon reflections, fade to black aesthetic`,
				},
		  ];

	let currentTime = 0;
	return scenesBlueprint.map((sc, i) => {
		const start = currentTime;
		const end = Math.min(dur, start + sceneDuration);
		currentTime = end;

		const transition: StoryboardScene['transition'] =
			i === 0 ? 'corte' : i % 2 === 0 ? 'disolvencia' : 'corte';

		return {
			id: `scene-${i + 1}-${Date.now()}`,
			sceneNumber: i + 1,
			title: sc.title,
			shotType: sc.shotType,
			duration: end - start,
			startTime: start,
			endTime: end,
			visualPrompt: sc.prompt,
			scriptDialogue: sc.script,
			imageUrl: i === 0 && song.coverUrl ? song.coverUrl : '',
			actorName: actor,
			cameraMotion: sc.camera,
			transition,
		};
	});
}

/**
 * Builds initial multitrack timeline tracks from song and storyboard scenes
 */
export function buildTimelineTracks(song: StudioSong, scenes: StoryboardScene[]): TimelineTrack[] {
	const mainVideoClips: TimelineClip[] = scenes.map((s) => ({
		id: `clip-${s.id}`,
		trackId: 'track-v1',
		title: s.title,
		startTime: s.startTime,
		duration: s.duration,
		sourceUrl: s.imageUrl,
		type: 'image',
		color: 'from-cyan-600 to-blue-700',
	}));

	const musicClip: TimelineClip = {
		id: `audio-main-${song.key}`,
		trackId: 'track-a1',
		title: `🎵 ${song.title} (Canción Principal)`,
		startTime: 0,
		duration: song.duration || 60,
		sourceUrl: song.audioUrl,
		type: 'audio',
		color: 'from-primary/80 to-lime-600',
	};

	const sfxClip: TimelineClip = {
		id: `sfx-drop-${Date.now()}`,
		trackId: 'track-a2',
		title: '⚡ SFX Riser & Sub-Bass Clímax',
		startTime: scenes[1]?.startTime || 15,
		duration: 8,
		sourceUrl: '',
		type: 'audio',
		color: 'from-amber-500 to-orange-600',
	};

	return [
		{
			id: 'track-v1',
			name: 'Pista de Video V1 (Escenas & Storyboard)',
			type: 'video',
			channelLabel: 'V1',
			clips: mainVideoClips,
			muted: false,
			volume: 1,
		},
		{
			id: 'track-v2',
			name: 'Superposición V2 (B-Roll & Overlays)',
			type: 'video',
			channelLabel: 'V2',
			clips: [],
			muted: false,
			volume: 1,
		},
		{
			id: 'track-a1',
			name: 'Audio A1 (Música Principal)',
			type: 'audio',
			channelLabel: 'A1',
			clips: [musicClip],
			muted: false,
			volume: 1,
		},
		{
			id: 'track-a2',
			name: 'Efectos A2 (SFX & Foley)',
			type: 'audio',
			channelLabel: 'A2',
			clips: [sfxClip],
			muted: false,
			volume: 0.7,
		},
		{
			id: 'track-a3',
			name: 'Canal A3 (Voz / Diálogo / Ambiente)',
			type: 'audio',
			channelLabel: 'A3',
			clips: [],
			muted: false,
			volume: 0.8,
		},
	];
}
