import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

const emptyLogin = { username: "", password: "" };
const emptyRegister = { username: "", password: "", clubId: 0, clubName: "" };

function AuthGate({ onAuthenticated }) {
  const [tab, setTab] = useState("login");
  const [loginMode, setLoginMode] = useState("user");
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setMessage("");
    setError("");
  }, [tab]);

  useEffect(() => {
    let cancelled = false;

    async function loadClubs() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/clubs`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Load clubs failed");
        }

        if (cancelled) {
          return;
        }

        const nextClubs = Array.isArray(data?.data) ? data.data : [];
        setClubs(nextClubs);
        setRegisterForm((current) => {
          if (current.clubId || nextClubs.length === 0) {
            return current;
          }
          return { ...current, clubId: nextClubs[0].id };
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    loadClubs();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const endpoint =
        loginMode === "admin" ? "/admin/login" : "/api/v1/auth/login";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Login failed");
      }

      onAuthenticated({
        token: data.token,
        user: data.user,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Register failed");
      }

      setMessage(
        "Đăng ký thành công. Bạn có thể đăng nhập ngay với đội hình khởi tạo ban đầu.",
      );
      setTab("login");
      setLoginForm((current) => ({
        ...current,
        username: registerForm.username,
      }));
      setRegisterForm((current) => ({
        ...emptyRegister,
        clubId: clubs[0]?.id || current.clubId || 0,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="app-shell__inner grid min-h-[calc(100vh-3rem)] items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="game-panel game-panel--accent scan-line overflow-hidden p-6 sm:p-8">
          <div className="game-panel__content">
            <p className="game-header-kicker">
              <span className="pulse-dot" />
              FIFAM Access Tunnel
            </p>
            <h1 className="game-header-title mt-4 text-shadow-soft text-white">
              Enter The Stadium
            </h1>
            <p className="game-copy mt-4 max-w-2xl text-base sm:text-lg">
              Một màn đăng nhập đúng chất web game manager: vào CLB, chọn chế
              độ, đăng ký đội khởi đầu rồi lao thẳng vào vòng lặp squad,
              tactics, match và gacha.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                [
                  "Account Mode",
                  "User thường đi qua `/api/v1/auth/login`, admin dùng `/admin/login`.",
                ],
                [
                  "Starter Club",
                  `Hiện có ${clubs.length || 0} CLB khởi đầu khả dụng để chọn lúc đăng ký.`,
                ],
                [
                  "Game Loop",
                  "Đăng nhập xong vào thẳng shell điều hướng giống một lobby game bóng đá online.",
                ],
              ].map(([title, desc]) => (
                <div key={title} className="game-stat-card min-h-[156px]">
                  <p className="game-stat-card__label">{title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Secure Gate", "JWT guard"],
                ["Club Draft", "Starter roster"],
                ["Live Manager", "Realtime-ready shell"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="game-chip justify-center sm:justify-start"
                >
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="game-panel overflow-hidden p-4 sm:p-6">
          <div className="game-panel__content">
            <div className="mb-5 flex gap-2 rounded-[20px] border border-white/8 bg-black/20 p-2">
              <button
                className={buttonTab(tab === "login")}
                onClick={() => setTab("login")}
                type="button"
              >
                Login
              </button>
              <button
                className={buttonTab(tab === "register")}
                onClick={() => setTab("register")}
                type="button"
              >
                Register
              </button>
            </div>

            {tab === "login" ? (
              <form className="space-y-4" onSubmit={submitLogin}>
                <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-white/8 bg-black/30 p-1.5">
                  <button
                    type="button"
                    onClick={() => setLoginMode("user")}
                    className={`rounded-[14px] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      loginMode === "user"
                        ? "bg-emerald-400 text-slate-950 shadow-[0_14px_32px_-20px_rgba(52,211,153,0.9)]"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    User Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMode("admin")}
                    className={`rounded-[14px] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      loginMode === "admin"
                        ? "bg-sky-400 text-slate-950 shadow-[0_14px_32px_-20px_rgba(56,189,248,0.88)]"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    Admin Login
                  </button>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <p className="game-header-kicker">
                    {loginMode === "admin"
                      ? "Back Office Access"
                      : "Manager Login"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {loginMode === "admin"
                      ? "Chế độ này dành cho quản trị viên tạo dữ liệu cầu thủ và duyệt nguồn quốc gia."
                      : "Đăng nhập user để vào khu quản lý CLB, tactics, player lab và các mode match."}
                  </p>
                </div>

                <Field
                  label="Username"
                  value={loginForm.username}
                  onChange={(value) =>
                    setLoginForm((current) => ({ ...current, username: value }))
                  }
                />
                <Field
                  label="Password"
                  type="password"
                  value={loginForm.password}
                  onChange={(value) =>
                    setLoginForm((current) => ({ ...current, password: value }))
                  }
                />

                {message && (
                  <p className="game-notice game-notice--success">{message}</p>
                )}
                {error && (
                  <p className="game-notice game-notice--error">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="game-button-primary w-full"
                >
                  {loading
                    ? "Logging in..."
                    : loginMode === "admin"
                      ? "Login as Admin"
                      : "Login as User"}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={submitRegister}>
                <Field
                  label="Username"
                  value={registerForm.username}
                  onChange={(value) =>
                    setRegisterForm((current) => ({
                      ...current,
                      username: value,
                    }))
                  }
                />
                <Field
                  label="Password"
                  type="password"
                  value={registerForm.password}
                  onChange={(value) =>
                    setRegisterForm((current) => ({
                      ...current,
                      password: value,
                    }))
                  }
                />
                <Field
                  label="Tên Câu Lạc Bộ"
                  value={registerForm.clubName}
                  onChange={(value) =>
                    setRegisterForm((current) => ({
                      ...current,
                      clubName: value,
                    }))
                  }
                />
                <SelectField
                  label="Đội Bóng Khởi Đầu"
                  value={registerForm.clubId}
                  options={clubs}
                  onChange={(value) =>
                    setRegisterForm((current) => ({
                      ...current,
                      clubId: Number(value),
                    }))
                  }
                />

                {registerForm.clubId ? (
                  <ClubPreview clubs={clubs} clubId={registerForm.clubId} />
                ) : null}

                {message && (
                  <p className="game-notice game-notice--success">{message}</p>
                )}
                {error && (
                  <p className="game-notice game-notice--error">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="game-button-primary w-full"
                >
                  {loading ? "Registering..." : "Register"}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, type = "text", value, onChange }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-input"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="game-select"
      >
        <option value={0} disabled>
          Chọn đội bóng
        </option>
        {options.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClubPreview({ clubs, clubId }) {
  const club = clubs.find((item) => item.id === clubId);
  if (!club) {
    return null;
  }

  return (
    <div className="game-stat-card">
      <p className="game-stat-card__label">Starter Club Preview</p>
      <p className="mt-3 text-xl font-semibold text-white">{club.name}</p>
      <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <p>Sơ đồ: {club.formation}</p>
        <p>Giải đấu: {club.leagueName}</p>
        <p>Ngân sách: {Number(club.budget || 0).toLocaleString()}</p>
        <p>Roster: 22 thẻ thường</p>
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
        Đăng ký xong nhận ngay đội hình khởi tạo của CLB này.
      </p>
    </div>
  );
}

function buttonTab(active) {
  return `flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
    active
      ? "bg-white text-slate-950 shadow-[0_18px_34px_-22px_rgba(255,255,255,0.65)]"
      : "bg-transparent text-slate-400 hover:bg-white/5 hover:text-white"
  }`;
}

export default AuthGate;
