import { useEffect, useMemo, useState } from "react";

import AdminClubCreateCard from "./AdminClubCreateCard.jsx";
import AdminCountryCreateCard from "./AdminCountryCreateCard.jsx";
import AdminGachaCreateCard from "./AdminGachaCreateCard.jsx";
import AdminPlayerCreateCard from "./AdminPlayerCreateCard.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
const DEFAULT_AVATAR_URL = "/default-avatar.svg";

function AdminDashboard({
  token,
  user,
  onLogout,
  onUnauthorized,
  embedded = false,
}) {
  const [players, setPlayers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [clubsRefreshToken, setClubsRefreshToken] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [clubFilter, setClubFilter] = useState("all");
  const [debouncedNameSearch, setDebouncedNameSearch] = useState("");
  const [skills, setSkills] = useState([]);
  const [skillDraft, setSkillDraft] = useState({
    name: "",
    iconUrl: "",
    buffType: "shooting",
    buffValue: 3,
  });
  const [assignSkillName, setAssignSkillName] = useState("");

  const selectedPlayerStats = useMemo(() => {
    if (!selectedPlayer) {
      return "";
    }

    return [
      selectedPlayer.shooting,
      selectedPlayer.passing,
      selectedPlayer.longPass,
      selectedPlayer.vision,
      selectedPlayer.gkReach,
      selectedPlayer.attackingAwareness,
      selectedPlayer.defensiveAwareness,
      selectedPlayer.gkParrying,
      selectedPlayer.gkReflex,
      selectedPlayer.duels,
      selectedPlayer.pace,
      selectedPlayer.stamina,
      selectedPlayer.balance,
      selectedPlayer.technique,
      selectedPlayer.determination,
      selectedPlayer.strength,
      selectedPlayer.standingTackle,
      selectedPlayer.slidingTackle,
      selectedPlayer.dribbling,
      selectedPlayer.curve,
    ].join("/");
  }, [selectedPlayer]);

  const uniqueClubs = useMemo(() => {
    return Array.from(new Set(clubs.map((club) => club.name).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [clubs]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedNameSearch(nameSearch.trim());
    }, 300);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [nameSearch]);

  useEffect(() => {
    loadCountries();
    loadClubs();
    loadSkills();
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [debouncedNameSearch, countryFilter, clubFilter]);

  useEffect(() => {
    loadClubs();
  }, [clubsRefreshToken]);

  async function loadSkills() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/skills`, {
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
        throw new Error(data?.error || "Failed to load skills");
      }
      setSkills(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadCountries() {
    setLoadingCountries(true);
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

      setCountries(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCountries(false);
    }
  }

  async function loadClubs() {
    setLoadingClubs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/clubs`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load clubs");
      }

      setClubs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClubs(false);
    }
  }

  async function loadPlayers() {
    setLoadingPlayers(true);
    try {
      const query = new URLSearchParams();
      if (debouncedNameSearch) {
        query.set("name", debouncedNameSearch);
      }
      if (countryFilter !== "all") {
        query.set("countryId", String(countryFilter));
      }
      if (clubFilter !== "all") {
        query.set("baseClub", clubFilter);
      }

      const queryString = query.toString();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/admin/players${queryString ? `?${queryString}` : ""}`,
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
        throw new Error(data?.error || "Failed to load players");
      }

      const nextPlayers = Array.isArray(data?.data) ? data.data : [];
      setPlayers(nextPlayers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPlayers(false);
    }
  }

  async function loadPlayerDetail(playerId) {
    setLoadingDetail(true);
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
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function createSkill(event) {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/skills`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(skillDraft),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Failed to create skill");
      }

      setSkillDraft({
        name: "",
        iconUrl: "",
        buffType: skillDraft.buffType,
        buffValue: 3,
      });
      await loadSkills();
    } catch (err) {
      console.error(err);
    }
  }

  async function assignSkillToSelectedPlayer(event) {
    event.preventDefault();
    if (!selectedPlayer?.id || !assignSkillName) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/admin/players/${selectedPlayer.id}/skills`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ skillName: assignSkillName }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        throw new Error(data?.error || "Failed to assign skill");
      }

      setSelectedPlayer(data?.data || null);
      await loadPlayers();
    } catch (err) {
      console.error(err);
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
        className={`${embedded ? "game-panel__content" : "app-shell__inner"} mx-auto grid gap-6 ${embedded ? "max-w-none lg:grid-cols-[1.45fr_0.95fr]" : "max-w-7xl lg:grid-cols-[1.45fr_0.95fr]"}`}
      >
        <section className="game-panel overflow-hidden">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="game-header-kicker">Admin Dashboard</p>
                <h1 className="game-title mt-3 text-3xl font-bold text-white">
                  Quản lí cầu thủ
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
            </p>
          </div>

          {loadingPlayers && (
            <p className="px-5 py-4 text-sm text-slate-300">
              Đang tải danh sách cầu thủ...
            </p>
          )}
          {loadingCountries && (
            <p className="px-5 py-4 text-sm text-slate-300">
              Đang tải danh sách quốc gia cho form tạo cầu thủ...
            </p>
          )}
          {loadingClubs && (
            <p className="px-5 py-4 text-sm text-slate-300">
              Đang tải danh sách câu lạc bộ...
            </p>
          )}

          <div className="overflow-x-auto p-4">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <input
                type="text"
                placeholder="Search by player name"
                value={nameSearch}
                onChange={(event) => setNameSearch(event.target.value)}
                className="game-input"
              />
              <select
                value={countryFilter}
                onChange={(event) => setCountryFilter(event.target.value)}
                className="game-input"
              >
                <option value="all">All countries</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
              <select
                value={clubFilter}
                onChange={(event) => setClubFilter(event.target.value)}
                className="game-input"
              >
                <option value="all">All clubs</option>
                {uniqueClubs.map((clubName) => (
                  <option key={clubName} value={clubName}>
                    {clubName}
                  </option>
                ))}
              </select>
            </div>
            <table className="game-table min-w-full text-left text-sm">
              <thead className="text-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Season</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Skill</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-400" colSpan="5">
                      Không có cầu thủ phù hợp với bộ lọc hiện tại.
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
                      <div className="flex items-center gap-3">
                        <img
                          src={player.avatar || DEFAULT_AVATAR_URL}
                          alt={player.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <div>
                          <div>{player.name}</div>
                          <div className="text-xs text-slate-400">
                            {player.baseClub}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {player?.country?.name || player.nationality || "-"}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5">
          <AdminPlayerCreateCard
            token={token}
            title="Create Player"
            subtitle="Tạo cầu thủ với session lựa chọn"
            countries={countries}
            clubsRefreshToken={clubsRefreshToken}
            onCreated={loadPlayers}
            onUnauthorized={onUnauthorized}
          />

          <AdminCountryCreateCard
            token={token}
            onCreated={() => {
              loadCountries();
            }}
            onUnauthorized={onUnauthorized}
          />

          <AdminClubCreateCard
            token={token}
            countries={countries}
            onCreated={() => {
              setClubsRefreshToken((current) => current + 1);
            }}
            onUnauthorized={onUnauthorized}
          />

          <AdminGachaCreateCard
            token={token}
            players={players}
            onUnauthorized={onUnauthorized}
          />

          <section className="game-panel overflow-hidden p-5">
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
              <div className="mt-3 space-y-3 text-sm text-slate-200">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedPlayer.avatar || DEFAULT_AVATAR_URL}
                    alt={selectedPlayer.name}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold text-white">
                      {selectedPlayer.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {selectedPlayer.baseClub}
                    </div>
                  </div>
                </div>
                <div>CLB: {selectedPlayer.baseClub}</div>
                <div>Stats: {selectedPlayerStats}</div>
                <form className="mt-2 space-y-2" onSubmit={assignSkillToSelectedPlayer}>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Add Special Skill
                  </p>
                  <select
                    value={assignSkillName}
                    onChange={(event) => setAssignSkillName(event.target.value)}
                    className="game-input"
                  >
                    <option value="">Select skill</option>
                    {skills.map((skill) => (
                      <option key={skill.id} value={skill.name}>
                        {skill.name} ({skill.buffType} {skill.buffValue > 0 ? `+${skill.buffValue}` : skill.buffValue})
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="game-button-secondary w-full">
                    Add skill to player
                  </button>
                </form>
              </div>
            )}
          </section>

          <section className="game-panel overflow-hidden p-5">
            <p className="game-stat-card__label">Special Skill Catalog</p>
            <form className="mt-3 space-y-2" onSubmit={createSkill}>
              <input
                className="game-input"
                placeholder="Skill name"
                value={skillDraft.name}
                onChange={(event) =>
                  setSkillDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                className="game-input"
                placeholder="Icon URL (optional)"
                value={skillDraft.iconUrl}
                onChange={(event) =>
                  setSkillDraft((current) => ({ ...current, iconUrl: event.target.value }))
                }
              />
              <select
                className="game-input"
                value={skillDraft.buffType}
                onChange={(event) =>
                  setSkillDraft((current) => ({ ...current, buffType: event.target.value }))
                }
              >
                {[
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
                  "standingTackle",
                  "slidingTackle",
                  "pace",
                  "stamina",
                  "balance",
                  "technique",
                  "determination",
                  "strength",
                  "dribbling",
                  "curve",
                ].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                className="game-input"
                type="number"
                placeholder="Buff value"
                value={skillDraft.buffValue}
                onChange={(event) =>
                  setSkillDraft((current) => ({
                    ...current,
                    buffValue: Number(event.target.value || 0),
                  }))
                }
              />
              <button type="submit" className="game-button-primary w-full">
                Create skill
              </button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default AdminDashboard;
