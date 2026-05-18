import { useEffect, useMemo, useState } from "react";

import { API_BASE_URL, apiRequest } from "./api";

const DEFAULT_PLAYER_AVATAR = "/default-avatar.svg";

const defaultAllocate = {
  shooting: 0,
  passing: 0,
  longPass: 0,
  vision: 0,
  gkReach: 0,
  attackingAwareness: 0,
  defensiveAwareness: 0,
  gkParrying: 0,
  gkReflex: 0,
  duels: 0,
  pace: 0,
  stamina: 0,
  balance: 0,
  technique: 0,
  determination: 0,
  strength: 0,
  standingTackle: 0,
  slidingTackle: 0,
  dribbling: 0,
  curve: 0,
};

const allocateKeys = [
  "shooting",
  "passing",
  "longPass",
  "vision",
  "gkReach",
  "attackingAwareness",
  "defensiveAwareness",
  "gkParrying",
  "gkReflex",
  "duels",
  "pace",
  "stamina",
  "balance",
  "technique",
  "determination",
  "strength",
  "standingTackle",
  "slidingTackle",
  "dribbling",
  "curve",
];

const statMetas = [
  { key: "shooting", label: "Dứt điểm", allocatable: true },
  { key: "passing", label: "Chuyền ngắn", allocatable: true },
  { key: "longPass", label: "Chuyền dài", allocatable: true },
  { key: "vision", label: "Tầm nhìn", allocatable: true },
  { key: "attackingAwareness", label: "Nhận thức tấn công", allocatable: true },
  { key: "defensiveAwareness", label: "Nhận thức phòng thủ", allocatable: true },
  { key: "duels", label: "Tranh chấp", allocatable: true },
  { key: "pace", label: "Tốc độ", allocatable: true },
  { key: "stamina", label: "Thể lực", allocatable: true },
  { key: "balance", label: "Thăng bằng", allocatable: true },
  { key: "technique", label: "Kỹ thuật", allocatable: true },
  { key: "determination", label: "Quyết đoán", allocatable: true },
  { key: "strength", label: "Sức mạnh", allocatable: true },
  { key: "standingTackle", label: "Tắc bóng", allocatable: true },
  { key: "slidingTackle", label: "Xoạc bóng", allocatable: true },
  { key: "dribbling", label: "Rê bóng", allocatable: true },
  { key: "curve", label: "Sút xoáy", allocatable: true },
  { key: "gkParrying", label: "GK Parrying (thủ môn)", allocatable: true },
  { key: "gkReflex", label: "GK Reflex (thủ môn)", allocatable: true },
  {
    key: "gkReach",
    label: "GK Reach (thủ môn)",
    allocatable: true,
  },
];

