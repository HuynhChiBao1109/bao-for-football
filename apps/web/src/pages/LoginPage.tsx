import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../hooks/useAuth';
import { useLoginMutation, useRegisterMutation } from '../hooks/useAuthMutations';
import { ROUTES, defaultAuthenticatedRoute } from '../routes';
import { BrandLogo } from '../components/auth';
import { AnimatedBackground } from '../components/redlock/RedLockUI';
import { AuthTab } from '../enums/auth';

export function LoginPage() {
  const { setSession, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session)
      navigate(defaultAuthenticatedRoute(Boolean(session.user?.isAdmin)), { replace: true });
  }, [session, navigate]);

  const [tab, setTab] = useState<AuthTab>(AuthTab.Login);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const loading = loginMutation.isPending || registerMutation.isPending;

  useEffect(() => {
    setMessage('');
    setError('');
  }, [tab]);

  function hasNoTeam(payload: any) {
    return !payload?.team;
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const data = await loginMutation.mutateAsync(loginForm);
      setSession({ token: data.token, user: data.user });

      if (data.user?.isAdmin) {
        navigate(defaultAuthenticatedRoute(true), { replace: true });
        return;
      }

      const me = await apiClient('/api/v1/auth/me', { token: data.token });
      if (hasNoTeam(me)) {
        navigate(ROUTES.teamSetup, { replace: true });
        return;
      }

      navigate(defaultAuthenticatedRoute(Boolean(data.user?.isAdmin)), { replace: true });
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      // check password confirmation
      if (registerForm.password !== registerForm.confirmPassword) {
        setError('Password and confirm password do not match.');
        return;
      }
      await registerMutation.mutateAsync({
        username: registerForm.username,
        password: registerForm.password,
      });
      setMessage('Đăng ký thành công. Bạn có thể đăng nhập ngay.');
      setTab(AuthTab.Login);
      setLoginForm((prev) => ({ ...prev, username: registerForm.username }));
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="app-shell auth-popup-shell">
      <AnimatedBackground />
      <div className="app-shell__inner auth-popup-shell__inner">
        <section className="game-panel game-panel--accent scan-line overflow-hidden auth-popup-card p-5 sm:p-7">
          <div className="game-panel__content">
            <BrandLogo className="justify-center" compact />
            <h1 className="game-title mt-4 text-center text-3xl font-bold text-white sm:text-4xl">
              {tab === AuthTab.Login ? 'REDLOCK LOGIN' : 'CREATE REDLOCK PROFILE'}
            </h1>
            <p className="game-copy mt-2 text-center text-sm sm:text-base">
              {tab === AuthTab.Login
                ? 'Awaken Your Ego. Dominate The Field.'
                : 'Enter the academy and fight for the striker seat.'}
            </p>

            <div className="mt-5 flex gap-2 rounded-[20px] border border-white/8 bg-black/20 p-2">
              <button
                className={tabClass(tab === AuthTab.Login)}
                onClick={() => setTab(AuthTab.Login)}
                type="button"
              >
                Login
              </button>
              <button
                className={tabClass(tab === AuthTab.Register)}
                onClick={() => setTab(AuthTab.Register)}
                type="button"
              >
                Register
              </button>
            </div>

            {tab === AuthTab.Login ? (
              <form className="mt-4 space-y-4" onSubmit={submitLogin}>
                <Field
                  label="Username"
                  value={loginForm.username}
                  onChange={(v) => setLoginForm((p) => ({ ...p, username: v }))}
                />
                <Field
                  label="Password"
                  type="password"
                  value={loginForm.password}
                  onChange={(v) => setLoginForm((p) => ({ ...p, password: v }))}
                />

                {message && <p className="game-notice game-notice--success">{message}</p>}
                {error && <p className="game-notice game-notice--error">{error}</p>}

                <button type="submit" disabled={loading} className="game-button-primary w-full">
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>
            ) : (
              <form className="mt-4 space-y-4" onSubmit={submitRegister}>
                <Field
                  label="Username"
                  value={registerForm.username}
                  onChange={(v) => setRegisterForm((p) => ({ ...p, username: v }))}
                />
                <Field
                  label="Password"
                  type="password"
                  value={registerForm.password}
                  onChange={(v) => setRegisterForm((p) => ({ ...p, password: v }))}
                />
                <Field
                  label="Confirm Password"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(v) => setRegisterForm((p) => ({ ...p, confirmPassword: v }))}
                />

                {message && <p className="game-notice game-notice--success">{message}</p>}
                {error && <p className="game-notice game-notice--error">{error}</p>}

                <button type="submit" disabled={loading} className="game-button-primary w-full">
                  {loading ? 'Registering...' : 'Register'}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="game-input"
      />
    </label>
  );
}

function tabClass(active: boolean) {
  return active
    ? 'flex-1 rounded-[16px] bg-white/12 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition'
    : 'flex-1 rounded-[16px] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-white';
}
