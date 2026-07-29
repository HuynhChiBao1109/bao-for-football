import { useEffect, useRef, useState } from 'react';
import { EPlayerSkill } from '../enums/skill';
import type { MatchPitchPlayer, MatchSnapshot } from '../types';

export type RenderedMatchSnapshot = MatchSnapshot & {
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
};

const PASS_EVENT = 35;
const GOAL_EVENT = 7;
const SHOOT_EVENT = 36;
const GOALKEEPER_SAVE_EVENT = 38;
const FREE_KICK_EVENT = 8;
const TACKLE_EVENT = 42;
const SLIDE_TACKLE_EVENT = 43;
const FOUL_EVENT = 49;
const PASS_RELEASE_SHARE = 0.1;
const TACKLE_CONTACT_SHARE = 0.3;
const FULL_MATCH_DISPLAY_SECONDS = 90 * 60;
const FRAME_JITTER_BUFFER_MAX_MS = 120;
const FRAME_DURATION_MIN_MS = 140;
const FRAME_DURATION_MAX_MS = 5000;

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function easeInOut(alpha: number) {
  const value = clamp(alpha, 0, 1);
  return value * value * (3 - 2 * value);
}

function linear(alpha: number) {
  return clamp(alpha, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function shouldUseBallTrajectory(snapshot: MatchSnapshot) {
  const event = snapshot.highlight?.event;
  return (
    Boolean(snapshot.ball.skillTrajectory) ||
    event === GOAL_EVENT ||
    event === PASS_EVENT ||
    event === SHOOT_EVENT ||
    event === GOALKEEPER_SAVE_EVENT ||
    event === SLIDE_TACKLE_EVENT ||
    event === 41
  );
}

function isShotSkill(snapshot: MatchSnapshot) {
  const skill = snapshot.ball.skillTrajectory ?? snapshot.highlight?.skill ?? null;
  return skill === EPlayerSkill.SHOOT_THUNDER || skill === EPlayerSkill.KAISER_SHOT;
}

function isBallFlightSnapshot(snapshot: MatchSnapshot) {
  const event = snapshot.highlight?.event;
  return (
    Boolean(snapshot.ball.trajectory?.length) &&
    (event === PASS_EVENT ||
      event === GOAL_EVENT ||
      event === SHOOT_EVENT ||
      event === GOALKEEPER_SAVE_EVENT ||
      event === SLIDE_TACKLE_EVENT ||
      isShotSkill(snapshot) ||
      snapshot.highlight?.skill === EPlayerSkill.EAGLE_EYE)
  );
}

function isLightningDribbleSnapshot(snapshot: MatchSnapshot) {
  const skill = snapshot.ball.skillTrajectory ?? snapshot.highlight?.skill ?? null;
  return Boolean(snapshot.ball.trajectory?.length) && skill === EPlayerSkill.LIGHTNING_DRIBBLE;
}

function getBallAnimationDuration(snapshot: MatchSnapshot, frameDuration: number) {
  const event = snapshot.highlight?.event;
  if (snapshot.ball.ownerPlayerId && !isBallFlightSnapshot(snapshot)) return frameDuration;

  const from = {
    x: Number(snapshot.ball.fromX ?? snapshot.ball.x),
    y: Number(snapshot.ball.fromY ?? snapshot.ball.y),
  };
  const travelDistance = distance(from, snapshot.ball);

  if (event === PASS_EVENT || snapshot.highlight?.skill === EPlayerSkill.EAGLE_EYE) {
    return clamp(180 + travelDistance * 4, 220, frameDuration * 0.96);
  }
  if (isShotSkill(snapshot)) {
    return clamp(280 + travelDistance * 4.5, 360, frameDuration * 0.94);
  }
  if (snapshot.ball.skillTrajectory || snapshot.highlight?.skill) return frameDuration;
  if (event === GOAL_EVENT || event === SHOOT_EVENT || event === GOALKEEPER_SAVE_EVENT) {
    return clamp(240 + travelDistance * 4.2, 320, frameDuration * 0.9);
  }
  return frameDuration;
}

function parseClockLabel(clockLabel: string | undefined) {
  const match = /^(\d{1,3}):(\d{2})$/.exec(clockLabel ?? '');
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getDisplaySecond(snapshot: MatchSnapshot | null) {
  if (!snapshot) return 0;
  const value = Number(snapshot.displaySecond);
  if (Number.isFinite(value)) return clamp(value, 0, FULL_MATCH_DISPLAY_SECONDS);
  return clamp(
    parseClockLabel(snapshot.clockLabel) ?? Number(snapshot.minute ?? 0) * 60,
    0,
    FULL_MATCH_DISPLAY_SECONDS,
  );
}

function hasStandardMatchClock(snapshot: MatchSnapshot | null) {
  if (!snapshot) return false;
  return (
    Number.isFinite(Number(snapshot.displaySecond)) || parseClockLabel(snapshot.clockLabel) !== null
  );
}

function formatClockLabel(displaySecond: number) {
  const value = clamp(Math.floor(displaySecond), 0, FULL_MATCH_DISPLAY_SECONDS);
  const minute = Math.floor(value / 60);
  const second = value % 60;
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function frameIdOf(snapshot: MatchSnapshot | null) {
  return Number(snapshot?.frameId ?? snapshot?.tick ?? -1);
}

function isTimelineDiscontinuity(previous: MatchSnapshot | null, next: MatchSnapshot) {
  if (!previous) return false;
  return frameIdOf(next) <= frameIdOf(previous);
}

function getBallProgressAlpha(snapshot: MatchSnapshot, alpha: number) {
  const event = snapshot.highlight?.event;
  if (isBallFlightSnapshot(snapshot)) return linear(alpha);
  if (snapshot.ball.ownerPlayerId) return linear(alpha);
  if (event === PASS_EVENT) return linear(alpha);
  if (isShotSkill(snapshot)) return easeInOut(alpha);
  if (snapshot.ball.skillTrajectory || snapshot.highlight?.skill) return easeInOut(alpha);
  if (event === GOAL_EVENT || event === SHOOT_EVENT || event === GOALKEEPER_SAVE_EVENT) {
    return linear(alpha);
  }
  return easeInOut(alpha);
}

function shouldSnapPlayers(snapshot: MatchSnapshot) {
  const event = snapshot.highlight?.event;
  return event === 51 || event === 53;
}

function isTackleMotionSnapshot(snapshot: MatchSnapshot) {
  const event = snapshot.highlight?.event;
  const skill = snapshot.ball.skillTrajectory ?? snapshot.highlight?.skill ?? null;
  return (
    event === TACKLE_EVENT ||
    event === SLIDE_TACKLE_EVENT ||
    event === FOUL_EVENT ||
    skill === EPlayerSkill.TANK_TACKLE
  );
}

function requiresFullMotionCompletion(snapshot: MatchSnapshot) {
  const event = snapshot.highlight?.event;
  return (event === FREE_KICK_EVENT && Boolean(snapshot.restart)) || isTackleMotionSnapshot(snapshot);
}

function normalizeBallPath(points: Array<{ x: number; y: number }>) {
  const path: Array<{ x: number; y: number }> = [];

  points.forEach((point) => {
    const last = path[path.length - 1];
    if (!last || distance(last, point) >= 0.05) {
      path.push(point);
    }
  });

  return path;
}

function smoothBallPath(points: Array<{ x: number; y: number }>) {
  let path = normalizeBallPath(points);
  if (path.length <= 2) return path;

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const smoothed = [path[0]];
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index];
      const to = path[index + 1];
      smoothed.push(
        { x: lerp(from.x, to.x, 0.25), y: lerp(from.y, to.y, 0.25) },
        { x: lerp(from.x, to.x, 0.75), y: lerp(from.y, to.y, 0.75) },
      );
    }
    smoothed.push(path[path.length - 1]);
    path = smoothed;
  }

  return path;
}

function interpolatePathByDistance(
  points: Array<{ x: number; y: number }>,
  alpha: number,
  shouldSmooth = true,
) {
  const path = shouldSmooth ? smoothBallPath(points) : normalizeBallPath(points);
  if (path.length <= 1) {
    return path[0] ?? { x: 50, y: 50 };
  }

  const segmentLengths = path.slice(1).map((point, index) => distance(path[index], point));
  const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);
  if (totalLength <= 0) {
    return path[path.length - 1];
  }

  let traveled = clamp(alpha, 0, 1) * totalLength;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (traveled > segmentLength) {
      traveled -= segmentLength;
      continue;
    }

    const from = path[index];
    const to = path[index + 1];
    const localAlpha = segmentLength <= 0 ? 1 : traveled / segmentLength;
    return {
      x: lerp(from.x, to.x, localAlpha),
      y: lerp(from.y, to.y, localAlpha),
    };
  }

  return path[path.length - 1];
}

