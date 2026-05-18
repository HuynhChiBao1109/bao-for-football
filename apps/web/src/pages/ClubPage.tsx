import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useClubDetail } from '../hooks/useClubDetail'
import { ROUTES } from '../routes'
import { Banner } from '../components/ui/Banner'
import { ClubHeader } from '../components/ui/ClubHeader'
import { ModuleCard } from '../components/ui/ModuleCard'
import './ClubPage.css'

export function ClubPage() {
  const { data: sessionData, isLoading: sessionLoading } = useSession()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')

  const team = sessionData?.team ?? null
  const clubId = team?.clubId

  const { data: club, isLoading: clubLoading, error: clubError } = useClubDetail(clubId)

  const loading = sessionLoading || clubLoading

  return (
    <section className="club-page">
      {/* Background and decorative elements */}
      <div className="club-page__background">
        <div className="club-page__blur-element club-page__blur--1" />
        <div className="club-page__blur-element club-page__blur--2" />
        <div className="club-page__blur-element club-page__blur--3" />
      </div>

      <div className="club-page__content">
        {/* Header section */}
        <div className="club-page__header">
          <p className="game-header-kicker">⚽ Football Manager</p>
          <h1 className="game-title">Trung tâm điều hành CLB</h1>
        </div>

        {/* Status messages */}
        {loading && <Banner text="Đang tải dữ liệu đội bóng từ service-core..." tone="info" />}
        {clubError && <Banner text={(clubError as Error).message} tone="error" />}
        {!loading && !team && (
          <Banner text="Tài khoản hiện tại chưa có đội bóng được gán. Hãy chọn CLB khởi đầu để vào game." tone="muted" />
        )}

        {!loading && team && (
          <>
            {/* Club Header with Logo, Budget, Rank */}
            <ClubHeader
              clubName={team.clubName ?? 'CLB của bạn'}
              clubLogo={club?.logo}
              budget={Number(team.budget ?? 0)}
              rankPoint={Number(team.rankPoint ?? 0)}
            />

            {/* Main grid - 3 columns layout */}
            <div className="club-page__grid">
              {/* Left Column - Team Management */}
              <ModuleCard
                title="Quản lí"
                subtitle="Đội hình"
                icon="👥"
                column="left"
                actions={[
                  {
                    label: 'Quản lí chiến thuật',
                    description: 'Tinh chỉnh đội hình, nhịp độ và preset chiến thuật thi đấu.',
                    icon: '⚙️',
                    onClick: () => navigate(ROUTES.tactics),
                  },
                  {
                    label: 'Quản lí cầu thủ',
                    description: 'Xem stats, nâng cấp level và phân bổ điểm kỹ năng.',
                    icon: '📊',
                    onClick: () => navigate(ROUTES.players),
                  },
                ]}
              />

              {/* Center Column - Matches */}
              <ModuleCard
                title="Thi"
                subtitle="Đấu"
                icon="⚽"
                column="center"
                actions={[
                  {
                    label: 'Campaign',
                    description: 'Vào chuỗi màn AI để farm thưởng và đẩy tiến độ đội.',
                    icon: '🤖',
                    onClick: () => navigate(ROUTES.aiMatch),
                  },
                  {
                    label: 'PvP',
                    description: 'Vào rank match để leo hạng và đối đầu người chơi khác.',
                    icon: '🏆',
                    onClick: () => navigate(ROUTES.pvp),
                  },
                ]}
              />

              {/* Right Column - Shop & Events */}
              <ModuleCard
                title="Cửa"
                subtitle="Hàng"
                icon="🎁"
                column="right"
                actions={[
                  {
                    label: 'Gacha',
                    description: 'Roll banner cầu thủ trực tiếp với tài khoản hiện tại.',
                    icon: '✨',
                    onClick: () => navigate(ROUTES.gacha),
                  },
                  {
                    label: 'Shop',
                    description: 'Mua bán vật phẩm và nâng cấp trang bị cho đội.',
                    icon: '🛒',
                    onClick: () => setNotice('Mục Mua sắm đang phát triển, vui lòng quay lại sau.'),
                  },
                  {
                    label: 'Events',
                    description: 'Sự kiện theo mùa với phần thưởng hấp dẫn.',
                    icon: '🎪',
                    onClick: () => setNotice('Mục Events đang phát triển, vui lòng quay lại sau.'),
                  },
                  {
                    label: 'Gacha',
                    description: 'Roll banner cầu thủ trực tiếp với tài khoản hiện tại.',
                    icon: '✨',
                    onClick: () => navigate(ROUTES.gacha),
                  },
                  {
                    label: 'Shop',
                    description: 'Mua bán vật phẩm và nâng cấp trang bị cho đội.',
                    icon: '🛒',
                    onClick: () => setNotice('Mục Mua sắm đang phát triển, vui lòng quay lại sau.'),
                  },
                  {
                    label: 'Events',
                    description: 'Sự kiện theo mùa với phần thưởng hấp dẫn.',
                    icon: '🎪',
                    onClick: () => setNotice('Mục Events đang phát triển, vui lòng quay lại sau.'),
                  },
                ]}
              />
            </div>

            {/* Notification banner */}
            {notice && <Banner text={notice} tone="muted" />}
          </>
        )}
      </div>
    </section>
  )
}
