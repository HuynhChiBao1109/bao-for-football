import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { EventPopups } from '../components/ui/EventPopups';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../routes';

const PLAYER_NAV = [
  { path: ROUTES.club, label: 'Dashboard', icon: 'HB' },
  { path: ROUTES.players, label: 'Players', icon: 'PL' },
  { path: ROUTES.tactics, label: 'Tactics', icon: 'TX' },
  { path: ROUTES.gacha, label: 'Gacha', icon: 'GC' },
  { path: ROUTES.aiMatch, label: 'Campaign', icon: 'ST' },
];

export function AppLayout() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = isAdmin ? [{ path: ROUTES.admin, label: 'Admin', icon: 'AD' }] : PLAYER_NAV;
  const isClubScreen = !isAdmin && location.pathname === ROUTES.club;

  return (
    <main className={`app-shell wuxia-shell${isClubScreen ? ' app-shell--fullscreen' : ''}`}>
      <div className="wuxia-shell__mist" aria-hidden="true" />
      <div className="wuxia-shell__flare wuxia-shell__flare--left" aria-hidden="true" />
      <div className="wuxia-shell__flare wuxia-shell__flare--right" aria-hidden="true" />
      <EventPopups />
      <div className={`app-shell__inner${isClubScreen ? ' app-shell__inner--fullscreen' : ''}`}>
        <Outlet />
      </div>
      {isClubScreen ? null : (
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
