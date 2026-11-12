-- ===== Modules (feature toggles) =====
CREATE TABLE public.app_modules (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules public read" ON public.app_modules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins update modules" ON public.app_modules FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
INSERT INTO public.app_modules (key, name, description, sort) VALUES
 ('player','Reproductor','Reproductor fijo, cola y Now Playing',1),
 ('lyrics','Letras sincronizadas','Letras con marcas de tiempo en Now Playing',2),
 ('studio','Estudio de IA','Creación de música, video e imágenes con IA',3),
 ('artists','Perfiles de artista','Perfiles públicos y panel del artista',4),
 ('payments','Planes y pagos','Página de planes y suscripciones',5);

-- ===== AI providers (no secrets stored here) =====
CREATE TABLE public.ai_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('music','video','image')),
  secret_name TEXT,
  model TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  credit_cost INTEGER NOT NULL DEFAULT 1 CHECK (credit_cost >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers read" ON public.ai_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins insert providers" ON public.ai_providers FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins update providers" ON public.ai_providers FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins delete providers" ON public.ai_providers FOR DELETE TO authenticated USING (public.has_role('admin'));
INSERT INTO public.ai_providers (slug, name, kind, secret_name, model, is_active, is_default, credit_cost, notes) VALUES
 ('kie-suno','Kie · Suno','music','KIE_API_KEY','V4_5',true,true,10,'Canciones completas con voz o instrumentales'),
 ('openai-image','OpenAI Imágenes','image','OPENAI_API_KEY','gpt-image-1',true,true,3,'Portadas, arte y banners'),
 ('video-pendiente','Proveedor de video','video',NULL,NULL,false,false,20,'Pendiente de elegir proveedor');

-- ===== Plans =====
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort INTEGER NOT NULL DEFAULT 0,
  stripe_price_monthly TEXT,
  stripe_price_yearly TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active plans anon read" ON public.plans FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "plans auth read" ON public.plans FOR SELECT TO authenticated USING (is_active = true OR public.has_role('admin'));
CREATE POLICY "admins insert plans" ON public.plans FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins update plans" ON public.plans FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins delete plans" ON public.plans FOR DELETE TO authenticated USING (public.has_role('admin'));
INSERT INTO public.plans (slug, name, description, price_monthly, price_yearly, monthly_credits, features, is_highlighted, sort) VALUES
 ('gratis','Gratis','Para escuchar y probar el estudio',0,0,30,ARRAY['Música ilimitada con anuncios','Letras sincronizadas','30 créditos de IA al mes'],false,1),
 ('pro','Pro','Para oyentes y creadores ocasionales',9.99,99.90,300,ARRAY['Sin anuncios','Calidad de audio alta','300 créditos de IA al mes','Descargas de tus creaciones'],true,2),
 ('artista','Artista','Para publicar y crecer tu audiencia',19.99,199.90,1000,ARRAY['Todo lo de Pro','Perfil de artista verificado','Estadísticas avanzadas','1.000 créditos de IA al mes'],false,3),
 ('empresa','Empresa','Para sellos y equipos',79.00,790.00,5000,ARRAY['Todo lo de Artista','Varios artistas por cuenta','Soporte prioritario','5.000 créditos de IA al mes'],false,4);

-- ===== Subscriptions =====
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','canceled')),
  billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','yearly')),
  current_period_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE POLICY "read own subscription" ON public.subscriptions FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id OR public.has_role('admin'));
CREATE POLICY "admins insert subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins update subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins delete subscriptions" ON public.subscriptions FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ===== Credits =====
CREATE TABLE public.credit_balances (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own credits" ON public.credit_balances FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id OR public.has_role('admin'));
CREATE POLICY "admins update credits" ON public.credit_balances FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  creation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);
CREATE POLICY "read own credit tx" ON public.credit_transactions FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id OR public.has_role('admin'));

-- ===== AI creations (writes happen server-side) =====
CREATE TABLE public.ai_creations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('music','video','image')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','generating','ready','error')),
  provider_slug TEXT,
  external_task_id TEXT,
  title TEXT,
  result_urls TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  error_message TEXT,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  published_track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_creations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ai_creations_user ON public.ai_creations(user_id, created_at DESC);
CREATE INDEX idx_ai_creations_track ON public.ai_creations(published_track_id);
CREATE POLICY "read own creations" ON public.ai_creations FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id OR public.has_role('admin'));
CREATE POLICY "delete own creations" ON public.ai_creations FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id OR public.has_role('admin'));
CREATE POLICY "link own creation to track" ON public.ai_creations FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
-- Only published_track_id may be changed by the owner
REVOKE UPDATE ON public.ai_creations FROM authenticated;
GRANT UPDATE (published_track_id) ON public.ai_creations TO authenticated;

-- ===== Admin visibility & moderation on existing tables =====
CREATE POLICY "admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admins update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins read history" ON public.play_history FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admins read all tracks" ON public.tracks FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admins update tracks" ON public.tracks FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins delete tracks" ON public.tracks FOR DELETE TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admins update artists" ON public.artists FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admins delete artists" ON public.artists FOR DELETE TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admins read follows" ON public.follows FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admins read playlists" ON public.playlists FOR SELECT TO authenticated USING (public.has_role('admin'));

-- Artist owners can read their followers count rows
CREATE POLICY "artist owner reads follows" ON public.follows FOR SELECT TO authenticated USING (public.is_artist_owner(artist_id));

-- Artist socials
ALTER TABLE public.artists ADD COLUMN social_links JSONB NOT NULL DEFAULT '{}';

-- ===== Signup: profile, role (first user = admin), free plan, credits =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _free_plan UUID;
  _role TEXT := 'listener';
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    _role := 'admin';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  SELECT id INTO _free_plan FROM public.plans WHERE slug = 'gratis' LIMIT 1;
  IF _free_plan IS NOT NULL THEN
    INSERT INTO public.subscriptions (user_id, plan_id, status, billing_period) VALUES (NEW.id, _free_plan, 'active', 'monthly');
  END IF;
  INSERT INTO public.credit_balances (user_id, balance) VALUES (NEW.id, 30);
  RETURN NEW;
END;
$$;

-- ===== Storage for uploads and AI results =====
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);
CREATE POLICY "media public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'media');
CREATE POLICY "media upload own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "media update own folder" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text) WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "media delete own folder" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
