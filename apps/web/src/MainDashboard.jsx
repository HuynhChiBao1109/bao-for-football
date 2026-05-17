import { useEffect, useMemo, useState } from "react";

import AdminDashboard from "./AdminDashboard.jsx";
import AiMatchPage from "./AiMatchPage.jsx";
import ClubPage from "./ClubPage.jsx";
import GachaPage from "./GachaPage.jsx";
import PlayerManagementPage from "./PlayerManagementPage.jsx";
import TacticsPage from "./TacticsPage.jsx";
import { apiRequest } from "./api";
import { navItems, ROUTES } from "./routes";

const routeMeta = {
  [ROUTES.club]: {
    title: "Club Command Center",
    eyebrow: "Club Ops",
    description:
      "Quản lý roster nền, ngân sách và các tuyến nâng cấp của đội hình hiện tại.",
  },
  [ROUTES.players]: {
    title: "Player Lab",
    eyebrow: "Squad Data",
    description:
      "Theo dõi tiến trình thẻ cầu thủ, chỉnh điểm kỹ năng và xem toàn bộ chỉ số phát triển.",
  },
  [ROUTES.tactics]: {
    title: "Tactics Forge",
    eyebrow: "Match Engine",
    description:
      "Tinh chỉnh nhịp độ, áp lực và hồ sơ gameplay để đẩy thẳng sang realtime engine.",
  },
  [ROUTES.aiMatch]: {
    title: "AI Campaign",
    eyebrow: "Progression",
    description:
      "Đánh từng stage, mở khóa màn kế tiếp và farm tiền thưởng cùng EXP toàn đội.",
  },
  [ROUTES.pvp]: {
    title: "Arena Queue",
    eyebrow: "PvP Hub",
    description:
      "Không gian chờ cho matchmaking realtime, xếp hạng và đấu rank nhiều mùa giải.",
  },
  [ROUTES.gacha]: {
    title: "Scout Capsule",
    eyebrow: "Recruitment",
    description:
      "Roll banner mùa giải, theo dõi pity và chốt kết quả hiếm ngay trong phiên hiện tại.",
  },
  [ROUTES.admin]: {
    title: "Admin Foundry",
    eyebrow: "Back Office",
    description:
      "Tạo cầu thủ mới, kiểm tra pool quốc gia và rà soát dữ liệu nguồn cho hệ thống.",
  },
};

const navHints = {
  [ROUTES.club]: "Tổng quan CLB",
  [ROUTES.players]: "Nâng cấp thẻ",
  [ROUTES.tactics]: "Preset đội hình",
  [ROUTES.aiMatch]: "50 stage",
  [ROUTES.pvp]: "Xếp hạng",
  [ROUTES.gacha]: "Banner roll",
  [ROUTES.admin]: "Quản trị dữ liệu",
};