function findPlayerById(players: MatchPitchPlayer[], playerId: string | null | undefined) {
  if (!playerId) return null;
  return players.find((player) => String(player.id) === String(playerId)) ?? null;
}

function interpolatePlayers(
  previousPlayers: MatchPitchPlayer[],
  nextPlayers: MatchPitchPlayer[],
  alpha: number,
) {
  return nextPlayers.map((nextPlayer) => {
    const previousPlayer = findPlayerById(previousPlayers, nextPlayer.id);
    if (!previousPlayer) return nextPlayer;

    return {
      ...nextPlayer,
      x: lerp(previousPlayer.x, nextPlayer.x, alpha),
      y: lerp(previousPlayer.y, nextPlayer.y, alpha),
    };
  });
}

function getPassBallPosition(input: {
  previous: MatchSnapshot | null;
  next: MatchSnapshot;
  ballFrom: { x: number; y: number };
  playerAlpha: number;
  ballAlpha: number;
}) {
  const actorId = input.next.highlight?.actorPlayerId;
  const previousPlayers = [
    ...(input.previous?.homePlayers ?? []),
    ...(input.previous?.awayPlayers ?? []),
  ];
  const nextPlayers = [...input.next.homePlayers, ...input.next.awayPlayers];
  const previousActor = findPlayerById(previousPlayers, actorId);
  const nextActor = findPlayerById(nextPlayers, actorId);

  if (!previousActor || !nextActor) return null;

  const releaseActorAlpha = Math.min(PASS_RELEASE_SHARE, input.playerAlpha);
  const releasePosition = {
    x: input.ballFrom.x + lerp(previousActor.x, nextActor.x, releaseActorAlpha) - previousActor.x,
    y: input.ballFrom.y + lerp(previousActor.y, nextActor.y, releaseActorAlpha) - previousActor.y,
  };

  if (input.ballAlpha <= PASS_RELEASE_SHARE) {
    const actorAlpha = Math.min(input.playerAlpha, input.ballAlpha);
    return {
      x: input.ballFrom.x + lerp(previousActor.x, nextActor.x, actorAlpha) - previousActor.x,
      y: input.ballFrom.y + lerp(previousActor.y, nextActor.y, actorAlpha) - previousActor.y,
    };
  }

  const target = { x: input.next.ball.x, y: input.next.ball.y };
  const targetVector = { x: target.x - releasePosition.x, y: target.y - releasePosition.y };
  const forwardPath = (input.next.ball.trajectory ?? []).filter((point) => {
    const fromRelease = { x: point.x - releasePosition.x, y: point.y - releasePosition.y };
    return fromRelease.x * targetVector.x + fromRelease.y * targetVector.y > 0;
  });
  const flightAlpha = (input.ballAlpha - PASS_RELEASE_SHARE) / (1 - PASS_RELEASE_SHARE);
  const curvedPath = input.next.highlight?.skill === EPlayerSkill.EAGLE_EYE ? forwardPath : [];

  return interpolatePathByDistance([releasePosition, ...curvedPath, target], linear(flightAlpha));
}

