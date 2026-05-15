import { useEffect, useMemo, useRef, useState } from 'react'

const F = { w: 100, h: 64 }
const SSE_URL = import.meta.env.VITE_MATCH_SSE_URL || 'http://localhost:8082/sse/match'

// Per-event display config: label (log), title (popup), color, bg, border, duration(ms)
const EV = {
  goal:              { label: '⚽ GOAL',         title: 'GOAL!',            color: '#f6d87a', bg: '#2d1600', bdr: '#f6d87a', dur: 3200 },
  var:               { label: '📺 VAR',           title: 'VAR REVIEW',       color: '#93c5fd', bg: '#030e2b', bdr: '#3b82f6', dur: 4000 },
  yellow_card:       { label: '🟨 Thẻ Vàng',     title: 'THẺ VÀNG',         color: '#fde047', bg: '#1c1200', bdr: '#fde047', dur: 2500 },
  red_card:          { label: '🟥 Thẻ Đỏ',       title: 'THẺ ĐỎ!',          color: '#f87171', bg: '#1c0000', bdr: '#ef4444', dur: 2800 },
  foul:              { label: '⚠️ Phạm Lỗi',     title: 'PHẠM LỖI',         color: '#fdba74', bg: '#1c0800', bdr: '#f97316', dur: 2200 },
  free_kick:         { label: '🦵 Đá Phạt',      title: 'ĐÁ PHẠT',          color: '#bae6fd', bg: '#021020', bdr: '#38bdf8', dur: 2500 },
  corner:            { label: '🚩 Phạt Góc',     title: 'PHẠT GÓC',         color: '#99f6e4', bg: '#021210', bdr: '#14b8a6', dur: 2000 },
  argument:          { label: '😤 Cãi Lộn',      title: 'CÃI LỘN!',         color: '#d8b4fe', bg: '#0d0420', bdr: '#a855f7', dur: 2500 },
  substitution:      { label: '🔄 Thay Người',   title: 'THAY NGƯỜI',        color: '#6ee7b7', bg: '#020f09', bdr: '#10b981', dur: 3000 },
  half_time:         { label: '⏸ Hết Hiệp 1',   title: 'HẾT HIỆP 1',       color: '#e2e8f0', bg: '#060b18', bdr: '#64748b', dur: 5000, phase: 'half_time' },
  second_half_start: { label: '▶ Hiệp 2',        title: 'HIỆP 2 BẮT ĐẦU',  color: '#bfdbfe', bg: '#030a1c', bdr: '#3b82f6', dur: 3000, phase: 'second_half' },
  match_end:         { label: '🏁 Kết Thúc',     title: 'KẾT THÚC TRẬN',    color: '#e4e4e7', bg: '#050505', bdr: '#52525b', dur: 5500, phase: 'full_time' },
  kickoff:           { label: '⚽ Kick Off',      title: 'KICK OFF',          color: '#bbf7d0', bg: '#020f06', bdr: '#22c55e', dur: 2000 },
  pass:              { label: 'Chuyền' },
  shot:              { label: 'Sút' },
  possession_change: { label: 'Đổi Bóng' },
}

const KEY_EVENTS = new Set([
  'goal','var','yellow_card','red_card','foul','free_kick',
  'corner','argument','substitution','half_time','second_half_start','match_end','kickoff',
])

