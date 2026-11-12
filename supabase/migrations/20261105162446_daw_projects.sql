-- Studio DAW projects: private to each user
CREATE TABLE public.daw_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled project' CHECK (char_length(name) BETWEEN 1 AND 120),
  bpm INTEGER NOT NULL DEFAULT 120 CHECK (bpm BETWEEN 40 AND 240),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daw_projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_daw_projects_user ON public.daw_projects(user_id, updated_at DESC);

CREATE POLICY "daw select own" ON public.daw_projects FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "daw insert own" ON public.daw_projects FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "daw update own" ON public.daw_projects FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "daw delete own" ON public.daw_projects FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.touch_daw_project()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_touch_daw_project BEFORE UPDATE ON public.daw_projects FOR EACH ROW EXECUTE FUNCTION public.touch_daw_project();

-- Admin toggle for the Studio DAW module
INSERT INTO public.app_modules (key, name, description, sort)
VALUES ('daw', 'Studio (DAW)', 'Multitrack editor: import, record audio and MIDI instruments', 6)
ON CONFLICT (key) DO NOTHING;