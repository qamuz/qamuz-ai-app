-- Engagement counters, trending score and Shorts settings on tracks
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canvas_url TEXT,
  ADD COLUMN IF NOT EXISTS short_start_seconds INTEGER NOT NULL DEFAULT 0 CHECK (short_start_seconds >= 0);

CREATE INDEX IF NOT EXISTS idx_tracks_trending ON public.tracks(trending_score DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_liked_tracks_track ON public.liked_tracks(track_id, created_at);

-- Views and shares log. Written only by the server-side track-event function; clients have no access.
CREATE TABLE public.track_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('view', 'share')),
  channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.track_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_track_events_track ON public.track_events(track_id, kind, created_at DESC);
CREATE INDEX idx_track_events_user ON public.track_events(user_id);
REVOKE ALL ON public.track_events FROM anon, authenticated;

-- Backfill counters for existing songs
UPDATE public.tracks t SET
  likes_count = (SELECT count(*) FROM public.liked_tracks l WHERE l.track_id = t.id),
  comments_count = (SELECT count(*) FROM public.track_comments c WHERE c.track_id = t.id);
UPDATE public.tracks SET trending_score = round((ln(1 + plays) + likes_count * 3 + comments_count * 2)::numeric, 3);