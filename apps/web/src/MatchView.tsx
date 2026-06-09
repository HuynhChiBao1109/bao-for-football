import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { ESocketEvent } from './enums/socket';
import { skillAnimation, skillImage, skillName } from './enums/skill';
import { useAuth } from './hooks/useAuth';
import { useMatch } from './hooks/useMatch';
import { useMatchMotion } from './hooks/useMatchMotion';
import { API_BASE_URL } from './lib/apiClient';
import { normalizeSnapshot } from './lib/normalizeMatchSnapshot';
import { ROUTES } from './routes';
import type { MatchEventRecord, MatchPitchPlayer, MatchSnapshot } from './types';
import './MatchView.css';

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io';
const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || API_BASE_URL;
const DEFAULT_AVATAR = '/player/default-avatar.svg';

function phaseLabel(snapshot: MatchSnapshot) {
  if (snapshot.matchStep === 'first_half_start') return 'Bat dau hiep 1';
  if (snapshot.matchStep === 'half_time' || snapshot.phase === 'half_time') return 'Het hiep 1';
  if (snapshot.matchStep === 'second_half_start') return 'Bat dau hiep 2';
  if (snapshot.matchStep === 'full_time' || snapshot.phase === 'full_time') return 'Het tran';
  if (snapshot.phase === 'second_half') return 'Hiep 2';
  return 'Hiep 1';
}

function eventLabel(event: number) {
  const map: Record<number, string> = {
    2: 'Bat dau hiep 1',
    3: 'Het hiep 1',
    4: 'Bat dau hiep 2',
    6: 'Het tran',
    7: 'Ghi ban',
    35: 'Chuyen bong',
    36: 'Sut',
    37: 'Chan bong',
    38: 'Cuu thua',
    39: 'Qua nguoi',
    40: 'Cat bong',
    41: 'Skill',
  };
  return map[event] ?? `Event ${event}`;
}

function playerName(player: MatchPitchPlayer) {
  const parts = player.name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return player.name;
  return `${parts[0].slice(0, 1)}. ${parts.at(-1)}`;
}

