import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import { defaultAuthenticatedRoute } from '../routes'
import { BrandLogo } from '../components/ui/BrandLogo'

export function LoginPage() {
  const { setSession, session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) navigate(defaultAuthenticatedRoute(Boolean(session.user?.isAdmin)), { replace: true })
  }, [session, navigate])

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setMessage('')
    setError('')
  }, [tab])

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await apiClient('/api/v1/auth/login', { method: 'POST', body: loginForm })
      setSession({ token: data.token, user: data.user })
      navigate(defaultAuthenticatedRoute(Boolean(data.user?.isAdmin)), { replace: true })
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiClient('/api/v1/auth/register', { method: 'POST', body: registerForm })
      setMessage('Đăng ký thành công. Bạn có thể đăng nhập ngay.')
      setTab('login')
      setLoginForm((prev) => ({ ...prev, username: registerForm.username }))
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell auth-popup-shell">
      <div className="app-shell__inner auth-popup-shell__inner">
        <section className="game-panel game-panel--accent scan-line overflow-hidden auth-popup-card p-5 sm:p-7">
          <div className="game-panel__content">
            <BrandLogo className="justify-center" compact />
            <h1 className="game-title mt-4 text-center text-3xl font-bold text-white sm:text-4xl">{tab === 'login' ? 'User Login' : 'Create Account'}</h1>
            <p className="game-copy mt-2 text-center text-sm sm:text-base">{tab === 'login' ? 'Đăng nhập để vào game dashboard.' : 'Tạo tài khoản mới và chọn câu lạc bộ khởi đầu.'}</p>

            <div className="mt-5 flex gap-2 rounded-[20px] border border-white/8 bg-black/20 p-2">
              <button className={tabClass(tab === 'login')} onClick={() => setTab('login')} type="button">Login</button>
              <button className={tabClass(tab === 'register')} onClick={() => setTab('register')} type="button">Register</button>
            </div>

            {tab === 'login' ? (
              <form className="mt-4 space-y-4" onSubmit={submitLogin}>
                <Field label="Username" value={loginForm.username} onChange={(v) => setLoginForm((p) => ({ ...p, username: v }))} />
                <Field label="Password" type="password" value={loginForm.password} onChange={(v) => setLoginForm((p) => ({ ...p, password: v }))} />

                {message && <p className="game-notice game-notice--success">{message}</p>}
                {error && <p className="game-notice game-notice--error">{error}</p>}

                <button type="submit" disabled={loading} className="game-button-primary w-full">
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>
            ) : (
              <form className="mt-4 space-y-4" onSubmit={submitRegister}>
                <Field label="Username" value={registerForm.username} onChange={(v) => setRegisterForm((p) => ({ ...p, username: v }))} />
                <Field label="Password" type="password" value={registerForm.password} onChange={(v) => setRegisterForm((p) => ({ ...p, password: v }))} />
                <p className="game-stat-card text-sm text-slate-300">
                  Sau khi login lần đầu, hệ thống sẽ yêu cầu bạn chọn câu lạc bộ để tạo team khởi đầu.
                </p>

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
  )
}

function Field({ label, type = 'text', value, onChange }: { label: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="game-input" />
    </label>
  )
}

function tabClass(active: boolean) {
  return active
    ? 'flex-1 rounded-[16px] bg-white/12 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition'
    : 'flex-1 rounded-[16px] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-white'
}
