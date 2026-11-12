-- 1) Plan gating by plan.slug: empty list = every plan. Free plan keeps lyrics, synced lyrics, WAV and cover art.
ALTER TABLE public.kie_service_prices ADD COLUMN IF NOT EXISTS allowed_plans TEXT[] NOT NULL DEFAULT '{}';
UPDATE public.kie_service_prices
  SET allowed_plans = ARRAY['pro','artista','empresa'], updated_at = now()
  WHERE service IN ('extend','cover','upload_extend','add_vocals','add_instrumental','replace_section','video','persona','stems_advanced');

-- 2) Internal alert state (e.g. low Kie balance) so admins are not spammed. Service role only.
CREATE TABLE IF NOT EXISTS public.internal_alerts (
  name TEXT PRIMARY KEY,
  last_value NUMERIC,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.internal_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.internal_alerts FROM anon, authenticated;

-- 3) Fast per-user counting for the request limits.
CREATE INDEX IF NOT EXISTS idx_kie_tasks_user_created ON public.kie_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_stems_user_created ON public.ai_stems(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_creations_user_created ON public.ai_creations(user_id, created_at DESC);