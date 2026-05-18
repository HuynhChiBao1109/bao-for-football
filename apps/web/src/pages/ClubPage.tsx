import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSession } from '../hooks/useSession'
import { useClubDetail } from '../hooks/useClubDetail'
import { ROUTES } from '../routes'
import { Banner } from '../components/ui/Banner'

export function ClubPage() {
  const { token } = useAuth()
  const { data: sessionData, isLoading: sessionLoading } = useSession()
  const navigate = useNavigate()

  const team = sessionData?.team ?? null
  const clubId = team?.clubId

  const { data: club, isLoading: clubLoading, error: clubError } = useClubDetail(clubId)

  const loading = sessionLoading || clubLoading

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="game-header-kicker">Club Command</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">Bản đồ vận hành câu lạc bộ hiện tại</h2>
              <p className="game-copy mt-3 max-w-2xl text-base">
                Đây là nơi theo dõi tình trạng đội bóng của user: ngân sách, điểm rank, đội khởi đầu và đường tắt sang các module phát triển đội hình.
              </p>
            </div>
            {clubId ? <span className="game-chip">Club ID #{clubId}</span> : null}
          </div>

          {loading && <Banner text="Đang tải dữ liệu đội bóng từ service-core..." tone="info" />}
          {clubError && <Banner text={(clubError as Error).message} tone="error" />}

          {!loading && !team && (
            <Banner text="Tài khoản hiện tại chưa có đội bóng được gán. Hãy đăng ký tài khoản người chơi để có đội hình khởi tạo." tone="muted" />
          )}

          {!loading && team && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard label="Tên CLB người chơi" value={team.clubName ?? 'Chưa đặt tên'} />
              <InfoCard label="Ngân sách" value={Number(team.budget ?? 0).toLocaleString()} />
              <InfoCard label="Điểm rank" value={String(team.rankPoint ?? 0)} />
              <InfoCard label="Tactics Team ID" value={team.tacticsTeamId ?? 'N/A'} />
            </div>
          )}

          {!loading && club && (
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
              <div className="game-stat-card">
                <p className="game-stat-card__label text-emerald-300">Starter Club</p>
                <div className="mt-3 flex items-center gap-3">
                  <img src={club.logo ?? '/default-avatar.svg'} alt={club.name} className="h-16 w-16 rounded-2xl bg-white/10 object-contain p-2" />
                  <h3 className="text-3xl font-semibold text-white">{club.name}</h3>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniInfo label="League" value={club.leagueName ?? ''} />
                  <MiniInfo label="Starter Budget" value={Number(club.budget ?? 0).toLocaleString()} />
                  <MiniInfo label="Starter Cards" value="22 cầu thủ mùa thường" />
                </div>
              </div>

              <div className="game-stat-card">
                <p className="game-stat-card__label text-sky-200">Quick Access</p>
                <div className="mt-4 space-y-3">
                  <ActionButton label="Quản lí cầu thủ" description="Xem toàn bộ chỉ số, flag quốc gia, tăng level và cộng điểm nâng cấp cho từng cầu thủ." onClick={() => navigate(ROUTES.players)} />
                  <ActionButton label="Chỉnh chiến thuật đội" description="Đi tới màn tactics và lưu trực tiếp xuống API realtime tactics." onClick={() => navigate(ROUTES.tactics)} />
                  <ActionButton label="Mở đấu với máy" description="Xem mô phỏng trận đấu realtime với sân 22 cầu thủ đang di chuyển." onClick={() => navigate(ROUTES.aiMatch)} />
                  <ActionButton label="Mở gacha cầu thủ" description="Roll trực tiếp bằng user hiện tại qua gacha API." onClick={() => navigate(ROUTES.gacha)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </article>

      <aside className="game-panel overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Club Intel</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p className="game-stat-card">Khi đăng ký, user được gán đội bóng khởi đầu và nhận 22 thẻ cầu thủ mùa thường từ câu lạc bộ đã chọn.</p>
            <p className="game-stat-card">Dữ liệu trên màn này lấy từ hai API thật: session hiện tại và chi tiết câu lạc bộ tương ứng theo team đang gắn với user.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="game-stat-card">
                <p className="game-stat-card__label">Squad Loop</p>
                <p className="mt-2 text-sm text-slate-300">Club → Players → Tactics → Match → Reward → nâng cấp tiếp.</p>
              </div>
              <div className="game-stat-card">
                <p className="game-stat-card__label">Roster Entry</p>
                <p className="mt-2 text-sm text-slate-300">User mới có thể vào ngay player lab sau khi hoàn tất đăng ký.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </section>
  )

  // suppress token lint
  void token
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-stat-card">
      <p className="game-stat-card__label">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-2.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function ActionButton({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-[18px] border border-white/8 bg-black/20 p-3 text-left transition hover:bg-white/5">
      <p className="font-semibold text-white text-sm">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </button>
  )
}