function MatchView({ embedded = false, onMatchEnd }) {
  const [connState, setConnState]           = useState('Connecting...')
  const [score, setScore]                   = useState({ home: 0, away: 0 })
  const [elapsedMS, setElapsedMS]           = useState(0)
  const [matchLog, setMatchLog]             = useState([])
  const [popup, setPopup]                   = useState(null)
  const [displayPlayers, setDisplayPlayers] = useState([])
  const [displayBall, setDisplayBall]       = useState({ x: 50, y: 32 })
  const [fieldFx, setFieldFx]               = useState([])   // on-SVG effects
  const [matchPhase, setMatchPhase]         = useState('playing') // 'playing'|'half_time'|'second_half'|'full_time'

  const targetsRef       = useRef(new Map())
  const ballTargetRef    = useRef({ x: 50, y: 32 })
  const ballAlphaRef     = useRef(0.30)
  const matchPhaseRef    = useRef('playing')
  const matchEndFiredRef = useRef(false)
  const fxIdRef          = useRef(0)

  // keep phase ref in sync
  useEffect(() => { matchPhaseRef.current = matchPhase }, [matchPhase])

  useEffect(() => {
    const es = new EventSource(SSE_URL)

    const handleEvent = (rawData) => {
      let payload
      try { payload = JSON.parse(rawData) } catch { return }
      if (payload?.type !== 'match_tick') return

      setScore(payload.score || { home: 0, away: 0 })
      setElapsedMS(payload.elapsedMs || 0)

      // update ball target (smooth lerp happens in RAF)
      if (payload.ball) ballTargetRef.current = { x: payload.ball.x, y: payload.ball.y }

      if (Array.isArray(payload.players)) {
        for (const pl of payload.players) targetsRef.current.set(pl.id, pl)
        setDisplayPlayers((prev) =>
          prev.length > 0 ? prev : payload.players.map((pl) => ({ ...pl })),
        )
      }

      if (Array.isArray(payload.events) && payload.events.length > 0) {
        const time = formatMatchTime(payload.elapsedMs || 0)

        // tune ball lerp speed per event kind
        if (payload.events.some((e) => e.kind === 'shot'))       ballAlphaRef.current = 0.58
        else if (payload.events.some((e) => e.kind === 'pass'))  ballAlphaRef.current = 0.42
        else                                                      ballAlphaRef.current = 0.28

        const stamped = payload.events.map((event, idx) => ({
          id: `${payload.tick}-${event.kind}-${event.playerId || 0}-${idx}`,
          time,
          kind: event.kind,
          label: EV[event.kind]?.label || event.kind,
          teamId: event.teamId || '',
          message: event.message || '',
        }))
        setMatchLog((prev) => [...stamped.reverse(), ...prev].slice(0, 40))

        // popup for key events
        const keyEv = payload.events.find((e) => KEY_EVENTS.has(e.kind))
        if (keyEv) {
          const cfg = EV[keyEv.kind]
          if (cfg?.title) {
            setPopup({ kind: keyEv.kind, title: cfg.title, color: cfg.color, bg: cfg.bg, border: cfg.bdr, detail: keyEv.message || '', duration: cfg.dur || 2500 })
          }
          // phase transition
          if (cfg?.phase) setMatchPhase(cfg.phase)
          // restore 'playing' after second_half_start entry animation
          if (cfg?.phase === 'second_half') setTimeout(() => setMatchPhase('playing'), 3600)
        }

        // field effects
        const newFx = []
        const bx = payload.ball?.x ?? 50
        const by = payload.ball?.y ?? 32
        for (const e of payload.events) {
          const id = ++fxIdRef.current
          if (e.kind === 'foul') {
            newFx.push({ id, type: 'foul', x: bx, y: by })
          } else if (e.kind === 'free_kick') {
            newFx.push({ id, type: 'free_kick', x: bx, y: by })
          } else if (e.kind === 'corner') {
            newFx.push({ id, type: 'corner', x: bx < 50 ? 1 : 99, y: by < 32 ? 1 : 63 })
          } else if (e.kind === 'yellow_card') {
            const pl = payload.players?.find((p) => p.id === e.playerId)
            newFx.push({ id, type: 'yellow_card', x: pl?.x ?? bx, y: pl?.y ?? by })
          } else if (e.kind === 'red_card') {
            const pl = payload.players?.find((p) => p.id === e.playerId)
            newFx.push({ id, type: 'red_card', x: pl?.x ?? bx, y: pl?.y ?? by })
          } else if (e.kind === 'argument') {
            newFx.push({ id, type: 'argument', x: bx, y: by })
          } else if (e.kind === 'substitution') {
            newFx.push({ id, type: 'substitution', x: bx, y: by })
          } else if (e.kind === 'var') {
            newFx.push({ id, type: 'var', x: 50, y: 32 })
          } else if (e.kind === 'goal') {
            newFx.push({ id, type: 'goal', x: bx, y: by })
          }
        }
        if (newFx.length > 0) {
          setFieldFx((prev) => [...prev, ...newFx].slice(-10))
          const ids = new Set(newFx.map((f) => f.id))
          setTimeout(() => setFieldFx((prev) => prev.filter((f) => !ids.has(f.id))), 3200)
        }

        const ended = payload.events.some((e) => e.kind === 'match_end')
        if (ended && !matchEndFiredRef.current) {
          matchEndFiredRef.current = true
          const home = Number(payload?.score?.home || 0)
          const away = Number(payload?.score?.away || 0)
          onMatchEnd?.({ home, away, didWin: home > away, isDraw: home === away })
        }
      }
    }

    es.onopen = () => {
      setConnState('Live')
    }
    es.onerror = () => {
      setConnState('SSE reconnecting...')
    }
    es.addEventListener('match_tick', (event) => handleEvent(event.data))
    es.onmessage = (event) => handleEvent(event.data)

    return () => es.close()
  }, [onMatchEnd])

  // auto-clear popup after its configured duration
  useEffect(() => {
    if (!popup) return undefined
    const t = window.setTimeout(() => setPopup(null), popup.duration || 2500)
    return () => window.clearTimeout(t)
  }, [popup])

  // RAF loop: smooth-lerp players AND ball
  useEffect(() => {
    let raf = 0
    const animate = () => {
      const phase = matchPhaseRef.current
      const isTunnel = phase === 'half_time' || phase === 'full_time'
      const isEntry  = phase === 'second_half'

      // lerp players
      setDisplayPlayers((current) => {
        if (current.length === 0) return current
        let changed = false
        const next = current.map((p) => {
          let tx, ty
          if (isTunnel) {
            // guide players toward bottom-center tunnel opening
            tx = 50 + (p.teamId === 'home' ? -8 : 8)
            ty = 62
          } else {
            const target = targetsRef.current.get(p.id)
            if (!target) return p
            tx = target.x
            ty = target.y
          }
          const alpha = isTunnel ? 0.035 : isEntry ? 0.055 : 0.22
          const nx = lerp(p.x, tx, alpha)
          const ny = lerp(p.y, ty, alpha)
          const target = targetsRef.current.get(p.id)
          const hasBall = isTunnel ? false : (target?.hasBall ?? p.hasBall)
          if (Math.abs(nx - p.x) > 0.003 || Math.abs(ny - p.y) > 0.003 || p.hasBall !== hasBall) {
            changed = true
            return { ...p, x: nx, y: ny, hasBall, teamId: target?.teamId ?? p.teamId, role: target?.role ?? p.role }
          }
          return p
        })
        return changed ? next : current
      })

      // lerp ball — speed varies by event (shot fast, pass medium, default slow)
      setDisplayBall((prev) => {
        const tgt = isTunnel ? { x: 50, y: 62 } : ballTargetRef.current
        const alpha = isTunnel ? 0.035 : ballAlphaRef.current
        const nx = lerp(prev.x, tgt.x, alpha)
        const ny = lerp(prev.y, tgt.y, alpha)
        if (Math.abs(nx - prev.x) < 0.003 && Math.abs(ny - prev.y) < 0.003) return prev
        return { x: nx, y: ny }
      })

      raf = window.requestAnimationFrame(animate)
    }
    raf = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const minuteText = useMemo(() => formatMatchTime(elapsedMS), [elapsedMS])

  // ── SVG field effects renderer ─────────────────────────────────────────────
  function renderFx(fx) {
    switch (fx.type) {
      case 'foul':
        return (
          <g key={fx.id}>
            <circle cx={fx.x} cy={fx.y} r="1" fill="none" stroke="#f97316" strokeWidth="0.5">
              <animate attributeName="r"       from="1"   to="8"   dur="0.9s" repeatCount="2" />
              <animate attributeName="opacity" from="0.9" to="0"   dur="0.9s" repeatCount="2" />
            </circle>
            <text x={fx.x} y={fx.y - 5} textAnchor="middle" fill="#fb923c" fontSize="3" fontWeight="bold">
              ⚠
              <animate attributeName="opacity" values="1;1;0" dur="2.5s" fill="freeze" />
            </text>
          </g>
        )
      case 'free_kick':
        return (
          <g key={fx.id}>
            <circle cx={fx.x} cy={fx.y} r="2" fill="none" stroke="#38bdf8" strokeWidth="0.4" strokeDasharray="0.8 0.8">
              <animate attributeName="r"       from="2"   to="9"   dur="1.1s" repeatCount="2" />
              <animate attributeName="opacity" from="0.8" to="0"   dur="1.1s" repeatCount="2" />
            </circle>
            <text x={fx.x} y={fx.y - 6} textAnchor="middle" fill="#7dd3fc" fontSize="2.2" fontWeight="bold">
              ĐÁ PHẠT
              <animate attributeName="opacity" values="0;1;1;0" dur="2.5s" fill="freeze" />
            </text>
          </g>
        )
      case 'corner':
        return (
          <g key={fx.id}>
            <circle cx={fx.x} cy={fx.y} r="1" fill="#14b8a6" opacity="0.6">
              <animate attributeName="r"       from="1"   to="7"   dur="1s" repeatCount="2" />
              <animate attributeName="opacity" from="0.7" to="0"   dur="1s" repeatCount="2" />
            </circle>
            <text
              x={fx.x + (fx.x < 50 ? 5 : -5)}
              y={fx.y + (fx.y < 32 ? 4 : -3)}
              textAnchor="middle" fill="#99f6e4" fontSize="2.4" fontWeight="bold"
            >
              🚩
              <animate attributeName="opacity" values="0;1;1;0" dur="2.2s" fill="freeze" />
            </text>
          </g>
        )
      case 'yellow_card':
        return (
          <g key={fx.id} transform={`translate(${fx.x}, ${fx.y})`}>
            <rect x="-1.1" y="-2" width="2.2" height="3" rx="0.3" fill="#fde047">
              <animate attributeName="y"       from="0"   to="-6"  dur="2.5s" fill="freeze" />
              <animate attributeName="opacity" values="0;1;1;1;0" dur="2.5s" fill="freeze" />
            </rect>
          </g>
        )
      case 'red_card':
        return (
          <g key={fx.id} transform={`translate(${fx.x}, ${fx.y})`}>
            <rect x="-1.1" y="-2" width="2.2" height="3" rx="0.3" fill="#ef4444">
              <animate attributeName="y"       from="0"   to="-7"  dur="2.5s" fill="freeze" />
              <animate attributeName="opacity" values="0;1;1;1;0" dur="2.5s" fill="freeze" />
            </rect>
          </g>
        )
      case 'argument':
        return (
          <g key={fx.id}>
            {[-3.5, 0, 3.5].map((dx, i) => (
              <text key={i} x={fx.x + dx} y={fx.y} textAnchor="middle" fill="#c084fc" fontSize="3" fontWeight="bold">
                !
                <animate attributeName="y"       from={fx.y}   to={fx.y - 5 - i}     dur={`${1.4 + i * 0.25}s`} fill="freeze" />
                <animate attributeName="opacity" values="0;1;1;0"                    dur={`${2 + i * 0.2}s`}    fill="freeze" />
              </text>
            ))}
          </g>
        )
      case 'substitution':
        return (
          <g key={fx.id}>
            <text x={fx.x - 3} y={fx.y} textAnchor="middle" fill="#34d399" fontSize="3.5" fontWeight="bold">
              ↑
              <animate attributeName="opacity" values="1;1;0" dur="2.8s" fill="freeze" />
              <animate attributeName="y" from={String(fx.y)} to={String(fx.y - 5)} dur="2.8s" fill="freeze" />
            </text>
            <text x={fx.x + 3} y={fx.y} textAnchor="middle" fill="#f87171" fontSize="3.5" fontWeight="bold">
              ↓
              <animate attributeName="opacity" values="1;1;0" dur="2.8s" fill="freeze" />
              <animate attributeName="y" from={String(fx.y)} to={String(fx.y + 5)} dur="2.8s" fill="freeze" />
            </text>
          </g>
        )
      case 'var':
        return (
          <g key={fx.id}>
            <rect x="1" y="1" width="98" height="62" fill="none" stroke="#3b82f6" strokeWidth="1.2">
              <animate attributeName="opacity" values="0.6;0.1;0.6;0.1;0.6;0" dur="3.5s" fill="freeze" />
            </rect>
            <rect x="0" y="0" width={F.w} height="1.5" fill="#3b82f6" opacity="0.35">
              <animate attributeName="y"       from="0"   to={String(F.h)} dur="1s" repeatCount="3" />
              <animate attributeName="opacity" from="0.4" to="0"           dur="3.5s" fill="freeze" />
            </rect>
            <text x="50" y="35" textAnchor="middle" fill="#93c5fd" fontSize="6" fontWeight="bold" letterSpacing="2">
              VAR
              <animate attributeName="opacity" values="0;0.8;0.8;0.8;0" dur="3.5s" fill="freeze" />
            </text>
          </g>
        )
      case 'goal':
        return (
          <g key={fx.id}>
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i / 16) * 2 * Math.PI
              const colors = ['#f6d87a','#f97316','#22c55e','#3b82f6','#ec4899','#a855f7']
              return (
                <circle key={i} cx={fx.x} cy={fx.y} r="0.55" fill={colors[i % colors.length]}>
                  <animate attributeName="cx" from={String(fx.x)} to={String(fx.x + Math.cos(angle) * 15)} dur="1.1s" fill="freeze" />
                  <animate attributeName="cy" from={String(fx.y)} to={String(fx.y + Math.sin(angle) * 15)} dur="1.1s" fill="freeze" />
                  <animate attributeName="opacity" from="1" to="0" begin="0.5s" dur="0.8s" fill="freeze" />
                </circle>
              )
            })}
          </g>
        )
      default:
        return null
    }
  }

  const isTunnelPhase = matchPhase === 'half_time' || matchPhase === 'full_time'
  const isEntryPhase  = matchPhase === 'second_half'

  return (
    <section
      className={`mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 ${
        embedded ? 'p-0 lg:grid-cols-[1fr_360px]' : 'min-h-screen p-4 lg:grid-cols-[1fr_380px] lg:p-6'
      }`}
    >
      {/* ── Field panel ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1b2458] bg-[linear-gradient(165deg,#020205_0%,#060b22_100%)] p-3 shadow-[0_30px_70px_-40px_rgba(0,0,128,0.7)]">
        {/* Header bar */}
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[#1b2458] bg-black/35 px-4 py-3 text-xs tracking-[0.18em] text-slate-300 sm:text-sm">
          <p>LIVE MATCH</p>
          <p className="font-semibold text-[#f6d87a]">{connState}</p>
          <p>{minuteText}</p>
        </div>

        {/* SVG pitch */}
        <div className="rounded-xl border border-[#25306f] bg-[#06133a] p-2 sm:p-3">
          <svg
            viewBox={`0 0 ${F.w} ${F.h}`}
            className={`w-full overflow-visible rounded-lg bg-[#0b2f14] ${embedded ? 'h-[48vh] min-h-[360px]' : 'h-[58vh] min-h-[420px]'}`}
          >
            <defs>
              <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#114726" />
                <stop offset="100%" stopColor="#0c351d" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="ball-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="0.6" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Grass */}
            <rect x="0" y="0" width={F.w} height={F.h} fill="url(#grass)" />
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x={i * 10} y="0" width="5" height={F.h} fill="rgba(255,255,255,0.03)" />
            ))}

            {/* Lines */}
            <rect x="1" y="1" width="98" height="62" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <line x1="50" y1="1" x2="50" y2="63" stroke="#cbd5e1" strokeWidth="0.35" />
            <circle cx="50" cy="32" r="7.3" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <circle cx="50" cy="32" r="0.55" fill="#cbd5e1" />

            {/* Goals */}
            <rect x="1"  y="22" width="8" height="20" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <rect x="91" y="22" width="8" height="20" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <rect x="1"  y="26" width="3" height="12" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <rect x="96" y="26" width="3" height="12" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />

            {/* Penalty arcs */}
            <path d="M 9 26 A 8 8 0 0 1 9 38"   fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <path d="M 91 26 A 8 8 0 0 0 91 38"  fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <circle cx="8"  cy="32" r="0.45" fill="#cbd5e1" />
            <circle cx="92" cy="32" r="0.45" fill="#cbd5e1" />

            {/* Field effects (below players) */}
            {fieldFx.map((fx) => renderFx(fx))}

            {/* Players */}
            {displayPlayers.map((player) => {
              const isHome = player.teamId === 'home'
              const fill   = isHome ? '#13206d' : '#1a0524'
              const stroke = isHome ? '#7f9cff' : '#f472b6'
              return (
                <g key={player.id} transform={`translate(${player.x}, ${player.y})`}>
                  {player.hasBall && (
                    <circle r="2.4" fill="none" stroke="#f6d87a" strokeWidth="0.22" opacity="0.65">
                      <animate attributeName="r"       values="2;2.7;2"     dur="0.85s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.65;0.2;0.65" dur="0.85s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle r="1.4" fill={fill} stroke={stroke} strokeWidth="0.28" filter="url(#glow)" />
                  <text y="2.9" textAnchor="middle" fill="#f8fafc" fontSize="1.1" fontWeight="600">
                    {player.role}
                  </text>
                </g>
              )
            })}

            {/* Ball — smooth-lerped, rendered last (top layer) */}
            <g transform={`translate(${displayBall.x}, ${displayBall.y})`}>
              <circle r="0.95" fill="white" opacity="0.12" />
              <circle r="0.62" fill="#f8fafc" stroke="#111827" strokeWidth="0.14" filter="url(#ball-glow)" />
              <circle r="0.22" fill="#374151" />
            </g>

            {/* Tunnel / phase overlay */}
            {(isTunnelPhase || isEntryPhase) && (
              <g>
                <rect x="0" y="0" width={F.w} height={F.h} fill="rgba(0,0,0,0.72)">
                  <animate
                    attributeName="opacity"
                    values={isEntryPhase ? '0.72;0.72;0' : '0;0.72;0.72'}
                    dur="2.8s"
                    fill="freeze"
                  />
                </rect>
                <text x="50" y="29" textAnchor="middle" fill="#f1f5f9" fontSize="3.8" fontWeight="bold" letterSpacing="1">
                  {isTunnelPhase && matchPhase === 'half_time' && 'CÁC CẦU THỦ VÀO ĐƯỜNG HẦM'}
                  {isTunnelPhase && matchPhase === 'full_time'  && 'KẾT THÚC TRẬN ĐẤU'}
                  {isEntryPhase  && 'CÁC CẦU THỦ RA SÂN'}
                  <animate attributeName="opacity" values="0;1;1" dur="0.9s" fill="freeze" />
                </text>
                <text x="50" y="36" textAnchor="middle" fill="#94a3b8" fontSize="2.4">
                  {isTunnelPhase && matchPhase === 'half_time' && 'Nghỉ giữa hiệp...'}
                  {isTunnelPhase && matchPhase === 'full_time'  && 'Cảm ơn đã theo dõi'}
                  {isEntryPhase  && 'Hiệp 2 sắp bắt đầu...'}
                  <animate attributeName="opacity" values="0;1;1" dur="1.1s" fill="freeze" />
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Score bar */}
        <div className="mt-3 flex items-center justify-center gap-5 rounded-xl border border-[#1b2458] bg-black/40 px-4 py-3">
          <p className="text-sm font-semibold tracking-wider text-slate-200">FC NAVY</p>
          <p className="font-['Space_Grotesk'] text-3xl font-bold text-[#f6d87a]">
            {score.home} &ndash; {score.away}
          </p>
          <p className="text-sm font-semibold tracking-wider text-slate-200">BLACK UNITED</p>
        </div>

        {/* Event popup */}
        {popup && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div
              className="animate-[popIn_260ms_cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl px-8 py-7 text-center"
              style={{
                background: `radial-gradient(circle at center, ${popup.bg} 0%, #000 100%)`,
                border: `2px solid ${popup.border}`,
                boxShadow: `0 0 60px -15px ${popup.border}88`,
              }}
            >
              <p
                className="font-['Space_Grotesk'] text-4xl font-black tracking-[0.12em]"
                style={{ color: popup.color }}
              >
                {popup.title}
              </p>
              {popup.detail && <p className="mt-2 text-sm text-slate-300">{popup.detail}</p>}
            </div>
          </div>
        )}
      </div>

      {/* ── Match log sidebar ─────────────────────────────────────────────── */}
      <aside className="flex h-full min-h-[500px] flex-col rounded-2xl border border-[#1b2458] bg-[linear-gradient(180deg,#020207_0%,#070f2f_100%)]">
        <div className="border-b border-[#1b2458] px-5 py-4">
          <p className="font-['Space_Grotesk'] text-xl font-semibold tracking-wide text-white">Match Log</p>
          <p className="mt-1 text-xs text-slate-400">Tình huống mới nhất hiển thị ở trên cùng.</p>
        </div>

        <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {matchLog.length === 0 && (
            <p className="rounded-lg border border-dashed border-[#2a387e] bg-black/25 px-4 py-6 text-center text-sm text-slate-400">
              Đang chờ dữ liệu trận đấu từ SSE...
            </p>
          )}

          {matchLog.map((item) => {
            const cfg = EV[item.kind]
            const isHighlight = !!cfg?.title
            return (
              <div
                key={item.id}
                className={`rounded-lg border px-3 py-2 transition-colors ${isHighlight ? 'bg-black/45' : 'bg-black/20'}`}
                style={{ borderColor: cfg?.bdr ?? '#223074' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="text-[11px] font-semibold tracking-[0.1em]"
                    style={{ color: cfg?.color ?? '#e2e8f0' }}
                  >
                    {item.label}
                  </p>
                  <p className="shrink-0 text-[11px] text-slate-400">{item.time}</p>
                </div>
                {item.message && <p className="mt-0.5 text-sm text-slate-300">{item.message}</p>}
              </div>
            )
          })}
        </div>
      </aside>
    </section>
  )
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function formatMatchTime(elapsedMS) {
  const s = Math.floor(elapsedMS / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default MatchView
