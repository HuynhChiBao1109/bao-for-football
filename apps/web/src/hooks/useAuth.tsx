import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '../types';

const SESSION_KEY = 'fifam-session';

type AuthContextValue = {
  session: Session | null;
  setSession: (session: Session | null) => void;
  token: string;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session]);

  function setSession(next: Session | null) {
    setSessionState(next);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        setSession,
        token: session?.token ?? '',
        isAdmin: Boolean(session?.user?.isAdmin),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
