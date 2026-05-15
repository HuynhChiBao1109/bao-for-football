import { useEffect, useMemo, useState } from 'react'

import AdminDashboard from './AdminDashboard.jsx'
import ClubPage from './ClubPage.jsx'
import GachaPage from './GachaPage.jsx'
import MatchView from './MatchView.jsx'
import TacticsPage from './TacticsPage.jsx'
import { apiRequest } from './api'
import { navItems, ROUTES } from './routes'

function MainDashboard({ token, user, pathname, onNavigate, onLogout, onUnauthorized }) {
  const [sessionData, setSessionData] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')

  const items = useMemo(() => navItems(Boolean(user?.isAdmin)), [user?.isAdmin])

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      setLoadingSession(true)
      setSessionError('')

      try {
        const payload = await apiRequest('/api/v1/auth/me', { token })
        if (!cancelled) {
          setSessionData(payload?.data || null)
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          onUnauthorized()
          return
        }
        if (!cancelled) {
          setSessionError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoadingSession(false)
        }
      }
    }

    loadSession()

    return () => {
      cancelled = true
    }
  }, [onUnauthorized, token])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,0,128,0.3),transparent_30%),linear-gradient(180deg,#050505_0%,#090d1f_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[#1c255b] bg-[#050814]/95 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
          <div className="grid gap-5 border-b border-[#1c255b] px-5 py-5 lg:grid-cols-[1.4fr_0.8fr] lg:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">FIFAM Main Page</p>
              <h1 className="mt-3 font-['Space_Grotesk'] text-3xl font-bold text-white sm:text-4xl">
                Trung tâm điều khiển câu lạc bộ sau đăng nhập
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Mỗi khu chức năng giờ có URL riêng và các màn chính đã bắt đầu lấy dữ liệu thật từ service-core.
              </p>
            </div>

            <div className="rounded-2xl border border-[#24306e] bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Session</p>
              <p className="mt-2 text-xl font-semibold text-white">{user?.username}</p>
              <p className="mt-1 text-sm text-slate-300">
                Vai trò: <span className="font-semibold text-[#f6d87a]">{user?.isAdmin ? 'Admin' : 'User'}</span>
              </p>
              <p className="mt-2 text-sm text-slate-300">
                CLB: <span className="font-semibold text-white">{sessionData?.team?.clubName || 'Chưa có dữ liệu'}</span>
              </p>
              <p className="mt-2 text-xs text-slate-400">URL hiện tại: {pathname}</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-4 w-full rounded-xl bg-[#000080] px-4 py-3 font-semibold text-white transition hover:bg-[#1111a8]"
              >
                Logout
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-3 px-5 py-4 lg:px-6">
            {items.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  pathname === item.path
                    ? 'border-[#4169ff] bg-[#000080] text-white shadow-[0_16px_30px_-20px_rgba(0,0,128,0.95)]'
                    : 'border-[#24306e] bg-black/20 text-slate-300 hover:border-[#4169ff] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </section>

        {loadingSession && <Banner tone="info" text="Đang tải session hiện tại từ API..." />}
        {sessionError && <Banner tone="error" text={sessionError} />}

        {!loadingSession &&
          !sessionError &&
          renderRoute(pathname, {
            token,
            user,
            sessionData,
            onNavigate,
            onLogout,
            onUnauthorized,
          })}
      </div>
    </main>
  )
}

function renderRoute(pathname, props) {
  if (pathname === ROUTES.club) {
    return (
      <ClubPage
        token={props.token}
        sessionData={props.sessionData}
        onUnauthorized={props.onUnauthorized}
        onNavigate={props.onNavigate}
      />
    )
  }

  if (pathname === ROUTES.tactics) {
    return (
      <TacticsPage
        token={props.token}
        sessionData={props.sessionData}
        user={props.user}
        onUnauthorized={props.onUnauthorized}
      />
    )
  }

  if (pathname === ROUTES.aiMatch) {
    return <MatchView embedded />
  }

  if (pathname === ROUTES.pvp) {
    return <PvpOverview />
  }

  if (pathname === ROUTES.gacha) {
    return (
      <GachaPage
        token={props.token}
        sessionData={props.sessionData}
        onUnauthorized={props.onUnauthorized}
      />
    )
  }

  if (pathname === ROUTES.admin && props.user?.isAdmin) {
    return (
      <AdminDashboard
        embedded
        token={props.token}
        user={props.user}
        onLogout={props.onLogout}
        onUnauthorized={props.onUnauthorized}
      />
    )
  }

  return <PvpOverview />
}

function PvpOverview() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <article className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Đấu với người</p>
        <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
          Chế độ rank với ghép trận tự động
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">Hệ thống xếp hạng</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Nghiệp dư, bán chuyên, chuyên nghiệp, hạng 3, hạng 2, hạng 1 và siêu sao.
            </p>
          </div>
          <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">Điều kiện thăng hạng</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Trong chu kỳ 10 trận, thắng từ 6 trận trở lên sẽ được lên hạng.
            </p>
          </div>
        </div>
      </article>

      <aside className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Queue Status</p>
        <div className="mt-4 rounded-2xl border border-dashed border-[#2a387e] bg-black/20 px-4 py-5 text-sm text-slate-300">
          Khu vực này sẵn sàng cho matchmaking realtime. Route riêng đã có để sau này nối matchmaking API mà không cần đổi cấu trúc điều hướng nữa.
        </div>
      </aside>
    </section>
  )
}

function Banner({ text, tone }) {
  const toneClass =
    tone === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : 'border-[#24306e] bg-black/20 text-slate-300'

  return <p className={`rounded-2xl border px-4 py-4 text-sm ${toneClass}`}>{text}</p>
}

export default MainDashboard
