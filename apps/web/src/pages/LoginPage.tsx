import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useClubs } from '../hooks/useClubs'
import { apiClient } from '../lib/apiClient'
import { defaultAuthenticatedRoute } from '../routes'

export function LoginPage() {
  const { setSession, session } = useAuth()
  const navigate = useNavigate()
  const { data: clubs = [] } = useClubs()

  useEffect(() => {
    if (session) navigate(defaultAuthenticatedRoute(Boolean(session.user?.isAdmin)), { replace: true })
  }, [session, navigate])

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', clubId: 0, clubName: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setMessage('')
    setError('')
  }, [tab])

  useEffect(() => {
    if (clubs.length > 0 && !registerForm.clubId) {
      setRegisterForm((prev) => ({ ...prev, clubId: clubs[0].id }))
    }
  }, [clubs, registerForm.clubId])

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const endpoint = loginMode === 'admin' ? '/admin/login' : '/api/v1/auth/login'
      const data = await apiClient(endpoint, { method: 'POST', body: loginForm })
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

  const selectedClub = clubs.find((c) => c.id === registerForm.clubId)

  return (
    <main className="app-shell">
      <div className="app-shell__inner grid min-h-[calc(100vh-3rem)] items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="game-panel game-panel--accent scan-line overflow-hidden p-6 sm:p-8">
          <div className="game-panel__content">
            <p className="game-header-kicker">
              <span className="pulse-dot" />
              FIFAM Access Tunnel
            </p>
            <h1 className="game-header-title mt-4 text-shadow-soft text-white">Enter The Stadium</h1>
            <p className="game-copy mt-4 max-w-2xl text-base sm:text-lg">
              Đăng nhập để vào CLB, chọn chế độ, đăng ký đội khởi đầu rồi lao vào vòng squad, tactics, match và gacha.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ['Account Mode', 'User thường đi qua login, admin dùng /admin/login.'],
                ['Starter Club', `Hiện có ${clubs.length} CLB khởi đầu khả dụng để chọn lúc đăng ký.`],
                ['Game Loop', 'Đăng nhập xong vào thẳng shell điều hướng giống một lobby game bóng đá online.'],
              ].map(([title, desc]) => (
                <div key={title} className="game-stat-card min-h-[156px]">
                  <p className="game-stat-card__label">{title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="game-panel overflow-hidden p-4 sm:p-6">
          <div className="game-panel__content">
            <div className="mb-5 flex gap-2 rounded-[20px] border border-white/8 bg-black/20 p-2">
              <button
                className={tabClass(tab === 'login')}
                onClick={() => setTab('login')}
                type="button"
              >Login</button>
              <button
                className={tabClass(tab === 'register')}
                onClick={() => setTab('register')}
                type="button"
              >Register</button>
            </div>

            {tab === 'login' ? (
              <form className="space-y-4" onSubmit={submitLogin}>
                <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-white/8 bg-black/30 p-1.5">
                  {(['user', 'admin'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setLoginMode(mode)}
                      className={modeClass(loginMode === mode, mode)}
                    >
                      {mode === 'user' ? 'User Login' : 'Admin Login'}
                    </button>
                  ))}
                </div>

                <Field label="Username" value={loginForm.username} onChange={(v) => setLoginForm((p) => ({ ...p, username: v }))} />
                <Field label="Password" type="password" value={loginForm.password} onChange={(v) => setLoginForm((p) => ({ ...p, password: v }))} />

                {message && <p className="game-notice game-notice--success">{message}</p>}
                {error && <p className="game-notice game-notice--error">{error}</p>}

                <button type="submit" disabled={loading} className="game-button-primary w-full">
                  {loading ? 'Logging in...' : loginMode === 'admin' ? 'Login as Admin' : 'Login as User'}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={submitRegister}>
                <Field label="Username" value={registerForm.username} onChange={(v) => setRegisterForm((p) => ({ ...p, username: v }))} />
                <Field label="Password" type="password" value={registerForm.password} onChange={(v) => setRegisterForm((p) => ({ ...p, password: v }))} />
                <Field label="Tên Câu Lạc Bộ" value={registerForm.clubName} onChange={(v) => setRegisterForm((p) => ({ ...p, clubName: v }))} />

                <label className="block">
                  <span className="game-field-label">Đội Bóng Khởi Đầu</span>
                  <select
                    value={registerForm.clubId}
                    onChange={(e) => setRegisterForm((p) => ({ ...p, clubId: Number(e.target.value) }))}
                    className="game-select"
                  >
                    <option value={0} disabled>Chọn đội bóng</option>
                    {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>

                {selectedClub && (
                  <div className="game-stat-card">
                    <p className="game-stat-card__label">Starter Club Preview</p>
                    <div className="mt-3 flex items-center gap-3">
                      <img src={selectedClub.logo ?? '/default-avatar.svg'} alt={selectedClub.name} className="h-12 w-12 rounded-xl bg-white/10 object-contain p-1.5" />
                      <div>
                        <p className="font-semibold text-white">{selectedClub.name}</p>
                        {selectedClub.leagueName && <p className="text-xs text-slate-400">{selectedClub.leagueName}</p>}
                      </div>
                    </div>
                  </div>
                )}

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

function modeClass(active: boolean, mode: string) {
  if (active) {
    return `rounded-[14px] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
      mode === 'user'
        ? 'bg-emerald-400 text-slate-950 shadow-[0_14px_32px_-20px_rgba(52,211,153,0.9)]'
        : 'bg-sky-400 text-slate-950 shadow-[0_14px_32px_-20px_rgba(56,189,248,0.88)]'
    }`
  }
  return 'rounded-[14px] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition text-slate-300 hover:bg-white/5'
}
