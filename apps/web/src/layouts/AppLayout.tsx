import { Outlet } from 'react-router-dom';
import { EventPopups } from '../components/ui/EventPopups';

export function AppLayout() {
  return (
    <main className="app-shell wuxia-shell">
      <div className="wuxia-shell__mist" aria-hidden="true" />
      <div className="wuxia-shell__flare wuxia-shell__flare--left" aria-hidden="true" />
      <div className="wuxia-shell__flare wuxia-shell__flare--right" aria-hidden="true" />
      <EventPopups />
      <div className="app-shell__inner space-y-6">
        <Outlet />
      </div>
    </main>
  );
}
