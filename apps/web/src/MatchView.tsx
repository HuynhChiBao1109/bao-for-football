// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';

const F = { w: 100, h: 64 };
const MATCH_WS_BASE_URL =
  import.meta.env.VITE_MATCH_WS_URL ||
  import.meta.env.VITE_WS_URL ||
  deriveMatchWebSocketURL(import.meta.env.VITE_MATCH_SSE_URL) ||
  'ws://localhost:8081/ws';

// Per-event display config: label (log), title (popup), color, bg, border, duration(ms)
const EV = {
  goal: {
    label: '⚽ GOAL',
    title: 'GOAL!',
    color: '#f6d87a',
    bg: '#2d1600',
    bdr: '#f6d87a',
    dur: 3200,
  },
  var: {
    label: '📺 VAR',
    title: 'VAR REVIEW',
    color: '#93c5fd',
    bg: '#030e2b',
    bdr: '#3b82f6',
    dur: 4000,
  },
  yellow_card: {
    label: '🟨 Thẻ Vàng',
    title: 'THẺ VÀNG',
    color: '#fde047',
    bg: '#1c1200',
    bdr: '#fde047',
    dur: 2500,
  },
  red_card: {
    label: '🟥 Thẻ Đỏ',
    title: 'THẺ ĐỎ!',
    color: '#f87171',
    bg: '#1c0000',
    bdr: '#ef4444',
    dur: 2800,
  },
  foul: {
    label: '⚠️ Phạm Lỗi',
    title: 'PHẠM LỖI',
    color: '#fdba74',
    bg: '#1c0800',
    bdr: '#f97316',
    dur: 2200,
  },
  free_kick: {
    label: '🦵 Đá Phạt',
    title: 'ĐÁ PHẠT',
    color: '#bae6fd',
    bg: '#021020',
    bdr: '#38bdf8',
    dur: 2500,
  },
  corner: {
    label: '🚩 Phạt Góc',
    title: 'PHẠT GÓC',
    color: '#99f6e4',
    bg: '#021210',
    bdr: '#14b8a6',
    dur: 2000,
  },
  argument: {
    label: '😤 Cãi Lộn',
    title: 'CÃI LỘN!',
    color: '#d8b4fe',
    bg: '#0d0420',
    bdr: '#a855f7',
    dur: 2500,
  },
  substitution: {
    label: '🔄 Thay Người',
    title: 'THAY NGƯỜI',
    color: '#6ee7b7',
    bg: '#020f09',
    bdr: '#10b981',
    dur: 3000,
  },
  half_time: {
    label: '⏸ Hết Hiệp 1',
    title: 'HẾT HIỆP 1',
    color: '#e2e8f0',
    bg: '#060b18',
    bdr: '#64748b',
    dur: 5000,
    phase: 'half_time',
  },
  second_half_start: {
    label: '▶ Hiệp 2',
    title: 'HIỆP 2 BẮT ĐẦU',
    color: '#bfdbfe',
    bg: '#030a1c',
    bdr: '#3b82f6',
    dur: 3000,
    phase: 'second_half',
  },
  match_end: {
    label: '🏁 Kết Thúc',
    title: 'KẾT THÚC TRẬN',
    color: '#e4e4e7',
    bg: '#050505',
    bdr: '#52525b',
    dur: 5500,
    phase: 'full_time',
  },
  kickoff: {
    label: '⚽ Giao Bóng',
    title: 'KICK OFF',
    color: '#bbf7d0',
    bg: '#020f06',
    bdr: '#22c55e',
    dur: 2000,
  },
  through_ball: {
    label: '🎯 Chọc Khe',
    title: 'CHỌC KHE TINH TẾ!',
    color: '#38bdf8',
    bg: '#031422',
    bdr: '#0ea5e9',
    dur: 2200,
  },
  long_pass: {
    label: '🚀 Phất Bóng',
    title: 'ĐƯỜNG CHUYỀN DÀI!',
    color: '#c084fc',
    bg: '#0e0318',
    bdr: '#a855f7',
    dur: 2200,
  },
  cross: {
    label: '📐 Tạt Cánh',
    title: 'ĐƯỜNG TẠT CÁNH!',
    color: '#22c55e',
    bg: '#020f06',
    bdr: '#4ade80',
    dur: 2200,
  },
  clearance: {
    label: '🛡️ Phá Bóng',
    title: 'PHÁ BÓNG GIẢI NGUY!',
    color: '#fb7185',
    bg: '#1c050a',
    bdr: '#f43f5e',
    dur: 2000,
  },
  tackle: {
    label: '⚡ Cướp Bóng',
    title: 'ĐÁNH CHẶN CHUẨN XÁC!',
    color: '#34d399',
    bg: '#021008',
    bdr: '#10b981',
    dur: 1800,
  },
  sliding_tackle: {
    label: '💥 Xoạc Bóng',
    title: 'XOẠC BÓNG QUYẾT LIỆT!',
    color: '#f43f5e',
    bg: '#250005',
    bdr: '#ef4444',
    dur: 2600,
  },
  great_save: {
    label: '🧤 Cản Phá',
    title: 'CỨU THUA XUẤT THẦN!',
    color: '#6ee7b7',
    bg: '#02100a',
    bdr: '#34d399',
    dur: 2800,
  },
  save: {
    label: '🧤 Cứu Thua',
    title: 'THỦ MÔN CẢN PHÁ',
    color: '#a7f3d0',
    bg: '#042f2e',
    bdr: '#059669',
    dur: 2000,
  },
  blocked_shot: {
    label: '🛡️ Chắn Bóng',
    title: 'CẢN PHÁ CÚ SÚT!',
    color: '#fb923c',
    bg: '#180a02',
    bdr: '#f97316',
    dur: 1800,
  },
  woodwork_hit: {
    label: '🥅 Xà Cột',
    title: 'BÓNG TRÚNG XÀ / CỘT!',
    color: '#f43f5e',
    bg: '#1e0205',
    bdr: '#e11d48',
    dur: 3000,
  },
  rebound: {
    label: '🔄 Rebound',
    title: 'BÓNG BẬT RA!',
    color: '#fcd34d',
    bg: '#181002',
    bdr: '#f59e0b',
    dur: 2000,
  },
  player_celebration: {
    label: '🎉 Ăn Mừng',
    title: 'ĂN MỪNG BÀN THẮNG!',
    color: '#f472b6',
    bg: '#1c0010',
    bdr: '#ec4899',
    dur: 2800,
  },
  captain_argument: {
    label: '😤 Phản Đối',
    title: 'TRANH CÃI GAY GẮT!',
    color: '#d8b4fe',
    bg: '#0d0420',
    bdr: '#a855f7',
    dur: 2500,
  },
  referee_warning: {
    label: '🟨 Nhắc Nhở',
    title: 'TRỌNG TÀI CẢNH CÁO!',
    color: '#fdba74',
    bg: '#180702',
    bdr: '#f97316',
    dur: 2200,
  },
  domination_phase: {
    label: '🔥 Áp Đảo',
    title: 'THẾ TRẬN ÁP ĐẢO!',
    color: '#f87171',
    bg: '#1c0205',
    bdr: '#ef4444',
    dur: 3200,
  },
  momentum_shift: {
    label: '📈 Đổi Nhịp',
    title: 'THAY ĐỔI NHỊP ĐỘ!',
    color: '#60a5fa',
    bg: '#020b1c',
    bdr: '#3b82f6',
    dur: 2600,
  },
  fatigue_warning: {
    label: '💤 Đuối Sức',
    title: 'CẦU THỦ SUY KIỆT!',
    color: '#94a3b8',
    bg: '#0f172a',
    bdr: '#64748b',
    dur: 2500,
  },
  penalty_awarded: {
    label: '🎯 Phạt Đền',
    title: 'THỔI PHẠT ĐỀN!',
    color: '#fca5a5',
    bg: '#310404',
    bdr: '#ef4444',
    dur: 3000,
  },
  penalty_missed: {
    label: '❌ Hỏng Phạt Đền',
    title: 'SÚT HỎNG PHẠT ĐỀN!',
    color: '#f87171',
    bg: '#1a0505',
    bdr: '#ef4444',
    dur: 2800,
  },
  penalty_saved: {
    label: '🧤 Cứu Phạt Đền',
    title: 'ĐẨY PHẠT ĐỀN THÀNH CÔNG!',
    color: '#34d399',
    bg: '#021008',
    bdr: '#10b981',
    dur: 3000,
  },
  pass: { label: 'Chuyền Bóng' },
  interception: { label: '🛡 Cắt Bóng', color: '#fca5a5', bdr: '#dc2626' },
  shot: {
    label: '⚡ Sút Bóng',
    title: 'CÚ SÚT NGUY HIỂM!',
    color: '#fbbf24',
    bg: '#1a0d02',
    bdr: '#f59e0b',
    dur: 2600,
  },
  possession_change: { label: 'Đổi Bóng' },
};

