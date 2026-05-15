import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "./api";

const defaultAllocate = {
  shooting: 0,
  passing: 0,
  pace: 0,
  physical: 0,
  defending: 0,
  dribbling: 0,
};

function PlayerManagementPage({ token, onUnauthorized }) {
  const [cards, setCards] = useState([]);
  const [selectedId, setSelectedId] = useState(0);
  const [allocate, setAllocate] = useState(defaultAllocate);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCards();
  }, []);

  const selectedCard = useMemo(() => {
    if (!Array.isArray(cards) || cards.length === 0) {
      return null;
    }
    return cards.find((item) => item.userPlayerId === selectedId) || cards[0];
  }, [cards, selectedId]);

  const spendPoints = useMemo(() => {
    return (
      Number(allocate.shooting) +
      Number(allocate.passing) +
      Number(allocate.pace) +
      Number(allocate.physical) +
      Number(allocate.defending) +
      Number(allocate.dribbling)
    );
  }, [allocate]);

  async function loadCards() {
    setLoading(true);
    setError("");
    try {
      const payload = await apiRequest("/api/v1/players", { token });
      const nextCards = Array.isArray(payload?.data) ? payload.data : [];
      setCards(nextCards);
      if (nextCards.length > 0) {
        setSelectedId((current) =>
          current ? current : nextCards[0].userPlayerId,
        );
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

  async function handleLevelUp() {
    if (!selectedCard?.userPlayerId) {
      return;
    }

    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = await apiRequest(
        `/api/v1/players/${selectedCard.userPlayerId}/level-up`,
        {
          method: "POST",
          token,
        },
      );
      const updated = payload?.data;
      setCards((current) =>
        current.map((card) =>
          card.userPlayerId === updated.userPlayerId ? updated : card,
        ),
      );
      setMessage("Đã tăng level cầu thủ thành công.");
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized();
        return;
      }
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAllocate(event) {
    event.preventDefault();
    if (!selectedCard?.userPlayerId || spendPoints <= 0) {
      return;
    }

    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = await apiRequest(
        `/api/v1/players/${selectedCard.userPlayerId}/allocate`,
        {
          method: "POST",
          token,
          body: allocate,
        },
      );
      const updated = payload?.data;
      setCards((current) =>
        current.map((card) =>
          card.userPlayerId === updated.userPlayerId ? updated : card,
        ),
      );
      setAllocate(defaultAllocate);
      setMessage("Đã cộng chỉ số cho cầu thủ.");
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized();
        return;
      }
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function updateAllocate(key, value) {
    setAllocate((current) => ({
      ...current,
      [key]: Math.max(0, Number(value) || 0),
    }));
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Player Management
            </p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
              Quản lí cầu thủ, level và chỉ số
            </h2>
          </div>
          <button
            type="button"
            onClick={loadCards}
            className="rounded-xl border border-[#2b397f] bg-[#08113a] px-3 py-2 text-xs text-slate-200 transition hover:border-[#4169ff]"
          >
            Reload
          </button>
        </div>

        {loading && (
          <StateBox tone="info" text="Đang tải danh sách cầu thủ..." />
        )}
        {error && <StateBox tone="error" text={error} />}
        {message && <StateBox tone="success" text={message} />}

        {!loading && !error && cards.length === 0 && (
          <StateBox tone="muted" text="Bạn chưa có cầu thủ nào." />
        )}

        {!loading && cards.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full overflow-hidden rounded-xl border border-[#1d275e] text-left text-sm">
              <thead className="bg-[#08113a] text-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Flag</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Overall</th>
                  <th className="px-4 py-3 font-medium">S/P/Pa/Ph/D/Dr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#15204e] bg-[#040711]">
                {cards.map((card) => (
                  <tr
                    key={card.userPlayerId}
                    onClick={() => setSelectedId(card.userPlayerId)}
                    className={`cursor-pointer transition hover:bg-white/5 ${
                      selectedCard?.userPlayerId === card.userPlayerId
                        ? "bg-[#0a133d]"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      <div>{card.name}</div>
                      <div className="text-xs text-slate-400">
                        {card.baseClub} • {card.season}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      <div className="flex items-center gap-2">
                        {card?.country?.flag ? (
                          <img
                            src={card.country.flag}
                            alt={card.country.name}
                            className="h-4 w-6 rounded-sm object-cover"
                          />
                        ) : (
                          <span className="inline-block h-4 w-6 rounded-sm bg-slate-700" />
                        )}
                        <span>
                          {card?.country?.code || card?.country?.name || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">{card.level}</td>
                    <td className="px-4 py-3 text-slate-200">
                      {Number(card.overall || 0).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {card.totalStats.shooting}/{card.totalStats.passing}/
                      {card.totalStats.pace}/{card.totalStats.physical}/
                      {card.totalStats.defending}/{card.totalStats.dribbling}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <aside className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        {!selectedCard ? (
          <p className="text-sm text-slate-300">
            Chọn một cầu thủ để xem chi tiết.
          </p>
        ) : (
          <>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Card Detail
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {selectedCard.name}
            </h3>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
              {selectedCard?.country?.flag ? (
                <img
                  src={selectedCard.country.flag}
                  alt={selectedCard.country.name}
                  className="h-5 w-7 rounded-sm object-cover"
                />
              ) : (
                <span className="inline-block h-5 w-7 rounded-sm bg-slate-700" />
              )}
              <span>{selectedCard?.country?.name || "-"}</span>
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl border border-[#24306e] bg-black/20 p-4 text-sm text-slate-300">
              <p>
                Level:{" "}
                <span className="font-semibold text-white">
                  {selectedCard.level}/36
                </span>
              </p>
              <p>
                EXP:{" "}
                <span className="font-semibold text-white">
                  {selectedCard.exp}
                </span>{" "}
                / {selectedCard.requiredExpForNextLevel || "MAX"}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-[#1e2b62]">
                <div
                  className="h-full rounded-full bg-[#4169ff]"
                  style={{
                    width: `${Math.min(100, Number(selectedCard.expProgressPercent || 0))}%`,
                  }}
                />
              </div>
              <p>
                Điểm cộng còn lại:{" "}
                <span className="font-semibold text-[#f6d87a]">
                  {selectedCard.currentPoints}
                </span>
              </p>
            </div>

            <button
              type="button"
              disabled={actionLoading || !selectedCard.canLevelUp}
              onClick={handleLevelUp}
              className="mt-4 w-full rounded-xl bg-[#000080] px-4 py-3 font-semibold text-white transition hover:bg-[#1111a8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading
                ? "Processing..."
                : selectedCard.canLevelUp
                  ? "Tăng level"
                  : "Chưa đủ EXP để tăng level"}
            </button>

            <form className="mt-4 space-y-3" onSubmit={handleAllocate}>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Cộng chỉ số
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "shooting",
                  "passing",
                  "pace",
                  "physical",
                  "defending",
                  "dribbling",
                ].map((key) => (
                  <NumberField
                    key={key}
                    label={key}
                    value={allocate[key]}
                    onChange={(value) => updateAllocate(key, value)}
                  />
                ))}
              </div>

              <div className="rounded-xl border border-[#24306e] bg-black/30 px-4 py-3 text-sm text-slate-300">
                Tổng điểm sẽ dùng:{" "}
                <span className="font-semibold text-[#f6d87a]">
                  {spendPoints}
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  actionLoading ||
                  spendPoints <= 0 ||
                  spendPoints > selectedCard.currentPoints
                }
                className="w-full rounded-xl border border-[#4169ff] bg-[#08113a] px-4 py-3 font-semibold text-white transition hover:bg-[#10205f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? "Saving..." : "Áp dụng cộng chỉ số"}
              </button>
            </form>

            <div className="mt-4 rounded-xl border border-[#24306e] bg-black/20 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Base / Bonus / Total</p>
              <p className="mt-2">
                Shooting: {selectedCard.baseStats.shooting} /{" "}
                {selectedCard.bonusStats.shooting} /{" "}
                {selectedCard.totalStats.shooting}
              </p>
              <p>
                Passing: {selectedCard.baseStats.passing} /{" "}
                {selectedCard.bonusStats.passing} /{" "}
                {selectedCard.totalStats.passing}
              </p>
              <p>
                Pace: {selectedCard.baseStats.pace} /{" "}
                {selectedCard.bonusStats.pace} / {selectedCard.totalStats.pace}
              </p>
              <p>
                Physical: {selectedCard.baseStats.physical} /{" "}
                {selectedCard.bonusStats.physical} /{" "}
                {selectedCard.totalStats.physical}
              </p>
              <p>
                Defending: {selectedCard.baseStats.defending} /{" "}
                {selectedCard.bonusStats.defending} /{" "}
                {selectedCard.totalStats.defending}
              </p>
              <p>
                Dribbling: {selectedCard.baseStats.dribbling} /{" "}
                {selectedCard.bonusStats.dribbling} /{" "}
                {selectedCard.totalStats.dribbling}
              </p>
              <p className="mt-2 text-[#f6d87a]">
                Overall: {Number(selectedCard.overall || 0).toFixed(1)}
              </p>
            </div>
          </>
        )}
      </aside>
    </section>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2 text-sm text-white outline-none transition focus:border-[#4169ff]"
      />
    </label>
  );
}

function StateBox({ text, tone }) {
  const toneClass =
    tone === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : tone === "info"
          ? "border-[#24306e] bg-black/20 text-slate-300"
          : "border-slate-500/30 bg-slate-500/10 text-slate-300";

  return (
    <p className={`mt-4 rounded-2xl border px-4 py-4 text-sm ${toneClass}`}>
      {text}
    </p>
  );
}

export default PlayerManagementPage;
