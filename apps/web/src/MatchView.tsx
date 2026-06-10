import { memo, useMemo, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import './MatchView.css';
import { useMatchMotion } from './hooks/useMatchMotion';
import { useGetNextMatchTick } from './hooks/useMatch';
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

function formatCoord(value: number | undefined) {
  return Number.isFinite(value) ? Number(value).toFixed(1) : '0.0';
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

function PitchDebugGrid() {
  const marks = [0, 25, 50, 75, 100];

  return (
    <div className="pitch-debug-grid" aria-hidden="true">
      {marks.map((value) => (
        <span
          className="pitch-debug-grid__x"
          key={`x-${value}`}
          style={{ top: `${value}%` }}
        >
          x {value}
        </span>
      ))}
      {marks.map((value) => (
        <span
          className="pitch-debug-grid__y"
          key={`y-${value}`}
          style={{ left: `${value}%` }}
        >
          y {value}
        </span>
      ))}
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
      <span className="player-coord">
        x:{formatCoord(player.x)} y:{formatCoord(player.y)}
      </span>
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
    >
      <span className="ball-coord">
        x:{formatCoord(snapshot.ball.x)} y:{formatCoord(snapshot.ball.y)}
      </span>
    </div>
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
        <PitchDebugGrid />
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
  const getNextTick = useGetNextMatchTick(matchId);
  const renderedSnapshot = useMatchMotion(snapshot, {
    onTickComplete: ackActiveTick,
  });

  return (
    <main className="match-view">
      <Scoreboard
        snapshot={renderedSnapshot}
        status={status}
        isConnected={isConnected}
        queuedTicks={queuedTicks}
      />
      <div className="match-view__content">
        <div className="match-debug-controls">
          <button
            type="button"
            className="match-debug-controls__button"
            disabled={!matchId || getNextTick.isPending}
            onClick={() => {
              getNextTick.mutate();
            }}
          >
            {getNextTick.isPending ? 'Generating tick...' : 'Get next tick'}
          </button>
          {getNextTick.error ? (
            <span className="match-debug-controls__error">{getNextTick.error.message}</span>
          ) : null}
        </div>
        {renderedSnapshot ? (
          <MatchPitch snapshot={renderedSnapshot} />
        ) : (
          <section className="match-empty">
            <strong>{isLoading ? 'Loading match...' : 'No live snapshot'}</strong>
            <span>{error ? error.message : 'Press Get next tick to render the next server tick.'}</span>
          </section>
        )}
        <EventFeed events={events} />
      </div>
    </main>
  );
}
