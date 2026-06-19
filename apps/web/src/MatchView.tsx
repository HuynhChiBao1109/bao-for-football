import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './MatchView.css';
import { useMatchMotion } from './hooks/useMatchMotion';
import { useGetNextMatchTick, useStartAutoMatchTick, useStopAutoMatchTick } from './hooks/useMatch';
import { useMatchSocket, type LiveMatchEvent } from './hooks/useMatchSocket';
import { EPlayerSkill, skillAnimation, skillName } from './enums/skill';
import { ROUTES } from './routes';
import type { MatchPitchPlayer, MatchSnapshot } from './types';

const MATCH_EVENT = {
  FIRST_HALF_START: 2,
  FIRST_HALF_END: 3,
  SECOND_HALF_START: 4,
  MATCH_END: 6,
  FREE_KICK: 8,
  PASS: 35,
  SHOOT: 36,
  GOALKEEPER_SAVE: 38,
  DRIBBLE: 39,
  INTERCEPTION: 40,
  SKILL_USED: 41,
  TACKLE: 42,
  SLIDE_TACKLE: 43,
  FIRST_HALF_STOPPAGE: 44,
  HALF_TIME_TUNNEL: 45,
  SECOND_HALF_STOPPAGE: 46,
  OFFSIDE: 47,
  GOAL_RESET: 48,
  FOUL: 49,
  THROW_IN: 50,
  CORNER_KICK: 51,
  GOAL_KICK: 52,
} as const;

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
  return snapshot?.highlight?.event === MATCH_EVENT.SHOOT;
}

function isPassEvent(snapshot: MatchSnapshot | null) {
  return snapshot?.highlight?.event === MATCH_EVENT.PASS;
}

function isThunderShot(snapshot: MatchSnapshot | null) {
  return snapshot?.ball?.skillTrajectory === EPlayerSkill.SHOOT_THUNDER || snapshot?.highlight?.skill === EPlayerSkill.SHOOT_THUNDER;
}

function isMagicDribble(snapshot: MatchSnapshot | null) {
  return snapshot?.ball?.skillTrajectory === EPlayerSkill.DRIBBLE_MAGIC || snapshot?.highlight?.skill === EPlayerSkill.DRIBBLE_MAGIC;
}

function isTankTackle(snapshot: MatchSnapshot | null) {
  return snapshot?.ball?.skillTrajectory === EPlayerSkill.TANK_TACKLE || snapshot?.highlight?.skill === EPlayerSkill.TANK_TACKLE;
}

function getEventView(eventCode: number | null | undefined) {
  switch (eventCode) {
    case MATCH_EVENT.FIRST_HALF_START:
      return { title: 'Start half', className: 'match-event--start' };
    case MATCH_EVENT.FIRST_HALF_STOPPAGE:
      return { title: 'Stoppage time', className: 'match-event--start' };
    case MATCH_EVENT.FIRST_HALF_END:
      return { title: 'Half time', className: 'match-event--start' };
    case MATCH_EVENT.HALF_TIME_TUNNEL:
      return { title: 'Tunnel', className: 'match-event--start' };
    case MATCH_EVENT.SECOND_HALF_START:
      return { title: 'Second half', className: 'match-event--start' };
    case MATCH_EVENT.SECOND_HALF_STOPPAGE:
      return { title: 'Stoppage time', className: 'match-event--start' };
    case MATCH_EVENT.MATCH_END:
      return { title: 'Full time', className: 'match-event--goal' };
    case MATCH_EVENT.FREE_KICK:
      return { title: 'Free kick', className: 'match-event--pass' };
    case MATCH_EVENT.PASS:
      return { title: 'Pass', className: 'match-event--pass' };
    case MATCH_EVENT.SHOOT:
      return { title: 'Shot', className: 'match-event--shot' };
    case MATCH_EVENT.GOALKEEPER_SAVE:
      return { title: 'Save', className: 'match-event--defense' };
    case MATCH_EVENT.DRIBBLE:
      return { title: 'Carry', className: 'match-event--standard' };
    case MATCH_EVENT.INTERCEPTION:
      return { title: 'Interception', className: 'match-event--defense' };
    case MATCH_EVENT.SKILL_USED:
      return { title: 'Skill', className: 'match-event--skill' };
    case MATCH_EVENT.TACKLE:
      return { title: 'Tackle', className: 'match-event--defense' };
    case MATCH_EVENT.SLIDE_TACKLE:
      return { title: 'Slide tackle', className: 'match-event--defense' };
    case MATCH_EVENT.OFFSIDE:
      return { title: 'Offside', className: 'match-event--defense' };
    case MATCH_EVENT.GOAL_RESET:
      return { title: 'Reset', className: 'match-event--start' };
    case MATCH_EVENT.FOUL:
      return { title: 'Foul', className: 'match-event--defense' };
    case MATCH_EVENT.THROW_IN:
      return { title: 'Throw in', className: 'match-event--pass' };
    case MATCH_EVENT.CORNER_KICK:
      return { title: 'Corner', className: 'match-event--shot' };
    case MATCH_EVENT.GOAL_KICK:
      return { title: 'Goal kick', className: 'match-event--pass' };
    case 7:
      return { title: 'Goal', className: 'match-event--goal' };
    default:
      return {
        title: eventCode ? `Event ${eventCode}` : 'Tick',
        className: 'match-event--standard',
      };
  }
}

function getPlayerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
        <span className="pitch-debug-grid__x" key={`x-${value}`} style={{ top: `${value}%` }}>
          x {value}
        </span>
      ))}
      {marks.map((value) => (
        <span className="pitch-debug-grid__y" key={`y-${value}`} style={{ left: `${value}%` }}>
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
  const isGoalkeeper = player.position === 'GK';

  return (
    <div
      className={[
        'player-node',
        isGoalkeeper ? 'player-node--goalkeeper' : '',
        player.hasBall ? 'player-node--has-ball' : '',
        activeHighlight ? 'player-node--highlight' : '',
        player.activeSkill === EPlayerSkill.DRIBBLE_MAGIC ? 'player-node--magic-dribble' : '',
        player.activeSkill === EPlayerSkill.TANK_TACKLE ? 'player-node--tank-tackle' : '',
      ].join(' ')}
      style={style}
      title={`${player.name} - ${player.position}`}
    >
      <div className={`player-circle ${teamClass}`}>
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="player-avatar" />
        ) : (
          <span className="player-avatar player-avatar--fallback">
            {getPlayerInitials(player.name)}
          </span>
        )}
        <span className="player-number">{player.jerseyNumber ?? player.id}</span>
      </div>
      {player.activeSkill ? (
        <span className="player-skill-badge" title={skillName(player.activeSkill) ?? 'Skill'}>
          {player.activeSkill === EPlayerSkill.SHOOT_THUNDER
            ? 'TS'
            : player.activeSkill === EPlayerSkill.DRIBBLE_MAGIC
              ? 'MD'
              : player.activeSkill === EPlayerSkill.TANK_TACKLE
                ? 'TT'
                : 'SK'}
        </span>
      ) : null}
      <span className="player-name">{player.name}</span>
    </div>
  );
});

function Ball({ snapshot }: { snapshot: MatchSnapshot }) {
  const style = toHorizontalPitchPosition(snapshot.ball);
  const thunderShot = isThunderShot(snapshot);
  const magicDribble = isMagicDribble(snapshot);
  const tankTackle = isTankTackle(snapshot);

  return (
    <div
      className={[
        'match-ball',
        isShotEvent(snapshot) ? 'match-ball--shot' : '',
        isPassEvent(snapshot) ? 'match-ball--pass' : '',
        thunderShot ? 'match-ball--thunder' : '',
        magicDribble ? 'match-ball--magic' : '',
        tankTackle ? 'match-ball--tank' : '',
      ].join(' ')}
      style={style}
      aria-label="Ball"
    >
      <span className="ball-coord">
        x:{formatCoord(snapshot.ball.x)} y:{formatCoord(snapshot.ball.y)}
      </span>
    </div>
  );
}

