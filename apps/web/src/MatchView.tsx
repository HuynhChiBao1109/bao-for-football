import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import './MatchView.css';
import { useMatchMotion } from './hooks/useMatchMotion';
import {
  useResetMatch,
  useStartAutoMatchTick,
  useStopAutoMatchTick,
  useUpdateMatchTactics,
} from './hooks/useMatch';
import { useMatchSocket, type LiveMatchEvent } from './hooks/useMatchSocket';
import { EPlayerSkill, skillName } from './enums/skill';
import { ROUTES } from './routes';
import type { CampaignCompletion, MatchPitchPlayer, MatchSnapshot } from './types';
import { useSession } from './hooks/useSession';
import { useTactics } from './hooks/useTactics';
import { TacticsControls } from './components/TacticsControls';
import { DEFAULT_TACTICS } from './lib/tactics';

const MATCH_EVENT = {
  FIRST_HALF_START: 2,
  FIRST_HALF_END: 3,
  SECOND_HALF_START: 4,
  MATCH_END: 6,
  GOAL: 7,
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
  PENALTY: 53,
} as const;

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function toPitchPosition(point: { x: number; y: number }, mirrorY = false) {
  const lateral = clampPercent(point.x);
  const length = clampPercent(mirrorY ? 100 - point.y : point.y);

  return {
    '--pitch-lateral': lateral,
    '--pitch-length': length,
    '--landscape-x-pos': `${length}cqw`,
    '--landscape-y-pos': `${lateral}cqh`,
    '--portrait-x-pos': `${lateral}cqw`,
    '--portrait-y-pos': `${length}cqh`,
  } as CSSProperties;
}

function formatStatus(status: string | undefined, snapshot: MatchSnapshot | null) {
  const step = snapshot?.matchStep;
  const phase = snapshot?.phase ?? status;

  if (step === 'full_time' || phase === 'full_time' || status === 'finished') return 'Full time';
  if (step === 'half_time' || phase === 'half_time') return 'Half time';
  if (step === 'goal_celebration') return 'Goal';
  if (phase === 'second_half' || step === 'second_half_start') return 'Second half';
  if (phase === 'first_half' || step === 'first_half_start') return 'First half';
  return 'Live';
}

function isGoalEvent(snapshot: MatchSnapshot | null) {
  return snapshot?.highlight?.event === MATCH_EVENT.GOAL;
}

function isGoalCelebration(snapshot: MatchSnapshot | null) {
  return snapshot?.matchStep === 'goal_celebration';
}

function hasBallReachedGoal(snapshot: MatchSnapshot) {
  if (isGoalCelebration(snapshot)) return true;
  if (!isGoalEvent(snapshot)) return false;

  const scoringSide = snapshot.highlight?.teamSide ?? snapshot.possession;
  const ballInsideGoalMouth = snapshot.ball.x >= 39.5 && snapshot.ball.x <= 60.5;
  const crossedGoalLine = scoringSide === 'home' ? snapshot.ball.y <= 5.6 : snapshot.ball.y >= 94.4;

  return ballInsideGoalMouth && crossedGoalLine;
}

let matchWhistleAudioContext: AudioContext | null = null;

function getMatchWhistleAudioContext() {
  if (typeof window === 'undefined') return;
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!matchWhistleAudioContext || matchWhistleAudioContext.state === 'closed') {
    try {
      matchWhistleAudioContext = new AudioContextClass();
    } catch {
      return null;
    }
  }

  return matchWhistleAudioContext;
}

function unlockMatchWhistleAudio() {
  const context = getMatchWhistleAudioContext();
  if (!context || context.state === 'running') return;
  void context.resume().catch(() => undefined);
}

function playKickoffWhistle() {
  const context = getMatchWhistleAudioContext();
  if (!context) return;

  void context
    .resume()
    .then(() => {
      const startedAt = context.currentTime;
      const master = context.createGain();
      const upperGain = context.createGain();
      const primary = context.createOscillator();
      const upper = context.createOscillator();
      const vibrato = context.createOscillator();
      const vibratoDepth = context.createGain();

      primary.type = 'sine';
      primary.frequency.setValueAtTime(1880, startedAt);
      upper.type = 'sine';
      upper.frequency.setValueAtTime(2630, startedAt);
      upperGain.gain.setValueAtTime(0.18, startedAt);
      vibrato.type = 'sine';
      vibrato.frequency.setValueAtTime(18, startedAt);
      vibratoDepth.gain.setValueAtTime(55, startedAt);

      master.gain.setValueAtTime(0.0001, startedAt);
      master.gain.exponentialRampToValueAtTime(0.1, startedAt + 0.035);
      master.gain.setValueAtTime(0.085, startedAt + 1.72);
      master.gain.exponentialRampToValueAtTime(0.0001, startedAt + 2);

      vibrato.connect(vibratoDepth);
      vibratoDepth.connect(primary.frequency);
      primary.connect(master);
      upper.connect(upperGain);
      upperGain.connect(master);
      master.connect(context.destination);

      primary.start(startedAt);
      upper.start(startedAt);
      vibrato.start(startedAt);
      primary.stop(startedAt + 2.02);
      upper.stop(startedAt + 2.02);
      vibrato.stop(startedAt + 2.02);
    })
    .catch(() => undefined);
}