const EMPTY_TEAM_STATS = {
  passes: 0,
  successfulPasses: 0,
  possessionTicks: 0,
  shots: 0,
  shotsOnTarget: 0,
  goals: 0,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
  corners: 0,
};

const INITIAL_MATCH_STATS = {
  home: { ...EMPTY_TEAM_STATS },
  away: { ...EMPTY_TEAM_STATS },
};

function MatchView({ embedded = false, onMatchEnd, matchId = '' }) {
  const [connState, setConnState] = useState('Connecting...');
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [elapsedMS, setElapsedMS] = useState(0);
  const [popup, setPopup] = useState(null);
  const [matchStats, setMatchStats] = useState(INITIAL_MATCH_STATS);
  const [displayPlayers, setDisplayPlayers] = useState([]);
  const [displayBall, setDisplayBall] = useState({
    x: 50,
    y: 32,
    height: 0,
    vx: 0,
    vy: 0,
  });
  const [debugOverlay, setDebugOverlay] = useState({
    gameplay: null,
    passPreview: null,
  });
  const [fieldFx, setFieldFx] = useState([]); // on-SVG effects
  const [matchPhase, setMatchPhase] = useState('playing'); // 'playing'|'half_time'|'second_half'|'full_time'

  const targetsRef = useRef(new Map());
  const ballTargetRef = useRef({ x: 50, y: 32, height: 0, vx: 0, vy: 0 });
  const ballAlphaRef = useRef(0.3);
  const matchPhaseRef = useRef('playing');
  const matchEndFiredRef = useRef(false);
  const fxIdRef = useRef(0);
  const lastTickRef = useRef(-1);
  const scorersRef = useRef([]);
  const matchStatsRef = useRef(INITIAL_MATCH_STATS);
  const eventQueueRef = useRef([]);
  const eventQueueTimerRef = useRef(0);

  const matchWSURL = useMemo(() => {
    return buildMatchWebSocketURL(MATCH_WS_BASE_URL, matchId);
  }, [matchId]);

  // keep phase ref in sync
  useEffect(() => {
    matchPhaseRef.current = matchPhase;
  }, [matchPhase]);

  useEffect(() => {
    setConnState('Connecting...');
    setScore({ home: 0, away: 0 });
    setElapsedMS(0);
    setPopup(null);
    setMatchStats(INITIAL_MATCH_STATS);
    matchStatsRef.current = INITIAL_MATCH_STATS;
    setDisplayPlayers([]);
    setDisplayBall({ x: 50, y: 32, height: 0, vx: 0, vy: 0 });
    setDebugOverlay({ gameplay: null, passPreview: null });
    setFieldFx([]);
    setMatchPhase('playing');
    targetsRef.current = new Map();
    ballTargetRef.current = { x: 50, y: 32, height: 0, vx: 0, vy: 0 };
    ballAlphaRef.current = 0.3;
    matchPhaseRef.current = 'playing';
    matchEndFiredRef.current = false;
    lastTickRef.current = -1;
    scorersRef.current = [];
    eventQueueRef.current = [];
    if (eventQueueTimerRef.current) {
      window.clearTimeout(eventQueueTimerRef.current);
      eventQueueTimerRef.current = 0;
    }

    let socket;
    let reconnectTimer = 0;
    let closed = false;

    const processQueuedMatchEvent = (entry) => {
      const { event, payload } = entry;
      if (!event) return;

      if (event.kind === 'shot') ballAlphaRef.current = 0.5;
      else if (event.kind === 'pass') ballAlphaRef.current = 0.36;
      else ballAlphaRef.current = 0.24;

      const cfg = EV[event.kind];
      if (cfg?.title) {
        let msg = event.message || '';
        if (event.kind === 'shot' && event.shotPower) {
          msg = `🔥 Lực sút: ${event.shotPower} km/h\n🧤 Khả năng cản phá của thủ môn: ${event.gkCapability}%`;
        }
        setPopup({
          kind: event.kind,
          title: cfg.title,
          color: cfg.color,
          bg: cfg.bg,
          border: cfg.bdr,
          detail: msg,
          duration: cfg.dur || 2500,
        });
      }
      if (cfg?.phase) setMatchPhase(cfg.phase);
      if (cfg?.phase === 'second_half') {
        setTimeout(() => setMatchPhase('playing'), 3600);
      }

      const bx = payload.ball?.x ?? 50;
      const by = payload.ball?.y ?? 32;
      const id = ++fxIdRef.current;
      let fx = null;
      if (event.kind === 'foul') {
        fx = { id, type: 'foul', x: bx, y: by };
      } else if (event.kind === 'free_kick') {
        fx = { id, type: 'free_kick', x: bx, y: by };
      } else if (event.kind === 'corner') {
        fx = { id, type: 'corner', x: bx < 50 ? 1 : 99, y: by < 32 ? 1 : 63 };
      } else if (event.kind === 'yellow_card') {
        const pl = payload.players?.find((p) => p.id === event.playerId);
        fx = { id, type: 'yellow_card', x: pl?.x ?? bx, y: pl?.y ?? by };
      } else if (event.kind === 'red_card') {
        const pl = payload.players?.find((p) => p.id === event.playerId);
        fx = { id, type: 'red_card', x: pl?.x ?? bx, y: pl?.y ?? by };
      } else if (event.kind === 'argument') {
        fx = { id, type: 'argument', x: bx, y: by };
      } else if (event.kind === 'substitution') {
        fx = { id, type: 'substitution', x: bx, y: by };
      } else if (event.kind === 'var') {
        fx = { id, type: 'var', x: 50, y: 32 };
      } else if (event.kind === 'goal') {
        fx = { id, type: 'goal', x: bx, y: by };
      } else if (event.kind === 'kickoff') {
        fx = { id, type: 'kickoff', x: 50, y: 32 };
      } else if (event.kind === 'shot') {
        fx = {
          id,
          type: 'shot',
          x: bx,
          y: by,
          vx: payload.ball?.vx || 0,
          vy: payload.ball?.vy || 0,
          power: event.shotPower || 0,
        };
      }

      if (fx) {
        setFieldFx((prev) => [...prev, fx].slice(-10));
        setTimeout(() => {
          setFieldFx((prev) => prev.filter((f) => f.id !== id));
        }, 3200);
      }

      if (event.kind === 'goal') {
        scorersRef.current.push({
          teamId: event.teamId,
          playerId: Number(event.playerId || 0),
          minute: Math.floor(Number(payload.elapsedMs || 0) / 1000 / 60),
        });
      }

      if (event.kind === 'match_end' && !matchEndFiredRef.current) {
        matchEndFiredRef.current = true;
        const home = Number(payload?.score?.home || 0);
        const away = Number(payload?.score?.away || 0);
        onMatchEnd?.({
          matchId,
          home,
          away,
          homeStats: matchStatsRef.current.home,
          awayStats: matchStatsRef.current.away,
          scorers: scorersRef.current,
          didWin: home > away,
          isDraw: home === away,
        });
      }
    };

    const drainEventQueue = () => {
      if (closed) return;
      const next = eventQueueRef.current.shift();
      if (!next) {
        eventQueueTimerRef.current = 0;
        return;
      }

      processQueuedMatchEvent(next);
      eventQueueTimerRef.current = window.setTimeout(drainEventQueue, 55);
    };

    const enqueueMatchEvents = (payload) => {
      if (!Array.isArray(payload?.events) || payload.events.length === 0) return;
      for (const event of payload.events) {
        eventQueueRef.current.push({ event, payload });
      }

      if (!eventQueueTimerRef.current) {
        drainEventQueue();
      }
    };

    const handleEvent = (rawData) => {
      let payload;
      try {
        payload = JSON.parse(rawData);
      } catch {
        return;
      }
      if (payload?.type !== 'match_tick') return;
      if (matchId && payload?.matchId !== matchId) return;
      const isReplay = Boolean(payload?.replay);

      const tick = Number(payload.tick ?? -1);
      if (tick >= 0) {
        if (tick === lastTickRef.current) return;
        lastTickRef.current = tick;
      }

      setScore(payload.score || { home: 0, away: 0 });
      setElapsedMS(payload.elapsedMs || 0);
      setMatchStats((prev) => {
        const next = accumulateMatchStats(prev, payload);
        matchStatsRef.current = next;
        return next;
      });

      // update ball target (smooth lerp happens in RAF)
      if (payload.ball) {
        ballTargetRef.current = {
          x: payload.ball.x,
          y: payload.ball.y,
          height: Number(payload.ball.height || 0),
          vx: Number(payload.ball.vx || 0),
          vy: Number(payload.ball.vy || 0),
        };
      }

      if (Array.isArray(payload.players)) {
        for (const pl of payload.players) targetsRef.current.set(pl.id, pl);
        setDisplayPlayers((prev) =>
          prev.length > 0 ? prev : payload.players.map((pl) => ({ ...pl })),
        );
      }

      if (payload.debug) {
        setDebugOverlay({
          gameplay: payload.debug.gameplay || null,
          passPreview: payload.debug.passPreview || null,
        });
      }

      if (!isReplay) {
        enqueueMatchEvents(payload);
      }
    };

    const connect = () => {
      if (closed) return;

      socket = new WebSocket(matchWSURL);
      socket.onopen = () => {
        setConnState('Live');
      };
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          handleEvent(event.data);
        }
      };
      socket.onerror = () => {
        setConnState('Socket reconnecting...');
        socket?.close();
      };
      socket.onclose = () => {
        if (closed) return;
        setConnState('Socket reconnecting...');
        reconnectTimer = window.setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (eventQueueTimerRef.current) {
        window.clearTimeout(eventQueueTimerRef.current);
        eventQueueTimerRef.current = 0;
      }
      socket?.close();
    };
  }, [matchId, matchWSURL, onMatchEnd]);

  // auto-clear popup after its configured duration
  useEffect(() => {
    if (!popup) return undefined;
    const t = window.setTimeout(() => setPopup(null), popup.duration || 2500);
    return () => window.clearTimeout(t);
  }, [popup]);

  // RAF loop: smooth-lerp players AND ball
  useEffect(() => {
    let raf = 0;
    const animate = () => {
      const phase = matchPhaseRef.current;
      const isTunnel = phase === 'half_time' || phase === 'full_time';
      const isEntry = phase === 'second_half';

      // lerp players
      setDisplayPlayers((current) => {
        if (current.length === 0) return current;
        let changed = false;
        const next = current.map((p) => {
          let tx, ty;
          if (isTunnel) {
            // guide players toward bottom-center tunnel opening
            tx = 50 + (p.teamId === 'home' ? -8 : 8);
            ty = 62;
          } else {
            const target = targetsRef.current.get(p.id);
            if (!target) return p;
            tx = target.x;
            ty = target.y;
          }
          const alpha = isTunnel ? 0.03 : isEntry ? 0.05 : 0.16;
          const nx = lerp(p.x, tx, alpha);
          const ny = lerp(p.y, ty, alpha);
          const target = targetsRef.current.get(p.id);
          const hasBall = isTunnel ? false : (target?.hasBall ?? p.hasBall);
          if (Math.abs(nx - p.x) > 0.003 || Math.abs(ny - p.y) > 0.003 || p.hasBall !== hasBall) {
            changed = true;
            return {
              ...p,
              x: nx,
              y: ny,
              hasBall,
              teamId: target?.teamId ?? p.teamId,
              role: target?.role ?? p.role,
            };
          }
          return p;
        });
        return changed ? next : current;
      });

      // lerp ball — speed varies by event (shot fast, pass medium, default slow)
      setDisplayBall((prev) => {
        const tgt = isTunnel ? { x: 50, y: 62, height: 0, vx: 0, vy: 0 } : ballTargetRef.current;
        const speed = Math.hypot(Number(tgt.vx || 0), Number(tgt.vy || 0));
        const alpha = isTunnel
          ? 0.03
          : clamp(0.18 + speed * 0.08 + ballAlphaRef.current * 0.22, 0.2, 0.58);
        const nx = lerp(prev.x, tgt.x, alpha);
        const ny = lerp(prev.y, tgt.y, alpha);
        const nh = lerp(prev.height || 0, Number(tgt.height || 0), isTunnel ? 0.04 : 0.26);
        if (
          Math.abs(nx - prev.x) < 0.003 &&
          Math.abs(ny - prev.y) < 0.003 &&
          Math.abs(nh - (prev.height || 0)) < 0.01
        )
          return prev;
        return {
          x: nx,
          y: ny,
          height: nh,
          vx: Number(tgt.vx || 0),
          vy: Number(tgt.vy || 0),
        };
      });

      raf = window.requestAnimationFrame(animate);
    };
    raf = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const minuteText = useMemo(() => formatMatchTime(elapsedMS), [elapsedMS]);
  const statsRows = useMemo(() => {
    const totalPossessionTicks = matchStats.home.possessionTicks + matchStats.away.possessionTicks;

    return [
      {
        label: 'Số đường chuyền',
        home: matchStats.home.passes,
        away: matchStats.away.passes,
      },
      {
        label: '% chuyền thành công',
        home: formatPercent(matchStats.home.successfulPasses, matchStats.home.passes),
        away: formatPercent(matchStats.away.successfulPasses, matchStats.away.passes),
      },
      {
        label: 'Kiểm soát bóng',
        home: formatPossession(matchStats.home.possessionTicks, totalPossessionTicks),
        away: formatPossession(matchStats.away.possessionTicks, totalPossessionTicks),
      },
      {
        label: 'Số lần sút',
        home: matchStats.home.shots,
        away: matchStats.away.shots,
      },
      {
        label: 'Sút trúng target',
        home: Math.max(matchStats.home.shotsOnTarget, matchStats.home.goals),
        away: Math.max(matchStats.away.shotsOnTarget, matchStats.away.goals),
      },
      {
        label: 'Bàn thắng',
        home: matchStats.home.goals,
        away: matchStats.away.goals,
      },
      {
        label: 'Phạm lỗi',
        home: matchStats.home.fouls,
        away: matchStats.away.fouls,
      },
      {
        label: 'Thẻ vàng',
        home: matchStats.home.yellowCards,
        away: matchStats.away.yellowCards,
      },
      {
        label: 'Thẻ đỏ',
        home: matchStats.home.redCards,
        away: matchStats.away.redCards,
      },
      {
        label: 'Phạt góc',
        home: matchStats.home.corners,
        away: matchStats.away.corners,
      },
    ];
  }, [matchStats]);

  // ── SVG field effects renderer ─────────────────────────────────────────────
  function renderFx(fx) {
    switch (fx.type) {
      case 'foul':
        return (
          <g key={fx.id}>
            <circle cx={fx.x} cy={fx.y} r="1" fill="none" stroke="#f97316" strokeWidth="0.5">
              <animate attributeName="r" from="1" to="8" dur="0.9s" repeatCount="2" />
              <animate attributeName="opacity" from="0.9" to="0" dur="0.9s" repeatCount="2" />
            </circle>
            <text
              x={fx.x}
              y={fx.y - 5}
              textAnchor="middle"
              fill="#fb923c"
              fontSize="3"
              fontWeight="bold"
            >
              ⚠
              <animate attributeName="opacity" values="1;1;0" dur="2.5s" fill="freeze" />
            </text>
          </g>
        );
      case 'free_kick':
        return (
          <g key={fx.id}>
            <circle
              cx={fx.x}
              cy={fx.y}
              r="2"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="0.4"
              strokeDasharray="0.8 0.8"
            >
              <animate attributeName="r" from="2" to="9" dur="1.1s" repeatCount="2" />
              <animate attributeName="opacity" from="0.8" to="0" dur="1.1s" repeatCount="2" />
            </circle>
            <text
              x={fx.x}
              y={fx.y - 6}
              textAnchor="middle"
              fill="#7dd3fc"
              fontSize="2.2"
              fontWeight="bold"
            >
              ĐÁ PHẠT
              <animate attributeName="opacity" values="0;1;1;0" dur="2.5s" fill="freeze" />
            </text>
          </g>
        );
      case 'corner':
        return (
          <g key={fx.id}>
            <circle cx={fx.x} cy={fx.y} r="1" fill="#14b8a6" opacity="0.6">
              <animate attributeName="r" from="1" to="7" dur="1s" repeatCount="2" />
              <animate attributeName="opacity" from="0.7" to="0" dur="1s" repeatCount="2" />
            </circle>
            <text
              x={fx.x + (fx.x < 50 ? 5 : -5)}
              y={fx.y + (fx.y < 32 ? 4 : -3)}
              textAnchor="middle"
              fill="#99f6e4"
              fontSize="2.4"
              fontWeight="bold"
            >
              🚩
              <animate attributeName="opacity" values="0;1;1;0" dur="2.2s" fill="freeze" />
            </text>
          </g>
        );
      case 'yellow_card':
        return (
          <g key={fx.id} transform={`translate(${fx.x}, ${fx.y})`}>
            <rect x="-1.1" y="-2" width="2.2" height="3" rx="0.3" fill="#fde047">
              <animate attributeName="y" from="0" to="-6" dur="2.5s" fill="freeze" />
              <animate attributeName="opacity" values="0;1;1;1;0" dur="2.5s" fill="freeze" />
            </rect>
          </g>
        );
      case 'red_card':
        return (
          <g key={fx.id} transform={`translate(${fx.x}, ${fx.y})`}>
            <rect x="-1.1" y="-2" width="2.2" height="3" rx="0.3" fill="#ef4444">
              <animate attributeName="y" from="0" to="-7" dur="2.5s" fill="freeze" />
              <animate attributeName="opacity" values="0;1;1;1;0" dur="2.5s" fill="freeze" />
            </rect>
          </g>
        );
      case 'argument':
        return (
          <g key={fx.id}>
            {[-3.5, 0, 3.5].map((dx, i) => (
              <text
                key={i}
                x={fx.x + dx}
                y={fx.y}
                textAnchor="middle"
                fill="#c084fc"
                fontSize="3"
                fontWeight="bold"
              >
                !
                <animate
                  attributeName="y"
                  from={fx.y}
                  to={fx.y - 5 - i}
                  dur={`${1.4 + i * 0.25}s`}
                  fill="freeze"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  dur={`${2 + i * 0.2}s`}
                  fill="freeze"
                />
              </text>
            ))}
          </g>
        );
      case 'substitution':
        return (
          <g key={fx.id}>
            <text
              x={fx.x - 3}
              y={fx.y}
              textAnchor="middle"
              fill="#34d399"
              fontSize="3.5"
              fontWeight="bold"
            >
              ↑
              <animate attributeName="opacity" values="1;1;0" dur="2.8s" fill="freeze" />
              <animate
                attributeName="y"
                from={String(fx.y)}
                to={String(fx.y - 5)}
                dur="2.8s"
                fill="freeze"
              />
            </text>
            <text
              x={fx.x + 3}
              y={fx.y}
              textAnchor="middle"
              fill="#f87171"
              fontSize="3.5"
              fontWeight="bold"
            >
              ↓
              <animate attributeName="opacity" values="1;1;0" dur="2.8s" fill="freeze" />
              <animate
                attributeName="y"
                from={String(fx.y)}
                to={String(fx.y + 5)}
                dur="2.8s"
                fill="freeze"
              />
            </text>
          </g>
        );
      case 'var':
        return (
          <g key={fx.id}>
            <rect x="1" y="1" width="98" height="62" fill="none" stroke="#3b82f6" strokeWidth="1.2">
              <animate
                attributeName="opacity"
                values="0.6;0.1;0.6;0.1;0.6;0"
                dur="3.5s"
                fill="freeze"
              />
            </rect>
            <rect x="0" y="0" width={F.w} height="1.5" fill="#3b82f6" opacity="0.35">
              <animate attributeName="y" from="0" to={String(F.h)} dur="1s" repeatCount="3" />
              <animate attributeName="opacity" from="0.4" to="0" dur="3.5s" fill="freeze" />
            </rect>
            <text
              x="50"
              y="35"
              textAnchor="middle"
              fill="#93c5fd"
              fontSize="6"
              fontWeight="bold"
              letterSpacing="2"
            >
              VAR
              <animate attributeName="opacity" values="0;0.8;0.8;0.8;0" dur="3.5s" fill="freeze" />
            </text>
          </g>
        );
      case 'goal':
        return (
          <g key={fx.id}>
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i / 16) * 2 * Math.PI;
              const colors = ['#f6d87a', '#f97316', '#22c55e', '#3b82f6', '#ec4899', '#a855f7'];
              return (
                <circle key={i} cx={fx.x} cy={fx.y} r="0.55" fill={colors[i % colors.length]}>
                  <animate
                    attributeName="cx"
                    from={String(fx.x)}
                    to={String(fx.x + Math.cos(angle) * 15)}
                    dur="1.1s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="cy"
                    from={String(fx.y)}
                    to={String(fx.y + Math.sin(angle) * 15)}
                    dur="1.1s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    from="1"
                    to="0"
                    begin="0.5s"
                    dur="0.8s"
                    fill="freeze"
                  />
                </circle>
              );
            })}
          </g>
        );
      case 'kickoff':
        return (
          <g key={fx.id}>
            <circle cx={fx.x} cy={fx.y} r="1.8" fill="none" stroke="#bbf7d0" strokeWidth="0.4">
              <animate attributeName="r" values="1.8;6.2;1.8" dur="1.2s" repeatCount="2" />
              <animate attributeName="opacity" values="0.85;0.15;0.85" dur="1.2s" repeatCount="2" />
            </circle>
            <circle
              cx={fx.x}
              cy={fx.y}
              r="3.5"
              fill="none"
              stroke="#22c55e"
              strokeWidth="0.25"
              opacity="0.7"
            >
              <animate attributeName="r" values="3.5;10;3.5" dur="1.4s" repeatCount="2" />
              <animate attributeName="opacity" values="0.7;0.05;0.7" dur="1.4s" repeatCount="2" />
            </circle>
            <text
              x={fx.x}
              y={fx.y - 5}
              textAnchor="middle"
              fill="#bbf7d0"
              fontSize="2.8"
              fontWeight="bold"
            >
              GIAO BÓNG
              <animate attributeName="opacity" values="0;1;1;0" dur="2s" fill="freeze" />
            </text>
          </g>
        );
      case 'shot': {
        const norm = Math.max(Math.hypot(fx.vx || 0, fx.vy || 0), 0.1);
        const dx = ((fx.vx || 0) / norm) * (8 + (fx.power || 0) * 2);
        const dy = ((fx.vy || 0) / norm) * (8 + (fx.power || 0) * 2);
        return (
          <g key={fx.id}>
            <line
              x1={fx.x}
              y1={fx.y}
              x2={fx.x + dx}
              y2={fx.y + dy}
              stroke="#f59e0b"
              strokeWidth="0.7"
              strokeLinecap="round"
              opacity="0.8"
            >
              <animate attributeName="opacity" values="0.95;0.45;0" dur="0.55s" fill="freeze" />
            </line>
            <circle cx={fx.x} cy={fx.y} r="1" fill="none" stroke="#fbbf24" strokeWidth="0.45">
              <animate attributeName="r" from="1" to="4.4" dur="0.55s" fill="freeze" />
              <animate attributeName="opacity" from="0.9" to="0" dur="0.55s" fill="freeze" />
            </circle>
          </g>
        );
      }
      default:
        return null;
    }
  }

  const isTunnelPhase = matchPhase === 'half_time' || matchPhase === 'full_time';
  const isEntryPhase = matchPhase === 'second_half';

  return (
    <section
      className={`mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 ${
        embedded ? 'p-0' : 'min-h-screen p-4 lg:p-6'
      }`}
    >
      {/* ── Field panel ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1b2458] bg-[linear-gradient(165deg,#020205_0%,#060b22_100%)] p-3 shadow-[0_30px_70px_-40px_rgba(0,0,128,0.7)]">
        {/* Header bar */}
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[#1b2458] bg-black/35 px-4 py-3 text-xs tracking-[0.18em] text-slate-300 sm:text-sm">
          <p>LIVE MATCH</p>
          <p className="font-semibold text-[#f6d87a]">{connState}</p>
          <p>
            {minuteText}
            {debugOverlay.gameplay?.mode
              ? ` | ${String(debugOverlay.gameplay.mode).toUpperCase()}`
              : ''}
          </p>
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
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="ball-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="0.6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grass */}
            <rect x="0" y="0" width={F.w} height={F.h} fill="url(#grass)" />
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x={i * 10} y="0" width="5" height={F.h} fill="rgba(255,255,255,0.03)" />
            ))}

            {/* Debug coordinate grid */}
            <g pointerEvents="none" opacity="0.55">
              {Array.from({ length: 11 }).map((_, i) => {
                const x = i * 10;
                return (
                  <g key={`grid-x-${x}`}>
                    <line
                      x1={x}
                      y1="0"
                      x2={x}
                      y2={F.h}
                      stroke={x === 50 ? '#facc15' : '#93c5fd'}
                      strokeWidth={x === 50 ? '0.2' : '0.1'}
                      strokeDasharray={x === 50 ? 'none' : '0.5 0.7'}
                    />
                    <text
                      x={x}
                      y="2.2"
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="1.35"
                      fontWeight="600"
                    >
                      {x}
                    </text>
                  </g>
                );
              })}
              {Array.from({ length: 7 }).map((_, i) => {
                const y = i * 10;
                if (y > F.h) return null;
                return (
                  <g key={`grid-y-${y}`}>
                    <line
                      x1="0"
                      y1={y}
                      x2={F.w}
                      y2={y}
                      stroke={y === 32 ? '#facc15' : '#93c5fd'}
                      strokeWidth={y === 32 ? '0.2' : '0.1'}
                      strokeDasharray={y === 32 ? 'none' : '0.5 0.7'}
                    />
                    <text
                      x="1.6"
                      y={y + 1.6}
                      textAnchor="start"
                      fill="#e2e8f0"
                      fontSize="1.35"
                      fontWeight="600"
                    >
                      {y}
                    </text>
                  </g>
                );
              })}
              <text x="96" y="3.2" textAnchor="end" fill="#fef08a" fontSize="1.6" fontWeight="700">
                X
              </text>
              <text x="2" y="60" textAnchor="start" fill="#fef08a" fontSize="1.6" fontWeight="700">
                Y
              </text>
            </g>

            {/* Lines */}
            <rect
              x="1"
              y="1"
              width="98"
              height="62"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.35"
            />
            <line x1="50" y1="1" x2="50" y2="63" stroke="#cbd5e1" strokeWidth="0.35" />
            <circle cx="50" cy="32" r="7.3" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <circle cx="50" cy="32" r="0.55" fill="#cbd5e1" />

            {/* Goals */}
            <rect
              x="1"
              y="22"
              width="8"
              height="20"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.35"
            />
            <rect
              x="91"
              y="22"
              width="8"
              height="20"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.35"
            />
            <rect
              x="1"
              y="26"
              width="3"
              height="12"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.35"
            />
            <rect
              x="96"
              y="26"
              width="3"
              height="12"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.35"
            />

            {/* Left Goal Post and Netting */}
            <path
              d="M 1 28 L -1.5 28 L -1.5 36 L 1 36"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 1 28 L -1.5 29 M 1 30 L -1.5 31 M 1 32 L -1.5 33 M 1 34 L -1.5 35 M 1 36 L -1.5 36 M -1.5 28 L -1.5 36 M -0.8 28 L -0.8 36"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="0.15"
            />

            {/* Right Goal Post and Netting */}
            <path
              d="M 99 28 L 101.5 28 L 101.5 36 L 99 36"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 99 28 L 101.5 29 M 99 30 L 101.5 31 M 99 32 L 101.5 33 M 99 34 L 101.5 35 M 99 36 L 101.5 36 M 101.5 28 L 101.5 36 M 100.2 28 L 100.2 36"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="0.15"
            />

            {/* Penalty arcs */}
            <path d="M 9 26 A 8 8 0 0 1 9 38" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <path d="M 91 26 A 8 8 0 0 0 91 38" fill="none" stroke="#cbd5e1" strokeWidth="0.35" />
            <circle cx="8" cy="32" r="0.45" fill="#cbd5e1" />
            <circle cx="92" cy="32" r="0.45" fill="#cbd5e1" />

            {/* Field effects (below players) */}
            {fieldFx.map((fx) => renderFx(fx))}

            {/* Pass debug overlay (predicted lane + interception point + success) */}
            {debugOverlay.passPreview && (
              <g pointerEvents="none">
                <line
                  x1={debugOverlay.passPreview.fromX}
                  y1={debugOverlay.passPreview.fromY}
                  x2={debugOverlay.passPreview.toX}
                  y2={debugOverlay.passPreview.toY}
                  stroke={passSuccessColor(debugOverlay.passPreview.successPct || 0)}
                  strokeWidth="0.45"
                  strokeDasharray={
                    debugOverlay.passPreview.passType === 'lob' ? '1.2 1.1' : '0.7 0.65'
                  }
                  opacity="0.8"
                />
                <circle
                  cx={debugOverlay.passPreview.toX}
                  cy={debugOverlay.passPreview.toY}
                  r="0.7"
                  fill="none"
                  stroke={passSuccessColor(debugOverlay.passPreview.successPct || 0)}
                  strokeWidth="0.35"
                  opacity="0.85"
                />
                <text
                  x={(debugOverlay.passPreview.fromX + debugOverlay.passPreview.toX) / 2}
                  y={(debugOverlay.passPreview.fromY + debugOverlay.passPreview.toY) / 2 - 1.2}
                  textAnchor="middle"
                  fill={passSuccessColor(debugOverlay.passPreview.successPct || 0)}
                  fontSize="1.9"
                  fontWeight="700"
                >
                  {debugOverlay.passPreview.successPct || 0}%
                </text>
                {debugOverlay.passPreview.hasLaneRisk && (
                  <g>
                    <circle
                      cx={debugOverlay.passPreview.laneRiskX}
                      cy={debugOverlay.passPreview.laneRiskY}
                      r="1"
                      fill="none"
                      stroke="#fb7185"
                      strokeWidth="0.35"
                    >
                      <animate
                        attributeName="r"
                        values="0.7;1.35;0.7"
                        dur="0.9s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <text
                      x={debugOverlay.passPreview.laneRiskX}
                      y={debugOverlay.passPreview.laneRiskY - 1.4}
                      textAnchor="middle"
                      fill="#fca5a5"
                      fontSize="1.8"
                      fontWeight="700"
                    >
                      cut
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* Players */}
            {displayPlayers.map((player) => {
              const isHome = player.teamId === 'home';
              const fill = isHome ? '#13206d' : '#1a0524';
              const stroke = isHome ? '#7f9cff' : '#f472b6';
              return (
                <g key={player.id} transform={`translate(${player.x}, ${player.y})`}>
                  {player.hasBall && (
                    <circle r="2.4" fill="none" stroke="#f6d87a" strokeWidth="0.22" opacity="0.65">
                      <animate
                        attributeName="r"
                        values="2;2.7;2"
                        dur="0.85s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.65;0.2;0.65"
                        dur="0.85s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle
                    r="1.4"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="0.28"
                    filter="url(#glow)"
                  />
                  <text y="2.9" textAnchor="middle" fill="#f8fafc" fontSize="1.1" fontWeight="600">
                    {player.role}
                  </text>
                </g>
              );
            })}

            {/* Ball — smooth-lerped, rendered last (top layer) */}
            <g
              transform={`translate(${displayBall.x}, ${displayBall.y - (displayBall.height || 0) * 0.2})`}
            >
              <ellipse
                cx="0"
                cy={`${(displayBall.height || 0) * 0.2 + 0.34}`}
                rx={`${0.95 + (displayBall.height || 0) * 0.06}`}
                ry={`${0.28 + (displayBall.height || 0) * 0.02}`}
                fill="#000"
                opacity="0.2"
              />
              <circle r="0.95" fill="white" opacity="0.1" />
              <circle
                r="0.62"
                fill="#f8fafc"
                stroke="#111827"
                strokeWidth="0.14"
                filter="url(#ball-glow)"
              />
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
                <text
                  x="50"
                  y="29"
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="3.8"
                  fontWeight="bold"
                  letterSpacing="1"
                >
                  {isTunnelPhase && matchPhase === 'half_time' && 'CÁC CẦU THỦ VÀO ĐƯỜNG HẦM'}
                  {isTunnelPhase && matchPhase === 'full_time' && 'KẾT THÚC TRẬN ĐẤU'}
                  {isEntryPhase && 'CÁC CẦU THỦ RA SÂN'}
                  <animate attributeName="opacity" values="0;1;1" dur="0.9s" fill="freeze" />
                </text>
                <text x="50" y="36" textAnchor="middle" fill="#94a3b8" fontSize="2.4">
                  {isTunnelPhase && matchPhase === 'half_time' && 'Nghỉ giữa hiệp...'}
                  {isTunnelPhase && matchPhase === 'full_time' && 'Cảm ơn đã theo dõi'}
                  {isEntryPhase && 'Hiệp 2 sắp bắt đầu...'}
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

        {/* Match stats */}
        <div className="mt-3 rounded-xl border border-[#1b2458] bg-black/30 px-3 py-3 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#1b2458] pb-3">
            <p className="font-['Space_Grotesk'] text-lg font-semibold tracking-wide text-white">
              Thống Kê Trận Đấu
            </p>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
              Cập nhật theo thời gian thực
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 text-[11px] uppercase tracking-[0.14em] text-slate-400 sm:text-xs">
              <p className="text-left text-[#9db5ff]">FC Navy</p>
              <p className="text-center">Chỉ số</p>
              <p className="text-right text-[#f9a8d4]">Black United</p>
            </div>

            {statsRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-[#202e6e] bg-[#060d2b]/70 px-3 py-2"
              >
                <p className="text-left text-sm font-semibold text-[#dbeafe]">{row.home}</p>
                <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 sm:text-[11px]">
                  {row.label}
                </p>
                <p className="text-right text-sm font-semibold text-[#fce7f3]">{row.away}</p>
              </div>
            ))}
          </div>
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
    </section>
  );
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function deriveMatchWebSocketURL(rawURL) {
  if (!rawURL) return '';

  try {
    const url = new URL(rawURL);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (url.pathname.endsWith('/sse/match')) {
      url.pathname = url.pathname.replace(/\/sse\/match$/, '/ws');
    }
    return url.toString();
  } catch {
    return '';
  }
}

function buildMatchWebSocketURL(baseURL, matchId) {
  if (!matchId) return baseURL;
  try {
    const url = new URL(baseURL);
    url.searchParams.set('matchId', matchId);
    return url.toString();
  } catch {
    const sep = baseURL.includes('?') ? '&' : '?';
    return `${baseURL}${sep}matchId=${encodeURIComponent(matchId)}`;
  }
}

function createEmptyTeamStats() {
  return {
    ...EMPTY_TEAM_STATS,
  };
}

function createInitialMatchStats() {
  return {
    home: createEmptyTeamStats(),
    away: createEmptyTeamStats(),
  };
}

function accumulateMatchStats(prevStats, payload) {
  const hasKickoff = Array.isArray(payload?.events)
    ? payload.events.some((event) => event?.kind === 'kickoff')
    : false;

  const next =
    hasKickoff && Number(payload?.elapsedMs || 0) <= 1200
      ? createInitialMatchStats()
      : {
          home: { ...prevStats.home },
          away: { ...prevStats.away },
        };

  const ownerTeamID = payload?.ball?.ownerTeamId;
  if (ownerTeamID === 'home' || ownerTeamID === 'away') {
    next[ownerTeamID].possessionTicks += 1;
  }

  if (!Array.isArray(payload?.events)) {
    return next;
  }

  for (const event of payload.events) {
    const teamID = event?.teamId;
    if (teamID !== 'home' && teamID !== 'away') {
      continue;
    }

    if (event.kind === 'pass') {
      next[teamID].passes += 1;
      continue;
    }

    if (event.kind === 'possession_change') {
      const isCompletedPass =
        Number(event?.receiverId || 0) > 0 &&
        Number(event?.interceptorId || 0) === 0 &&
        (event?.passType === 'ground' || event?.passType === 'lob');
      if (isCompletedPass) {
        next[teamID].successfulPasses += 1;
      }
      continue;
    }

    if (event.kind === 'shot') {
      next[teamID].shots += 1;
      if (event?.shotOnTarget) {
        next[teamID].shotsOnTarget += 1;
      }
      continue;
    }

    if (event.kind === 'goal') {
      next[teamID].goals += 1;
      continue;
    }

    if (event.kind === 'foul') {
      next[teamID].fouls += 1;
      continue;
    }

    if (event.kind === 'yellow_card') {
      next[teamID].yellowCards += 1;
      continue;
    }

    if (event.kind === 'red_card') {
      next[teamID].redCards += 1;
      continue;
    }

    if (event.kind === 'corner') {
      next[teamID].corners += 1;
    }
  }

  return next;
}

function formatPercent(success, attempts) {
  if (attempts <= 0) return '0%';
  return `${Math.round((success / attempts) * 100)}%`;
}

function formatPossession(teamTicks, totalTicks) {
  if (totalTicks <= 0) return '50%';
  return `${Math.round((teamTicks / totalTicks) * 100)}%`;
}

function passSuccessColor(successPct) {
  if (successPct >= 78) return '#4ade80';
  if (successPct >= 56) return '#facc15';
  return '#fb7185';
}

function formatMatchTime(elapsedMS) {
  const s = Math.floor(elapsedMS / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default MatchView;
