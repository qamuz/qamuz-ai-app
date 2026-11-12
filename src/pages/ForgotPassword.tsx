import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await resetPassword(email);
    if (result.success) setSent(true);else
    setError(result.error ?? t('Could not send the email'));
    setLoading(false);
  }

  return (
    <main data-ev-id="ev_e1a545ae7e" className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
			<div data-ev-id="ev_9e7eb822b8" className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-border bg-surface p-8">
				<h1 data-ev-id="ev_208ac5c3e3" className="text-2xl font-black tracking-tight">{t('Reset password')}</h1>
				{sent ?
        <p data-ev-id="ev_81715bddee" className="text-sm text-muted-foreground">{t('If an account exists with that email, we sent you a link to reset your password.')}</p> :

        <>
						{error && <p data-ev-id="ev_a26c2c0186" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
						<form data-ev-id="ev_889d592bdc" onSubmit={handleSubmit} className="flex flex-col gap-4">
							<label data-ev-id="ev_e39b184f17" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								{t('Email')}
								<input data-ev-id="ev_9814b117b8" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary" />
							</label>
							<button data-ev-id="ev_96f00ac471" type="submit" disabled={loading} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
								{loading ? t('Sending...') : t('Send link')}
							</button>
						</form>
					</>
        }
				<Link data-ev-id="ev_df995d6eb1" to="/login" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
					{t('Back to log in')}
				</Link>
			</div>
		</main>);

}