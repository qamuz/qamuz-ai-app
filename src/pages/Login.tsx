import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { QamuzMark } from '@/components/QamuzMark';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    if (result.success) navigate('/');else
    setError(result.error === 'Email not confirmed' ? t("Your email isn't confirmed yet. Check your inbox.") : result.error === 'Invalid login credentials' ? t('Incorrect email or password.') : result.error ?? t('Could not log in'));
    setLoading(false);
  }

  return (
    <main data-ev-id="ev_d9db92cf80" className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
			<div data-ev-id="ev_355d47d8d4" className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-surface p-8">
				<div data-ev-id="ev_f868333b0f" className="flex items-center justify-between gap-3">
				<Link data-ev-id="ev_be53284f6e" to="/" className="flex items-center gap-2">
					<span data-ev-id="ev_04aa4e34a3" className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<QamuzMark className="h-5 w-5" />
					</span>
					<span data-ev-id="ev_2b0484fad5" className="text-lg font-black tracking-tight">Qamuz <span data-ev-id="ev_d1cd6fa574" className="text-primary">AI</span></span>
				</Link>
				<LanguageSwitcher />
				</div>
				<h1 data-ev-id="ev_b273326e76" className="text-2xl font-black tracking-tight">{t('Log in')}</h1>

				{error && <p data-ev-id="ev_bf5fa24df7" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

				<form data-ev-id="ev_ac1f5fe0ee" onSubmit={handleSubmit} className="flex flex-col gap-4">
					<label data-ev-id="ev_472cb4868c" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{t('Email')}
						<input data-ev-id="ev_c12a90457a" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary" />
					</label>
					<label data-ev-id="ev_3472314886" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{t('Password')}
						<input data-ev-id="ev_aa793860df" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary" />
					</label>
					<button data-ev-id="ev_924ebac8b5" type="submit" disabled={loading} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-50">
						{loading ? t('Logging in...') : t('Log in')}
					</button>
				</form>

				<div data-ev-id="ev_9e572a10a8" className="flex flex-col gap-2 text-sm text-muted-foreground">
					<Link data-ev-id="ev_bb7306e114" to="/recuperar" className="hover:text-foreground hover:underline">
						{t('Forgot your password?')}
					</Link>
					<span data-ev-id="ev_e13513932f">
						{t("Don't have an account?")}{' '}
						<Link data-ev-id="ev_ac598f8791" to="/registro" className="font-semibold text-primary hover:underline">
							{t('Sign up')}
						</Link>
					</span>
				</div>
			</div>
		</main>);

}