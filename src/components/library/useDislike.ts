import { useEffect, useState } from 'react';
import { toggleDraftDislike, type Creation, type StudioSong } from '@/lib/studio';

/** Private "dislike" flag for one of the user's own songs (only visible in their Library). */
export function useDislike(song: StudioSong, creation: Creation | undefined, liked: boolean, unlike: () => void, onChanged: () => void) {
	const [disliked, setDisliked] = useState(Boolean(song.disliked));
	useEffect(() => setDisliked(Boolean(song.disliked)), [song.disliked]);
	const canDislike = song.origin === 'ai' && Boolean(creation);

	async function toggle() {
		if (!creation) return;
		const next = !disliked;
		setDisliked(next);
		if (next && liked) unlike();
		const err = await toggleDraftDislike(creation, song.index);
		if (err) setDisliked(!next);
		else onChanged();
	}

	return { disliked, canDislike, toggle };
}
