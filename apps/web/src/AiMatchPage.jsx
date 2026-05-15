import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "./api";
import MatchView from "./MatchView.jsx";

function AiMatchPage({ token, onUnauthorized }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [isFighting, setIsFighting] = useState(false);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

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
    setError("");

    try {
      const payload = await apiRequest("/api/v1/ai/stages", { token });
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setStages(list);

      if (list.length > 0) {
        const firstPlayable = list.find(
          (stage) => stage.isUnlocked && !stage.isCleared,
        );
        const firstUnlocked = list.find((stage) => stage.isUnlocked);
        const preferred = firstPlayable || firstUnlocked;
        if (preferred) {
          setSelectedLevel((current) => {
            const exists = list.some((item) => item.stageNo === current);
            if (!exists) {
              return preferred.stageNo;
            }

            const currentStage = list.find((item) => item.stageNo === current);
            if (
              currentStage &&
              currentStage.isUnlocked &&
              !currentStage.isCleared
            ) {
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
    setError("");

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
    setError("");
    setResultMessage("");

    try {
      const payload = await apiRequest(`/api/v1/ai/stages/${stageNo}/result`, {
        method: "POST",
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
        setResultMessage(
          `Bạn đã thua màn ${stageNo}. Hãy thử lại để mở khóa màn mới.`,
        );
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

    await submitStageResult(selected.stageNo, Boolean(result?.didWin));
  }

  if (loading) {
    return (
      <p className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-4 text-sm text-slate-300">
        Đang tải danh sách 50 màn...
      </p>
    );
  }

  if (!selected) {
    return (
      <p className="rounded-2xl border border-slate-500/30 bg-slate-500/10 px-4 py-4 text-sm text-slate-300">
        Chưa có dữ liệu màn AI.
      </p>
    );
  }

  if (isFighting) {
    return (
      <section className="space-y-4">
        <div className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-4 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Đấu với máy
              </p>
              <h2 className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-white">
                Màn {selected.stageNo}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Đối thủ: {selected.clubName} • Buff chỉ số +
                {selected.enemyStatBonus}. Thắng nhận{" "}
                {Number(selected.rewardMoney || 0).toLocaleString()} tiền +{" "}
                {selected.rewardExp} EXP.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsFighting(false)}
              className="rounded-xl border border-[#2a387e] bg-black/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[#4169ff] hover:bg-white/5"
            >
              Quay lại chọn màn
            </button>
          </div>
        </div>

        <MatchView embedded onMatchEnd={handleMatchEnd} />

        <div className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
          <p className="text-sm text-slate-300">
            Kết quả trận sẽ được tự động chốt khi nhận event{" "}
            <span className="font-semibold text-white">match_end</span> từ match
            engine.
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Trạng thái hiện tại:{" "}
            <span className="font-semibold text-[#f6d87a]">
              {submittingResult
                ? "Đang cập nhật thắng/thua và cộng thưởng..."
                : "Đang chờ trận kết thúc"}
            </span>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Đấu với máy
            </p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
              50 màn campaign theo tiến trình thắng-thua
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Phải thắng màn hiện tại mới mở màn tiếp theo. Mỗi màn có đối thủ
              CLB random và đội hình 22 cầu thủ với chỉ số tăng dần theo màn.
            </p>
          </div>

          <div className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-3 text-sm text-slate-300">
            Màn đang chọn:{" "}
            <span className="font-semibold text-[#f6d87a]">
              {selected.stageNo}
            </span>
          </div>
        </div>

        {resultMessage && (
          <p className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {resultMessage}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

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
                    ? "cursor-not-allowed border-slate-700/70 bg-slate-900/40 text-slate-500"
                    : completed
                      ? "cursor-not-allowed border-slate-700/80 bg-slate-900/45 text-slate-500 grayscale"
                      : active
                        ? "border-[#3f63ff] bg-[#0c1d69] text-white shadow-[0_18px_34px_-20px_rgba(27,68,255,0.9)] ring-2 ring-[#5376ff]/70"
                        : "border-[#2c3b80] bg-[#050d30] text-slate-200 hover:border-[#4a6dff] hover:bg-[#0b1a54] hover:text-white"
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
                    ? "Đã hoàn thành (khóa)"
                    : locked
                      ? "Chưa mở khóa"
                      : "Sẵn sàng thi đấu"}
                </p>

                {!disabled && (
                  <p className="mt-3 inline-flex rounded-lg border border-[#6a86ff]/70 bg-[#1431a6] px-2.5 py-1 text-xs font-semibold tracking-wide text-white">
                    Chọn màn này
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#f6d87a]">
              Thông tin màn
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              Màn {selected.stageNo} • {selected.clubName}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Buff chỉ số đối thủ: +{selected.enemyStatBonus}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Tiến độ: {selected.wins}/{Math.max(selected.attempts, 1)} trận
              thắng trong {selected.attempts} lần thử
            </p>

            <button
              type="button"
              disabled={!selected.isUnlocked || selected.isCleared}
              onClick={() => {
                setResultMessage("");
                setIsFighting(true);
              }}
              className="mt-4 w-full rounded-xl border border-[#607bff] bg-[linear-gradient(180deg,#1d3fd4_0%,#0e237f_100%)] px-4 py-3.5 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-slate-700/70 disabled:bg-slate-900/50 disabled:text-slate-400"
            >
              {selected.isCleared
                ? `Màn ${selected.stageNo} đã hoàn thành`
                : `Vào thi đấu màn ${selected.stageNo}`}
            </button>

            {selected.isCleared && (
              <p className="mt-2 text-xs text-slate-400">
                Màn đã qua sẽ được làm xám và không thể bấm lại. Hãy chọn màn
                chưa hoàn thành.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#f6d87a]">
              Đội hình đối thủ (22 cầu thủ)
            </p>
            {detailLoading ? (
              <p className="mt-3 text-sm text-slate-300">
                Đang tải đội hình đối thủ...
              </p>
            ) : (
              <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {(selectedDetail?.opponent || []).map((player, idx) => (
                  <div
                    key={`${player.name}-${idx}`}
                    className="rounded-xl border border-[#1d275e] bg-[#08113a]/70 px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-white">
                      {idx + 1}. {player.name} ({player.role})
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      S{player.shooting} P{player.passing} Pa{player.pace} Ph
                      {player.physical} D{player.defending} Dr{player.dribbling}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

export default AiMatchPage;
