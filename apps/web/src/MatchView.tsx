import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './hooks/useAuth';
import { useMatch } from './hooks/useMatch';
import { API_BASE_URL } from './lib/apiClient';
import { ROUTES } from './routes';
import type { MatchEventRecord, MatchPitchPlayer, MatchSnapshot } from './types';
import './MatchView.css';

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io';
const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || API_BASE_URL;
const DEFAULT_AVATAR = '/player/default-avatar.svg';

function skillImage(skill?: number | null) {
  if (skill === 1) {
    return '/skills/1.jpg';
  }
  return '/app/logo.png';
}

function eventLabel(event: number) {
  const map: Record<number, string> = {
    7: 'Goal',
    15: 'Corner',
    16: 'Yellow Card',
    20: 'Offside',
    21: 'Foul',
    27: 'Kick-off',
  };
  return map[event] ?? `Event ${event}`;
}

function playerName(player: MatchPitchPlayer) {
  const parts = player.name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return player.name;
  }
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
  const resolvedSnapshot = snapshot ?? data?.latestSnapshot ?? null;

  useEffect(() => {
    if (!token || !matchId) {
      return;
    }

    const socket: Socket = io(SOCKET_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      setStatusText('Live');
      socket.emit('match:join', { matchId });
    });

    socket.on('match:snapshot', (payload: { matchId: string; snapshot: MatchSnapshot }) => {
      if (String(payload.matchId) !== String(matchId)) {
        return;
      }
      setSnapshot(payload.snapshot);
    });

    socket.on(
      'match:event',
      (payload: { matchId: string; minute: number; highlight: MatchSnapshot['highlight'] }) => {
        if (String(payload.matchId) !== String(matchId)) {
          return;
        }
        setLiveEvents((prev) =>
          [
            {
              minute: payload.minute,
              event: payload.highlight.event ?? 0,
              payload: {
                label: payload.highlight.label,
                skill: payload.highlight.skill,
              },
            },
            ...prev,
          ].slice(0, 12),
        );
      },
    );

    socket.on(
      'match:completed',
      (payload: { matchId: string; homeScore: number; awayScore: number }) => {
        if (String(payload.matchId) === String(matchId)) {
          setStatusText(`FT ${payload.homeScore}-${payload.awayScore}`);
        }
      },
    );

    socket.on('disconnect', () => {
      setStatusText('Disconnected');
    });

    return () => {
      socket.emit('match:leave', { matchId });
      socket.disconnect();
    };
  }, [matchId, token]);

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

  const topStats = useMemo(() => {
    return [...(data?.matchPlayerStats ?? [])]
      .sort((left, right) => Number(right.rating ?? 0) - Number(left.rating ?? 0))
      .slice(0, 5);
  }, [data?.matchPlayerStats]);

  if (isLoading) {
    return <div className="match-view__loading">Loading match...</div>;
  }

  if (error || !data || !resolvedSnapshot) {
    return (
      <section className="match-view">
        <article className="game-panel game-panel--accent p-6">
          <div className="game-panel__content">
            <p className="game-header-kicker">Match Error</p>
            <h2 className="game-title mt-3 text-3xl font-bold text-white">Cannot load match</h2>
            <p className="game-copy mt-3">
              {(error as Error | undefined)?.message || 'No snapshot yet.'}
            </p>
            <button
              className="game-button-secondary mt-4"
              type="button"
              onClick={() => navigate(ROUTES.aiMatch)}
            >
              Back to Campaign
            </button>
          </div>
        </article>
      </section>
    );
  }

  const activeSkill = resolvedSnapshot.highlight?.skill ?? null;

  return (
    <section className="match-view">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content match-view__hero">
          <div>
            <p className="game-header-kicker">Live Match</p>
            <h1 className="game-title mt-3 text-4xl font-bold text-white">FIFA Manager View</h1>
          </div>
          <div className="match-view__scoreboard">
            <div className="match-view__team" data-side="home">
              <span className="match-view__team-label">Home</span>
              <strong>{resolvedSnapshot.homePlayers.at(0)?.name ? 'Your Team' : 'Home'}</strong>
            </div>
            <div className="match-view__score">
              {resolvedSnapshot.homeScore} - {resolvedSnapshot.awayScore}
            </div>
            <div className="match-view__team" data-side="away">
              <span className="match-view__team-label">Away</span>
              <strong>{data.awayTeamId ? `BOT #${data.awayTeamId}` : 'Away'}</strong>
            </div>
          </div>
          <div className="match-view__clock">
            <div className="match-view__clock-value">{resolvedSnapshot.clockLabel}</div>
            <div className="game-chip mt-2">{statusText}</div>
          </div>
        </div>
      </article>

      <div className="match-view__layout">
        <article className="game-panel game-panel--soft overflow-hidden p-4 sm:p-5 match-view__pitch-card">
          <div className="game-panel__content">
            <div className="match-view__pitch">
              <div className="match-view__possession game-chip">
                Possession: {resolvedSnapshot.possession.toUpperCase()}
              </div>
              <div className="match-view__center-circle" />
              <div className="match-view__penalty-box match-view__penalty-box--top" />
              <div className="match-view__penalty-box match-view__penalty-box--bottom" />
              <div className="match-view__goal-box match-view__goal-box--top" />
              <div className="match-view__goal-box match-view__goal-box--bottom" />

              {renderPlayers(resolvedSnapshot.homePlayers, 'home')}
              {renderPlayers(resolvedSnapshot.awayPlayers, 'away')}

              <div
                className="match-view__ball"
                style={{ left: `${resolvedSnapshot.ball.x}%`, top: `${resolvedSnapshot.ball.y}%` }}
              />
            </div>
          </div>
        </article>

        <aside className="match-view__side">
          <article className="game-panel game-panel--accent overflow-hidden p-5">
            <div className="game-panel__content match-view__highlight">
              <p className="game-header-kicker">Highlight</p>
              <div className="match-view__highlight-top">
                <img
                  className="match-view__skill-art"
                  src={skillImage(activeSkill)}
                  alt="Skill art"
                />
                <div>
                  <h2 className="game-title text-3xl font-bold text-white">
                    {resolvedSnapshot.highlight.label}
                  </h2>
                  <p className="game-copy mt-2">
                    Event:{' '}
                    {resolvedSnapshot.highlight.event
                      ? eventLabel(resolvedSnapshot.highlight.event)
                      : 'Build-up play'}
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="game-panel overflow-hidden p-5">
            <div className="game-panel__content">
              <p className="game-header-kicker">Timeline</p>
              <div className="match-view__timeline mt-4 game-scroll">
                {timeline.map((item, index) => (
                  <div
                    key={`${item.minute}-${item.label}-${index}`}
                    className="match-view__timeline-item"
                  >
                    <div className="match-view__timeline-minute">{item.minute}'</div>
                    <div>
                      <div className="font-semibold text-white">{item.label}</div>
                      {item.skill ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                          <img
                            src={skillImage(item.skill)}
                            alt="skill"
                            className="h-8 w-8 rounded-lg object-cover"
                          />
                          <span>Skill trigger</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="game-panel overflow-hidden p-5">
            <div className="game-panel__content">
              <p className="game-header-kicker">Top Players</p>
              <div className="match-view__stats-list mt-4">
                {topStats.map((item, index) => (
                  <div className="match-view__stats-row" key={`${item.playerId}-${index}`}>
                    <div>
                      <div className="font-semibold text-white">Player #{item.playerId}</div>
                      <div className="text-xs text-slate-400">
                        G {item.goals} · A {item.assists} · S {item.shots}
                      </div>
                    </div>
                    <strong className="text-cyan-300">{Number(item.rating ?? 0).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
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
      className={`match-view__player ${player.hasBall ? 'match-view__player-ball' : ''}`}
      data-side={side}
      style={{ left: `${player.x}%`, top: `${player.y}%` }}
    >
      <div className="match-view__player-inner">
        {player.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt={player.name}
            className="match-view__player-avatar"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_AVATAR;
            }}
          />
        ) : (
          <span className="match-view__player-fallback">{player.position}</span>
        )}
        {player.activeSkill ? (
          <span className="match-view__player-skill" aria-hidden="true" />
        ) : null}
      </div>
      <div className="match-view__player-name">
        {playerName(player)}
        <span className="match-view__player-role">{player.position}</span>
      </div>
    </div>
  ));
}
