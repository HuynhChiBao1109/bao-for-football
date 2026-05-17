import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

const defaultForm = {
  name: "",
  countryId: 0,
  baseClub: "",
  season: "Normal",
  sourceType: "normal",
  specialSkill: "",
  shooting: 70,
  passing: 70,
  longPass: 70,
  vision: 70,
  gkReach: 70,
  counterAttackAwareness: 70,
  gkParrying: 70,
  gkReflex: 70,
  gkCatching: 70,
  duels: 70,
  pace: 70,
  physical: 70,
  defending: 70,
  standingTackle: 70,
  slidingTackle: 70,
  dribbling: 70,
};

const statLabels = {
  shooting: "Shooting",
  passing: "Passing",
  longPass: "Long Pass",
  vision: "Vision",
  counterAttackAwareness: "Counter Attack Awareness",
  duels: "Duels",
  pace: "Pace",
  physical: "Physical",
  defending: "Defending",
  standingTackle: "Standing Tackle",
  slidingTackle: "Sliding Tackle",
  dribbling: "Dribbling",
  gkReach: "GK Reach (thủ môn)",
  gkParrying: "GK Parrying (thủ môn)",
  gkReflex: "GK Reflex (thủ môn)",
  gkCatching: "GK Catching (thủ môn)",
};

