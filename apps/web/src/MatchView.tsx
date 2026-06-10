import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import './MatchView.css';
import { useMatchMotion } from './hooks/useMatchMotion';
import { useMatchSocket, type LiveMatchEvent } from './hooks/useMatchSocket';
import type { MatchPitchPlayer, MatchSnapshot } from './types';

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function toHorizontalPitchPosition(point: { x: number; y: number }) {
  return {
    left: `${clampPercent(point.y)}%`,
    top: `${clampPercent(point.x)}%`,
  } as CSSProperties;
}

function formatStatus(status: string | undefined, snapshot: MatchSnapshot | null) {
  const value = snapshot?.matchStep ?? snapshot?.phase ?? status ?? 'ready';
  return value.replaceAll('_', ' ');
}

function isGoalEvent(snapshot: MatchSnapshot | null) {
  return snapshot?.highlight?.event === 7;
}

function isShotEvent(snapshot: MatchSnapshot | null) {
  return snapshot?.highlight?.event === 36 || snapshot?.ball?.speed;
}

function Scoreboard({
  snapshot,
  status,
  isConnected,
  queuedTicks,
}: {
  snapshot: MatchSnapshot | null;
  status: string;
  isConnected: boolean;
  queuedTicks: number;
}) {
  return (
    <header className="match-scoreboard">
      <div className="match-scoreboard__team">
        <span className="match-scoreboard__dot match-scoreboard__dot--home" />
        <span>Home</span>
      </div>
      <div className="match-scoreboard__center">
        <span className="match-scoreboard__clock">{snapshot?.clockLabel ?? '00:00'}</span>
        <strong className="match-scoreboard__score">
          {snapshot?.homeScore ?? 0}
          <span>:</span>
          {snapshot?.awayScore ?? 0}
        </strong>
        <span className="match-scoreboard__status">
          {formatStatus(status, snapshot)}
          <span className={isConnected ? 'match-live-dot is-on' : 'match-live-dot'} />
          {queuedTicks > 0 ? <small>{queuedTicks} ticks</small> : null}
        </span>
      </div>
      <div className="match-scoreboard__team match-scoreboard__team--away">
        <span>Away</span>
        <span className="match-scoreboard__dot match-scoreboard__dot--away" />
      </div>
    </header>
  );
}

function PitchLines() {
  return (
    <div className="match-pitch__lines" aria-hidden="true">
      <div className="pitch-line pitch-line--outer" />
      <div className="pitch-line pitch-line--mid" />
      <div className="pitch-circle pitch-circle--center" />
      <div className="pitch-spot pitch-spot--center" />
      <div className="pitch-box pitch-box--penalty pitch-box--home" />
      <div className="pitch-box pitch-box--penalty pitch-box--away" />
      <div className="pitch-box pitch-box--goal pitch-box--home" />
      <div className="pitch-box pitch-box--goal pitch-box--away" />
      <div className="pitch-spot pitch-spot--home" />
      <div className="pitch-spot pitch-spot--away" />
      <div className="pitch-goal pitch-goal--home" />
      <div className="pitch-goal pitch-goal--away" />
    </div>
  );
}

const PlayerCircle = memo(function PlayerCircle({
  player,
  activeHighlight,
}: {
  player: MatchPitchPlayer;
  activeHighlight: boolean;
}) {
  const style = toHorizontalPitchPosition(player);
  const teamClass = player.teamSide === 'away' ? 'player-circle--away' : 'player-circle--home';

  return (
    <div
      className={[
        'player-node',
        player.hasBall ? 'player-node--has-ball' : '',
        activeHighlight ? 'player-node--highlight' : '',
      ].join(' ')}
      style={style}
      title={`${player.name} - ${player.position}`}
    >
      <div className={`player-circle ${teamClass}`}>
        <span>{player.jerseyNumber ?? player.id}</span>
      </div>
      {player.card ? <span className={`player-card player-card--${player.card}`} /> : null}
      {player.activeSkill ? <span className="player-skill-badge">S</span> : null}
      <span className="player-name">{player.name}</span>
    </div>
  );
});