function useKickoffWhistle(snapshot: MatchSnapshot | null) {
  const playedFrameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshot?.highlight?.kickoffWhistle) return;
    const frameKey = String(snapshot.frameId ?? snapshot.tick ?? 'kickoff');
    if (playedFrameRef.current === frameKey) return;
    playedFrameRef.current = frameKey;
    playKickoffWhistle();
  }, [snapshot?.frameId, snapshot?.highlight?.kickoffWhistle, snapshot?.tick]);
}

function isShotEvent(snapshot: MatchSnapshot | null) {
  return (
    snapshot?.highlight?.event === MATCH_EVENT.SHOOT ||
    snapshot?.highlight?.event === MATCH_EVENT.GOALKEEPER_SAVE ||
    isGoalEvent(snapshot)
  );
}

function isPassEvent(snapshot: MatchSnapshot | null) {
  return snapshot?.highlight?.event === MATCH_EVENT.PASS;
}

function isTackleEvent(snapshot: MatchSnapshot | null) {
  return (
    snapshot?.highlight?.event === MATCH_EVENT.TACKLE ||
    snapshot?.highlight?.event === MATCH_EVENT.SLIDE_TACKLE
  );
}

function isThunderShot(snapshot: MatchSnapshot | null) {
  return (
    snapshot?.ball?.skillTrajectory === EPlayerSkill.SHOOT_THUNDER ||
    snapshot?.highlight?.skill === EPlayerSkill.SHOOT_THUNDER
  );
}

function isMagicDribble(snapshot: MatchSnapshot | null) {
  return (
    snapshot?.ball?.skillTrajectory === EPlayerSkill.DRIBBLE_MAGIC ||
    snapshot?.highlight?.skill === EPlayerSkill.DRIBBLE_MAGIC
  );
}

function isTankTackle(snapshot: MatchSnapshot | null) {
  return (
    snapshot?.ball?.skillTrajectory === EPlayerSkill.TANK_TACKLE ||
    snapshot?.highlight?.skill === EPlayerSkill.TANK_TACKLE
  );
}

function isLightningDribble(snapshot: MatchSnapshot | null) {
  return (
    snapshot?.ball?.skillTrajectory === EPlayerSkill.LIGHTNING_DRIBBLE ||
    snapshot?.highlight?.skill === EPlayerSkill.LIGHTNING_DRIBBLE
  );
}

function isKaiserShot(snapshot: MatchSnapshot | null) {
  return (
    snapshot?.ball?.skillTrajectory === EPlayerSkill.KAISER_SHOT ||
    snapshot?.highlight?.skill === EPlayerSkill.KAISER_SHOT
  );
}

