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
  const [clubsRefreshToken, setClubsRefreshToken] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
      selectedPlayer.counterAttackAwareness,
      selectedPlayer.gkParrying,
      selectedPlayer.gkReflex,
      selectedPlayer.gkCatching,
      selectedPlayer.duels,
      selectedPlayer.pace,
      selectedPlayer.physical,
      selectedPlayer.defending,
      selectedPlayer.standingTackle,
      selectedPlayer.slidingTackle,
      selectedPlayer.dribbling,
    ].join("/");
  }, [selectedPlayer]);

  useEffect(() => {
    loadPlayers();
    loadCountries();
  }, []);

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

  async function loadPlayers() {
    setLoadingPlayers(true);
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

          <div className="overflow-x-auto p-4">
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
            subtitle="Tạo cầu thủ thường"
            season="Normal"
            sourceType="normal"
            countries={countries}
            clubsRefreshToken={clubsRefreshToken}
            onCreated={loadPlayers}
            onUnauthorized={onUnauthorized}
          />

          <AdminPlayerCreateCard
            token={token}
            title="Create Special Player"
            subtitle="Tạo cầu thủ mùa đặc biệt cho gacha"
            season="Special"
            sourceType="gacha"
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
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default AdminDashboard;