function SkillOverlay({ snapshot }: { snapshot: MatchSnapshot }) {
  const skill = snapshot.highlight?.skill ?? snapshot.ball.skillTrajectory ?? null;
  const animation = skillAnimation(skill);

  if (!skill || !animation) {
    return null;
  }

  return (
    <div className="skill-overlay" data-skill={skill} aria-hidden="true">
      <video key={`${snapshot.frameId ?? snapshot.tick}-${skill}`} src={animation} autoPlay muted playsInline />
      <div className="skill-overlay__label">
        <span>Skill activated</span>
        <strong>{skillName(skill)}</strong>
      </div>
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
            const view = getEventView(event.event);
            const tickLabel = Number.isFinite(event.tick)
              ? `T${event.tick}`
              : Number.isFinite(event.frameId)
                ? `T${event.frameId}`
                : 'T-';
            return (
              <article className={`match-event ${view.className}`} key={event.id}>
                <span className="match-event__minute">{tickLabel}</span>
                <div>
                  <strong>{view.title}</strong>
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
        <SkillOverlay snapshot={snapshot} />
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
  const navigate = useNavigate();
  const [isAutoTicking, setIsAutoTicking] = useState(false);
  const { snapshot, events, status, isConnected, isLoading, error, queuedTicks, ackActiveTick } =
    useMatchSocket(matchId);
  const getNextTick = useGetNextMatchTick(matchId);
  const startAutoTick = useStartAutoMatchTick(matchId);
  const stopAutoTick = useStopAutoMatchTick(matchId);
  const renderedSnapshot = useMatchMotion(snapshot, {
    onTickComplete: ackActiveTick,
  });
  const isMatchEnded = renderedSnapshot?.highlight?.event === MATCH_EVENT.MATCH_END;

  useEffect(() => {
    if (isMatchEnded && isAutoTicking) {
      setIsAutoTicking(false);
      stopAutoTick.mutate();
    }
  }, [isAutoTicking, isMatchEnded, stopAutoTick]);

  return (
    <main className="match-view">
      <div className="match-view__backdrop" aria-hidden="true" />
      <section className="match-modal" role="dialog" aria-modal="true" aria-label="Live match">
        <header className="match-modal__head">
          <div>
            <span>Live battle</span>
            <strong>Match View</strong>
          </div>
          <button
            type="button"
            className="match-modal__close"
            onClick={() => navigate(ROUTES.club)}
            aria-label="Close match"
            title="Close"
          >
            <span />
            <span />
          </button>
        </header>

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
            <button
              type="button"
              className="match-debug-controls__button"
              disabled={!matchId || isAutoTicking || isMatchEnded || startAutoTick.isPending}
              onClick={() => {
                startAutoTick.mutate(undefined, {
                  onSuccess: () => setIsAutoTicking(true),
                });
              }}
            >
              {startAutoTick.isPending ? 'Starting...' : 'Auto tick'}
            </button>
            <button
              type="button"
              className="match-debug-controls__button match-debug-controls__button--stop"
              disabled={!isAutoTicking || stopAutoTick.isPending}
              onClick={() => {
                stopAutoTick.mutate(undefined, {
                  onSettled: () => setIsAutoTicking(false),
                });
              }}
            >
              {stopAutoTick.isPending ? 'Stopping...' : 'Stop'}
            </button>
            {getNextTick.error ? (
              <span className="match-debug-controls__error">{getNextTick.error.message}</span>
            ) : null}
            {startAutoTick.error ? (
              <span className="match-debug-controls__error">{startAutoTick.error.message}</span>
            ) : null}
            {stopAutoTick.error ? (
              <span className="match-debug-controls__error">{stopAutoTick.error.message}</span>
            ) : null}
          </div>
          {renderedSnapshot ? (
            <MatchPitch snapshot={renderedSnapshot} />
          ) : (
            <section className="match-empty">
              <strong>{isLoading ? 'Loading match...' : 'No live snapshot'}</strong>
              <span>
                {error ? error.message : 'Press Get next tick to render the next server tick.'}
              </span>
            </section>
          )}
          <EventFeed events={events} />
        </div>
      </section>
    </main>
  );
}
