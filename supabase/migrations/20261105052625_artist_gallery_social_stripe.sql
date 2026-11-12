-- ===== Galería del artista (videos e imágenes publicados desde el Estudio) =====
CREATE TABLE public.artist_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  creation_id UUID UNIQUE REFERENCES public.ai_creations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.artist_media ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_artist_media_artist ON public.artist_media(artist_id, created_at DESC);
CREATE POLICY "published media public read" ON public.artist_media FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "owner reads own media" ON public.artist_media FOR SELECT TO authenticated USING (public.is_artist_owner(artist_id));
CREATE POLICY "owner inserts media" ON public.artist_media FOR INSERT TO authenticated WITH CHECK (public.is_artist_owner(artist_id));
CREATE POLICY "owner updates media" ON public.artist_media FOR UPDATE TO authenticated USING (public.is_artist_owner(artist_id)) WITH CHECK (public.is_artist_owner(artist_id));
CREATE POLICY "owner deletes media" ON public.artist_media FOR DELETE TO authenticated USING (public.is_artist_owner(artist_id) OR public.has_role('admin'));

-- ===== Comentarios en canciones (públicos en canciones publicadas) =====
CREATE TABLE public.track_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.track_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_track_comments_track ON public.track_comments(track_id, created_at DESC);
CREATE INDEX idx_track_comments_user ON public.track_comments(user_id);
CREATE POLICY "comments public read" ON public.track_comments FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = track_id AND t.is_published = true));
CREATE POLICY "insert own comment" ON public.track_comments FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "delete own comment" ON public.track_comments FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id OR public.has_role('admin'));

-- El nombre visible se copia del perfil propio (los perfiles siguen siendo privados)
CREATE OR REPLACE FUNCTION public.set_comment_author()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  SELECT display_name INTO NEW.author_name FROM public.profiles WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_comment_author BEFORE INSERT ON public.track_comments FOR EACH ROW EXECUTE FUNCTION public.set_comment_author();

-- ===== Notificaciones =====
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('follow','comment','like','system')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_actor ON public.notifications(actor_id);
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
-- Las notificaciones las crean los triggers en nombre de quien actúa (nunca a sí mismo)
CREATE POLICY "actor creates notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = actor_id AND user_id <> (SELECT auth.uid()) AND type IN ('follow','comment','like'));
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_artist_owner()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _owner UUID;
  _artist_name TEXT;
  _slug TEXT;
  _track_title TEXT;
  _actor_name TEXT;
BEGIN
  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = (SELECT auth.uid());
  IF TG_TABLE_NAME = 'follows' THEN
    SELECT owner_id, name, slug INTO _owner, _artist_name, _slug FROM public.artists WHERE id = NEW.artist_id;
    IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, actor_name, type, title, link)
      VALUES (_owner, NEW.user_id, _actor_name, 'follow', COALESCE(_actor_name,'Alguien') || ' empezó a seguir a ' || _artist_name, '/artista/' || _slug);
    END IF;
  ELSE
    SELECT a.owner_id, a.slug, t.title INTO _owner, _slug, _track_title
      FROM public.tracks t JOIN public.artists a ON a.id = t.artist_id WHERE t.id = NEW.track_id;
    IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
      IF TG_TABLE_NAME = 'track_comments' THEN
        INSERT INTO public.notifications (user_id, actor_id, actor_name, type, title, body, link)
        VALUES (_owner, NEW.user_id, _actor_name, 'comment', COALESCE(_actor_name,'Alguien') || ' comentó en «' || _track_title || '»', left(NEW.body, 140), '/artista/' || _slug);
      ELSE
        INSERT INTO public.notifications (user_id, actor_id, actor_name, type, title, link)
        VALUES (_owner, NEW.user_id, _actor_name, 'like', 'A ' || COALESCE(_actor_name,'alguien') || ' le gusta «' || _track_title || '»', '/artista/' || _slug);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_artist_owner();
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.track_comments FOR EACH ROW EXECUTE FUNCTION public.notify_artist_owner();
CREATE TRIGGER trg_notify_like AFTER INSERT ON public.liked_tracks FOR EACH ROW EXECUTE FUNCTION public.notify_artist_owner();

-- ===== Stripe: búsqueda rápida desde el webhook =====
CREATE INDEX idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);