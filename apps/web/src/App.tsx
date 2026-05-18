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

function App() {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect authenticated users away from login
  useEffect(() => {
    if (
      session &&
      (location.pathname === ROUTES.login || location.pathname === ROUTES.adminLogin)
    ) {
      navigate(isAdmin ? ROUTES.admin : ROUTES.club, { replace: true });
    }
  }, [session, isAdmin, location.pathname, navigate]);

  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.adminLogin} element={<AdminLoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
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
