-- New togglable modules
INSERT INTO public.app_modules (key, name, description, sort) VALUES
 ('mastering','Mastering','Master songs with presets, before/after preview and WAV export',7),
 ('stems','Stem separation','Split AI songs into vocals, drums, bass and instruments',8),
 ('videos','Music videos','Public gallery of music videos published from the AI Studio',9)
ON CONFLICT (key) DO NOTHING;

-- ===== Stem separation jobs (written server-side only) =====
CREATE TABLE public.ai_stems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creation_id UUID NOT NULL REFERENCES public.ai_creations(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL DEFAULT 0,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('separate_vocal','split_stem')),
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating','ready','error')),
  external_task_id TEXT,
  stems JSONB NOT NULL DEFAULT '{}',
  credits_spent INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_stems ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ai_stems_user ON public.ai_stems(user_id, created_at DESC);
CREATE INDEX idx_ai_stems_creation ON public.ai_stems(creation_id);
CREATE INDEX idx_ai_stems_track ON public.ai_stems(track_id);
CREATE POLICY "read own stems" ON public.ai_stems FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "delete own stems" ON public.ai_stems FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE INSERT, UPDATE ON public.ai_stems FROM authenticated, anon;

-- ===== Public music video gallery =====
CREATE TABLE public.music_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creation_id UUID NOT NULL UNIQUE REFERENCES public.ai_creations(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  video_url TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.music_videos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_music_videos_user ON public.music_videos(user_id);
CREATE INDEX idx_music_videos_artist ON public.music_videos(artist_id);
CREATE INDEX idx_music_videos_created ON public.music_videos(created_at DESC);
-- Published videos are public content
CREATE POLICY "music videos public read" ON public.music_videos FOR SELECT TO anon, authenticated USING (true);
-- Owners can only publish their own ready video creations, with the exact video and soundtrack produced
CREATE POLICY "publish own video" ON public.music_videos FOR INSERT TO authenticated WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (artist_id IS NULL OR public.is_artist_owner(artist_id))
  AND EXISTS (
    SELECT 1 FROM public.ai_creations c
    WHERE c.id = creation_id
      AND c.user_id = (SELECT auth.uid())
      AND c.kind = 'video'
      AND c.status = 'ready'
      AND video_url = ANY (c.result_urls)
      AND audio_url = c.options->'source'->>'audio_url'
  )
);
CREATE POLICY "unpublish own video" ON public.music_videos FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id OR public.has_role('admin'));
REVOKE UPDATE ON public.music_videos FROM authenticated, anon;
REVOKE INSERT, DELETE ON public.music_videos FROM anon;