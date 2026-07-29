import { Outlet, useLocation } from 'react-router-dom';
import { EventPopups } from '../components/ui/EventPopups';
import { AnimatedBackground } from '../components/redlock/RedLockUI';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../routes';

export function AppLayout() {
  const { isAdmin } = useAuth();
  const location = useLocation();
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
    </main>
  );
}
