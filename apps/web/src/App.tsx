import { useEffect, useState } from 'react'

import AdminDashboard from './AdminDashboard.jsx'
import AuthGate from './AuthGate.jsx'
import MatchView from './MatchView.jsx'

type SessionUser = {
  id: number
  username: string
  isAdmin: boolean
}

type SessionState = {
  token: string
  user: SessionUser
} | null

const SESSION_KEY = 'fifam-session'
const LEGACY_ADMIN_SESSION_KEY = 'fifam-admin-session'

function App() {
  const [session, setSession] = useState<SessionState>(() => loadSession())

  useEffect(() => {
    if (session?.token) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }

    // Cleanup old key to avoid stale admin-only session behavior.
    localStorage.removeItem(LEGACY_ADMIN_SESSION_KEY)
  }, [session])

  if (!session?.token) {
    return (
      <AuthGate
        onAuthenticated={({ token, user }: { token: string; user: SessionUser }) => {
          setSession({ token, user })
        }}
      />
    )
  }

  if (!session.user?.isAdmin) {
    return (
      <main className="relative min-h-screen bg-[linear-gradient(180deg,#050505_0%,#090d1f_100%)] text-slate-100">
        <div className="absolute right-4 top-4 z-10 rounded-xl border border-[#1c255b] bg-black/45 px-3 py-2 text-xs sm:right-6 sm:top-6 sm:text-sm">
          <p className="mb-2 text-slate-300">Xin chào {session.user.username}</p>
          <button
            onClick={() => setSession(null)}
            className="rounded-lg bg-[#000080] px-3 py-1.5 font-semibold text-white transition hover:bg-[#1111a8]"
          >
            Logout
          </button>
        </div>
        <MatchView />
      </main>
    )
  }

  return (
    <AdminDashboard
      token={session.token}
      user={session.user}
      onLogout={() => setSession(null)}
      onUnauthorized={() => setSession(null)}
    />
  )
}

function loadSession(): SessionState {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_ADMIN_SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionState) : null
  } catch {
    return null
  }
}

export default App
