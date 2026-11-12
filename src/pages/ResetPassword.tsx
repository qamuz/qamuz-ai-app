import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';

export default function ResetPassword() {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const readyRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.slice(1));
      const code = params.get('error_code');
      if (code) {
        setLinkError(code === 'otp_expired' ? 'This link has expired. Request a new one.' : 'The link is not valid.');
        return;
      }
    }
    if (!supabase) return;

    const markReady = () => {
      readyRef.current = true;
      setReady(true);
    };

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') markReady();
    });

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) markReady();
    });

    const timeout = setTimeout(() => {
      if (!readyRef.current) setLinkError("We couldn't verify the link. It may have expired.");
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("Passwords don't match"));
      return;
    }
    if (!supabase) return;
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate('/login'), 1800);
  }

  return (
    <main data-ev-id="ev_efb707bdd9" className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
			<div data-ev-id="ev_ff4163a588" className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-border bg-surface p-8">
				<h1 data-ev-id="ev_3a27e22331" className="text-2xl font-black tracking-tight">{t('New password')}</h1>
				{linkError ?
        <>
						<p data-ev-id="ev_5d90c183ed" className="text-sm text-muted-foreground">{t(linkError)}</p>
						<Link data-ev-id="ev_e489ae692d" to="/recuperar" className="rounded-full bg-primary px-5 py-2.5 text-center text-sm font-bold text-primary-foreground">
							{t('Request a new link')}
						</Link>
					</> :
        success ?
        <p data-ev-id="ev_33898c15de" className="text-sm text-muted-foreground">{t('Password updated. Taking you to log in...')}</p> :
        !ready ?
        <p data-ev-id="ev_e06437c7ec" className="text-sm text-muted-foreground">{t('Verifying the link...')}</p> :

        <>
						{error && <p data-ev-id="ev_ba9eae1825" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
						<form data-ev-id="ev_e48cf661c3" onSubmit={handleSubmit} className="flex flex-col gap-4">
							<label data-ev-id="ev_2eb332abe5" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								{t('New password')}
								<input data-ev-id="ev_8db54e2c3e" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary" />
							</label>
							<label data-ev-id="ev_f3b612ebc4" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								{t('Repeat password')}
								<input data-ev-id="ev_167b22172d" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary" />
							</label>
							<button data-ev-id="ev_bcf5aca81c" type="submit" disabled={loading} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
								{loading ? t('Saving...') : t('Save password')}
							</button>
						</form>
					</>
        }
			</div>
		</main>);

}