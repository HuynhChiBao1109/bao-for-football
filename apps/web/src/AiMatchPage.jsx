import { useEffect, useMemo, useState } from 'react';

import { apiRequest } from './api';
import MatchView from './MatchView.jsx';

function AiMatchPage({ token, onUnauthorized }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [isFighting, setIsFighting] = useState(false);
  const [startingMatch, setStartingMatch] = useState(false);
  const [activeMatchID, setActiveMatchID] = useState('');
  const [submittingResult, setSubmittingResult] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  useEffect(() => {
    loadStages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLevel > 0) {
      loadStageDetail(selectedLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel]);

  const selected = useMemo(() => {
    return stages.find((stage) => stage.stageNo === selectedLevel) || null;
  }, [selectedLevel, stages]);

  async function loadStages() {
    setLoading(true);
    setError('');

    try {
      const payload = await apiRequest('/api/v1/ai/stages', { token });
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setStages(list);

      if (list.length > 0) {
        const firstPlayable = list.find((stage) => stage.isUnlocked && !stage.isCleared);
        const firstUnlocked = list.find((stage) => stage.isUnlocked);
        const preferred = firstPlayable || firstUnlocked;
        if (preferred) {
          setSelectedLevel((current) => {
            const exists = list.some((item) => item.stageNo === current);
            if (!exists) {
              return preferred.stageNo;
            }

            const currentStage = list.find((item) => item.stageNo === current);
            if (currentStage && currentStage.isUnlocked && !currentStage.isCleared) {
              return current;
            }

            return preferred.stageNo;
          });
        }
      }
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized();
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadStageDetail(stageNo) {
    setDetailLoading(true);
    setError('');

    try {
      const payload = await apiRequest(`/api/v1/ai/stages/${stageNo}`, {
        token,
      });
      setSelectedDetail(payload?.data || null);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized();
        return;
      }
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitStageResult(stageNo, isWin) {
    if (!stageNo) {
      return;
    }

    setSubmittingResult(true);
    setError('');
    setResultMessage('');

    try {
      const payload = await apiRequest(`/api/v1/ai/stages/${stageNo}/result`, {
        method: 'POST',
        token,
        body: { isWin },
      });

      const data = payload?.data;
      if (isWin) {
        const rewardText = `${Number(data?.grantedMoney || 0).toLocaleString()} tiền + ${Number(data?.grantedExpPerPlayer || 0)} EXP x ${Number(data?.rewardedPlayers || 0)} cầu thủ`;
        if (data?.unlockedNext) {
          setResultMessage(
            `Thắng màn ${stageNo}. Nhận ${rewardText}. Đã mở khóa màn ${data.nextUnlockedStage}.`,
          );
        } else {
          setResultMessage(`Thắng màn ${stageNo}. Nhận ${rewardText}.`);
        }
      } else {
        setResultMessage(`Bạn đã thua màn ${stageNo}. Hãy thử lại để mở khóa màn mới.`);
      }

      setIsFighting(false);
      await loadStages();
      await loadStageDetail(stageNo);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized();
        return;
      }
      setError(err.message);
    } finally {
      setSubmittingResult(false);
    }
  }

  async function handleMatchEnd(result) {
    if (submittingResult || !selected) {
      return;
    }

    if (!activeMatchID) {
      setError('Thiếu matchId để chốt kết quả trận đấu.');
      return;
    }

    try {
      await apiRequest(`/api/v1/matches/${activeMatchID}/finalize`, {
        method: 'POST',
        token,
        body: {
          homeScore: Number(result?.home || 0),
          awayScore: Number(result?.away || 0),
          homeStats: result?.homeStats || {},
          awayStats: result?.awayStats || {},
          scorers: Array.isArray(result?.scorers) ? result.scorers : [],
        },
      });
    } catch (err) {
      setError(`Không lưu được lịch sử trận: ${err.message}`);
    }

    await submitStageResult(selected.stageNo, Boolean(result?.didWin));
  }

  async function startCampaignMatch() {
    if (!selected || !selected.isUnlocked || selected.isCleared || startingMatch) {
      return;
    }

    setStartingMatch(true);
    setError('');
    setResultMessage('');

    try {
      const payload = await apiRequest('/api/v1/matches/start', {
        method: 'POST',
        token,
        body: {
          awayClubName: selected.clubName,
          mode: 'ai_campaign',
          stageNo: selected.stageNo,
        },
      });

      const matchID = payload?.data?.matchId;
      if (!matchID) {
        throw new Error('Server không trả về matchId');
      }

      setActiveMatchID(matchID);
      setIsFighting(true);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized();
        return;
      }
      setError(err.message);
    } finally {
      setStartingMatch(false);
    }
  }

  if (loading) {
    return <p className="game-notice game-notice--info">Đang tải danh sách 50 màn...</p>;
  }

  if (!selected) {
    return <p className="game-notice game-notice--muted">Chưa có dữ liệu màn AI.</p>;
  }

  if (isFighting) {
    return (
      <section className="space-y-4">
        <div className="game-panel game-panel--accent overflow-hidden p-4 sm:p-5">
          <div className="game-panel__content">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="game-header-kicker">Campaign Battle</p>
                <h2 className="game-title mt-2 text-3xl font-bold text-white">
                  Màn {selected.stageNo}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Đối thủ: {selected.clubName} • Buff chỉ số +{selected.enemyStatBonus}. Thắng nhận{' '}
                  {Number(selected.rewardMoney || 0).toLocaleString()} tiền + {selected.rewardExp}{' '}
                  EXP.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsFighting(false);
                  setActiveMatchID('');
                }}
                className="game-button-secondary"
              >
                Quay lại chọn màn
              </button>
            </div>
          </div>
        </div>

        <MatchView embedded onMatchEnd={handleMatchEnd} matchId={activeMatchID} />

        <div className="game-panel overflow-hidden p-5">
          <div className="game-panel__content">
            <p className="text-sm text-slate-300">
              Kết quả trận sẽ được tự động chốt khi nhận event{' '}
              <span className="font-semibold text-white">match_end</span> từ match engine.
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Trạng thái hiện tại:{' '}
              <span className="font-semibold text-[#f6d87a]">
                {submittingResult
                  ? 'Đang cập nhật thắng/thua và cộng thưởng...'
                  : 'Đang chờ trận kết thúc'}
              </span>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="game-header-kicker">AI Campaign</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">
                50 màn campaign theo tiến trình thắng-thua
              </h2>
              <p className="game-copy mt-3 max-w-2xl text-base">
                Phải thắng màn hiện tại mới mở màn tiếp theo. Mỗi màn có đối thủ CLB random và đội
                hình 22 cầu thủ với chỉ số tăng dần theo màn.
              </p>
            </div>

            <div className="game-chip">
              Màn đang chọn:{' '}
              <span className="font-semibold text-emerald-300">{selected.stageNo}</span>
            </div>
          </div>

          {resultMessage && (
            <p className="game-notice game-notice--success mt-4">{resultMessage}</p>
          )}
          {error && <p className="game-notice game-notice--error mt-4">{error}</p>}

          <button
            type="button"
            disabled={!selected.isUnlocked || selected.isCleared || startingMatch}
            onClick={startCampaignMatch}
            className="game-button-primary mt-4 w-full disabled:border-slate-700/70 disabled:bg-slate-900/50 disabled:text-slate-400"
          >
            {startingMatch
              ? 'Đang tạo trận...'
              : selected.isCleared
                ? `Màn ${selected.stageNo} đã hoàn thành`
                : `Vào thi đấu màn ${selected.stageNo}`}
          </button>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((item) => {
              const active = item.stageNo === selected.stageNo;
              const locked = !item.isUnlocked;
              const completed = item.isCleared;
              const disabled = locked || completed;
              return (
                <button
                  key={item.stageNo}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedLevel(item.stageNo)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    locked
                      ? 'cursor-not-allowed border-slate-700/70 bg-slate-900/40 text-slate-500'
                      : completed
                        ? 'cursor-not-allowed border-slate-700/80 bg-slate-900/45 text-slate-500 grayscale'
                        : active
                          ? 'border-emerald-300/50 bg-[linear-gradient(180deg,rgba(14,70,58,0.95),rgba(8,24,36,0.95))] text-white shadow-[0_18px_34px_-20px_rgba(52,211,153,0.62)] ring-2 ring-emerald-200/30'
                          : 'border-white/10 bg-[rgba(8,20,34,0.88)] text-slate-200 hover:border-emerald-300/30 hover:bg-[rgba(11,28,42,0.96)] hover:text-white'
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.14em] opacity-80">
                    Màn {item.stageNo}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {Number(item.rewardMoney || 0).toLocaleString()} tiền
                  </p>
                  <p className="mt-1 text-sm">+ {item.rewardExp} EXP / cầu thủ</p>
                  <p className="mt-1 text-xs">
                    {completed
                      ? 'Đã hoàn thành (khóa)'
                      : locked
                        ? 'Chưa mở khóa'
                        : 'Sẵn sàng thi đấu'}
                  </p>

                  {!disabled && (
                    <p className="mt-3 inline-flex rounded-lg border border-emerald-300/40 bg-emerald-400/20 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-100">
                      Chọn màn này
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="game-stat-card">
              <p className="game-stat-card__label text-amber-200">Thông tin màn</p>
              <p className="mt-2 text-lg font-semibold text-white">
                Màn {selected.stageNo} • {selected.clubName}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Buff chỉ số đối thủ: +{selected.enemyStatBonus}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Tiến độ: {selected.wins}/{Math.max(selected.attempts, 1)} trận thắng trong{' '}
                {selected.attempts} lần thử
              </p>

              {selected.isCleared && (
                <p className="mt-2 text-xs text-slate-400">
                  Màn đã qua sẽ được làm xám và không thể bấm lại. Hãy chọn màn chưa hoàn thành.
                </p>
              )}
            </div>

            <div className="game-stat-card">
              <p className="game-stat-card__label text-sky-200">Đội hình đối thủ (22 cầu thủ)</p>
              {detailLoading ? (
                <p className="mt-3 text-sm text-slate-300">Đang tải đội hình đối thủ...</p>
              ) : (
                <div className="game-scroll mt-3 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                  {(selectedDetail?.opponent || []).map((player, idx) => (
                    <div
                      key={`${player.name}-${idx}`}
                      className="rounded-[16px] border border-white/8 bg-black/20 px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-white">
                        {idx + 1}. {player.name} ({player.role})
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        S{player.shooting} P{player.passing} Pa{player.pace} Ph
                        {player.physical} D{player.defending} Dr
                        {player.dribbling}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

export default AiMatchPage;