function resolvePlayerAvatarUrl(imageUrl) {
  const value = String(imageUrl || "").trim();
  if (!value) {
    return DEFAULT_PLAYER_AVATAR;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`;
  }
  return `${API_BASE_URL}/${value}`;
}

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
      gkReach:
        Number(selectedCard.bonusStats.gkReach || 0) +
        Number(allocateDelta.gkReach || 0),
      attackingAwareness:
        Number(selectedCard.bonusStats.attackingAwareness || 0) +
        Number(allocateDelta.attackingAwareness || 0),
      defensiveAwareness:
        Number(selectedCard.bonusStats.defensiveAwareness || 0) +
        Number(allocateDelta.defensiveAwareness || 0),
      gkParrying:
        Number(selectedCard.bonusStats.gkParrying || 0) +
        Number(allocateDelta.gkParrying || 0),
      gkReflex:
        Number(selectedCard.bonusStats.gkReflex || 0) +
        Number(allocateDelta.gkReflex || 0),
      duels:
        Number(selectedCard.bonusStats.duels || 0) +
        Number(allocateDelta.duels || 0),
      pace:
        Number(selectedCard.bonusStats.pace || 0) +
        Number(allocateDelta.pace || 0),
      stamina:
        Number(selectedCard.bonusStats.stamina || 0) +
        Number(allocateDelta.stamina || 0),
      balance:
        Number(selectedCard.bonusStats.balance || 0) +
        Number(allocateDelta.balance || 0),
      technique:
        Number(selectedCard.bonusStats.technique || 0) +
        Number(allocateDelta.technique || 0),
      determination:
        Number(selectedCard.bonusStats.determination || 0) +
        Number(allocateDelta.determination || 0),
      strength:
        Number(selectedCard.bonusStats.strength || 0) +
        Number(allocateDelta.strength || 0),
      standingTackle:
        Number(selectedCard.bonusStats.standingTackle || 0) +
        Number(allocateDelta.standingTackle || 0),
      slidingTackle:
        Number(selectedCard.bonusStats.slidingTackle || 0) +
        Number(allocateDelta.slidingTackle || 0),
      dribbling:
        Number(selectedCard.bonusStats.dribbling || 0) +
        Number(allocateDelta.dribbling || 0),
      curve:
        Number(selectedCard.bonusStats.curve || 0) +
        Number(allocateDelta.curve || 0),
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
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="game-header-kicker">Player Lab</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">
                Quản lí cầu thủ, cấp độ và chỉ số
              </h2>
              <p className="game-copy mt-3 max-w-2xl text-base">
                Chọn thẻ cầu thủ, kiểm tra tiến trình level, cộng kỹ năng và xem
                toàn bộ chỉ số nền/tăng thêm/tổng trong cùng một bảng điều
                khiển.
              </p>
            </div>
            <button
              type="button"
              onClick={loadCards}
              className="game-button-secondary"
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
              <table className="game-table min-w-full text-left text-sm">
                <thead className="text-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cầu thủ</th>
                    <th className="px-4 py-3 font-medium">Quốc gia</th>
                    <th className="px-4 py-3 font-medium">Cấp độ</th>
                    <th className="px-4 py-3 font-medium">Chỉ số tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr
                      key={card.userPlayerId}
                      onClick={() => setSelectedId(card.userPlayerId)}
                      data-active={
                        selectedCard?.userPlayerId === card.userPlayerId
                      }
                      className="cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolvePlayerAvatarUrl(card.imageUrl)}
                            alt={card.name}
                            className="h-10 w-10 rounded-full border border-white/20 bg-slate-800 object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = DEFAULT_PLAYER_AVATAR;
                            }}
                          />
                          <div>
                            <div>{card.name}</div>
                            <div className="text-xs text-slate-400">
                              {card.baseClub} • {card.season}
                            </div>
                          </div>
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
        </div>
      </article>

      <aside className="game-panel overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          {!selectedCard ? (
            <p className="game-notice game-notice--muted">
              Chọn một cầu thủ để xem chi tiết.
            </p>
          ) : (
            <>
              <p className="game-header-kicker">Player Detail</p>
              <div className="mt-3 flex items-center gap-4">
                <img
                  src={resolvePlayerAvatarUrl(selectedCard.imageUrl)}
                  alt={selectedCard.name}
                  className="h-16 w-16 rounded-full border border-white/20 bg-slate-800 object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = DEFAULT_PLAYER_AVATAR;
                  }}
                />
                <h3 className="game-title text-3xl font-bold text-white">
                  {selectedCard.name}
                </h3>
              </div>
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

              <div className="mt-4 grid gap-2 rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm text-slate-300">
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
                <div className="game-progress h-2">
                  <span
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

              <p className="game-stat-card mt-4 text-sm text-slate-300">
                Cấp độ sẽ tự động tăng khi kinh nghiệm đủ mốc. Bạn chỉ cần dùng
                điểm kỹ năng chưa cộng để nâng chỉ số.
              </p>

              <form className="mt-4 space-y-3" onSubmit={handleAllocate}>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Điều chỉnh chỉ số
                </p>
                <p className="text-xs text-slate-400">
                  Mặc định là chỉ số hiện tại của cầu thủ. Nhấn + để tăng, nhấn
                  - để giảm phần đã cộng trước đó.
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

                <div className="game-stat-card text-sm text-slate-300">
                  Chênh lệch điểm lần này:{" "}
                  <span className="font-semibold text-emerald-300">
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
                  <div className="game-scroll rounded-[20px] border border-white/8 bg-black/20 p-4 text-sm text-slate-300 max-h-[280px] overflow-y-auto">
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
                      GK Reach: +{selectedCard.bonusStats.gkReach} {"->"} +
                      {projected.nextBonus.gkReach}
                    </p>
                    <p>
                      Nhận thức tấn công: +
                      {selectedCard.bonusStats.attackingAwareness} {"->"} +
                      {projected.nextBonus.attackingAwareness}
                    </p>
                    <p>
                      Nhận thức phòng thủ: +
                      {selectedCard.bonusStats.defensiveAwareness} {"->"} +
                      {projected.nextBonus.defensiveAwareness}
                    </p>
                    <p>
                      GK Parrying: +{selectedCard.bonusStats.gkParrying} {"->"}{" "}
                      +{projected.nextBonus.gkParrying}
                    </p>
                    <p>
                      GK Reflex: +{selectedCard.bonusStats.gkReflex} {"->"} +
                      {projected.nextBonus.gkReflex}
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
                      Thể lực: +{selectedCard.bonusStats.stamina} {"->"} +
                      {projected.nextBonus.stamina}
                    </p>
                    <p>
                      Thăng bằng: +{selectedCard.bonusStats.balance} {"->"} +
                      {projected.nextBonus.balance}
                    </p>
                    <p>
                      Kỹ thuật: +{selectedCard.bonusStats.technique} {"->"} +
                      {projected.nextBonus.technique}
                    </p>
                    <p>
                      Quyết đoán: +{selectedCard.bonusStats.determination} {"->"} +
                      {projected.nextBonus.determination}
                    </p>
                    <p>
                      Sức mạnh: +{selectedCard.bonusStats.strength} {"->"} +
                      {projected.nextBonus.strength}
                    </p>
                    <p>
                      Rê bóng: +{selectedCard.bonusStats.dribbling} {"->"} +
                      {projected.nextBonus.dribbling}
                    </p>
                    <p>
                      Sút xoáy: +{selectedCard.bonusStats.curve} {"->"} +
                      {projected.nextBonus.curve}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setAllocate(buildTargetStats(selectedCard))}
                  className="game-button-secondary w-full"
                >
                  Trả về chỉ số hiện tại
                </button>

                <button
                  type="submit"
                  disabled={
                    actionLoading || spendPoints === 0 || !!projected?.invalid
                  }
                  className="game-button-primary w-full"
                >
                  {actionLoading ? "Đang lưu..." : "Áp dụng thay đổi chỉ số"}
                </button>
              </form>

              <div className="game-stat-card mt-4 text-sm text-slate-300">
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
                  Chỉ số tổng quan:{" "}
                  {Number(selectedCard.overall || 0).toFixed(1)}
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </section>
  );
}

function NumberField({ label, value, onChange, onAdd, onSub, canAdd, canSub }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <div className="grid grid-cols-[40px_1fr_40px] gap-2">
        <button
          type="button"
          onClick={onSub}
          disabled={!canSub}
          className="game-button-ghost rounded-xl px-0 py-0 disabled:opacity-50"
        >
          -
        </button>
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="game-number-input text-center"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="game-button-ghost rounded-xl px-0 py-0 disabled:opacity-50"
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
      ? "game-notice--error"
      : tone === "success"
        ? "game-notice--success"
        : tone === "info"
          ? "game-notice--info"
          : "game-notice--muted";

  return <p className={`game-notice mt-4 ${toneClass}`}>{text}</p>;
}

export default PlayerManagementPage;