export function MatchView() {
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { data, isLoading, error } = useMatch(matchId);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [liveEvents, setLiveEvents] = useState<MatchEventRecord[]>([]);
  const [statusText, setStatusText] = useState('Connecting');
  const [skillVideo, setSkillVideo] = useState<number | null>(null);
  const lastSkillRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const sourceSnapshot = useMemo(() => {
    const raw = snapshot ?? data?.latestSnapshot ?? null;
    return raw ? normalizeSnapshot(raw) : null;
  }, [snapshot, data?.latestSnapshot]);
  const resolvedSnapshot = useMatchMotion(sourceSnapshot);

  useEffect(() => {
    if (!token || !matchId) return;
    const socket: Socket = io(SOCKET_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      setStatusText('Live');
      socket.emit(ESocketEvent.MATCH_JOIN, { matchId });
    });
    socket.on(ESocketEvent.MATCH_SNAPSHOT, (payload: { matchId: string; snapshot: MatchSnapshot }) => {
      if (String(payload.matchId) === String(matchId)) {
        setSnapshot(normalizeSnapshot(payload.snapshot));
      }
    });
    socket.on(
      ESocketEvent.MATCH_EVENT,
      (payload: { matchId: string; minute: number; highlight: MatchSnapshot['highlight'] }) => {
        if (String(payload.matchId) !== String(matchId)) return;
        setLiveEvents((prev) =>
          [
            {
              minute: payload.minute,
              event: payload.highlight.event ?? 0,
              payload: { label: payload.highlight.label, skill: payload.highlight.skill },
            },
            ...prev,
          ].slice(0, 12),
        );
      },
    );
    socket.on(ESocketEvent.MATCH_COMPLETED, (payload: { matchId: string; homeScore: number; awayScore: number }) => {
      if (String(payload.matchId) === String(matchId)) {
        setStatusText(`FT ${payload.homeScore}-${payload.awayScore}`);
      }
    });
    socket.on('disconnect', () => setStatusText('Disconnected'));

    return () => {
      socket.emit(ESocketEvent.MATCH_LEAVE, { matchId });
      socket.disconnect();
    };
  }, [matchId, token]);

  useEffect(() => {
    const activeSkill = resolvedSnapshot?.highlight?.skill ?? null;
    if (!activeSkill) return;
    const key = `${resolvedSnapshot?.frameId}-${resolvedSnapshot?.minute}-${activeSkill}`;
    if (lastSkillRef.current === key) return;
    lastSkillRef.current = key;
    setSkillVideo(activeSkill);
  }, [resolvedSnapshot?.frameId, resolvedSnapshot?.highlight?.skill, resolvedSnapshot?.minute]);

  useEffect(() => {
    if (!skillVideo || !videoRef.current) return;
    void videoRef.current.play().catch(() => undefined);
  }, [skillVideo]);

  const timeline = useMemo(() => {
    const persisted = (data?.matchEvents ?? [])
      .filter((item) => (resolvedSnapshot ? item.minute <= resolvedSnapshot.minute : true))
      .map((item) => ({
        minute: item.minute,
        label: String(item.payload?.label || eventLabel(item.event)),
        skill: Number(item.payload?.skill ?? 0) || null,
      }));
    const live = liveEvents.map((item) => ({
      minute: item.minute,
      label: String(item.payload?.label || eventLabel(item.event)),
      skill: Number(item.payload?.skill ?? 0) || null,
    }));
    return [...live, ...persisted].slice(0, 16);
  }, [data?.matchEvents, liveEvents, resolvedSnapshot]);

  const topStats = useMemo(
    () =>
      [...(data?.matchPlayerStats ?? [])]
        .sort((left, right) => Number(right.rating ?? 0) - Number(left.rating ?? 0))
        .slice(0, 5),
    [data?.matchPlayerStats],
  );

  if (isLoading) return <div className="match-view__loading">Loading match...</div>;

  if (error || !data || !resolvedSnapshot) {
    return (
      <section className="match-view">
        <article className="match-shell match-shell--compact">
          <p className="match-kicker">Match Error</p>
          <h2>Cannot load match</h2>
          <p>{(error as Error | undefined)?.message || 'No snapshot yet.'}</p>
          <button type="button" onClick={() => navigate(ROUTES.aiMatch)}>
            Back to Campaign
          </button>
        </article>
      </section>
    );
  }

  const activeSkill = resolvedSnapshot.highlight?.skill ?? null;
  const ballTrail = resolvedSnapshot.ball.trajectory ?? [];
  const isThunderShot = resolvedSnapshot.ball.skillTrajectory === 1;
  const isMagicDribble = resolvedSnapshot.ball.skillTrajectory === 2 || activeSkill === 2;

  return (
    <section className="match-view">
      {skillVideo ? (
        <div className="match-view__skill-cinema" role="dialog" aria-label="Skill animation">
          <div className="match-view__skill-cinema-backdrop" />
          <div className="match-view__skill-cinema-frame">
            <video
              ref={videoRef}
              key={`skill-${skillVideo}-${resolvedSnapshot.frameId}`}
              className="match-view__skill-video"
              src={skillAnimation(skillVideo) ?? undefined}
              autoPlay
              muted
              playsInline
              onEnded={() => setSkillVideo(null)}
            />
            <div className="match-view__skill-cinema-label">
              <span>Special Skill</span>
              <strong>{skillName(skillVideo)}</strong>
            </div>
            <button type="button" className="match-view__skill-cinema-close" onClick={() => setSkillVideo(null)} aria-label="Close skill animation">
              x
            </button>
          </div>
        </div>
      ) : null}

      <header className="match-header">
        <div>
          <p className="match-kicker">Live Match</p>
          <h1>FIFA Manager View</h1>
        </div>
        <div className="match-scoreboard">
          <div className="match-team" data-side="home">
            <span>Home</span>
            <strong>Your Team</strong>
          </div>
          <div className="match-score">{resolvedSnapshot.homeScore} - {resolvedSnapshot.awayScore}</div>
          <div className="match-team" data-side="away">
            <span>Away</span>
            <strong>{data.awayTeamId ? `BOT #${data.awayTeamId}` : 'Away'}</strong>
          </div>
        </div>
        <div className="match-clock">
          <span>{phaseLabel(resolvedSnapshot)}</span>
          <strong>{resolvedSnapshot.clockLabel}</strong>
          <em>{statusText}</em>
        </div>
      </header>

      <div className="match-view__layout">
        <main className="match-pitch-wrap">
          <div className="match-pitch">
            <div className="match-pitch__grass" />
            <div className="match-pitch__possession">Possession: {resolvedSnapshot.possession.toUpperCase()}</div>
            <div className="match-pitch__center-circle" />
            <div className="match-pitch__penalty match-pitch__penalty--top" />
            <div className="match-pitch__penalty match-pitch__penalty--bottom" />
            <div className="match-pitch__goal match-pitch__goal--top" />
            <div className="match-pitch__goal match-pitch__goal--bottom" />

            {ballTrail.map((point, index) => (
              <span
                key={`trail-${index}`}
                className={`match-ball-trail ${isThunderShot ? 'match-ball-trail--thunder' : ''} ${isMagicDribble ? 'match-ball-trail--magic' : ''}`}
                style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: 0.12 + index * 0.12 }}
              />
            ))}

            {renderPlayers(resolvedSnapshot.homePlayers, 'home')}
            {renderPlayers(resolvedSnapshot.awayPlayers, 'away')}

            <div
              className={`match-ball ${isThunderShot ? 'match-ball--thunder' : ''} ${isMagicDribble ? 'match-ball--magic' : ''}`}
              style={{ left: `${resolvedSnapshot.ball.x}%`, top: `${resolvedSnapshot.ball.y}%` }}
            />
          </div>
        </main>

        <aside className="match-side">
          <article className="match-panel match-panel--highlight">
            <p className="match-kicker">Highlight</p>
            <div className="match-highlight">
              <img src={skillImage(activeSkill)} alt="Skill art" />
              <div>
                <h2>{resolvedSnapshot.highlight.label}</h2>
                <p>{resolvedSnapshot.highlight.event ? eventLabel(resolvedSnapshot.highlight.event) : 'Build-up play'}</p>
                {activeSkill ? <span>{skillName(activeSkill)}</span> : null}
              </div>
            </div>
          </article>

          <article className="match-panel">
            <p className="match-kicker">Timeline</p>
            <div className="match-timeline">
              {timeline.map((item, index) => (
                <div key={`${item.minute}-${item.label}-${index}`} className="match-timeline__item">
                  <strong>{item.minute}'</strong>
                  <div>
                    <p>{item.label}</p>
                    {item.skill ? <small>{skillName(item.skill)}</small> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="match-panel">
            <p className="match-kicker">Top Players</p>
            <div className="match-stats">
              {topStats.map((item, index) => (
                <div className="match-stats__row" key={`${item.playerId}-${index}`}>
                  <div>
                    <strong>Player #{item.playerId}</strong>
                    <span>G {item.goals} / A {item.assists} / S {item.shots}</span>
                  </div>
                  <em>{Number(item.rating ?? 0).toFixed(2)}</em>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

function renderPlayers(players: MatchPitchPlayer[], side: 'home' | 'away') {
  return players.map((player) => (
    <div
      key={`${side}-${player.id}`}
      className={`match-player ${player.hasBall ? 'match-player--ball' : ''} ${player.activeSkill ? 'match-player--skill' : ''}`}
      data-side={side}
      data-intent={player.move?.intent ?? 'anchor'}
      style={{ left: `${player.x}%`, top: `${player.y}%` }}
    >
      <div className="match-player__body">
        {player.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt={player.name}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_AVATAR;
            }}
          />
        ) : (
          <span>{player.position}</span>
        )}
        {player.activeSkill ? <i aria-hidden="true" /> : null}
      </div>
      <div className="match-player__name">
        {playerName(player)}
        <span>{player.position}</span>
      </div>
    </div>
  ));
}
