import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/apiClient';
import { ROUTES } from '../routes';
import { BrandLogo } from '../components/ui/BrandLogo';

export function AdminLoginPage() {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session?.user?.isAdmin) {
      navigate(ROUTES.admin, { replace: true });
    } else if (session) {
      navigate(ROUTES.club, { replace: true });
    }
  }, [session, navigate]);

  async function submitAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiClient('/admin/login', {
        method: 'POST',
        body: form,
      });
      setSession({ token: data.token, user: data.user });
      navigate(ROUTES.admin, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell auth-popup-shell">
      <div className="app-shell__inner auth-popup-shell__inner">
        <section className="game-panel game-panel--accent scan-line overflow-hidden auth-popup-card p-5 sm:p-7">
          <div className="game-panel__content">
            <BrandLogo className="justify-center" compact />
            <p className="game-header-kicker mt-4 justify-center">
              <span className="pulse-dot" />
              Admin Access
            </p>
            <h1 className="game-title mt-3 text-center text-3xl font-bold text-white sm:text-4xl">
              Admin Login
            </h1>
            <p className="game-copy mt-2 text-center text-sm sm:text-base">
              Trang đăng nhập riêng cho quản trị viên.
            </p>

            <form className="mt-5 space-y-4" onSubmit={submitAdminLogin}>
              <label className="block">
                <span className="game-field-label">Admin Username</span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="game-input"
                />
              </label>

              <label className="block">
                <span className="game-field-label">Password</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="game-input"
                />
              </label>

              {error && <p className="game-notice game-notice--error">{error}</p>}

              <button type="submit" disabled={loading} className="game-button-primary w-full">
                {loading ? 'Logging in...' : 'Login as Admin'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