function isEagleEye(snapshot: MatchSnapshot | null) {
  return (
    snapshot?.ball?.skillTrajectory === EPlayerSkill.EAGLE_EYE ||
    snapshot?.highlight?.skill === EPlayerSkill.EAGLE_EYE
  );
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
      return { title: 'Celebration', className: 'match-event--goal' };
    case MATCH_EVENT.FOUL:
      return { title: 'Foul', className: 'match-event--defense' };
    case MATCH_EVENT.THROW_IN:
      return { title: 'Throw in', className: 'match-event--pass' };
    case MATCH_EVENT.CORNER_KICK:
      return { title: 'Corner', className: 'match-event--shot' };
    case MATCH_EVENT.GOAL_KICK:
      return { title: 'Goal kick', className: 'match-event--pass' };
    case MATCH_EVENT.PENALTY:
      return { title: 'Penalty', className: 'match-event--shot' };
    case 7:
      return { title: 'Goal', className: 'match-event--goal' };
    default:
      return {
        title: 'Match update',
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

function getPlayerDisplayName(name: string) {
  const normalizedName = name.trim();
  if (normalizedName.length <= 12) return normalizedName;

  const parts = normalizedName.split(/\s+/).filter(Boolean);
  const lastName = parts.at(-1) ?? normalizedName;
  return lastName.length <= 12 ? lastName : `${lastName.slice(0, 11)}…`;
}

function skillCode(skill: number) {
  if (skill === EPlayerSkill.SHOOT_THUNDER) return 'TS';
  if (skill === EPlayerSkill.DRIBBLE_MAGIC) return 'MD';
  if (skill === EPlayerSkill.TANK_TACKLE) return 'TT';
  if (skill === EPlayerSkill.LIGHTNING_DRIBBLE) return 'LD';
  if (skill === EPlayerSkill.KAISER_SHOT) return 'KS';
  if (skill === EPlayerSkill.EAGLE_EYE) return 'EE';
  return 'SK';
}

function Scoreboard({
  snapshot,
  status,
  homeTeamName,
  awayTeamName,
}: {
  snapshot: MatchSnapshot | null;
  status: string;
  homeTeamName: string;
  awayTeamName: string;
}) {
  return (
    <header className="match-scoreboard">
      <div className="match-scoreboard__team">
        <span className="match-scoreboard__dot match-scoreboard__dot--home" />
        <span className="match-scoreboard__team-name">{homeTeamName}</span>
      </div>
      <div className="match-scoreboard__center">
        <span className="match-scoreboard__clock">
          <small>Match time</small>
          {snapshot?.clockLabel ?? '00:00'}
        </span>
        <strong className="match-scoreboard__score">
          {snapshot?.homeScore ?? 0}
          <span>:</span>
          {snapshot?.awayScore ?? 0}
        </strong>
        <span className="match-scoreboard__status">{formatStatus(status, snapshot)}</span>
      </div>
      <div className="match-scoreboard__team match-scoreboard__team--away">
        <span className="match-scoreboard__team-name">{awayTeamName}</span>
        <span className="match-scoreboard__dot match-scoreboard__dot--away" />
      </div>
    </header>
  );
}

const PitchLines = memo(function PitchLines() {
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
});

const PlayerCircle = memo(function PlayerCircle({
  player,
  activeHighlight,
  celebrating,
  slideTackleActive,
  mirrorY,
}: {
  player: MatchPitchPlayer;
  activeHighlight: boolean;
  celebrating: boolean;
  slideTackleActive: boolean;
  mirrorY: boolean;
}) {
  const style = toPitchPosition(player, mirrorY);
  const teamClass = player.teamSide === 'away' ? 'player-circle--away' : 'player-circle--home';
  const isGoalkeeper = player.position === 'GK';
  const keeperAction =
    player.aiState === 'KEEPER_DIVE'
      ? 'dive'
      : player.aiState === 'KEEPER_CATCH'
        ? 'catch'
        : player.aiState === 'KEEPER_HOLD'
          ? 'hold'
          : null;
  const diveDirection =
    Number(player.move?.directionX ?? player.vx ?? 0) < -0.08
      ? 'left'
      : Number(player.move?.directionX ?? player.vx ?? 0) > 0.08
        ? 'right'
        : 'center';

  return (
    <div
      className={[
        'player-node',
        isGoalkeeper ? 'player-node--goalkeeper' : '',
        keeperAction ? `player-node--keeper-${keeperAction}` : '',
        player.hasBall ? 'player-node--has-ball' : '',
        activeHighlight ? 'player-node--highlight' : '',
        celebrating ? 'player-node--celebrating' : '',
        slideTackleActive ? 'player-node--slide-tackle' : '',
        player.activeSkill === EPlayerSkill.DRIBBLE_MAGIC ? 'player-node--magic-dribble' : '',
        player.activeSkill === EPlayerSkill.LIGHTNING_DRIBBLE
          ? 'player-node--lightning-dribble'
          : '',
        player.activeSkill === EPlayerSkill.TANK_TACKLE ? 'player-node--tank-tackle' : '',
        player.activeSkill === EPlayerSkill.KAISER_SHOT ? 'player-node--kaiser-shot' : '',
        player.activeSkill === EPlayerSkill.EAGLE_EYE ? 'player-node--eagle-eye' : '',
      ].join(' ')}
      data-dive-direction={
        keeperAction === 'dive' || keeperAction === 'catch' ? diveDirection : undefined
      }
      data-team-side={player.teamSide}
      data-position={player.position}
      style={style}
      role="img"
      aria-label={`${player.name}, number ${player.jerseyNumber ?? player.id}, ${player.position}, ${player.teamSide} team${player.hasBall ? ', in possession' : ''}`}
      title={`${player.name} - ${player.position}`}
    >
      <span className="player-ground-ring" aria-hidden="true" />
      <span className="player-control-indicator" aria-hidden="true" />
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
          {skillCode(player.activeSkill)}
        </span>
      ) : null}
      {player.card ? (
        <span
          className={`player-card player-card--${player.card}`}
          title={player.card === 'red' ? 'Red card' : 'Yellow card'}
          aria-label={player.card === 'red' ? 'Red card' : 'Yellow card'}
        />
      ) : null}
      <span className="player-name">{getPlayerDisplayName(player.name)}</span>
      {player.skillCharges?.length ? (
        <div className="player-rage-bars" aria-label={`${player.name} skill rage`}>
          {player.skillCharges.map((item) => (
            <div
              className="player-rage-bar"
              data-ready={item.charge >= 100}
              key={`${player.id}-${item.skill}`}
              title={`${skillName(item.skill) ?? 'Skill'} ${Math.round(item.charge)}%`}
            >
              <span>{skillCode(item.skill)}</span>
              <i style={{ width: `${Math.min(100, Math.max(0, item.charge))}%` }} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

const PlayerLayer = memo(function PlayerLayer({
  homePlayers,
  awayPlayers,
  highlightedPlayerId,
  celebratingSide,
  slideTackleActorId,
  mirrorY,
}: {
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
  highlightedPlayerId?: string | null;
  celebratingSide?: 'home' | 'away' | null;
  slideTackleActorId?: string | null;
  mirrorY: boolean;
}) {
  return (
    <>
      {[...homePlayers, ...awayPlayers].map((player) => (
        <PlayerCircle
          key={`${player.teamSide}-${player.id}`}
          player={player}
          activeHighlight={Boolean(highlightedPlayerId && player.id === highlightedPlayerId)}
          celebrating={Boolean(celebratingSide && player.teamSide === celebratingSide)}
          slideTackleActive={Boolean(slideTackleActorId && player.id === slideTackleActorId)}
          mirrorY={mirrorY}
        />
      ))}
    </>
  );
});

function Ball({ snapshot, mirrorY }: { snapshot: MatchSnapshot; mirrorY: boolean }) {
  const currentLateral = clampPercent(snapshot.ball.x);
  const currentLength = clampPercent(mirrorY ? 100 - snapshot.ball.y : snapshot.ball.y);
  const sourceLateral = Number.isFinite(snapshot.ball.fromX)
    ? clampPercent(Number(snapshot.ball.fromX))
    : currentLateral;
  const sourceLength = Number.isFinite(snapshot.ball.fromY)
    ? clampPercent(mirrorY ? 100 - Number(snapshot.ball.fromY) : Number(snapshot.ball.fromY))
    : currentLength;
  const lateralDelta = currentLateral - sourceLateral;
  const lengthDelta = currentLength - sourceLength;
  const style = {
    ...toPitchPosition(snapshot.ball, mirrorY),
    '--ball-trail-angle-portrait': `${Math.atan2(lengthDelta, lateralDelta) * (180 / Math.PI)}deg`,
    '--ball-trail-angle-landscape': `${Math.atan2(lateralDelta, lengthDelta) * (180 / Math.PI)}deg`,
  } as CSSProperties;
  const thunderShot = isThunderShot(snapshot);
  const magicDribble = isMagicDribble(snapshot);
  const tankTackle = isTankTackle(snapshot);
  const lightningDribble = isLightningDribble(snapshot);
  const kaiserShot = isKaiserShot(snapshot);
  const eagleEye = isEagleEye(snapshot);

  return (
    <div
      className={[
        'match-ball',
        isShotEvent(snapshot) ? 'match-ball--shot' : '',
        isPassEvent(snapshot) ? 'match-ball--pass' : '',
        isTackleEvent(snapshot) ? 'match-ball--tackle' : '',
        thunderShot ? 'match-ball--thunder' : '',
        magicDribble ? 'match-ball--magic' : '',
        lightningDribble ? 'match-ball--lightning' : '',
        tankTackle ? 'match-ball--tank' : '',
        kaiserShot ? 'match-ball--kaiser' : '',
        eagleEye ? 'match-ball--eagle' : '',
      ].join(' ')}
      style={style}
      role="img"
      aria-label="Ball"
    >
      <span className="match-ball__trail" aria-hidden="true" />
      <span className="match-ball__panel" aria-hidden="true" />
    </div>
  );
}

const SkillOverlay = memo(function SkillOverlay({ skill }: { skill?: number | null }) {
  if (!skill) {
    return null;
  }

  return (
    <div className="skill-overlay" data-skill={skill} aria-hidden="true">
      <span className="skill-overlay__wash" />
      <span className="skill-overlay__pulse" />
      <div className="skill-overlay__label">
        <span>Skill activated</span>
        <strong>{skillName(skill)}</strong>
      </div>
    </div>
  );
});

const GoalOverlay = memo(function GoalOverlay({
  show,
  celebrating,
  label,
}: {
  show: boolean;
  celebrating: boolean;
  label: string;
}) {
  if (!show) {
    return null;
  }

  return (
    <div
      className={`goal-overlay ${celebrating ? 'goal-overlay--celebration' : ''}`}
      role="status"
      aria-live="polite"
    >
      {celebrating ? (
        <span className="goal-confetti" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      ) : null}
      <strong>GOAL!</strong>
      <span>{label}</span>
    </div>
  );
});

const KickoffWhistleOverlay = memo(function KickoffWhistleOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="kickoff-whistle" role="status" aria-live="polite">
      <i aria-hidden="true" />
      <strong>WHISTLE</strong>
      <span>KICK OFF</span>
    </div>
  );
});

function MatchResultOverlay({
  snapshot,
  reward,
  isRetrying,
  retryError,
  onRetry,
  onContinue,
  campaignCompletion,
}: {
  snapshot: MatchSnapshot;
  reward: number;
  isRetrying: boolean;
  retryError?: string;
  onRetry: () => void;
  onContinue: () => void;
  campaignCompletion?: CampaignCompletion | null;
}) {
  const won = campaignCompletion?.stageCleared ?? snapshot.homeScore > snapshot.awayScore;
  const draw = snapshot.homeScore === snapshot.awayScore;
  const rewardGranted = campaignCompletion?.rewardGranted ?? reward;

  return (
    <div
      className="match-result-overlay"
      data-result={won ? 'win' : 'retry'}
      role="dialog"
      aria-modal="true"
    >
      <section className="match-result-panel">
        <span className="match-result-panel__eyebrow">Campaign result</span>
        <strong className="match-result-panel__title">{won ? 'YOU WIN' : 'RETRY'}</strong>
        <div className="match-result-panel__score" aria-label="Final score">
          <span>{snapshot.homeScore}</span>
          <i>:</i>
          <span>{snapshot.awayScore}</span>
        </div>
        <p className="match-result-panel__message">
          {won
            ? campaignCompletion?.campaignCompleted
              ? 'Stage cleared. You completed this campaign.'
              : campaignCompletion?.nextStageUnlocked
                ? `Stage ${campaignCompletion.completedLevel} cleared. Stage ${campaignCompletion.unlockedLevel} is now unlocked.`
                : 'Stage cleared. The next campaign match is now unlocked.'
            : draw
              ? 'The match ended level. Win this stage to advance.'
              : 'This stage remains locked. Rebuild and fight again.'}
        </p>
        {won && rewardGranted > 0 ? (
          <div className="match-result-panel__reward">
            <span>Reward earned</span>
            <strong>+{rewardGranted.toLocaleString()}</strong>
          </div>
        ) : null}
        {retryError ? <p className="match-result-panel__error">{retryError}</p> : null}
        <div className="match-result-panel__actions">
          {won ? (
            <button
              type="button"
              className="match-result-button match-result-button--primary"
              onClick={onContinue}
            >
              Continue Campaign
            </button>
          ) : (
            <>
              <button
                type="button"
                className="match-result-button match-result-button--primary"
                disabled={isRetrying}
                onClick={onRetry}
              >
                {isRetrying ? 'Resetting...' : 'Retry Match'}
              </button>
              <button type="button" className="match-result-button" onClick={onContinue}>
                Back to Campaign
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function MatchStatistics({
  snapshot,
  homeTeamName,
  awayTeamName,
}: {
  snapshot: MatchSnapshot | null;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const home = snapshot?.matchStats?.home;
  const away = snapshot?.matchStats?.away;
  const homePossessionMs = Number(home?.possessionMs ?? 0);
  const awayPossessionMs = Number(away?.possessionMs ?? 0);
  const totalPossessionMs = homePossessionMs + awayPossessionMs;
  const homePossession =
    totalPossessionMs > 0 ? Math.round((homePossessionMs / totalPossessionMs) * 100) : 50;
  const awayPossession = 100 - homePossession;
  const passAccuracy = (completed = 0, attempted = 0) =>
    attempted > 0 ? `${Math.round((completed / attempted) * 100)}%` : '0%';
  const metrics = [
    {
      label: 'Kiểm soát bóng',
      home: `${homePossession}%`,
      away: `${awayPossession}%`,
    },
    {
      label: 'Sút',
      home: home?.shots ?? 0,
      away: away?.shots ?? 0,
    },
    {
      label: 'Sút trúng đích',
      home: home?.shotsOnTarget ?? 0,
      away: away?.shotsOnTarget ?? 0,
    },
    {
      label: 'Chuyền',
      home: `${home?.passesCompleted ?? 0}/${home?.passesAttempted ?? 0}`,
      away: `${away?.passesCompleted ?? 0}/${away?.passesAttempted ?? 0}`,
    },
    {
      label: 'Chuyền chính xác',
      home: passAccuracy(home?.passesCompleted, home?.passesAttempted),
      away: passAccuracy(away?.passesCompleted, away?.passesAttempted),
    },
    {
      label: 'Tắc bóng',
      home: home?.tackles ?? 0,
      away: away?.tackles ?? 0,
    },
    {
      label: 'Phạm lỗi',
      home: home?.fouls ?? 0,
      away: away?.fouls ?? 0,
    },
    {
      label: 'Việt vị',
      home: home?.offsides ?? 0,
      away: away?.offsides ?? 0,
    },
    {
      label: 'Phạt góc',
      home: home?.corners ?? 0,
      away: away?.corners ?? 0,
    },
    {
      label: 'Cứu thua',
      home: home?.saves ?? 0,
      away: away?.saves ?? 0,
    },
  ];

  return (
    <section className="match-statistics" aria-label="Thống kê trận đấu">
      <header className="match-insight-head">
        <span>Match data</span>
        <strong>Thống kê trận đấu</strong>
      </header>
      <div className="match-statistics__teams" aria-hidden="true">
        <span>{homeTeamName}</span>
        <span>{awayTeamName}</span>
      </div>
      <div className="match-statistics__grid">
        {metrics.map((metric) => (
          <article className="match-statistic" key={metric.label}>
            <strong>{metric.home}</strong>
            <span>{metric.label}</span>
            <strong>{metric.away}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function GoalScorers({ snapshot }: { snapshot: MatchSnapshot | null }) {
  const scorers = snapshot?.matchStats?.scorers ?? [];

  return (
    <section className="match-scorers" aria-label="Cầu thủ ghi bàn">
      <header className="match-insight-head">
        <span>Goal log</span>
        <strong>Cầu thủ ghi bàn</strong>
      </header>
      <div className="match-scorers__list">
        {scorers.length === 0 ? (
          <p className="match-scorers__empty">Chưa có bàn thắng.</p>
        ) : (
          scorers.map((scorer) => (
            <article className="match-scorer" key={`${scorer.side}-${scorer.playerId}`}>
              <span className={`match-scorer__team match-scorer__team--${scorer.side}`} />
              <div>
                <strong>{scorer.name}</strong>
                <small>{scorer.minutes.map((minute) => `${minute}'`).join(', ')}</small>
              </div>
              <b>×{scorer.goals}</b>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function EventFeed({ events }: { events: LiveMatchEvent[] }) {
  return (
    <aside className="match-events" aria-label="Match events">
      <div className="match-events__head">
        <span>Diễn biến</span>
        <strong>{events.length}</strong>
      </div>
      <div className="match-events__list">
        {events.length === 0 ? (
          <p className="match-events__empty">Waiting for match events.</p>
        ) : (
          events.map((event) => {
            const view = getEventView(event.event);
            const minuteLabel = Number.isFinite(event.minute)
              ? `${Math.max(0, Math.floor(event.minute))}'`
              : '—';
            return (
              <article className={`match-event ${view.className}`} key={event.id}>
                <span className="match-event__minute">{minuteLabel}</span>
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

const STADIUM_CROWD = Array.from({ length: 42 }, (_, index) => index);

function StadiumCrowd({ side }: { side: 'north' | 'south' }) {
  return (
    <div className={`stadium-crowd stadium-crowd--${side}`} aria-hidden="true">
      {STADIUM_CROWD.map((seat) => (
        <span key={`${side}-${seat}`} style={{ '--crowd-seat': seat } as CSSProperties} />
      ))}
    </div>
  );
}

function MatchPitch({ snapshot }: { snapshot: MatchSnapshot }) {
  const highlightedPlayerId = snapshot.highlight?.actorPlayerId;
  const mirrorY = snapshot.phase === 'second_half';
  const tunnelActive =
    snapshot.highlight?.event === MATCH_EVENT.FIRST_HALF_END ||
    snapshot.highlight?.event === MATCH_EVENT.HALF_TIME_TUNNEL ||
    snapshot.highlight?.event === MATCH_EVENT.SECOND_HALF_START;
  const slideTackleActorId =
    snapshot.highlight?.event === MATCH_EVENT.SLIDE_TACKLE ? highlightedPlayerId : null;
  const activeSkill = snapshot.highlight?.skill ?? snapshot.ball.skillTrajectory ?? undefined;
  const goalCelebration = isGoalCelebration(snapshot);
  const celebratingSide = goalCelebration ? snapshot.highlight?.teamSide : null;
  // Render the simulation coordinates directly. Physical challenges may place
  // multiple player bodies at the same point and must not be visually separated.
  const visualPlayers = [...snapshot.homePlayers, ...snapshot.awayPlayers];
  const visualHomePlayers = visualPlayers.slice(0, snapshot.homePlayers.length);
  const visualAwayPlayers = visualPlayers.slice(snapshot.homePlayers.length);
  const visualOwner = visualPlayers.find((player) => player.hasBall);
  const originalOwner = visualOwner
    ? [...snapshot.homePlayers, ...snapshot.awayPlayers].find(
        (player) => String(player.id) === String(visualOwner.id),
      )
    : null;
  const visualSnapshot =
    visualOwner && originalOwner
      ? {
          ...snapshot,
          ball: {
            ...snapshot.ball,
            x: clampPercent(snapshot.ball.x + visualOwner.x - originalOwner.x),
            y: clampPercent(snapshot.ball.y + visualOwner.y - originalOwner.y),
          },
        }
      : snapshot;

  return (
    <section className="match-pitch-shell" aria-label="Top down football pitch">
      <div className={`match-stadium ${tunnelActive ? 'match-stadium--tunnel-active' : ''}`}>
        <StadiumCrowd side="north" />
        <div className="technical-area technical-area--home" aria-label="Home technical area">
          <small className="technical-area__label">Home staff</small>
          <span className="technical-area__bench" />
          <span className="technical-area__sub technical-area__sub--one" />
          <span className="technical-area__sub technical-area__sub--two" />
          <span className="technical-area__sub technical-area__sub--three" />
          <span className="technical-area__coach technical-area__coach--one" />
          <span className="technical-area__coach technical-area__coach--two" />
        </div>
        <div className="match-pitch" data-active-skill={activeSkill}>
          <PitchLines />
          <PlayerLayer
            homePlayers={visualHomePlayers}
            awayPlayers={visualAwayPlayers}
            highlightedPlayerId={highlightedPlayerId}
            celebratingSide={celebratingSide}
            slideTackleActorId={slideTackleActorId}
            mirrorY={mirrorY}
          />
          <Ball snapshot={visualSnapshot} mirrorY={mirrorY} />
          <SkillOverlay skill={activeSkill} />
          <GoalOverlay
            key={`${snapshot.frameId ?? snapshot.tick ?? 'goal'}-${snapshot.homeScore}-${snapshot.awayScore}`}
            show={hasBallReachedGoal(snapshot)}
            celebrating={goalCelebration}
            label={snapshot.highlight?.label ?? ''}
          />
          <KickoffWhistleOverlay show={Boolean(snapshot.highlight?.kickoffWhistle)} />
        </div>
        <div className="technical-area technical-area--away" aria-label="Away technical area">
          <small className="technical-area__label">Away staff</small>
          <span className="technical-area__bench" />
          <span className="technical-area__sub technical-area__sub--one" />
          <span className="technical-area__sub technical-area__sub--two" />
          <span className="technical-area__sub technical-area__sub--three" />
          <span className="technical-area__coach technical-area__coach--one" />
          <span className="technical-area__coach technical-area__coach--two" />
        </div>
        <div className="stadium-tunnel" aria-hidden="true">
          <span />
        </div>
        <StadiumCrowd side="south" />
      </div>
    </section>
  );
}

export function MatchView() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAutoTicking, setIsAutoTicking] = useState(false);
  const [isTacticsOpen, setIsTacticsOpen] = useState(false);
  const [liveTactics, setLiveTactics] = useState(DEFAULT_TACTICS);
  const [tacticsMessage, setTacticsMessage] = useState('');
  const [autoStartCycle, setAutoStartCycle] = useState(0);
  const handledMatchEndRef = useRef(false);
  const autoStartedMatchRef = useRef<string | null>(null);
  const autoStartRetryTimerRef = useRef<number | null>(null);
  const {
    match,
    snapshot,
    events,
    status,
    isLoading,
    error,
    ackActiveTick,
    resetLiveState,
    campaignCompletion,
  } = useMatchSocket(matchId);
  const { data: sessionData } = useSession();
  const sessionTeamId = Number(sessionData?.team?.id ?? 0);
  const ownsMatchTeam =
    sessionTeamId > 0 &&
    [match?.homeTeamId, match?.awayTeamId].some(
      (teamId) => Number(teamId ?? 0) === sessionTeamId,
    );
  const tacticsTeamId = ownsMatchTeam ? `team-${sessionTeamId}` : undefined;
  const { data: savedTactics, isLoading: isTacticsLoading } = useTactics(tacticsTeamId);
  const updateMatchTactics = useUpdateMatchTactics(matchId);
  useKickoffWhistle(snapshot);
  const { mutate: startAutoTick, isPending: isStartingAutoTick } =
    useStartAutoMatchTick(matchId);
  const stopAutoTick = useStopAutoMatchTick(matchId);
  const resetMatch = useResetMatch(matchId);
  const renderedSnapshot = useMatchMotion(snapshot, {
    onTickComplete: ackActiveTick,
  });
  const isMatchEnded = renderedSnapshot?.highlight?.event === MATCH_EVENT.MATCH_END;
  const matchReward = Number(match?.campainMatch?.matchReward ?? 0);
  const homeTeamName = match?.homeTeam?.teamName?.trim() || 'Home XI';
  const awayTeamName = match?.awayTeam?.teamName?.trim() || 'Away XI';

  const returnToCampaign = () => {
    void queryClient.invalidateQueries({ queryKey: ['campainMatches'] });
    void queryClient.invalidateQueries({ queryKey: ['session'] });
    navigate(ROUTES.club, {
      replace: true,
      state: { openClubModal: 'campaign' },
    });
  };

  const resetCurrentMatch = () => {
    resetMatch.mutate(undefined, {
      onSuccess: (resetMatchState) => {
        if (autoStartRetryTimerRef.current !== null) {
          window.clearTimeout(autoStartRetryTimerRef.current);
          autoStartRetryTimerRef.current = null;
        }
        autoStartedMatchRef.current = null;
        setIsAutoTicking(false);
        handledMatchEndRef.current = false;
        resetLiveState(resetMatchState);
        setAutoStartCycle((cycle) => cycle + 1);
        void queryClient.invalidateQueries({ queryKey: ['match'] });
      },
    });
  };

  useEffect(() => {
    if (!matchId || isLoading || isMatchEnded || autoStartedMatchRef.current === matchId) {
      return;
    }

    autoStartedMatchRef.current = matchId;
    let cancelled = false;
    let succeeded = false;
    const maxAttempts = 3;

    const attemptAutoStart = (attempt: number) => {
      startAutoTick(undefined, {
        onSuccess: () => {
          succeeded = true;
          setIsAutoTicking(true);
          autoStartRetryTimerRef.current = null;
        },
        onError: () => {
          if (cancelled || attempt >= maxAttempts) {
            setIsAutoTicking(false);
            return;
          }
          autoStartRetryTimerRef.current = window.setTimeout(
            () => attemptAutoStart(attempt + 1),
            attempt * 650,
          );
        },
      });
    };

    attemptAutoStart(1);

    return () => {
      cancelled = true;
      if (autoStartRetryTimerRef.current !== null) {
        window.clearTimeout(autoStartRetryTimerRef.current);
        autoStartRetryTimerRef.current = null;
      }
      if (!succeeded && autoStartedMatchRef.current === matchId) {
        autoStartedMatchRef.current = null;
      }
    };
  }, [autoStartCycle, isLoading, isMatchEnded, matchId, startAutoTick]);

  useEffect(() => {
    if (!isMatchEnded || handledMatchEndRef.current) {
      return;
    }

    handledMatchEndRef.current = true;
    setIsAutoTicking(false);
    void queryClient.invalidateQueries({ queryKey: ['campainMatches'] });
    void queryClient.invalidateQueries({ queryKey: ['session'] });
  }, [isMatchEnded, queryClient]);

  return (
    <main className="match-view" onPointerDown={unlockMatchWhistleAudio}>
      <div className="match-view__backdrop" aria-hidden="true" />
      <section className="match-modal" role="dialog" aria-modal="true" aria-label="Live match">
        <header className="match-modal__head">
          <div>
            <span>RedLock Arena</span>
            <strong>Live Battle</strong>
          </div>
          <div className="match-live-controls" aria-label="Match controls">
            <button
              type="button"
              className="match-live-control match-live-control--tactics"
              disabled={!tacticsTeamId || isTacticsLoading || isMatchEnded}
              onClick={() => {
                setTacticsMessage('');
                if (!isTacticsOpen) {
                  setLiveTactics(savedTactics ?? DEFAULT_TACTICS);
                }
                setIsTacticsOpen((current) => !current);
              }}
            >
              Chiến thuật
            </button>
            <button
              type="button"
              className="match-live-control match-live-control--stop"
              disabled={
                !matchId ||
                !isAutoTicking ||
                stopAutoTick.isPending ||
                resetMatch.isPending ||
                isMatchEnded
              }
              onClick={() => {
                if (autoStartRetryTimerRef.current !== null) {
                  window.clearTimeout(autoStartRetryTimerRef.current);
                  autoStartRetryTimerRef.current = null;
                }
                autoStartedMatchRef.current = matchId ?? null;
                stopAutoTick.mutate(undefined, {
                  onSuccess: () => setIsAutoTicking(false),
                });
              }}
            >
              {stopAutoTick.isPending ? 'Stopping…' : 'Stop Match'}
            </button>
            <button
              type="button"
              className="match-live-control match-live-control--reset"
              disabled={
                !matchId ||
                isStartingAutoTick ||
                stopAutoTick.isPending ||
                resetMatch.isPending
              }
              onClick={resetCurrentMatch}
            >
              {resetMatch.isPending ? 'Resetting…' : 'Reset Match'}
            </button>
          </div>
          <button
            type="button"
            className="match-modal__close"
            onClick={() => {
              if (isMatchEnded) {
                returnToCampaign();
                return;
              }
              void queryClient.invalidateQueries({ queryKey: ['campainMatches'] });
              void queryClient.invalidateQueries({ queryKey: ['session'] });
              navigate(ROUTES.club);
            }}
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
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
        />

        {isTacticsOpen ? (
          <aside className="match-tactics-drawer" aria-label="Điều chỉnh chiến thuật trong trận">
            <header className="match-tactics-drawer__head">
              <div>
                <span>Live tactics</span>
                <strong>Điều chỉnh trong trận</strong>
              </div>
              <button
                type="button"
                onClick={() => setIsTacticsOpen(false)}
                aria-label="Đóng bảng chiến thuật"
              >
                ×
              </button>
            </header>
            <div className="match-tactics-drawer__body game-scroll">
              {isTacticsLoading ? (
                <p className="match-tactics-drawer__status">Đang tải chiến thuật…</p>
              ) : (
                <TacticsControls
                  value={liveTactics}
                  onChange={(value) => {
                    setLiveTactics(value);
                    setTacticsMessage('');
                  }}
                  disabled={updateMatchTactics.isPending}
                  compact
                />
              )}
              {tacticsMessage ? (
                <p className="match-tactics-drawer__status match-tactics-drawer__status--success">
                  {tacticsMessage}
                </p>
              ) : null}
              {updateMatchTactics.error ? (
                <p className="match-tactics-drawer__status match-tactics-drawer__status--error">
                  {updateMatchTactics.error.message}
                </p>
              ) : null}
            </div>
            <footer className="match-tactics-drawer__actions">
              <button type="button" onClick={() => setIsTacticsOpen(false)}>
                Hủy
              </button>
              <button
                type="button"
                disabled={updateMatchTactics.isPending || isMatchEnded}
                onClick={() => {
                  updateMatchTactics.mutate(liveTactics, {
                    onSuccess: (updated) => {
                      setLiveTactics(updated);
                      setTacticsMessage('Đã áp dụng từ nhịp mô phỏng kế tiếp.');
                    },
                  });
                }}
              >
                {updateMatchTactics.isPending ? 'Đang áp dụng…' : 'Áp dụng ngay'}
              </button>
            </footer>
          </aside>
        ) : null}

        <div className="match-view__content">
          {renderedSnapshot ? (
            <MatchPitch snapshot={renderedSnapshot} />
          ) : (
            <section className="match-empty">
              <strong>{isLoading ? 'Loading match...' : 'No live snapshot'}</strong>
              <span>{error ? 'Unable to load the match.' : 'Waiting for kickoff...'}</span>
            </section>
          )}
          <div className="match-view__insights">
            <MatchStatistics
              snapshot={renderedSnapshot}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
            />
            <GoalScorers snapshot={renderedSnapshot} />
            <EventFeed events={events} />
          </div>
        </div>
        {isMatchEnded && renderedSnapshot ? (
          <MatchResultOverlay
            snapshot={renderedSnapshot}
            reward={matchReward}
            isRetrying={resetMatch.isPending}
            retryError={resetMatch.error?.message}
            onRetry={resetCurrentMatch}
            onContinue={returnToCampaign}
            campaignCompletion={campaignCompletion}
          />
        ) : null}
      </section>
    </main>
  );
}
