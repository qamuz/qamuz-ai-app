ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.notify_artist_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _owner UUID;
  _artist_name TEXT;
  _slug TEXT;
  _track_title TEXT;
  _actor_name TEXT;
BEGIN
  SELECT display_name INTO _actor_name FROM public.profiles WHERE id = (SELECT auth.uid());
  _actor_name := COALESCE(NULLIF(_actor_name, ''), 'Someone');
  IF TG_TABLE_NAME = 'follows' THEN
    SELECT owner_id, name, slug INTO _owner, _artist_name, _slug FROM public.artists WHERE id = NEW.artist_id;
    IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, actor_name, type, title, meta, link)
      VALUES (_owner, NEW.user_id, _actor_name, 'follow', '{actor} started following {artist}',
        jsonb_build_object('actor', _actor_name, 'artist', _artist_name), '/artista/' || _slug);
    END IF;
  ELSE
    SELECT a.owner_id, a.slug, t.title INTO _owner, _slug, _track_title
      FROM public.tracks t JOIN public.artists a ON a.id = t.artist_id WHERE t.id = NEW.track_id;
    IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
      IF TG_TABLE_NAME = 'track_comments' THEN
        INSERT INTO public.notifications (user_id, actor_id, actor_name, type, title, body, meta, link)
        VALUES (_owner, NEW.user_id, _actor_name, 'comment', '{actor} commented on “{track}”', left(NEW.body, 140),
          jsonb_build_object('actor', _actor_name, 'track', _track_title), '/artista/' || _slug);
      ELSE
        INSERT INTO public.notifications (user_id, actor_id, actor_name, type, title, meta, link)
        VALUES (_owner, NEW.user_id, _actor_name, 'like', '{actor} liked “{track}”',
          jsonb_build_object('actor', _actor_name, 'track', _track_title), '/artista/' || _slug);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.plans SET name = 'Free', description = 'To listen and try the studio', features = ARRAY['Unlimited music with ads','Synced lyrics','30 AI credits per month'] WHERE slug = 'gratis';
UPDATE public.plans SET name = 'Pro', description = 'For listeners and occasional creators', features = ARRAY['No ads','High audio quality','300 AI credits per month','Download your creations'] WHERE slug = 'pro';
UPDATE public.plans SET name = 'Artist', description = 'To publish and grow your audience', features = ARRAY['Everything in Pro','Verified artist profile','Advanced stats','1,000 AI credits per month'] WHERE slug = 'artista';
UPDATE public.plans SET name = 'Business', description = 'For labels and teams', features = ARRAY['Everything in Artist','Multiple artists per account','Priority support','5,000 AI credits per month'] WHERE slug = 'empresa';

UPDATE public.app_modules SET name = 'Player', description = 'Persistent player, queue and Now Playing' WHERE key = 'player';
UPDATE public.app_modules SET name = 'Synced lyrics', description = 'Time-stamped lyrics in Now Playing' WHERE key = 'lyrics';
UPDATE public.app_modules SET name = 'AI Studio', description = 'Create music, video and images with AI' WHERE key = 'studio';
UPDATE public.app_modules SET name = 'Artist profiles', description = 'Public profiles and artist dashboard' WHERE key = 'artists';
UPDATE public.app_modules SET name = 'Plans & payments', description = 'Plans page and subscriptions' WHERE key = 'payments';

UPDATE public.ai_providers SET name = 'OpenAI Images', notes = 'Covers, artwork and banners' WHERE slug = 'openai-image';
UPDATE public.ai_providers SET notes = 'Short videos and music videos with Veo 3' WHERE slug = 'kie-veo';
UPDATE public.ai_providers SET notes = 'Full songs with vocals or instrumentals' WHERE slug = 'kie-suno';

UPDATE public.playlists SET title = 'Neon Nights', description = 'Synthwave and electronica for late-night drives.' WHERE id = 'ccccccc1-0000-4000-8000-000000000001';
UPDATE public.playlists SET title = 'Deep Focus', description = 'Slow textures to work without interruptions.' WHERE id = 'ccccccc2-0000-4000-8000-000000000002';
UPDATE public.playlists SET title = 'Electric Roots', description = 'Spanish-language folk with modern production.' WHERE id = 'ccccccc3-0000-4000-8000-000000000003';
UPDATE public.playlists SET title = 'New Releases', description = 'The latest on the platform.' WHERE id = 'ccccccc4-0000-4000-8000-000000000004';

UPDATE public.artists SET bio = 'Atmospheric electronic producer. Blends analog synths with AI-generated textures.' WHERE slug = 'nova-reign';
UPDATE public.artists SET bio = 'Nocturnal synthwave duo born in the city''s basements.' WHERE slug = 'lumen-kai';
UPDATE public.artists SET name = 'Copper Tree', bio = 'Electronic folk in Spanish. Nylon guitars over broken beats.' WHERE slug = 'arbol-de-cobre';