-- Prices of Kie Suno services for Qamuz users (rule: 2x Kie cost, rounded up, minimum 1 credit).
CREATE TABLE public.kie_service_prices (
  service TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kie_credits NUMERIC(10,2) NOT NULL DEFAULT 0,
  user_credits INTEGER NOT NULL CHECK (user_credits >= 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kie_service_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read prices" ON public.kie_service_prices FOR SELECT TO authenticated USING (true);
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.kie_service_prices FROM anon, authenticated;

INSERT INTO public.kie_service_prices (service, label, kie_credits, user_credits) VALUES
  ('extend', 'Extend song', 12, 24),
  ('cover', 'Cover / re-version', 12, 24),
  ('upload_extend', 'Upload and extend', 12, 24),
  ('add_vocals', 'Add vocals', 12, 24),
  ('add_instrumental', 'Add instrumental', 12, 24),
  ('replace_section', 'Replace section', 5, 10),
  ('wav', 'WAV download', 0.4, 1),
  ('video', 'Music video MP4', 2, 4),
  ('lyrics', 'Generate lyrics', 0.4, 1),
  ('timestamped_lyrics', 'Synced lyrics', 0.5, 1),
  ('persona', 'Create persona', 0, 1),
  ('cover_image', 'AI cover art', 0, 1),
  ('stems_vocal', 'Vocals + instrumental', 10, 20),
  ('stems_full', 'Full stems', 50, 100),
  ('stems_advanced', 'Single instrument stem', 20, 40);

-- Results of Kie services that do not produce a new song (WAV, video, lyrics, persona, cover art).
CREATE TABLE public.kie_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creation_id UUID REFERENCES public.ai_creations(id) ON DELETE SET NULL,
  item_index INTEGER NOT NULL DEFAULT 0,
  service TEXT NOT NULL REFERENCES public.kie_service_prices(service),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating','ready','error')),
  external_task_id TEXT,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kie_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own kie tasks" ON public.kie_tasks FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users delete own kie tasks" ON public.kie_tasks FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.kie_tasks FROM anon, authenticated;
CREATE INDEX kie_tasks_user_idx ON public.kie_tasks(user_id, created_at DESC);
CREATE INDEX kie_tasks_creation_idx ON public.kie_tasks(creation_id);
CREATE INDEX kie_tasks_external_idx ON public.kie_tasks(external_task_id);

-- Real Suno personas created by each user (the Kie persona id is only usable by our API key).
CREATE TABLE public.voice_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kie_persona_id TEXT NOT NULL,
  creation_id UUID REFERENCES public.ai_creations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.voice_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own personas" ON public.voice_personas FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users delete own personas" ON public.voice_personas FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.voice_personas FROM anon, authenticated;
CREATE INDEX voice_personas_user_idx ON public.voice_personas(user_id);
CREATE INDEX voice_personas_creation_idx ON public.voice_personas(creation_id);

-- Single-instrument stems.
ALTER TABLE public.ai_stems ADD COLUMN IF NOT EXISTS stem_name TEXT;
ALTER TABLE public.ai_stems DROP CONSTRAINT IF EXISTS ai_stems_mode_check;
ALTER TABLE public.ai_stems ADD CONSTRAINT ai_stems_mode_check CHECK (mode IN ('separate_vocal','split_stem','split_stem_advanced'));

-- Fast lookups when a signed Kie callback arrives.
CREATE INDEX IF NOT EXISTS ai_creations_external_task_idx ON public.ai_creations(external_task_id);
CREATE INDEX IF NOT EXISTS ai_stems_external_task_idx ON public.ai_stems(external_task_id);