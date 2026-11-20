-- Security hardening: prevent client-side credit refund forgery on ai_creations.
-- Previously, "insert own creations" allowed authenticated users to insert arbitrary
-- status='generating' and credits_spent>0 rows that could trigger automated refunds.
-- Client-side inserts are restricted strictly to 0-credit, already-ready local artifacts.
DROP POLICY IF EXISTS "insert own creations" ON public.ai_creations;
CREATE POLICY "insert own creations" ON public.ai_creations
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND credits_spent = 0
    AND status = 'ready'
    AND external_task_id IS NULL
    AND provider_slug IN ('trimmed-audio', 'modal-image', 'modal-video', 'timeline-studio')
  );

-- Ensure authenticated clients cannot alter credits_spent, status, or external_task_id directly.
REVOKE UPDATE ON public.ai_creations FROM authenticated;
GRANT UPDATE (published_track_id, items) ON public.ai_creations TO authenticated;
