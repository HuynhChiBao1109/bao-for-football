import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "./api";

const defaultAllocate = {
  shooting: 0,
  passing: 0,
  longPass: 0,
  vision: 0,
  defensiveAwareness: 0,
  counterAttackAwareness: 0,
  crossbarHandling: 0,
  reflexes: 0,
  aerialCatching: 0,
  duels: 0,
  pace: 0,
  physical: 0,
  defending: 0,
  dribbling: 0,
};

const allocateKeys = [
  "shooting",
  "passing",
  "longPass",
  "vision",
  "defensiveAwareness",
  "counterAttackAwareness",
  "crossbarHandling",
  "reflexes",
  "aerialCatching",
  "duels",
  "pace",
  "physical",
  "defending",
  "dribbling",
];

const statMetas = [
  { key: "shooting", label: "Dứt điểm", allocatable: true },
  { key: "passing", label: "Chuyền ngắn", allocatable: true },
  { key: "longPass", label: "Chuyền dài", allocatable: true },
  { key: "vision", label: "Tầm nhìn", allocatable: true },
  {
    key: "defensiveAwareness",
    label: "Nhận thức phòng ngự",
    allocatable: true,
  },
  {
    key: "counterAttackAwareness",
    label: "Nhận thức phản công",
    allocatable: true,
  },
  { key: "crossbarHandling", label: "Bắt bóng xà", allocatable: true },
  { key: "reflexes", label: "Phản xạ", allocatable: true },
  { key: "aerialCatching", label: "Bắt bóng bổng", allocatable: true },
  { key: "duels", label: "Tranh chấp", allocatable: true },
  { key: "pace", label: "Tốc độ", allocatable: true },
  { key: "physical", label: "Thể chất", allocatable: true },
  { key: "defending", label: "Phòng ngự", allocatable: true },
  { key: "dribbling", label: "Rê bóng", allocatable: true },
];

function buildTargetStats(card) {
  if (!card?.totalStats) {
    return { ...defaultAllocate };
  }

  return allocateKeys.reduce((result, key) => {
    result[key] = Number(card.totalStats[key] || 0);
    return result;
  }, {});
}

