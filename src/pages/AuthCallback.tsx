import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';

export default function AuthCallback() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const errorCode = params.get('error_code');
    if (errorCode) {
      setError(errorCode === 'otp_expired' ? 'This link has expired. Request a new one.' : 'The link is not valid.');
      return;
    }
    const type = params.get('type');
    if (!supabase) {
      navigate('/', { replace: true });
      return;
    }
    void supabase.auth.getSession().then(() => {
      if (type === 'recovery') navigate('/nueva-contrasena', { replace: true });else
      navigate('/', { replace: true });
    });
  }, [navigate]);

  return (
    <main data-ev-id="ev_0b495fcfe9" className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
			{error ?
      <div data-ev-id="ev_63070bf450" className="flex max-w-sm flex-col gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
					<p data-ev-id="ev_e88015997b" className="text-sm text-muted-foreground">{t(error)}</p>
					<a data-ev-id="ev_eff8f8b67f" href="/recuperar" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
						{t('Request a new link')}
					</a>
				</div> :

      <div data-ev-id="ev_6e08c908fc" className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      }
		</main>);

}