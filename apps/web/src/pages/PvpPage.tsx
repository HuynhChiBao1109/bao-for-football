import { RankingBoard, StatusBadge } from '../components/redlock/RedLockUI';

const REDLOCK_RANKINGS = [
  { rank: 1, name: 'Apex Striker', score: 9820, winRate: '82%', goals: 64 },
  { rank: 2, name: 'Crimson Nine', score: 9140, winRate: '77%', goals: 58 },
  { rank: 3, name: 'Zero Angle', score: 8810, winRate: '73%', goals: 51 },
  { rank: 4, name: 'User Squad', score: 7600, winRate: '68%', goals: 39 },
];

export function PvpPage() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="game-header-kicker">RedLock Arena</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">Rank Queue</h2>
            </div>
            <StatusBadge tone="red">Competitive</StatusBadge>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ['Tier', '10 matches per cycle'],
              ['Promote', 'Win 6/10 to climb'],
              ['Realtime', 'Queue connection pending'],
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
          <p className="game-header-kicker">Leaderboard</p>
          <RankingBoard rows={REDLOCK_RANKINGS} />
          <div className="game-stat-card">
            <p className="game-stat-card__label">Current State</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">Matchmaking is not active yet.</p>
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
              <p className="mt-2 text-sm text-slate-300">Fast, sharp, competitive.</p>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
