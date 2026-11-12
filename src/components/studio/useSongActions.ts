import { useEffect, useState } from 'react';
import { useAccount } from '@/hooks/useAccount';
import { useAuth } from '@/hooks/useAuth';
import { useLikes } from '@/hooks/useLikes';
import { useI18n } from '@/hooks/useI18n';
import { copyText } from '@/lib/engagement';
import { deleteSong, publishSong, songToTrack, toggleDraftLike, type Creation, type StudioSong } from '@/lib/studio';
import type { TrackWithArtist } from '@/types/music';

/** Like / share / publish / delete for one Studio song (drafts and published songs). */
export function useSongActions(song: StudioSong, creation: Creation | undefined, onChanged: () => void) {
  const { artist } = useAccount();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useLikes();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{text: string;error?: boolean;} | null>(null);
  const [draftLiked, setDraftLiked] = useState(song.liked);
  const [publishedId, setPublishedId] = useState(song.publishedTrackId);

  useEffect(() => setDraftLiked(song.liked), [song.liked]);
  useEffect(() => setPublishedId(song.publishedTrackId), [song.publishedTrackId]);
  useEffect(() => setNote(null), [song.key]);

  const isAi = song.origin === 'ai' && Boolean(creation);
  const liked = publishedId ? isLiked(publishedId) : draftLiked;
  const canLike = Boolean(user && (publishedId || isAi));
  const canPublish = Boolean(artist && isAi && !publishedId);
  const canDelete = isAi && creation?.status === 'ready';
  const shareTrack: TrackWithArtist | null = publishedId ? { ...songToTrack(song, artist), id: publishedId } : null;

  async function like() {
    if (publishedId) {
      void toggleLike(publishedId);
      return;
    }
    if (!creation) return;
    setDraftLiked((v) => !v);
    const err = await toggleDraftLike(creation, song.index);
    if (err) setDraftLiked((v) => !v);else
    onChanged();
  }

  async function publish() {
    if (!artist || !creation) return;
    setBusy(true);
    const { trackId, error } = await publishSong(creation, song, artist.id);
    setBusy(false);
    if (error || !trackId) {
      setNote({ text: t('Could not publish'), error: true });
      return;
    }
    setPublishedId(trackId);
    setNote({ text: t('Published to your artist profile') });
    onChanged();
  }

  function copyLink() {
    copyText(song.audioUrl);
    setNote({ text: t('Link copied') });
  }

  async function remove(): Promise<boolean> {
    if (!creation || !user) return false;
    setBusy(true);
    const err = await deleteSong(creation, song.index, user.id);
    setBusy(false);
    if (err) {
      setNote({ text: t('Could not delete the creation'), error: true });
      return false;
    }
    return true;
  }

  return { busy, note, liked, canLike, canPublish, canDelete, publishedId, shareTrack, like, publish, copyLink, remove };
}