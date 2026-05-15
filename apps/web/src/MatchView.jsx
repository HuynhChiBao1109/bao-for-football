import { useEffect, useMemo, useRef, useState } from 'react'

const FIELD = { width: 100, height: 64 }
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8082/ws'

const EVENT_LABELS = {
  goal: 'GOAL',
  var: 'VAR',
  foul: 'FOUL',
  yellow_card: 'YELLOW CARD',
  red_card: 'RED CARD',
  pass: 'PASS',
  shot: 'SHOT',
  possession_change: 'POSSESSION',
  kickoff: 'KICKOFF',
  match_end: 'MATCH END',
}

function MatchView({ embedded = false, onMatchEnd }) {
  const [connectionState, setConnectionState] = useState('Connecting...')
  const [score, setScore] = useState({ home: 0, away: 0 })
  const [elapsedMS, setElapsedMS] = useState(0)
  const [matchLog, setMatchLog] = useState([])
  const [popup, setPopup] = useState(null)
  const [displayPlayers, setDisplayPlayers] = useState([])
  const [ball, setBall] = useState({ x: 50, y: 32, ownerTeamId: '', ownerId: 0 })

  const targetsRef = useRef(new Map())
  const matchEndFiredRef = useRef(false)

  useEffect(() => {
    const socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      setConnectionState('Live')
    }

    socket.onclose = () => {
      setConnectionState('Disconnected')
    }

    socket.onerror = () => {
      setConnectionState('Socket error')
    }

    socket.onmessage = (message) => {
      let payload
      try {
        payload = JSON.parse(message.data)
      } catch {
        return
      }

      if (payload?.type !== 'match_tick') {
        return
      }

      setScore(payload.score || { home: 0, away: 0 })
      setElapsedMS(payload.elapsedMs || 0)
      setBall(payload.ball || { x: 50, y: 32, ownerTeamId: '', ownerId: 0 })

      if (Array.isArray(payload.players)) {
        for (const player of payload.players) {
          targetsRef.current.set(player.id, player)
        }

        setDisplayPlayers((prev) => {
          if (prev.length > 0) {
            return prev
          }
          return payload.players.map((player) => ({ ...player }))
        })
      }

      if (Array.isArray(payload.events) && payload.events.length > 0) {
        const stamped = payload.events.map((event, idx) => ({
          id: `${payload.tick}-${event.kind}-${event.playerId || 0}-${idx}`,
          matchTime: formatMatchTime(payload.elapsedMs || 0),
          kind: event.kind,
          label: EVENT_LABELS[event.kind] || event.kind,
          teamId: event.teamId || '',
          message: event.message || '',
        }))

        setMatchLog((prev) => [...stamped.reverse(), ...prev].slice(0, 36))

        const keyEvent = payload.events.find((event) => event.kind === 'goal' || event.kind === 'var')
        if (keyEvent) {
          setPopup({
            kind: keyEvent.kind,
            title: keyEvent.kind === 'goal' ? 'GOAL' : 'VAR REVIEW',
            detail: keyEvent.message || '',
          })
        }

    const ended = payload.events.some((event) => event.kind === 'match_end')
    if (ended && !matchEndFiredRef.current) {
      matchEndFiredRef.current = true
      const home = Number(payload?.score?.home || 0)
      const away = Number(payload?.score?.away || 0)
      onMatchEnd?.({
        home,
        away,
        didWin: home > away,
        isDraw: home === away,
      })
    }
      }
    }

    return () => {
      socket.close()
    }
  }, [])

  useEffect(() => {
    if (!popup) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setPopup(null)
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [popup])

  useEffect(() => {
    let raf = 0

    const animate = () => {
      setDisplayPlayers((current) => {
        if (current.length === 0) {
          return current
        }

        let changed = false
        const next = current.map((p) => {
          const target = targetsRef.current.get(p.id)
          if (!target) {
            return p
          }

          const nx = lerp(p.x, target.x, 0.24)
          const ny = lerp(p.y, target.y, 0.24)
          const diffX = Math.abs(nx - p.x)
          const diffY = Math.abs(ny - p.y)

          if (diffX > 0.005 || diffY > 0.005 || p.hasBall !== target.hasBall) {
            changed = true
            return {
              ...p,
              x: nx,
              y: ny,
              hasBall: target.hasBall,
              teamId: target.teamId,
              role: target.role,
            }
          }

          return p
        })

        return changed ? next : current
      })

      raf = window.requestAnimationFrame(animate)
    }

    raf = window.requestAnimationFrame(animate)
    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [])

  const minuteText = useMemo(() => formatMatchTime(elapsedMS), [elapsedMS])

  return (
    <section
      className={`mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 ${
        embedded ? 'p-0 lg:grid-cols-[1fr_360px]' : 'min-h-screen p-4 lg:grid-cols-[1fr_380px] lg:p-6'
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#1b2458] bg-[linear-gradient(165deg,#020205_0%,#060b22_100%)] p-3 shadow-[0_30px_70px_-40px_rgba(0,0,128,0.7)]">
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[#1b2458] bg-black/35 px-4 py-3 text-xs tracking-[0.18em] text-slate-300 sm:text-sm">
          <p>LIVE MATCH</p>
          <p className="font-semibold text-[#f6d87a]">{connectionState}</p>
          <p>{minuteText}</p>
        </div>

        <div className="rounded-xl border border-[#25306f] bg-[#06133a] p-2 sm:p-3">
          <svg
            viewBox={`0 0 ${FIELD.width} ${FIELD.height}`}
            className={`w-full rounded-lg bg-[#0b2f14] ${embedded ? 'h-[48vh] min-h-[360px]' : 'h-[58vh] min-h-[420px]'}`}
          >
            <defs>
              <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#114726" />
                <stop offset="100%" stopColor="#0c351d" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={FIELD.width} height={FIELD.height} fill="url(#grass)" />

            {Array.from({ length: 10 }).map((_, idx) => (
              <rect
                key={idx}
                x={idx * 10}
                y="0"
                width="5"
                height={FIELD.height}
                fill="rgba(255,255,255,0.03)"
              />
            ))}

            <rect x="1" y="1" width="98" height="62" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <line x1="50" y1="1" x2="50" y2="63" stroke="#cbd5e1" strokeWidth="0.35" />
            <circle cx="50" cy="32" r="7.3" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />

            <rect x="1" y="22" width="8" height="20" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <rect x="91" y="22" width="8" height="20" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <rect x="1" y="26" width="3" height="12" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <rect x="96" y="26" width="3" height="12" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />

            {displayPlayers.map((player) => {
              const isHome = player.teamId === 'home'
              const fill = isHome ? '#13206d' : '#0f172a'
              const stroke = isHome ? '#7f9cff' : '#d1d5db'

              return (
                <g key={player.id} transform={`translate(${player.x}, ${player.y})`}>
                  <circle r="1.35" fill={fill} stroke={stroke} strokeWidth="0.28" />
                  {player.hasBall && <circle r="1.9" fill="none" stroke="#f6d87a" strokeWidth="0.28" />}
                  <text y="2.9" textAnchor="middle" fill="#f8fafc" fontSize="1.1" fontWeight="600">
                    {player.role}
                  </text>
                </g>
              )
            })}

            <g transform={`translate(${ball.x}, ${ball.y})`}>
              <circle r="0.52" fill="#f8fafc" stroke="#111827" strokeWidth="0.17" />
            </g>
          </svg>
        </div>

        <div className="mt-3 flex items-center justify-center gap-5 rounded-xl border border-[#1b2458] bg-black/40 px-4 py-3">
          <p className="text-sm font-semibold tracking-wider text-slate-200">FC NAVY</p>
          <p className="font-['Space_Grotesk'] text-3xl font-bold text-[#f6d87a]">
            {score.home} - {score.away}
          </p>
          <p className="text-sm font-semibold tracking-wider text-slate-200">BLACK UNITED</p>
        </div>

        {popup && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="animate-[popIn_220ms_ease-out] rounded-2xl border-2 border-[#f6d87a] bg-[radial-gradient(circle_at_center,#18286f_0%,#0b1342_62%,#050918_100%)] px-8 py-7 text-center shadow-[0_0_80px_-20px_rgba(246,216,122,0.85)]">
              <p className="font-['Space_Grotesk'] text-5xl font-black tracking-[0.18em] text-[#f6d87a]">{popup.title}</p>
              {popup.detail && <p className="mt-2 text-sm text-[#d7defa]">{popup.detail}</p>}
            </div>
          </div>
        )}
      </div>

      <aside className="flex h-full min-h-[500px] flex-col rounded-2xl border border-[#1b2458] bg-[linear-gradient(180deg,#020207_0%,#070f2f_100%)]">
        <div className="border-b border-[#1b2458] px-5 py-4">
          <p className="font-['Space_Grotesk'] text-xl font-semibold tracking-wide text-white">Match Log</p>
          <p className="mt-1 text-xs text-slate-400">Tình huống mới nhất được hiển thị ở trên cùng.</p>
        </div>

        <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {matchLog.length === 0 && (
            <p className="rounded-lg border border-dashed border-[#2a387e] bg-black/25 px-4 py-6 text-center text-sm text-slate-400">
              Đang chờ dữ liệu trận đấu từ WebSocket...
            </p>
          )}

          {matchLog.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#223074] bg-black/25 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[#f6d87a]">{item.label}</p>
                <p className="text-[11px] text-slate-400">{item.matchTime}</p>
              </div>
              <p className="mt-1 text-sm text-slate-200">{item.message || 'No details'}</p>
            </div>
          ))}
        </div>
      </aside>
    </section>
  )
}

function lerp(current, target, alpha) {
  return current + (target - current) * alpha
}

function formatMatchTime(elapsedMS) {
  const totalSeconds = Math.floor(elapsedMS / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export default MatchView
