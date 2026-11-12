-- Deleting a track must not be blocked by its stem jobs: drop the source check (the server always sets one)
ALTER TABLE public.ai_stems DROP CONSTRAINT IF EXISTS ai_stems_has_source;