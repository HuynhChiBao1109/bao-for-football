import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <main className="app-shell">
      <div className="app-shell__inner space-y-6">
        <Outlet />
      </div>
    </main>
  );
}
