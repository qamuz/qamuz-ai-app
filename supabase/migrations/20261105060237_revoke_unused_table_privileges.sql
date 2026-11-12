REVOKE TRUNCATE, TRIGGER, REFERENCES ON
  public.ai_creations, public.ai_providers, public.albums, public.app_modules,
  public.artist_media, public.artists, public.credit_balances, public.credit_transactions,
  public.follows, public.liked_tracks, public.lyric_lines, public.notifications,
  public.plans, public.play_history, public.playlist_tracks, public.playlists,
  public.profiles, public.subscriptions, public.track_comments, public.tracks,
  public.user_roles
FROM anon, authenticated;