export function PvpPage() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">PvP Arena</p>
          <h2 className="game-title mt-3 text-3xl font-bold text-white">
            Queue rank và đối kháng thời gian thực
          </h2>
          <p className="game-copy mt-3 max-w-2xl text-base">
            Phần này đang đóng vai trò lobby cạnh tranh: chọn ladder, đọc luật mùa và chờ hook
            realtime matchmaking khi backend sẵn sàng.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ['Tier Ladder', 'Nghiệp dư đến siêu sao, mỗi 10 trận là một chu kỳ leo hạng.'],
              ['Promotion Rule', 'Thắng tối thiểu 6/10 trận để đi tiếp lên tier cao hơn.'],
              [
                'Live Matchmaking',
                'Route đã cố định, có thể nối queue realtime mà không thay shell UI.',
              ],
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
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Realtime matchmaking chưa được bật, nhưng toàn bộ khu vực queue, rank badge và rule
              display đã sẵn để nối thẳng vào hub websocket.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="game-stat-card">
              <p className="game-stat-card__label">Expected Flow</p>
              <p className="mt-2 text-sm text-slate-300">
                Join queue, match found, sync đội hình, mở match scene.
              </p>
            </div>
            <div className="game-stat-card">
              <p className="game-stat-card__label">UI Intent</p>
              <p className="mt-2 text-sm text-slate-300">
                Giữ cảm giác một game manager online thay vì dashboard CRUD.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
