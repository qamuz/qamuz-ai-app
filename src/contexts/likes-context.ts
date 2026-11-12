import { createContext } from 'react';

export interface LikesContextType {
	likedIds: Set<string>;
	isLiked: (trackId: string) => boolean;
	toggleLike: (trackId: string) => Promise<void>;
	/** Change in like count caused by this session's toggles (for live counters). */
	likeDelta: (trackId: string) => number;
}

export const LikesContext = createContext<LikesContextType | null>(null);
