import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081'

const emptyLogin = { username: '', password: '' }
const emptyRegister = { username: '', password: '', clubId: 0, clubName: '' }

function AuthGate({ onAuthenticated }) {
  const [tab, setTab] = useState('login')
  const [loginMode, setLoginMode] = useState('user')
  const [loginForm, setLoginForm] = useState(emptyLogin)
  const [registerForm, setRegisterForm] = useState(emptyRegister)
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setMessage('')
    setError('')
  }, [tab])

  useEffect(() => {
    let cancelled = false

    async function loadClubs() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/clubs`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Load clubs failed')
        }

        if (cancelled) {
          return
        }

        const nextClubs = Array.isArray(data?.data) ? data.data : []
        setClubs(nextClubs)
        setRegisterForm((current) => {
          if (current.clubId || nextClubs.length === 0) {
            return current
          }
          return { ...current, clubId: nextClubs[0].id }
        })
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      }
    }

    loadClubs()

    return () => {
      cancelled = true
    }
  }, [])

  async function submitLogin(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const endpoint = loginMode === 'admin' ? '/admin/login' : '/api/v1/auth/login'
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Login failed')
      }

      onAuthenticated({
        token: data.token,
        user: data.user,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitRegister(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Register failed')
      }

      setMessage('Đăng ký thành công. Bạn có thể đăng nhập ngay với đội hình khởi tạo ban đầu.')
      setTab('login')
      setLoginForm((current) => ({ ...current, username: registerForm.username }))
      setRegisterForm((current) => ({ ...emptyRegister, clubId: clubs[0]?.id || current.clubId || 0 }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,0,128,0.28),transparent_34%),linear-gradient(180deg,#050505_0%,#090d1f_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-6 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)] sm:p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">FIFAM Access</p>
          <h1 className="mt-3 font-['Space_Grotesk'] text-4xl font-bold text-white sm:text-6xl">
            Login / Register
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Mặc định đăng nhập user. Tài khoản admin chỉ đăng nhập qua endpoint /admin/login.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['JWT Guard', 'Bảo vệ toàn bộ admin API bằng token'],
              ['Navy UI', 'Dark mode với nút Navy'],
              ['Gin Backend', 'Login qua endpoint /admin/login'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-[#21306e] bg-black/25 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-4 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)] sm:p-6">
          <div className="mb-4 flex gap-2 rounded-2xl bg-black/30 p-2">
            <button
              className={buttonTab(tab === 'login')}
              onClick={() => setTab('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={buttonTab(tab === 'register')}
              onClick={() => setTab('register')}
              type="button"
            >
              Register
            </button>
          </div>

          {tab === 'login' ? (
            <form className="space-y-4" onSubmit={submitLogin}>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-1.5">
                <button
                  type="button"
                  onClick={() => setLoginMode('user')}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                    loginMode === 'user' ? 'bg-[#000080] text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  User Login
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('admin')}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                    loginMode === 'admin' ? 'bg-[#000080] text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  Admin Login
                </button>
              </div>

              <Field
                label="Username"
                value={loginForm.username}
                onChange={(value) => setLoginForm((current) => ({ ...current, username: value }))}
              />
              <Field
                label="Password"
                type="password"
                value={loginForm.password}
                onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))}
              />

              {message && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p>}
              {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#000080] px-4 py-3 font-semibold text-white transition hover:bg-[#1111a8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Logging in...' : loginMode === 'admin' ? 'Login as Admin' : 'Login as User'}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submitRegister}>
              <Field
                label="Username"
                value={registerForm.username}
                onChange={(value) => setRegisterForm((current) => ({ ...current, username: value }))}
              />
              <Field
                label="Password"
                type="password"
                value={registerForm.password}
                onChange={(value) => setRegisterForm((current) => ({ ...current, password: value }))}
              />
              <Field
                label="Tên Câu Lạc Bộ"
                value={registerForm.clubName}
                onChange={(value) => setRegisterForm((current) => ({ ...current, clubName: value }))}
              />
              <SelectField
                label="Đội Bóng Khởi Đầu"
                value={registerForm.clubId}
                options={clubs}
                onChange={(value) => setRegisterForm((current) => ({ ...current, clubId: Number(value) }))}
              />

              {registerForm.clubId ? (
                <ClubPreview clubs={clubs} clubId={registerForm.clubId} />
              ) : null}

              {message && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p>}
              {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#000080] px-4 py-3 font-semibold text-white transition hover:bg-[#1111a8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#4169ff]"
      />
    </label>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#4169ff]"
      >
        <option value={0} disabled>
          Chọn đội bóng
        </option>
        {options.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function ClubPreview({ clubs, clubId }) {
  const club = clubs.find((item) => item.id === clubId)
  if (!club) {
    return null
  }

  return (
    <div className="rounded-xl border border-[#22306f] bg-black/20 px-3 py-3 text-sm text-slate-300">
      <p className="font-semibold text-white">{club.name}</p>
      <p className="mt-1">Sơ đồ: {club.formation}</p>
      <p className="mt-1">Giải đấu: {club.leagueName}</p>
      <p className="mt-1">Ngân sách khởi điểm: {Number(club.budget || 0).toLocaleString()}</p>
      <p className="mt-2 text-xs text-slate-400">Đăng ký xong sẽ nhận 22 thẻ cầu thủ mùa thường của đội này.</p>
    </div>
  )
}

function buttonTab(active) {
  return `flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
    active
      ? 'bg-[#000080] text-white shadow-[0_12px_30px_-16px_rgba(0,0,128,0.8)]'
      : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white'
  }`
}

export default AuthGate
