-- Stuck-task reconciler: every 5 minutes the database calls the kie-reconcile function.
-- The token is generated inside the database (never written in code): plaintext lives in Vault,
-- only its SHA-256 is stored in a table the function can read with the service role.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.internal_job_keys (
  name TEXT PRIMARY KEY,
  token_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.internal_job_keys ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (edge functions) can read it.
REVOKE ALL ON public.internal_job_keys FROM anon, authenticated;

DO $$
DECLARE
  tok TEXT := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  DELETE FROM vault.secrets WHERE name = 'kie_reconcile_token';
  PERFORM vault.create_secret(tok, 'kie_reconcile_token', 'Auth token for the kie-reconcile schedule');
  INSERT INTO public.internal_job_keys (name, token_sha256)
  VALUES ('kie_reconcile', encode(extensions.digest(tok, 'sha256'), 'hex'))
  ON CONFLICT (name) DO UPDATE SET token_sha256 = EXCLUDED.token_sha256, created_at = now();
END $$;

SELECT cron.unschedule('kie-reconcile') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kie-reconcile');

SELECT cron.schedule(
  'kie-reconcile',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://sxhzseqtlbvldymvtelk.supabase.co/functions/v1/kie-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Reconcile-Token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kie_reconcile_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);