function buildDeltaPayload(card, targetStats) {
  if (!card?.totalStats) {
    return { ...defaultAllocate };
  }

  return allocateKeys.reduce((result, key) => {
    result[key] =
      Number(targetStats[key] || 0) - Number(card.totalStats[key] || 0);
    return result;
  }, {});
}

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

  const allocateDelta = useMemo(() => {
    return buildDeltaPayload(selectedCard, allocate);
  }, [selectedCard, allocate]);

  const spendPoints = useMemo(() => {
    return allocateKeys.reduce(
      (sum, key) => sum + Number(allocateDelta[key] || 0),
      0,
    );
  }, [allocateDelta]);

  const projected = useMemo(() => {
    if (!selectedCard) {
      return null;
    }

    const nextBonus = {
      shooting:
        Number(selectedCard.bonusStats.shooting || 0) +
        Number(allocateDelta.shooting || 0),
      passing:
        Number(selectedCard.bonusStats.passing || 0) +
        Number(allocateDelta.passing || 0),
      longPass:
        Number(selectedCard.bonusStats.longPass || 0) +
        Number(allocateDelta.longPass || 0),
      vision:
        Number(selectedCard.bonusStats.vision || 0) +
        Number(allocateDelta.vision || 0),
      defensiveAwareness:
        Number(selectedCard.bonusStats.defensiveAwareness || 0) +
        Number(allocateDelta.defensiveAwareness || 0),
      counterAttackAwareness:
        Number(selectedCard.bonusStats.counterAttackAwareness || 0) +
        Number(allocateDelta.counterAttackAwareness || 0),
      crossbarHandling:
        Number(selectedCard.bonusStats.crossbarHandling || 0) +
        Number(allocateDelta.crossbarHandling || 0),
      reflexes:
        Number(selectedCard.bonusStats.reflexes || 0) +
        Number(allocateDelta.reflexes || 0),
      aerialCatching:
        Number(selectedCard.bonusStats.aerialCatching || 0) +
        Number(allocateDelta.aerialCatching || 0),
      duels:
        Number(selectedCard.bonusStats.duels || 0) +
        Number(allocateDelta.duels || 0),
      pace:
        Number(selectedCard.bonusStats.pace || 0) +
        Number(allocateDelta.pace || 0),
      physical:
        Number(selectedCard.bonusStats.physical || 0) +
        Number(allocateDelta.physical || 0),
      defending:
        Number(selectedCard.bonusStats.defending || 0) +
        Number(allocateDelta.defending || 0),
      dribbling:
        Number(selectedCard.bonusStats.dribbling || 0) +
        Number(allocateDelta.dribbling || 0),
    };

    const hasNegativeBonus = Object.values(nextBonus).some((item) => item < 0);
    const projectedPoints =
      Number(selectedCard.currentPoints || 0) - Number(spendPoints || 0);

    return {
      nextBonus,
      projectedPoints,
      hasNegativeBonus,
      invalid: hasNegativeBonus || projectedPoints < 0,
    };
  }, [selectedCard, allocateDelta, spendPoints]);

  useEffect(() => {
    setAllocate(buildTargetStats(selectedCard));
  }, [selectedCard?.userPlayerId]);

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

  async function handleAllocate(event) {
    event.preventDefault();
    if (!selectedCard?.userPlayerId || spendPoints === 0) {
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
          body: allocateDelta,
        },
      );
      const updated = payload?.data;
      setCards((current) =>
        current.map((card) =>
          card.userPlayerId === updated.userPlayerId ? updated : card,
        ),
      );
      setAllocate(buildTargetStats(updated));
      setMessage(
        spendPoints >= 0
          ? `Đã áp dụng thay đổi chỉ số (-${spendPoints} điểm).`
          : `Đã áp dụng thay đổi chỉ số (+${Math.abs(spendPoints)} điểm hoàn lại).`,
      );
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
      [key]: clampAllocateValue(current, key, Number(value) || 0),
    }));
  }

  function adjustAllocate(key, delta) {
    setAllocate((current) => ({
      ...current,
      [key]: clampAllocateValue(
        current,
        key,
        Number(current[key] || 0) + delta,
      ),
    }));
  }

  function clampAllocateValue(current, key, nextValue) {
    if (!selectedCard || !allocateKeys.includes(key)) {
      return Math.trunc(nextValue);
    }

    const integerValue = Math.trunc(Number(nextValue) || 0);
    const deltaWithoutKey = allocateKeys.reduce((sum, itemKey) => {
      if (itemKey === key) {
        return sum;
      }
      return (
        sum +
        (Number(current[itemKey] || 0) -
          Number(selectedCard.totalStats?.[itemKey] || 0))
      );
    }, 0);

    const minValue = Number(selectedCard.baseStats?.[key] || 0);
    const maxValue =
      Number(selectedCard.totalStats?.[key] || 0) +
      Number(selectedCard.currentPoints || 0) -
      deltaWithoutKey;

    return Math.min(maxValue, Math.max(minValue, integerValue));
  }

  function canIncrease(key) {
    if (!selectedCard || !allocateKeys.includes(key)) {
      return false;
    }

    const currentValue = Number(allocate[key] || 0);
    const nextValue = clampAllocateValue(allocate, key, currentValue + 1);
    return nextValue > currentValue;
  }

  function canDecrease(key) {
    if (!selectedCard || !allocateKeys.includes(key)) {
      return false;
    }

    const currentValue = Number(allocate[key] || 0);
    const nextValue = clampAllocateValue(allocate, key, currentValue - 1);
    return nextValue < currentValue;
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Quản lí cầu thủ
            </p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
              Quản lí cầu thủ, cấp độ và chỉ số
            </h2>
          </div>
          <button
            type="button"
            onClick={loadCards}
            className="rounded-xl border border-[#2b397f] bg-[#08113a] px-3 py-2 text-xs text-slate-200 transition hover:border-[#4169ff]"
          >
            Tải lại
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
                  <th className="px-4 py-3 font-medium">Cầu thủ</th>
                  <th className="px-4 py-3 font-medium">Quốc gia</th>
                  <th className="px-4 py-3 font-medium">Cấp độ</th>
                  <th className="px-4 py-3 font-medium">Chỉ số tổng</th>
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
              Chi tiết thẻ cầu thủ
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
                Cấp độ:{" "}
                <span className="font-semibold text-white">
                  {selectedCard.level}/36
                </span>
              </p>
              <p>
                Kinh nghiệm:{" "}
                <span className="font-semibold text-white">
                  {selectedCard.exp}
                </span>{" "}
                / {selectedCard.requiredExpForNextLevel || "Tối đa"}
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
                Điểm kỹ năng chưa cộng:{" "}
                <span className="font-semibold text-[#f6d87a]">
                  {selectedCard.currentPoints}
                </span>
              </p>
            </div>

            <p className="mt-4 rounded-xl border border-[#24306e] bg-black/20 px-4 py-3 text-sm text-slate-300">
              Cấp độ sẽ tự động tăng khi kinh nghiệm đủ mốc. Bạn chỉ cần dùng
              điểm kỹ năng chưa cộng để nâng chỉ số.
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleAllocate}>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Điều chỉnh chỉ số
              </p>
              <p className="text-xs text-slate-400">
                Mặc định là chỉ số hiện tại của cầu thủ. Nhấn + để tăng, nhấn -
                để giảm phần đã cộng trước đó.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {statMetas
                  .filter((item) => item.allocatable)
                  .map((item) => (
                    <NumberField
                      key={item.key}
                      label={item.label}
                      value={allocate[item.key]}
                      canAdd={canIncrease(item.key)}
                      canSub={canDecrease(item.key)}
                      onAdd={() => adjustAllocate(item.key, 1)}
                      onSub={() => adjustAllocate(item.key, -1)}
                      onChange={(value) => updateAllocate(item.key, value)}
                    />
                  ))}
              </div>

              <div className="rounded-xl border border-[#24306e] bg-black/30 px-4 py-3 text-sm text-slate-300">
                Chênh lệch điểm lần này:{" "}
                <span className="font-semibold text-[#f6d87a]">
                  {spendPoints > 0
                    ? `-${spendPoints}`
                    : `+${Math.abs(spendPoints)}`}
                </span>
                {projected && (
                  <span className="ml-2 text-slate-400">
                    (sau cập nhật còn {projected.projectedPoints} điểm)
                  </span>
                )}
              </div>

              {projected?.hasNegativeBonus && (
                <StateBox
                  tone="error"
                  text="Không thể giảm quá phần chỉ số đã cộng trước đó."
                />
              )}

              {projected && !projected.hasNegativeBonus && (
                <div className="rounded-xl border border-[#24306e] bg-black/20 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-white">
                    Đã cộng trước đó {"->"} Sau khi đổi
                  </p>
                  <p className="mt-2">
                    Dứt điểm: +{selectedCard.bonusStats.shooting} {"->"} +
                    {projected.nextBonus.shooting}
                  </p>
                  <p>
                    Chuyền ngắn: +{selectedCard.bonusStats.passing} {"->"} +
                    {projected.nextBonus.passing}
                  </p>
                  <p>
                    Chuyền dài: +{selectedCard.bonusStats.longPass} {"->"} +
                    {projected.nextBonus.longPass}
                  </p>
                  <p>
                    Tầm nhìn: +{selectedCard.bonusStats.vision} {"->"} +
                    {projected.nextBonus.vision}
                  </p>
                  <p>
                    Nhận thức phòng ngự: +
                    {selectedCard.bonusStats.defensiveAwareness} {"->"} +
                    {projected.nextBonus.defensiveAwareness}
                  </p>
                  <p>
                    Nhận thức phản công: +
                    {selectedCard.bonusStats.counterAttackAwareness} {"->"} +
                    {projected.nextBonus.counterAttackAwareness}
                  </p>
                  <p>
                    Bắt bóng xà: +{selectedCard.bonusStats.crossbarHandling}{" "}
                    {"->"} +{projected.nextBonus.crossbarHandling}
                  </p>
                  <p>
                    Phản xạ: +{selectedCard.bonusStats.reflexes} {"->"} +
                    {projected.nextBonus.reflexes}
                  </p>
                  <p>
                    Bắt bóng bổng: +{selectedCard.bonusStats.aerialCatching}{" "}
                    {"->"} +{projected.nextBonus.aerialCatching}
                  </p>
                  <p>
                    Tranh chấp: +{selectedCard.bonusStats.duels} {"->"} +
                    {projected.nextBonus.duels}
                  </p>
                  <p>
                    Tốc độ: +{selectedCard.bonusStats.pace} {"->"} +
                    {projected.nextBonus.pace}
                  </p>
                  <p>
                    Thể chất: +{selectedCard.bonusStats.physical} {"->"} +
                    {projected.nextBonus.physical}
                  </p>
                  <p>
                    Phòng ngự: +{selectedCard.bonusStats.defending} {"->"} +
                    {projected.nextBonus.defending}
                  </p>
                  <p>
                    Rê bóng: +{selectedCard.bonusStats.dribbling} {"->"} +
                    {projected.nextBonus.dribbling}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setAllocate(buildTargetStats(selectedCard))}
                className="w-full rounded-xl border border-[#2b397f] bg-[#08113a] px-4 py-2 text-sm text-slate-200 transition hover:border-[#4169ff]"
              >
                Trả về chỉ số hiện tại
              </button>

              <button
                type="submit"
                disabled={
                  actionLoading || spendPoints === 0 || !!projected?.invalid
                }
                className="w-full rounded-xl border border-[#4169ff] bg-[#08113a] px-4 py-3 font-semibold text-white transition hover:bg-[#10205f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? "Đang lưu..." : "Áp dụng thay đổi chỉ số"}
              </button>
            </form>

            <div className="mt-4 rounded-xl border border-[#24306e] bg-black/20 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">
                Toàn bộ chỉ số (gốc / cộng thêm / tổng)
              </p>
              {statMetas.map((item, index) => (
                <p key={item.key} className={index === 0 ? "mt-2" : ""}>
                  {item.label}: {selectedCard.baseStats[item.key]} /{" "}
                  {selectedCard.bonusStats[item.key]} /{" "}
                  {selectedCard.totalStats[item.key]}
                </p>
              ))}
              <p className="mt-2 text-[#f6d87a]">
                Chỉ số tổng quan: {Number(selectedCard.overall || 0).toFixed(1)}
              </p>
            </div>
          </>
        )}
      </aside>
    </section>
  );
}

function NumberField({ label, value, onChange, onAdd, onSub, canAdd, canSub }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
      <div className="grid grid-cols-[40px_1fr_40px] gap-2">
        <button
          type="button"
          onClick={onSub}
          disabled={!canSub}
          className="rounded-xl border border-[#22306f] bg-[#030712] text-white transition hover:border-[#4169ff] disabled:cursor-not-allowed disabled:opacity-50"
        >
          -
        </button>
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2 text-center text-sm text-white outline-none transition focus:border-[#4169ff]"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="rounded-xl border border-[#22306f] bg-[#030712] text-white transition hover:border-[#4169ff] disabled:cursor-not-allowed disabled:opacity-50"
        >
          +
        </button>
      </div>
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