function Ball({ snapshot }: { snapshot: MatchSnapshot }) {
  const style = toHorizontalPitchPosition(snapshot.ball);

  return (
    <div
      className={isShotEvent(snapshot) ? 'match-ball match-ball--shot' : 'match-ball'}
      style={style}
      aria-label="Ball"
    />
  );
}

function GoalOverlay({ show, label }: { show: boolean; label: string }) {
  if (!show) {
    return null;
  }

  return (
    <div className="goal-overlay" role="status" aria-live="polite">
      <strong>GOAL!</strong>
      <span>{label}</span>
    </div>
  );
}

function CountdownOverlay({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <div className="match-countdown" role="status" aria-live="polite">
      <span>Kickoff in</span>
      <strong>{count}</strong>
    </div>
  );
}

function EventFeed({ events }: { events: LiveMatchEvent[] }) {
  return (
    <aside className="match-events" aria-label="Match events">
      <div className="match-events__head">
        <span>Live Events</span>
        <strong>{events.length}</strong>
      </div>
      <div className="match-events__list">
        {events.length === 0 ? (
          <p className="match-events__empty">Waiting for match events.</p>
        ) : (
          events.map((event) => {
            return (
              <article
                className="match-event match-event--standard"
                key={event.id}
              >
                <span className="match-event__minute">{event.minute}'</span>
                <div>
                  <strong>{event.event ? `Event ${event.event}` : 'Tick'}</strong>
                  <p>{event.label}</p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}

function MatchPitch({ snapshot }: { snapshot: MatchSnapshot }) {
  const allPlayers = useMemo(
    () => [...snapshot.homePlayers, ...snapshot.awayPlayers],
    [snapshot.homePlayers, snapshot.awayPlayers],
  );
  const highlightedPlayerId = snapshot.highlight?.actorPlayerId;

  return (
    <section className="match-pitch-shell" aria-label="Top down football pitch">
      <div className="match-pitch">
        <PitchLines />
        {allPlayers.map((player) => (
          <PlayerCircle
            key={`${player.teamSide}-${player.id}`}
            player={player}
            activeHighlight={Boolean(highlightedPlayerId && player.id === highlightedPlayerId)}
          />
        ))}
        <Ball snapshot={snapshot} />
        <GoalOverlay
          key={`${snapshot.frameId ?? snapshot.tick ?? 'goal'}-${snapshot.homeScore}-${snapshot.awayScore}`}
          show={isGoalEvent(snapshot)}
          label={snapshot.highlight?.label ?? ''}
        />
      </div>
    </section>
  );
}

export function MatchView() {
  const { matchId } = useParams();
  const [countdown, setCountdown] = useState(3);
  const {
    snapshot,
    events,
    status,
    isConnected,
    isLoading,
    error,
    queuedTicks,
    ackActiveTick,
  } = useMatchSocket(matchId);
  const isCountdownDone = countdown <= 0;
  const renderedSnapshot = useMatchMotion(isCountdownDone ? snapshot : null, {
    onTickComplete: ackActiveTick,
  });
  const visibleEvents = isCountdownDone ? events : [];

  useEffect(() => {
    setCountdown(3);
    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [matchId]);

  return (
    <main className="match-view">
      <Scoreboard
        snapshot={renderedSnapshot}
        status={status}
        isConnected={isConnected}
        queuedTicks={queuedTicks}
      />
      <div className="match-view__content">
        {renderedSnapshot ? (
          <MatchPitch snapshot={renderedSnapshot} />
        ) : (
          <section className="match-empty">
            <strong>{countdown > 0 ? 'Preparing kickoff...' : isLoading ? 'Loading match...' : 'No live snapshot'}</strong>
            <span>{error ? error.message : 'Waiting for realtime data from server.'}</span>
          </section>
        )}
        <CountdownOverlay count={countdown} />
        <EventFeed events={visibleEvents} />
      </div>
    </main>
  );
}