function AdminDashboard({
  token,
  user,
  onLogout,
  onUnauthorized,
  embedded = false,
}) {
  const [players, setPlayers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const statsTotal = useMemo(() => {
    return averageStats(form);
  }, [form]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    await Promise.all([loadPlayers(), loadCountries()]);
  }

  async function loadPlayers() {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/players`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Failed to load players");
      }
      setPlayers(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadCountries() {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/countries`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Failed to load countries");
      }

      const nextCountries = Array.isArray(data?.data) ? data.data : [];
      setCountries(nextCountries);
      if (nextCountries.length > 0) {
        setForm((current) => ({
          ...current,
          countryId:
            current.countryId > 0
              ? current.countryId
              : Number(nextCountries[0].id),
        }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadPlayerDetail(playerId) {
    setLoadingDetail(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/admin/players/${playerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Failed to load player detail");
      }

      setSelectedPlayer(data?.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/players`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Failed to create player");
      }

      setMessage("Đã thêm cầu thủ mới thành công.");
      setPlayers((current) => [data.data, ...current]);
      setForm((current) => ({
        ...defaultForm,
        countryId: current.countryId,
      }));
      if (data?.data?.id) {
        loadPlayerDetail(data.data.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={`text-slate-100 ${
        embedded
          ? "game-panel game-panel--accent rounded-[28px] p-5"
          : "app-shell"
      }`}
    >
      <div
        className={`${embedded ? "game-panel__content" : "app-shell__inner"} mx-auto grid gap-6 ${embedded ? "max-w-none lg:grid-cols-[1.5fr_0.9fr]" : "max-w-7xl lg:grid-cols-[1.6fr_0.9fr]"}`}
      >
        <section className="game-panel overflow-hidden">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="game-header-kicker">Admin Dashboard</p>
                <h1 className="game-title mt-3 text-3xl font-bold text-white">
                  Quản lý cầu thủ hiện có
                </h1>
              </div>
              {!embedded && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="game-button-primary"
                >
                  Logout
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Logged in as{" "}
              <span className="font-semibold text-white">
                {user?.username || "admin"}
              </span>
              .
            </p>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="game-table min-w-full text-left text-sm">
              <thead className="text-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Season</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Skill</th>
                  <th className="px-4 py-3 font-medium">Stats</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-400" colSpan="6">
                      Chưa có cầu thủ nào trong hệ thống.
                    </td>
                  </tr>
                )}
                {players.map((player) => (
                  <tr
                    key={player.id}
                    className="cursor-pointer transition hover:bg-white/5"
                    onClick={() => loadPlayerDetail(player.id)}
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      <div>{player.name}</div>
                      <div className="text-xs text-slate-400">
                        {player.baseClub}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      <div className="flex items-center gap-2">
                        {player?.country?.flag ? (
                          <img
                            src={player.country.flag}
                            alt={player.country.name}
                            className="h-4 w-6 rounded-sm object-cover"
                          />
                        ) : (
                          <span className="inline-block h-4 w-6 rounded-sm bg-slate-700" />
                        )}
                        <span>
                          {player?.country?.name || player.nationality || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {player.season}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {player.sourceType}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {player.specialSkill || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {player.shooting}/{player.passing}/{player.longPass}/
                      {player.vision}/{player.gkReach}/
                      {player.counterAttackAwareness}/{player.gkParrying}/
                      {player.gkReflex}/{player.gkCatching}/{player.duels}/
                      {player.pace}/{player.physical}/{player.defending}/
                      {player.standingTackle}/{player.slidingTackle}/
                      {player.dribbling}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="game-panel overflow-hidden p-5">
          <div className="mb-4">
            <p className="game-header-kicker">Create Player</p>
            <h2 className="game-title mt-3 text-3xl font-bold text-white">
              Form thêm cầu thủ
            </h2>
          </div>

          <form className="space-y-3" onSubmit={submitForm}>
            <Input
              label="Name"
              value={form.name}
              onChange={(value) => updateField("name", value)}
            />
            <Select
              label="Country"
              value={String(form.countryId || "")}
              options={countries.map((country) => ({
                value: String(country.id),
                label: country.code
                  ? `${country.name} (${country.code})`
                  : country.name,
              }))}
              onChange={(value) => updateField("countryId", Number(value))}
            />
            <Input
              label="Base Club"
              value={form.baseClub}
              onChange={(value) => updateField("baseClub", value)}
            />

            <Select
              label="Season"
              value={form.season}
              options={["Normal", "Special"]}
              onChange={(value) => updateField("season", value)}
            />

            <Select
              label="Source Type"
              value={form.sourceType}
              options={["normal", "gacha"]}
              onChange={(value) => updateField("sourceType", value)}
            />

            <Input
              label="Special Skill"
              value={form.specialSkill}
              onChange={(value) => updateField("specialSkill", value)}
            />

            <div className="grid grid-cols-2 gap-3">
              {[
                "shooting",
                "passing",
                "longPass",
                "vision",
                "gkReach",
                "counterAttackAwareness",
                "gkParrying",
                "gkReflex",
                "gkCatching",
                "duels",
                "pace",
                "physical",
                "defending",
                "standingTackle",
                "slidingTackle",
                "dribbling",
              ].map((key) => (
                <NumberField
                  key={key}
                  label={statLabels[key] || key}
                  value={form[key]}
                  onChange={(value) => updateField(key, value)}
                />
              ))}
            </div>

            <div className="game-stat-card text-sm text-slate-300">
              Tổng chỉ số trung bình:{" "}
              <span className="font-semibold text-emerald-300">
                {statsTotal.toFixed(1)}
              </span>
            </div>

            {message && (
              <p className="game-notice game-notice--success">{message}</p>
            )}
            {error && <p className="game-notice game-notice--error">{error}</p>}

            <button
              type="submit"
              disabled={loading || !form.countryId}
              className="game-button-primary w-full"
            >
              {loading ? "Saving..." : "Add Player"}
            </button>
          </form>

          <div className="game-stat-card mt-5">
            <p className="game-stat-card__label">Player Detail</p>
            {loadingDetail && (
              <p className="mt-2 text-sm text-slate-300">
                Đang tải chi tiết...
              </p>
            )}
            {!loadingDetail && !selectedPlayer && (
              <p className="mt-2 text-sm text-slate-300">
                Chọn một cầu thủ trong danh sách để xem chi tiết.
              </p>
            )}
            {!loadingDetail && selectedPlayer && (
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div className="font-semibold text-white">
                  {selectedPlayer.name}
                </div>
                <div className="flex items-center gap-2">
                  {selectedPlayer?.country?.flag ? (
                    <img
                      src={selectedPlayer.country.flag}
                      alt={selectedPlayer.country.name}
                      className="h-4 w-6 rounded-sm object-cover"
                    />
                  ) : (
                    <span className="inline-block h-4 w-6 rounded-sm bg-slate-700" />
                  )}
                  <span>
                    {selectedPlayer?.country?.name ||
                      selectedPlayer.nationality}
                    {selectedPlayer?.country?.code
                      ? ` (${selectedPlayer.country.code})`
                      : ""}
                  </span>
                </div>
                <div>CLB: {selectedPlayer.baseClub}</div>
                <div>
                  Stats: {selectedPlayer.shooting}/{selectedPlayer.passing}/
                  {selectedPlayer.longPass}/{selectedPlayer.vision}/
                  {selectedPlayer.gkReach}/
                  {selectedPlayer.counterAttackAwareness}/
                  {selectedPlayer.gkParrying}/{selectedPlayer.gkReflex}/
                  {selectedPlayer.gkCatching}/{selectedPlayer.duels}/
                  {selectedPlayer.pace}/{selectedPlayer.physical}/
                  {selectedPlayer.defending}/{selectedPlayer.standingTackle}/
                  {selectedPlayer.slidingTackle}/{selectedPlayer.dribbling}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-input"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-select"
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input
        type="number"
        min="1"
        max="99"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="game-number-input"
      />
    </label>
  );
}

function averageStats(form) {
  const total =
    Number(form.shooting) +
    Number(form.passing) +
    Number(form.longPass) +
    Number(form.vision) +
    Number(form.gkReach) +
    Number(form.counterAttackAwareness) +
    Number(form.gkParrying) +
    Number(form.gkReflex) +
    Number(form.gkCatching) +
    Number(form.duels) +
    Number(form.pace) +
    Number(form.physical) +
    Number(form.defending) +
    Number(form.standingTackle) +
    Number(form.slidingTackle) +
    Number(form.dribbling);

  return total / 16;
}

export default AdminDashboard;
