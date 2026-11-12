-- Stem jobs can now come from an AI creation (song or video soundtrack) or from an artist track
ALTER TABLE public.ai_stems ALTER COLUMN creation_id DROP NOT NULL;
ALTER TABLE public.ai_stems ADD CONSTRAINT ai_stems_has_source CHECK (creation_id IS NOT NULL OR track_id IS NOT NULL);