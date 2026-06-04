import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { AdminLoginPage, AdminPage } from './pages/admin';
import { ClubPage } from './pages/ClubPage';
import { PlayersPage } from './pages/PlayersPage';
import { TacticsPage } from './pages/TacticsPage';
import { GachaPage } from './pages/GachaPage';
import { AiMatchPage } from './pages/AiMatchPage';
import { PvpPage } from './pages/PvpPage';
import { TeamSetupPage } from './pages/TeamSetupPage';
import { useSession } from './hooks/useSession';
import { useSocketSession } from './hooks/useSocketSession';
import { ROUTES } from './routes';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, isAdmin } = useAuth();
  if (!session) return <Navigate to={ROUTES.login} replace />;
  if (!isAdmin) return <Navigate to={ROUTES.club} replace />;
  return <>{children}</>;
}

function RequireStarterTeam({ children }: { children: React.ReactNode }) {
  const { session, isAdmin } = useAuth();
  const { data: sessionData, isLoading } = useSession();
  const location = useLocation();

  if (!session || isAdmin) {
    return <>{children}</>;
  }

  const isTeamSetupPath = location.pathname === ROUTES.teamSetup;
  const hasAssignedTeam = Boolean(sessionData?.team);

  if (isLoading && !sessionData) {
    return (
      <main className="app-shell auth-popup-shell">
        <div className="app-shell__inner auth-popup-shell__inner">
          <section className="game-panel game-panel--accent p-6 text-center">
            <div className="game-panel__content">
              <p className="game-copy">Dang tai du lieu tai khoan...</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!hasAssignedTeam && !isTeamSetupPath) {
    return <Navigate to={ROUTES.teamSetup} replace />;
  }

  if (hasAssignedTeam && isTeamSetupPath) {
    return <Navigate to={ROUTES.club} replace />;
  }

  return <>{children}</>;
}

function App() {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useSocketSession();

  // Redirect authenticated users away from login
  useEffect(() => {
    if (
      session &&
      (location.pathname === ROUTES.login || location.pathname === ROUTES.adminLogin)
    ) {
      navigate(isAdmin ? ROUTES.admin : ROUTES.teamSetup, { replace: true });
    }
  }, [session, isAdmin, location.pathname, navigate]);

  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.adminLogin} element={<AdminLoginPage />} />

      <Route
        element={
          <RequireAuth>
            <RequireStarterTeam>
              <AppLayout />
            </RequireStarterTeam>
          </RequireAuth>
        }
      >
        <Route path={ROUTES.teamSetup} element={<TeamSetupPage />} />
        <Route path={ROUTES.club} element={<ClubPage />} />
        <Route path={ROUTES.players} element={<PlayersPage />} />
        <Route path={ROUTES.tactics} element={<TacticsPage />} />
        <Route path={ROUTES.gacha} element={<GachaPage />} />
        <Route path={ROUTES.aiMatch} element={<AiMatchPage />} />
        <Route path={ROUTES.pvp} element={<PvpPage />} />
        <Route
          path={ROUTES.admin}
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="/" element={<Navigate to={isAdmin ? ROUTES.admin : ROUTES.club} replace />} />
        <Route path="*" element={<Navigate to={isAdmin ? ROUTES.admin : ROUTES.club} replace />} />
      </Route>
    </Routes>
  );
}

export default App;
