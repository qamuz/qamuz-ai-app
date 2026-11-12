export interface ArtistSummary {
	id: string;
	slug: string;
	name: string;
}

export interface Artist extends ArtistSummary {
	bio: string | null;
	avatar_key: string | null;
	banner_key: string | null;
	monthly_listeners: number;
	social_links?: Record<string, string> | null;
}

export interface TrackWithArtist {
	id: string;
	title: string;
	audio_url: string;
	cover_key: string | null;
	duration_seconds: number;
	genre: string | null;
	plays: number;
	album_id: string | null;
	artist: ArtistSummary | null;
	is_published?: boolean;
	likes_count?: number;
	comments_count?: number;
	shares_count?: number;
	canvas_url?: string | null;
	short_start_seconds?: number;
	lyrics?: string | null;
}

export interface Playlist {
	id: string;
	title: string;
	description: string | null;
	cover_key: string | null;
	is_public: boolean;
	is_featured: boolean;
	user_id: string | null;
}

export interface Album {
	id: string;
	title: string;
	cover_key: string | null;
	release_date: string | null;
}

export interface LyricLine {
	id: string;
	time_ms: number;
	text: string;
}