function MainDashboard({
  token,
  user,
  pathname,
  onNavigate,
  onLogout,
  onUnauthorized,
}) {
  const [sessionData, setSessionData] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const items = useMemo(
    () => navItems(Boolean(user?.isAdmin)),
    [user?.isAdmin],
  );
  const currentMeta = routeMeta[pathname] || routeMeta[ROUTES.club];
  const clubName = sessionData?.team?.clubName || "Chưa đồng bộ";
  const budget = Number(sessionData?.team?.budget || 0).toLocaleString();
  const rankPoint = Number(sessionData?.team?.rankPoint || 0);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setLoadingSession(true);
      setSessionError("");

      try {
        const payload = await apiRequest("/api/v1/auth/me", { token });
        if (!cancelled) {
          setSessionData(payload?.data || null);
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          onUnauthorized();
          return;
        }
        if (!cancelled) {
          setSessionError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [onUnauthorized, token]);

  return (
    <main className="app-shell">
      <div className="app-shell__inner space-y-6">
        <section className="game-panel game-panel--accent scan-line overflow-hidden">
          <div className="game-panel__content grid gap-6 px-5 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-7 lg:py-7">
            <div className="space-y-5">
              <div className="game-header-kicker">
                <span className="pulse-dot" />
                FIFAM Live Club Hub
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-100/70">
                  {currentMeta.eyebrow}
                </p>
                <h1 className="game-header-title text-shadow-soft text-white">
                  {currentMeta.title}
                </h1>
                <p className="game-copy mt-4 max-w-3xl text-base sm:text-lg">
                  {currentMeta.description} Tất cả module hiện đang chạy trên
                  route riêng, nên shell này đóng vai trò như game lobby chính
                  sau đăng nhập.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="game-stat-card floating-card">
                  <p className="game-stat-card__label">Manager</p>
                  <p className="game-stat-card__value">{user?.username}</p>
                  <p className="game-stat-card__hint">
                    Vai trò {user?.isAdmin ? "Admin" : "User"}
                  </p>
                </div>
                <div className="game-stat-card">
                  <p className="game-stat-card__label">Club Budget</p>
                  <p className="game-stat-card__value">{budget}</p>
                  <p className="game-stat-card__hint">coins khả dụng</p>
                </div>
                <div className="game-stat-card">
                  <p className="game-stat-card__label">Rank Power</p>
                  <p className="game-stat-card__value">{rankPoint}</p>
                  <p className="game-stat-card__hint">điểm tích lũy mùa</p>
                </div>
              </div>

              <nav className="game-nav">
                {items.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    data-active={pathname === item.path}
                    onClick={() => onNavigate(item.path)}
                    className="game-nav-button min-w-[150px] flex-1"
                  >
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                      {navHints[item.path] || "Module"}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {item.label}
                    </div>
                  </button>
                ))}
              </nav>
            </div>

            <aside className="space-y-4">
              <div className="game-panel game-panel--soft overflow-hidden rounded-[24px] border border-white/8 p-4">
                <div className="game-panel__content">
                  <p className="game-header-kicker">Session Radar</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-200">
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <span className="text-slate-400">CLB hiện tại</span>
                      <strong className="text-white">{clubName}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <span className="text-slate-400">Path</span>
                      <strong className="text-cyan-100">{pathname}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <span className="text-slate-400">API sync</span>
                      <strong className="text-emerald-300">
                        {loadingSession ? "Syncing" : "Ready"}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="game-button-primary mt-4 w-full"
                  >
                    Return To Login
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  [
                    "Mission",
                    "Xoay vòng giữa CLB, tactics, squad và match mà không reload app.",
                  ],
                  [
                    "Reward Loop",
                    "Campaign AI, gacha và nâng cấp cầu thủ đang nối vào dữ liệu thật.",
                  ],
                  [
                    "Live Ready",
                    "Shell này đã sẵn cho realtime PvP và event stream sau này.",
                  ],
                ].map(([title, text]) => (
                  <div key={title} className="game-stat-card">
                    <p className="game-stat-card__label">{title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        {loadingSession && (
          <Banner tone="info" text="Đang tải session hiện tại từ API..." />
        )}
        {sessionError && <Banner tone="error" text={sessionError} />}

        {!loadingSession &&
          !sessionError &&
          renderRoute(pathname, {
            token,
            user,
            sessionData,
            onNavigate,
            onLogout,
            onUnauthorized,
          })}
      </div>
    </main>
  );
}

function renderRoute(pathname, props) {
  if (pathname === ROUTES.club) {
    return (
      <ClubPage
        token={props.token}
        sessionData={props.sessionData}
        onUnauthorized={props.onUnauthorized}
        onNavigate={props.onNavigate}
      />
    );
  }

  if (pathname === ROUTES.tactics) {
    return (
      <TacticsPage
        token={props.token}
        sessionData={props.sessionData}
        user={props.user}
        onUnauthorized={props.onUnauthorized}
      />
    );
  }

  if (pathname === ROUTES.players) {
    return (
      <PlayerManagementPage
        token={props.token}
        onUnauthorized={props.onUnauthorized}
      />
    );
  }

  if (pathname === ROUTES.aiMatch) {
    return (
      <AiMatchPage token={props.token} onUnauthorized={props.onUnauthorized} />
    );
  }

  if (pathname === ROUTES.pvp) {
    return <PvpOverview />;
  }

  if (pathname === ROUTES.gacha) {
    return (
      <GachaPage
        token={props.token}
        sessionData={props.sessionData}
        onUnauthorized={props.onUnauthorized}
      />
    );
  }

  if (pathname === ROUTES.admin && props.user?.isAdmin) {
    return (
      <AdminDashboard
        embedded
        token={props.token}
        user={props.user}
        onLogout={props.onLogout}
        onUnauthorized={props.onUnauthorized}
      />
    );
  }

  return <PvpOverview />;
}

function PvpOverview() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">PvP Arena</p>
          <h2 className="game-title mt-3 text-3xl font-bold text-white">
            Queue rank và đối kháng thời gian thực
          </h2>
          <p className="game-copy mt-3 max-w-2xl text-base">
            Phần này đang đóng vai trò lobby cạnh tranh: chọn ladder, đọc luật
            mùa và chờ hook realtime matchmaking khi backend sẵn sàng.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              [
                "Tier Ladder",
                "Nghiệp dư đến siêu sao, mỗi 10 trận là một chu kỳ leo hạng.",
              ],
              [
                "Promotion Rule",
                "Thắng tối thiểu 6/10 trận để đi tiếp lên tier cao hơn.",
              ],
              [
                "Live Matchmaking",
                "Route đã cố định, có thể nối queue realtime mà không thay shell UI.",
              ],
            ].map(([title, text]) => (
              <div key={title} className="game-stat-card min-h-[150px]">
                <p className="game-stat-card__label">{title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </article>

      <aside className="game-panel overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content space-y-4">
          <p className="game-header-kicker">Queue Status</p>
          <div className="game-stat-card">
            <p className="game-stat-card__label">Current State</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Realtime matchmaking chưa được bật, nhưng toàn bộ khu vực queue,
              rank badge và rule display đã sẵn để nối thẳng vào hub websocket.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="game-stat-card">
              <p className="game-stat-card__label">Expected Flow</p>
              <p className="mt-2 text-sm text-slate-300">
                Join queue, match found, sync đội hình, mở match scene.
              </p>
            </div>
            <div className="game-stat-card">
              <p className="game-stat-card__label">UI Intent</p>
              <p className="mt-2 text-sm text-slate-300">
                Giữ cảm giác một game manager online thay vì dashboard CRUD.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}

function Banner({ text, tone }) {
  const toneClass =
    tone === "error" ? "game-notice--error" : "game-notice--info";

  return <p className={`game-notice ${toneClass}`}>{text}</p>;
}

export default MainDashboard;
