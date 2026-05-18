import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSession } from '../hooks/useSession'
import { navItems, ROUTES } from '../routes'
import { queryClient } from '../lib/queryClient'

const routeMeta: Record<string, { title: string; eyebrow: string; description: string }> = {
  [ROUTES.club]: {
    title: 'Club Command Center',
    eyebrow: 'Club Ops',
    description: 'Quản lý roster nền, ngân sách và các tuyến nâng cấp của đội hình hiện tại.',
  },
  [ROUTES.players]: {
    title: 'Player Lab',
    eyebrow: 'Squad Data',
    description: 'Theo dõi tiến trình thẻ cầu thủ, chỉnh điểm kỹ năng và xem toàn bộ chỉ số phát triển.',
  },
  [ROUTES.tactics]: {
    title: 'Tactics Forge',
    eyebrow: 'Match Engine',
    description: 'Tinh chỉnh nhịp độ, áp lực và hồ sơ gameplay để đẩy thẳng sang realtime engine.',
  },
  [ROUTES.aiMatch]: {
    title: 'AI Campaign',
    eyebrow: 'Progression',
    description: 'Đánh từng stage, mở khóa màn kế tiếp và farm tiền thưởng cùng EXP toàn đội.',
  },
  [ROUTES.pvp]: {
    title: 'Arena Queue',
    eyebrow: 'PvP Hub',
    description: 'Không gian chờ cho matchmaking realtime, xếp hạng và đấu rank nhiều mùa giải.',
  },
  [ROUTES.gacha]: {
    title: 'Scout Capsule',
    eyebrow: 'Recruitment',
    description: 'Roll banner mùa giải, theo dõi pity và chốt kết quả hiếm ngay trong phiên hiện tại.',
  },
  [ROUTES.admin]: {
    title: 'Admin Foundry',
    eyebrow: 'Back Office',
    description: 'Tạo cầu thủ mới, kiểm tra pool quốc gia và rà soát dữ liệu nguồn cho hệ thống.',
  },
}

const navHints: Record<string, string> = {
  [ROUTES.club]: 'Tổng quan CLB',
  [ROUTES.players]: 'Nâng cấp thẻ',
  [ROUTES.tactics]: 'Preset đội hình',
  [ROUTES.aiMatch]: '50 stage',
  [ROUTES.pvp]: 'Xếp hạng',
  [ROUTES.gacha]: 'Banner roll',
  [ROUTES.admin]: 'Quản trị dữ liệu',
}

export function AppLayout() {
  const { session, setSession, isAdmin } = useAuth()
  const { data: sessionData, isLoading } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname

  const items = navItems(isAdmin)
  const meta = routeMeta[pathname] ?? routeMeta[ROUTES.club]
  const clubName = sessionData?.team?.clubName ?? 'Chưa đồng bộ'
  const budget = Number(sessionData?.team?.budget ?? 0).toLocaleString()
  const rankPoint = Number(sessionData?.team?.rankPoint ?? 0)

  function handleLogout() {
    setSession(null)
    queryClient.clear()
    navigate(ROUTES.login, { replace: true })
  }

  return (
    <main className="app-shell">
      <div className="app-shell__inner space-y-6">
        <section className="game-panel game-panel--accent scan-line overflow-hidden">
          <div className="game-panel__content grid gap-6 px-5 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-7 lg:py-7">
            <div className="space-y-5">
              <div className="game-header-kicker">
                <span className="pulse-dot" />
                FIFAM Live Club Hub
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-100/70">{meta.eyebrow}</p>
                <h1 className="game-header-title text-shadow-soft text-white">{meta.title}</h1>
                <p className="game-copy mt-4 max-w-3xl text-base sm:text-lg">{meta.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="game-stat-card floating-card">
                  <p className="game-stat-card__label">Manager</p>
                  <p className="game-stat-card__value">{session?.user?.username}</p>
                  <p className="game-stat-card__hint">Vai trò {isAdmin ? 'Admin' : 'User'}</p>
                </div>
                <div className="game-stat-card">
                  <p className="game-stat-card__label">Club Budget</p>
                  <p className="game-stat-card__value">{budget}</p>
                  <p className="game-stat-card__hint">coins khả dụng</p>
                </div>
                <div className="game-stat-card">
                  <p className="game-stat-card__label">Rank Power</p>
                  <p className="game-stat-card__value">{rankPoint}</p>
                  <p className="game-stat-card__hint">điểm tích lũy mùa</p>
                </div>
              </div>

              <nav className="game-nav">
                {items.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    data-active={pathname === item.path}
                    onClick={() => navigate(item.path)}
                    className="game-nav-button min-w-[150px] flex-1"
                  >
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                      {navHints[item.path] ?? 'Module'}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">{item.label}</div>
                  </button>
                ))}
              </nav>
            </div>

            <aside className="space-y-4">
              <div className="game-panel game-panel--soft overflow-hidden rounded-[24px] border border-white/8 p-4">
                <div className="game-panel__content">
                  <p className="game-header-kicker">Session Radar</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-200">
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <span className="text-slate-400">CLB hiện tại</span>
                      <strong className="text-white">{clubName}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <span className="text-slate-400">Path</span>
                      <strong className="text-cyan-100">{pathname}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <span className="text-slate-400">API sync</span>
                      <strong className="text-emerald-300">{isLoading ? 'Syncing' : 'Ready'}</strong>
                    </div>
                  </div>
                  <button type="button" onClick={handleLogout} className="game-button-primary mt-4 w-full">
                    Return To Login
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  ['Mission', 'Xoay vòng giữa CLB, tactics, squad và match mà không reload app.'],
                  ['Reward Loop', 'Campaign AI, gacha và nâng cấp cầu thủ đang nối vào dữ liệu thật.'],
                  ['Live Ready', 'Shell này đã sẵn cho realtime PvP và event stream sau này.'],
                ].map(([title, text]) => (
                  <div key={title} className="game-stat-card">
                    <p className="game-stat-card__label">{title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <Outlet />
      </div>
    </main>
  )
}
