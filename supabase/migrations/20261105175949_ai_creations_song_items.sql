ALTER TABLE public.ai_creations ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
GRANT UPDATE (items) ON public.ai_creations TO authenticated;