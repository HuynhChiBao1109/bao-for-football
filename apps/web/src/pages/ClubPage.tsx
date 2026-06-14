import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner } from '../components/feedback';
import { useAuth } from '../hooks/useAuth';
import { useSession } from '../hooks/useSession';
import { queryClient } from '../lib/queryClient';
import { ROUTES } from '../routes';
import './ClubPage.css';

type DockAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: 'cyan' | 'gold' | 'red';
};

export function ClubPage() {
  const { data: sessionData, isLoading } = useSession();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');

  const team = sessionData?.team ?? null;
  const userName = sessionData?.user?.userName || 'Player';

  function handleLogout() {
    setSession(null);
    queryClient.clear();
    navigate(ROUTES.login, { replace: true });
  }

  const leftActions: DockAction[] = [
    { label: 'Events', icon: <CalendarIcon />, onClick: () => setNotice('Events dang cap nhat.') },
    { label: 'Shop', icon: <ShopIcon />, onClick: () => setNotice('Shop dang cap nhat.'), tone: 'gold' },
    { label: 'Lineup', icon: <FormationIcon />, onClick: () => navigate(ROUTES.tactics), tone: 'red' },
  ];
  const rightActions: DockAction[] = [
    { label: 'Players', icon: <PlayersIcon />, onClick: () => navigate(ROUTES.players) },
    { label: 'Gacha', icon: <SparkIcon />, onClick: () => navigate(ROUTES.gacha), tone: 'gold' },
  ];
  const quickActions: DockAction[] = [
    { label: 'Campaign', icon: <WhistleIcon />, onClick: () => navigate(ROUTES.aiMatch), tone: 'gold' },
    { label: 'PvP', icon: <VersusIcon />, onClick: () => navigate(ROUTES.pvp), tone: 'red' },
    { label: 'Lineup', icon: <FormationIcon />, onClick: () => navigate(ROUTES.tactics) },
    { label: 'Shop', icon: <ShopIcon />, onClick: () => setNotice('Shop dang cap nhat.'), tone: 'gold' },
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
          <PowerIcon />
        </button>
      </header>

      <div className="club-dashboard__identity">
        <p>{userName}</p>
        <strong>{team.teamName}</strong>
      </div>

      <nav className="club-dashboard__quick" aria-label="Club actions">
        {quickActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="club-action-card"
            data-tone={action.tone ?? 'cyan'}
            style={{ animationDelay: `${index * 70}ms` }}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <span className="club-action-card__icon">{action.icon}</span>
            <span className="club-action-card__label">{action.label}</span>
          </button>
        ))}
      </nav>

      <nav className="club-dashboard__side club-dashboard__side--left" aria-label="Events and shop">
        {leftActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="club-orbit-button"
            data-tone={action.tone ?? 'cyan'}
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
            className="club-orbit-button"
            data-tone={action.tone ?? 'cyan'}
            style={{ animationDelay: `${index * 90}ms` }}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <span>{action.icon}</span>
          </button>
        ))}
      </nav>

      {notice ? (
        <button type="button" className="club-toast" onClick={() => setNotice('')}>
          {notice}
        </button>
      ) : null}
    </section>
  );
}

function IconShell({ children }: { children: ReactNode }) {
  return (
    <svg className="club-svg-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

function CalendarIcon() {
  return (
    <IconShell>
      <path d="M7 3v3M17 3v3M4.5 9h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 5.5h14v14H5z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 13h2M14 13h2M8 17h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconShell>
  );
}

function ShopIcon() {
  return (
    <IconShell>
      <path d="M6.5 10.5h11l-1 9h-9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconShell>
  );
}

function FormationIcon() {
  return (
    <IconShell>
      <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <circle cx="12" cy="7" r="1.7" fill="currentColor" />
      <circle cx="8" cy="13" r="1.7" fill="currentColor" />
      <circle cx="16" cy="13" r="1.7" fill="currentColor" />
      <circle cx="12" cy="18" r="1.7" fill="currentColor" />
    </IconShell>
  );
}

function PlayersIcon() {
  return (
    <IconShell>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 19c.7-3.2 2.2-5 4.5-5s3.8 1.8 4.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 11.2a2.5 2.5 0 1 0-.5-4.8M15.5 14.2c2 .5 3.3 2 4 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconShell>
  );
}

function SparkIcon() {
  return (
    <IconShell>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" fill="currentColor" />
    </IconShell>
  );
}

function PowerIcon() {
  return (
    <IconShell>
      <path d="M12 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.3 6.8a7 7 0 1 0 9.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconShell>
  );
}

function WhistleIcon() {
  return (
    <IconShell>
      <path d="M4.5 14.5h7.2a4 4 0 1 0 0-8H9.2l-4.7 8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13.5 8.5h6M18 6l2 2.5-2 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconShell>
  );
}

function VersusIcon() {
  return (
    <IconShell>
      <path d="M5 6l4.2 12M10 6L5.8 18M14 6l5 6-5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </IconShell>
  );
}
