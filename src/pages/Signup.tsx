import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { QamuzMark } from '@/components/QamuzMark';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Signup() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signUp(email, password, name);
    if (!result.success) setError(result.error ?? t('Could not create the account'));else
    if (result.needsEmailConfirmation) setCheckEmail(true);else
    navigate('/');
    setLoading(false);
  }

  if (checkEmail) {
    return (
      <main data-ev-id="ev_d2a59637f5" className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
				<div data-ev-id="ev_8398418e2f" className="flex max-w-sm flex-col gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
					<h1 data-ev-id="ev_03a462aaef" className="text-xl font-black">{t('Check your email')}</h1>
					<p data-ev-id="ev_fd18229a2c" className="text-sm text-muted-foreground">{t('We sent a confirmation link to {email}.', { email })}</p>
					<Link data-ev-id="ev_16ce3a2984" to="/login" className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
						{t('Go to log in')}
					</Link>
				</div>
			</main>);

  }

  return (
    <main data-ev-id="ev_e07a966fbe" className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
			<div data-ev-id="ev_3fb54e3c62" className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-surface p-8">
				<div data-ev-id="ev_4f261011f3" className="flex items-center justify-between gap-3">
				<Link data-ev-id="ev_fbdb4c4677" to="/" className="flex items-center gap-2">
					<span data-ev-id="ev_b94ba702db" className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<QamuzMark className="h-5 w-5" />
					</span>
					<span data-ev-id="ev_2831ceaa26" className="text-lg font-black tracking-tight">Qamuz <span data-ev-id="ev_664727809f" className="text-primary">AI</span></span>
				</Link>
				<LanguageSwitcher />
				</div>
				<h1 data-ev-id="ev_666e1eaa74" className="text-2xl font-black tracking-tight text-balance">{t('Create your free account')}</h1>

				{error && <p data-ev-id="ev_44d38760f0" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

				<form data-ev-id="ev_3c9b172b9d" onSubmit={handleSubmit} className="flex flex-col gap-4">
					<label data-ev-id="ev_e5477c9f7e" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{t('Name')}
						<input data-ev-id="ev_1317d929bb" type="text" value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary" />
					</label>
					<label data-ev-id="ev_47477e0450" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{t('Email')}
						<input data-ev-id="ev_58b0a905c0" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary" />
					</label>
					<label data-ev-id="ev_e906ed5478" className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{t('Password')}
						<input data-ev-id="ev_6a3c95987f" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary" />
					</label>
					<button data-ev-id="ev_c393fc088d" type="submit" disabled={loading} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-50">
						{loading ? t('Creating account...') : t('Create account')}
					</button>
				</form>

				<p data-ev-id="ev_2a0cd54564" className="text-sm text-muted-foreground">
					{t('Already have an account?')}{' '}
					<Link data-ev-id="ev_2414d8f866" to="/login" className="font-semibold text-primary hover:underline">
						{t('Log in')}
					</Link>
				</p>
			</div>
		</main>);

}