import { useEffect, useState } from 'react'

import { apiRequest } from './api'
import { ROUTES } from './routes'

function ClubPage({ token, sessionData, onUnauthorized, onNavigate }) {
  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const team = sessionData?.team || null
  const clubId = team?.clubId

  useEffect(() => {
    let cancelled = false

    async function loadClub() {
      if (!clubId) {
        setClub(null)
        return
      }

      setLoading(true)
      setError('')

      try {
        const data = await apiRequest(`/api/v1/clubs/${clubId}`, { token })
        if (!cancelled) {
          setClub(data)
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          onUnauthorized()
          return
        }
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadClub()

    return () => {
      cancelled = true
    }
  }, [clubId, onUnauthorized, token])

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Quản lí đội bóng</p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
              Dữ liệu câu lạc bộ hiện tại từ API
            </h2>
          </div>
          {clubId ? (
            <span className="rounded-full border border-[#2b397f] bg-[#08113a] px-3 py-1 text-xs text-slate-200">
              Club ID #{clubId}
            </span>
          ) : null}
        </div>

        {loading && <StateBox text="Đang tải dữ liệu đội bóng từ service-core..." tone="info" />}
        {error && <StateBox text={error} tone="error" />}

        {!loading && !error && !team && (
          <StateBox
            text="Tài khoản hiện tại chưa có đội bóng được gán. Hãy đăng ký tài khoản người chơi để có đội hình khởi tạo."
            tone="muted"
          />
        )}

        {!loading && !error && team && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Tên CLB người chơi" value={team.clubName || 'Chưa đặt tên'} />
            <InfoCard label="Ngân sách" value={Number(team.budget || 0).toLocaleString()} />
            <InfoCard label="Điểm rank" value={String(team.rankPoint || 0)} />
            <InfoCard label="Đăng nhập bằng" value={sessionData?.user?.isAdmin ? 'Admin' : 'User'} />
          </div>
        )}

        {!loading && !error && club && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#f6d87a]">Starter Club</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{club.name}</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniInfo label="Formation" value={club.formation} />
                <MiniInfo label="League" value={club.leagueName} />
                <MiniInfo label="Starter Budget" value={Number(club.budget || 0).toLocaleString()} />
                <MiniInfo label="Starter Cards" value="22 cầu thủ mùa thường" />
              </div>
            </div>

            <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#f6d87a]">Quick Access</p>
              <div className="mt-4 space-y-3">
                <ActionButton
                  label="Chỉnh chiến thuật đội"
                  description="Đi tới màn tactics và lưu trực tiếp xuống API realtime tactics."
                  onClick={() => onNavigate(ROUTES.tactics)}
                />
                <ActionButton
                  label="Mở đấu với máy"
                  description="Xem mô phỏng trận đấu realtime với sân 22 cầu thủ đang di chuyển."
                  onClick={() => onNavigate(ROUTES.aiMatch)}
                />
                <ActionButton
                  label="Mở gacha cầu thủ"
                  description="Roll trực tiếp bằng user hiện tại qua gacha API."
                  onClick={() => onNavigate(ROUTES.gacha)}
                />
              </div>
            </div>
          </div>
        )}
      </article>

      <aside className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Tổng quan squad</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <p className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-3">
            Khi đăng ký, user được gán đội bóng khởi đầu và nhận 22 thẻ cầu thủ mùa thường từ câu lạc bộ đã chọn.
          </p>
          <p className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-3">
            Dữ liệu trên màn này lấy từ hai API thật: session hiện tại và chi tiết câu lạc bộ tương ứng theo team đang gắn với user.
          </p>
        </div>
      </aside>
    </section>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}

function MiniInfo({ label, value }) {
  return (
    <div className="rounded-xl border border-[#1d275e] bg-[#08113a]/70 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function ActionButton({ label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-[#24306e] bg-black/20 px-4 py-4 text-left transition hover:border-[#4169ff] hover:bg-white/5"
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </button>
  )
}

function StateBox({ text, tone }) {
  const toneClass =
    tone === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : tone === 'info'
        ? 'border-[#24306e] bg-black/20 text-slate-300'
        : 'border-slate-500/30 bg-slate-500/10 text-slate-300'

  return <p className={`mt-5 rounded-2xl border px-4 py-4 text-sm ${toneClass}`}>{text}</p>
}

export default ClubPage