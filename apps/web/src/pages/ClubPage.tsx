import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner } from '../components/feedback';
import { useAuth } from '../hooks/useAuth';
import { useSession } from '../hooks/useSession';
import { queryClient } from '../lib/queryClient';
import { ROUTES } from '../routes';
import './ClubPage.css';

type DockAction = {
  label: string;
  icon: string;
  onClick: () => void;
};

export function ClubPage() {
  const { data: sessionData, isLoading } = useSession();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const [startOpen, setStartOpen] = useState(false);

  const team = sessionData?.team ?? null;
  const userName = sessionData?.user?.userName || 'Player';

  function handleLogout() {
    setSession(null);
    queryClient.clear();
    navigate(ROUTES.login, { replace: true });
  }

  const leftActions: DockAction[] = [
    { label: 'Events', icon: 'EV', onClick: () => setNotice('Events dang cap nhat.') },
    { label: 'Shop', icon: 'SP', onClick: () => setNotice('Shop dang cap nhat.') },
  ];
  const rightActions: DockAction[] = [
    { label: 'Gacha', icon: 'GC', onClick: () => navigate(ROUTES.gacha) },
  ];

  if (isLoading) {
    return (
      <section className="club-dashboard club-dashboard--loading">
        <div className="club-dashboard__loader" />
      </section>
    );
  }

  if (!team) {
    return (
      <section className="club-dashboard club-dashboard--empty">
        <Banner text="Chua co team. Hay chon CLB khoi dau de vao game." tone="muted" />
      </section>
    );
  }

  return (
    <section className="club-dashboard">
      <div className="club-dashboard__field" aria-hidden="true" />
      <div className="club-dashboard__player" aria-hidden="true" />
      <div className="club-dashboard__scan" aria-hidden="true" />

      <header className="club-dashboard__top">
        <button
          type="button"
          className="club-icon-button club-icon-button--user"
          onClick={() => navigate(ROUTES.players)}
          aria-label="Players"
          title="Players"
        >
          <img src={team.imgUrl || '/app/logo.png'} alt="" />
        </button>
        <button
          type="button"
          className="club-icon-button club-icon-button--small"
          onClick={handleLogout}
          aria-label="Logout"
          title="Logout"
        >
          <span>ON</span>
        </button>
      </header>

      <div className="club-dashboard__identity">
        <p>{userName}</p>
        <strong>{team.teamName}</strong>
      </div>

      <nav className="club-dashboard__side club-dashboard__side--left" aria-label="Events and shop">
        {leftActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="club-orbit-button"
            style={{ animationDelay: `${index * 90}ms` }}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <span>{action.icon}</span>
          </button>
        ))}
      </nav>

      <nav className="club-dashboard__side club-dashboard__side--right" aria-label="Gacha">
        {rightActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="club-orbit-button club-orbit-button--gold"
            style={{ animationDelay: `${index * 90}ms` }}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <span>{action.icon}</span>
          </button>
        ))}
      </nav>

      <div className="club-dashboard__bottom">
        {startOpen ? (
          <div className="club-start-menu" role="menu">
            <button type="button" onClick={() => navigate(ROUTES.aiMatch)} role="menuitem">
              Campaign
            </button>
            <button type="button" onClick={() => navigate(ROUTES.pvp)} role="menuitem">
              PvP
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="club-start-button"
          onClick={() => setStartOpen((value) => !value)}
          aria-expanded={startOpen}
        >
          START
        </button>
      </div>

      {notice ? (
        <button type="button" className="club-toast" onClick={() => setNotice('')}>
          {notice}
        </button>
      ) : null}
    </section>
  );
}
