export function PvpPage() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">PvP Arena</p>
          <h2 className="game-title mt-3 text-3xl font-bold text-white">Rank Queue</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ['Tier', '10 tran / cycle'],
              ['Promote', 'Can 6/10 tran'],
              ['Realtime', 'Cho ket noi queue'],
            ].map(([title, text]) => (
              <div key={title} className="game-stat-card min-h-[150px]">
                <p className="game-stat-card__label">{title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </article>

      <aside className="game-panel overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content space-y-4">
          <p className="game-header-kicker">Queue Status</p>
          <div className="game-stat-card">
            <p className="game-stat-card__label">Current State</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">Matchmaking chua bat.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="game-stat-card">
              <p className="game-stat-card__label">Expected Flow</p>
              <p className="mt-2 text-sm text-slate-300">
                Queue {'->'} Match {'->'} Scene.
              </p>
            </div>
            <div className="game-stat-card">
              <p className="game-stat-card__label">UI Intent</p>
              <p className="mt-2 text-sm text-slate-300">Toc do, gon, canh tranh.</p>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
