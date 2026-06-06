import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../routes';
import { Banner } from '../components/feedback';
import { ClubHeader } from '../components/ui/ClubHeader';
import { ModuleCard } from '../components/ui/ModuleCard';
import { queryClient } from '../lib/queryClient';
import './ClubPage.css';

export function ClubPage() {
  const { data: sessionData, isLoading: sessionLoading } = useSession();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');

  const team = sessionData?.team ?? null;
  const loading = sessionLoading;

  function handleLogout() {
    setSession(null);
    queryClient.clear();
    navigate(ROUTES.login, { replace: true });
  }

  return (
    <section className="club-page">
      <div className="club-page__content">
        <div className="club-page__header">
          <div>
            <p className="game-header-kicker">Blue Lock Hub</p>
            <h1 className="game-title">Control Room</h1>
          </div>
          <button type="button" onClick={handleLogout} className="game-button-ghost">
            Logout
          </button>
        </div>

        {loading && <Banner text="Đang tải dữ liệu đội bóng từ service-core..." tone="info" />}
        {!loading && !team && (
          <Banner
            text="Tài khoản hiện tại chưa có đội bóng được gán. Hãy chọn CLB khởi đầu để vào game."
            tone="muted"
          />
        )}

        {!loading && team && (
          <>
            <ClubHeader
              clubName={team.teamName ?? 'CLB của bạn'}
              clubLogo={team.imgUrl}
              budget={team.budget ? Number(team.budget) : 0}
              rankPoint={Number(team.rankPoint ?? 0)}
            />

            <div className="club-page__grid">
              <ModuleCard
                title="Build"
                subtitle="Squad Lab"
                icon="🧩"
                column="left"
                actions={[
                  {
                    label: 'Tactics',
                    description: 'Set form va nhip do.',
                    icon: '🎯',
                    onClick: () => navigate(ROUTES.tactics),
                  },
                  {
                    label: 'Players',
                    description: 'Nang cap va chia stat.',
                    icon: '📈',
                    onClick: () => navigate(ROUTES.players),
                  },
                ]}
              />

              <ModuleCard
                title="Battle"
                subtitle="Match Arena"
                icon="🔥"
                column="center"
                actions={[
                  {
                    label: 'AI Campaign',
                    description: 'Farm nhanh theo stage.',
                    icon: '🧠',
                    onClick: () => navigate(ROUTES.aiMatch),
                  },
                  {
                    label: 'League',
                    description: 'Danh gia phong do mua.',
                    icon: '🏟️',
                    onClick: () => navigate(ROUTES.leagueMatch),
                  },
                  {
                    label: 'Championship',
                    description: 'Knock-out lay cup.',
                    icon: '👑',
                    onClick: () => navigate(ROUTES.championShipMatch),
                  },
                  {
                    label: 'PvP',
                    description: 'Leo rank real-time.',
                    icon: '⚔️',
                    onClick: () => navigate(ROUTES.pvp),
                  },
                ]}
              />

              <ModuleCard
                title="Store"
                subtitle="Loot Zone"
                icon="🎁"
                column="right"
                actions={[
                  {
                    label: 'Gacha',
                    description: 'Roll banner ngay.',
                    icon: '✨',
                    onClick: () => navigate(ROUTES.gacha),
                  },
                  {
                    label: 'Shop',
                    description: 'Vat pham va booster.',
                    icon: '🛒',
                    onClick: () => setNotice('Shop dang cap nhat.'),
                  },
                  {
                    label: 'Events',
                    description: 'Quest gioi han mua.',
                    icon: '🎫',
                    onClick: () => setNotice('Events theo mua dang mo rong.'),
                  },
                ]}
              />
            </div>

            {notice && <Banner text={notice} tone="muted" />}
          </>
        )}
      </div>
    </section>
  );
}
