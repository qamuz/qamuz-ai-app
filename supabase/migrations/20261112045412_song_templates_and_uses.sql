-- Public template data on published songs (prompt + style) and a counter of distinct users who used it.
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS prompt TEXT CHECK (prompt IS NULL OR char_length(prompt) <= 500),
  ADD COLUMN IF NOT EXISTS style TEXT CHECK (style IS NULL OR char_length(style) <= 200),
  ADD COLUMN IF NOT EXISTS template_uses INTEGER NOT NULL DEFAULT 0;

-- Backfill from the AI creations that produced each published song.
UPDATE public.tracks t
SET prompt = left(c.prompt, 500),
    style = left(coalesce(nullif(it->>'tags', ''), nullif(c.options->>'style', ''), t.genre), 200)
FROM public.ai_creations c, jsonb_array_elements(coalesce(c.items, '[]'::jsonb)) it
WHERE it->>'published_track_id' = t.id::text AND t.prompt IS NULL AND c.kind = 'music';

UPDATE public.tracks t
SET prompt = left(c.prompt, 500),
    style = left(coalesce(nullif(c.options->>'style', ''), t.genre), 200)
FROM public.ai_creations c
WHERE c.published_track_id = t.id AND t.prompt IS NULL AND c.kind = 'music';

CREATE INDEX IF NOT EXISTS idx_tracks_templates ON public.tracks(template_uses DESC, created_at DESC) WHERE is_published = true AND prompt IS NOT NULL;

-- One row per user per template. Written only by the server (no INSERT policy); users read their own.
CREATE TABLE IF NOT EXISTS public.template_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, track_id)
);
ALTER TABLE public.template_uses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_template_uses_track ON public.template_uses(track_id);
CREATE POLICY "read own template uses" ON public.template_uses FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.template_uses FROM anon, authenticated;
REVOKE ALL ON public.template_uses FROM anon;

-- Fast creator listing.
CREATE INDEX IF NOT EXISTS idx_tracks_artist_published ON public.tracks(artist_id) WHERE is_published = true;