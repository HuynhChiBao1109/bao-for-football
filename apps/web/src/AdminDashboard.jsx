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
  defensiveAwareness: 70,
  counterAttackAwareness: 70,
  crossbarHandling: 70,
  reflexes: 70,
  aerialCatching: 70,
  duels: 70,
  pace: 70,
  physical: 70,
  defending: 70,
  dribbling: 70,
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
          ? "rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]"
          : "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,0,128,0.32),transparent_32%),linear-gradient(180deg,#050505_0%,#090d1f_100%)] px-4 py-6 sm:px-6 lg:px-8"
      }`}
    >
      <div
        className={`mx-auto grid gap-6 ${embedded ? "max-w-none lg:grid-cols-[1.5fr_0.9fr]" : "max-w-7xl lg:grid-cols-[1.6fr_0.9fr]"}`}
      >
        <section className="rounded-2xl border border-[#1c255b] bg-[#050814]/95 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
          <div className="border-b border-[#1c255b] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Admin Dashboard
                </p>
                <h1 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
                  Quản lý cầu thủ hiện có
                </h1>
              </div>
              {!embedded && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-xl bg-[#000080] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1111a8]"
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
            <table className="min-w-full overflow-hidden rounded-xl border border-[#1d275e] text-left text-sm">
              <thead className="bg-[#08113a] text-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Season</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Skill</th>
                  <th className="px-4 py-3 font-medium">Stats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#15204e] bg-[#040711]">
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
                      {player.vision}/{player.defensiveAwareness}/
                      {player.counterAttackAwareness}/{player.crossbarHandling}/
                      {player.reflexes}/{player.aerialCatching}/{player.duels}/
                      {player.pace}/{player.physical}/{player.defending}/
                      {player.dribbling}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Create Player
            </p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
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
              ].map((key) => (
                <NumberField
                  key={key}
                  label={key}
                  value={form[key]}
                  onChange={(value) => updateField(key, value)}
                />
              ))}
            </div>

            <div className="rounded-xl border border-[#24306e] bg-black/30 px-4 py-3 text-sm text-slate-300">
              Tổng chỉ số trung bình:{" "}
              <span className="font-semibold text-[#f6d87a]">
                {statsTotal.toFixed(1)}
              </span>
            </div>

            {message && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !form.countryId}
              className="w-full rounded-xl bg-[#000080] px-4 py-3 font-semibold text-white transition hover:bg-[#1111a8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving..." : "Add Player"}
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-[#24306e] bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Player Detail
            </p>
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
                  {selectedPlayer.defensiveAwareness}/
                  {selectedPlayer.counterAttackAwareness}/
                  {selectedPlayer.crossbarHandling}/{selectedPlayer.reflexes}/
                  {selectedPlayer.aerialCatching}/{selectedPlayer.duels}/
                  {selectedPlayer.pace}/{selectedPlayer.physical}/
                  {selectedPlayer.defending}/{selectedPlayer.dribbling}
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
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#4169ff]"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#4169ff]"
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
      <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
      <input
        type="number"
        min="1"
        max="99"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2 text-sm text-white outline-none transition focus:border-[#4169ff]"
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
    Number(form.defensiveAwareness) +
    Number(form.counterAttackAwareness) +
    Number(form.crossbarHandling) +
    Number(form.reflexes) +
    Number(form.aerialCatching) +
    Number(form.duels) +
    Number(form.pace) +
    Number(form.physical) +
    Number(form.defending) +
    Number(form.dribbling);

  return total / 14;
}

export default AdminDashboard;
