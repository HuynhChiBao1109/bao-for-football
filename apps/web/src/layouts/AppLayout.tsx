import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { EventPopups } from '../components/ui/EventPopups';
import { AnimatedBackground } from '../components/redlock/RedLockUI';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../routes';

const PLAYER_NAV = [
  { path: ROUTES.club, label: 'Dashboard', icon: 'HB' },
  { path: ROUTES.players, label: 'Players', icon: 'PL' },
  { path: ROUTES.gacha, label: 'Gacha', icon: 'GC' },
  { path: ROUTES.aiMatch, label: 'Campaign', icon: 'ST' },
];

export function AppLayout() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = isAdmin ? [{ path: ROUTES.admin, label: 'Admin', icon: 'AD' }] : PLAYER_NAV;
  const isClubScreen = !isAdmin && location.pathname === ROUTES.club;
  const isMatchScreen = location.pathname.startsWith('/match/live/');
  const hideAppChrome = isClubScreen || isMatchScreen;

  return (
    <main className={`app-shell redlock-shell${hideAppChrome ? ' app-shell--fullscreen' : ''}`}>
      <AnimatedBackground />
      <EventPopups />
      {hideAppChrome ? null : (
        <header className="redlock-topbar">
          <div className="redlock-brand" aria-label="RedLock">
            REDLOCK
            <small>Survival Football Academy</small>
          </div>
          <span className="redlock-badge redlock-badge--dark">Ego Protocol Online</span>
        </header>
      )}
      <div className={`app-shell__inner${hideAppChrome ? ' app-shell__inner--fullscreen' : ''}`}>
        <Outlet />
      </div>
      {hideAppChrome ? null : (
        <nav className="app-bottom-nav" aria-label="Main navigation">
          {items.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <button
                key={item.path}
                type="button"
                className="app-bottom-nav__button"
                data-active={active}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                title={item.label}
              >
                <span>{item.icon}</span>
              </button>
            );
          })}
        </nav>
      )}
    </main>
  );
}
