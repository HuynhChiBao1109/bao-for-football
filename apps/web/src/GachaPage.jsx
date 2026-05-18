import { useState } from 'react';

import { apiRequest } from './api';

function GachaPage({ token, sessionData, onUnauthorized }) {
  const [bannerCode, setBannerCode] = useState('special-season');
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const userId = sessionData?.user?.id;

  async function rollOnce() {
    if (!userId) {
      setError('Không tìm thấy user hiện tại để thực hiện roll.');
      return;
    }

    setRolling(true);
    setError('');

    try {
      const payload = await apiRequest('/api/v1/gacha/roll', {
        method: 'POST',
        token,
        body: {
          userId,
          bannerCode,
        },
      });

      const nextResult = payload?.data || null;
      setResult(nextResult);
      setHistory((current) => [nextResult, ...current].filter(Boolean).slice(0, 6));
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized();
        return;
      }
      setError(err.message);
    } finally {
      setRolling(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Scout Capsule</p>
          <h2 className="game-title mt-3 text-3xl font-bold text-white">
            Phòng quay tuyển trạch cầu thủ
          </h2>
          <p className="game-copy mt-3 max-w-2xl text-base">
            Chọn banner, nổ capsule và xem ngay rarity cùng trạng thái pity của user hiện tại mà
            không cần rời khỏi game shell.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
            <div className="game-stat-card">
              <label className="block">
                <span className="game-field-label">Banner Code</span>
                <input
                  value={bannerCode}
                  onChange={(event) => setBannerCode(event.target.value)}
                  className="game-input"
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3">
                  <p className="game-field-label mb-0">Current User</p>
                  <p className="mt-2 text-lg font-semibold text-white">#{userId || 'N/A'}</p>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3">
                  <p className="game-field-label mb-0">Session History</p>
                  <p className="mt-2 text-lg font-semibold text-white">{history.length}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={rollOnce}
                disabled={rolling || !bannerCode.trim()}
                className="game-button-primary mt-4 w-full"
              >
                {rolling ? 'Rolling...' : 'Roll Player'}
              </button>

              {error && <p className="game-notice game-notice--error mt-4">{error}</p>}
            </div>

            <div className="game-stat-card">
              {!result ? (
                <p className="rounded-[18px] border border-dashed border-white/12 bg-black/20 px-4 py-10 text-center text-sm text-slate-400">
                  Chưa có lượt quay nào trong phiên này. Hãy chọn banner rồi roll để xem kết quả API
                  trả về.
                </p>
              ) : (
                <div>
                  <p className="game-stat-card__label text-amber-200">Latest Roll</p>
                  <h3 className="mt-3 font-['Orbitron'] text-4xl font-bold text-white">
                    {result.rarity}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">Banner: {result.bannerCode}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Tile label="Season" value={result.season} />
                    <Tile label="Special" value={result.isSpecial ? 'Yes' : 'No'} />
                    <Tile label="Pity Triggered" value={result.isPityTriggered ? 'Yes' : 'No'} />
                    <Tile label="Total Rolls" value={String(result.totalRolls)} />
                    <Tile
                      label="Rolls Since Special"
                      value={String(result.rollsSinceLastSpecial)}
                    />
                    <Tile
                      label="Next Guaranteed Hint"
                      value={result.nextRollGuaranteedHint ? 'Yes' : 'No'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>

      <aside className="game-panel overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Roll History</p>
          <div className="mt-4 space-y-3">
            {history.length === 0 && (
              <p className="rounded-[18px] border border-dashed border-white/12 bg-black/20 px-4 py-5 text-sm text-slate-400">
                Lịch sử roll của phiên hiện tại sẽ hiện ở đây.
              </p>
            )}

            {history.map((item, index) => (
              <div
                key={`${item.bannerCode}-${item.totalRolls}-${index}`}
                className="game-stat-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-white">{item.rarity}</p>
                  <p className="text-xs text-slate-400">Roll #{item.totalRolls}</p>
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  {item.bannerCode} • {item.season}
                </p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}

function Tile({ label, value }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/20 px-3 py-3">
      <p className="game-field-label mb-0">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export default GachaPage;