function getTackleBallPosition(input: {
  next: MatchSnapshot;
  ballFrom: { x: number; y: number };
  ballAlpha: number;
}) {
  if (input.ballAlpha <= TACKLE_CONTACT_SHARE) {
    return input.ballFrom;
  }

  const contactAlpha =
    (input.ballAlpha - TACKLE_CONTACT_SHARE) / (1 - TACKLE_CONTACT_SHARE);
  const path =
    input.next.highlight?.event === SLIDE_TACKLE_EVENT
      ? [
          input.ballFrom,
          ...(input.next.ball.trajectory ?? []),
          { x: input.next.ball.x, y: input.next.ball.y },
        ]
      : [input.ballFrom, { x: input.next.ball.x, y: input.next.ball.y }];

  return interpolatePathByDistance(path, linear(contactAlpha));
}

function interpolateSnapshot(
  previous: MatchSnapshot | null,
  next: MatchSnapshot,
  playerAlpha: number,
  ballAlpha: number,
  presentationDurationMs: number,
): RenderedMatchSnapshot {
  const previousBall = previous?.ball;
  const ballFromX = previousBall?.x ?? next.ball.fromX ?? next.ball.x;
  const ballFromY = previousBall?.y ?? next.ball.fromY ?? next.ball.y;
  const easedPlayerAlpha = shouldSnapPlayers(next) ? 1 : linear(playerAlpha);
  const ballPath =
    shouldUseBallTrajectory(next) && next.ball.trajectory?.length
      ? [
          { x: ballFromX, y: ballFromY },
          ...next.ball.trajectory,
          { x: next.ball.x, y: next.ball.y },
        ]
      : null;
  const easedBallAlpha = getBallProgressAlpha(next, ballAlpha);
  const passBallPosition =
    next.highlight?.event === PASS_EVENT && !next.ball.ownerPlayerId
      ? getPassBallPosition({
          previous,
          next,
          ballFrom: { x: ballFromX, y: ballFromY },
          playerAlpha: easedPlayerAlpha,
          ballAlpha: easedBallAlpha,
        })
      : null;
  const tackleBallPosition =
    isTackleMotionSnapshot(next)
      ? getTackleBallPosition({
          next,
          ballFrom: { x: ballFromX, y: ballFromY },
          ballAlpha: easedBallAlpha,
        })
      : null;
  const ballPosition =
    passBallPosition ??
    tackleBallPosition ??
    (ballPath
      ? interpolatePathByDistance(
          ballPath,
          easedBallAlpha,
          next.highlight?.event !== GOALKEEPER_SAVE_EVENT,
        )
      : {
          x: lerp(ballFromX, next.ball.x, easedBallAlpha),
          y: lerp(ballFromY, next.ball.y, easedBallAlpha),
        });
  const previousDisplaySecond = getDisplaySecond(previous);
  const nextDisplaySecond = getDisplaySecond(next);
  const shouldInterpolateClock =
    hasStandardMatchClock(next) && (!previous || hasStandardMatchClock(previous));
  const displaySecond = shouldInterpolateClock
    ? lerp(previousDisplaySecond, nextDisplaySecond, easedPlayerAlpha)
    : next.displaySecond;
  const previousSimulationSecond = Number(previous?.second);
  const nextSimulationSecond = Number(next.second);
  const simulationSecond =
    Number.isFinite(previousSimulationSecond) && Number.isFinite(nextSimulationSecond)
      ? lerp(previousSimulationSecond, nextSimulationSecond, easedPlayerAlpha)
      : next.second;
  const homePlayers = interpolatePlayers(
    previous?.homePlayers ?? next.homePlayers,
    next.homePlayers,
    easedPlayerAlpha,
  );
  const awayPlayers = interpolatePlayers(
    previous?.awayPlayers ?? next.awayPlayers,
    next.awayPlayers,
    easedPlayerAlpha,
  );

  return {
    ...next,
    durationMs: presentationDurationMs,
    minute: shouldInterpolateClock
      ? Math.min(90, Math.floor(Number(displaySecond ?? 0) / 60))
      : next.minute,
    second: simulationSecond,
    displaySecond,
    clockLabel: shouldInterpolateClock
      ? formatClockLabel(Number(displaySecond ?? 0))
      : next.clockLabel,
    ball: {
      ...next.ball,
      x: ballPosition.x,
      y: ballPosition.y,
    },
    homePlayers,
    awayPlayers,
  };
}

