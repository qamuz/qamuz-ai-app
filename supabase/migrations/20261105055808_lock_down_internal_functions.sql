-- Trigger functions: full lockdown (triggers still fire)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_artist_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_comment_author() FROM PUBLIC, anon, authenticated;

-- Permission helpers: signed-in users only
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_artist_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_artist_owner(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.owns_playlist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_playlist(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_read_playlist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_playlist(uuid) TO authenticated;