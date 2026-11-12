-- Lyrics text on tracks (used by Karaoke + lyrics fallback in the imported code)
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS lyrics TEXT;

-- Allow users to save their own trimmed clips into ai_creations
DROP POLICY IF EXISTS "insert own creations" ON public.ai_creations;
CREATE POLICY "insert own creations" ON public.ai_creations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT INSERT ON public.ai_creations TO authenticated;