export function useMatchMotion(
  snapshot: MatchSnapshot | null,
  options: { onTickComplete?: (snapshot: MatchSnapshot) => void } = {},
) {
  const [rendered, setRendered] = useState<RenderedMatchSnapshot | null>(snapshot);
  const lastRenderedRef = useRef<MatchSnapshot | null>(snapshot);
  const previousRef = useRef<MatchSnapshot | null>(snapshot);
  const nextRef = useRef<MatchSnapshot | null>(snapshot);
  const onTickCompleteRef = useRef(options.onTickComplete);
  const startRef = useRef(0);
  const durationRef = useRef(400);
  const ballDurationRef = useRef(400);
  const playerMotionDurationRef = useRef(400);
  const promotionLeadRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const promotionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onTickCompleteRef.current = options.onTickComplete;
  }, [options.onTickComplete]);

  useEffect(() => {
    if (!snapshot) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (promotionTimerRef.current !== null) {
        window.clearTimeout(promotionTimerRef.current);
        promotionTimerRef.current = null;
      }
      previousRef.current = null;
      nextRef.current = null;
      lastRenderedRef.current = null;
      frameRef.current = requestAnimationFrame(() => {
        setRendered(null);
        frameRef.current = null;
      });
      return () => {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        if (promotionTimerRef.current !== null) {
          window.clearTimeout(promotionTimerRef.current);
          promotionTimerRef.current = null;
        }
      };
    }

    const previous = lastRenderedRef.current ?? nextRef.current;
    const shouldSnapToTimeline = isTimelineDiscontinuity(previous, snapshot);
    const requestedDuration = Number(snapshot.durationMs ?? 400);
    const baseDuration = clamp(
      Number.isFinite(requestedDuration) ? requestedDuration : 400,
      FRAME_DURATION_MIN_MS,
      FRAME_DURATION_MAX_MS,
    );
    const instantFrame = shouldSnapToTimeline || requestedDuration <= 0;
    const jitterBuffer = instantFrame
      ? 0
      : clamp(baseDuration * 0.3, 48, FRAME_JITTER_BUFFER_MAX_MS);
    previousRef.current = shouldSnapToTimeline ? snapshot : previous;
    nextRef.current = snapshot;
    durationRef.current = instantFrame ? 16 : baseDuration + jitterBuffer;
    playerMotionDurationRef.current = instantFrame ? 0 : durationRef.current;
    promotionLeadRef.current = requiresFullMotionCompletion(snapshot) ? 0 : jitterBuffer;
    const promotionDuration = Math.max(120, durationRef.current - promotionLeadRef.current);
    ballDurationRef.current = instantFrame
      ? 16
      : isBallFlightSnapshot(snapshot) || isLightningDribbleSnapshot(snapshot)
        ? promotionDuration
        : Math.max(
            120,
            Math.min(durationRef.current, getBallAnimationDuration(snapshot, durationRef.current)),
          );
    startRef.current = performance.now();
    let didAcknowledgeTick = false;
    const acknowledgeTick = () => {
      if (didAcknowledgeTick) return;
      didAcknowledgeTick = true;
      onTickCompleteRef.current?.(snapshot);
    };
    promotionTimerRef.current = window.setTimeout(
      acknowledgeTick,
      Math.max(16, promotionDuration + 32),
    );

    const animate = (now: number) => {
      const next = nextRef.current;
      if (!next) {
        return;
      }

      const elapsed = now - startRef.current;
      const playerProgress = Math.min(1, elapsed / durationRef.current);
      const ballProgress = Math.min(1, elapsed / ballDurationRef.current);
      const frame = interpolateSnapshot(
        previousRef.current,
        next,
        playerProgress,
        ballProgress,
        playerMotionDurationRef.current,
      );
      lastRenderedRef.current = frame;
      setRendered(frame);

      const promotionTime = Math.max(0, durationRef.current - promotionLeadRef.current);
      if (!didAcknowledgeTick && elapsed >= promotionTime) {
        acknowledgeTick();
      }

      if (playerProgress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        frameRef.current = null;
        if (!didAcknowledgeTick) {
          acknowledgeTick();
        }
      }
    };

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (promotionTimerRef.current !== null) {
        window.clearTimeout(promotionTimerRef.current);
        promotionTimerRef.current = null;
      }
    };
  }, [snapshot]);

  return rendered ?? snapshot;
}
