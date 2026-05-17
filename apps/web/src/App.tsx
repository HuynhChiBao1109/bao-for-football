import { useEffect, useState } from "react";

import AuthGate from "./AuthGate.jsx";
import MainDashboard from "./MainDashboard.jsx";
import {
  defaultAuthenticatedRoute,
  normalizeAuthenticatedRoute,
  ROUTES,
} from "./routes";

type SessionUser = {
  id: number;
  username: string;
  isAdmin: boolean;
};

type SessionState = {
  token: string;
  user: SessionUser;
} | null;

const SESSION_KEY = "fifam-session";
const LEGACY_ADMIN_SESSION_KEY = "fifam-admin-session";

function App() {
  const [session, setSession] = useState<SessionState>(() => loadSession());
  const [pathname, setPathname] = useState(() => loadPathname());

  useEffect(() => {
    if (session?.token) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }

    // Cleanup old key to avoid stale admin-only session behavior.
    localStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
  }, [session]);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(loadPathname());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!session?.token) {
      if (pathname !== ROUTES.login) {
        navigateTo(ROUTES.login, setPathname, true);
      }
      return;
    }

    const nextPath = normalizeAuthenticatedRoute(
      pathname,
      Boolean(session.user?.isAdmin),
    );
    if (nextPath !== pathname) {
      navigateTo(nextPath, setPathname, true);
    }
  }, [pathname, session]);

  if (!session?.token) {
    return (
      <AuthGate
        onAuthenticated={({
          token,
          user,
        }: {
          token: string;
          user: SessionUser;
        }) => {
          setSession({ token, user });
          navigateTo(
            user?.isAdmin ? ROUTES.admin : defaultAuthenticatedRoute(),
            setPathname,
          );
        }}
      />
    );
  }

  return (
    <MainDashboard
      token={session.token}
      user={session.user}
      pathname={pathname}
      onNavigate={(nextPath: string) => navigateTo(nextPath, setPathname)}
      onLogout={() => {
        setSession(null);
        navigateTo(ROUTES.login, setPathname);
      }}
      onUnauthorized={() => {
        setSession(null);
        navigateTo(ROUTES.login, setPathname, true);
      }}
    />
  );
}

function navigateTo(
  pathname: string,
  setPathname: (value: string) => void,
  replace = false,
) {
  const method = replace ? "replaceState" : "pushState";
  window.history[method](null, "", pathname);
  setPathname(pathname);
}

function loadPathname() {
  if (typeof window === "undefined") {
    return ROUTES.login;
  }

  return window.location.pathname || ROUTES.login;
}

function loadSession(): SessionState {
  try {
    const raw =
      localStorage.getItem(SESSION_KEY) ||
      localStorage.getItem(LEGACY_ADMIN_SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

export default App;
