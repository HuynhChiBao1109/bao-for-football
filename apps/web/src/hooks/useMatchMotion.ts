import { useEffect, useRef, useState } from 'react';
import { EPlayerSkill } from '../enums/skill';
import type { MatchPitchPlayer, MatchSnapshot } from '../types';

export type RenderedMatchSnapshot = MatchSnapshot & {
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
};

const PASS_EVENT = 35;
const PASS_RELEASE_SHARE = 0.1;
const FULL_MATCH_DISPLAY_SECONDS = 90 * 60;

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

function passRollProgress(alpha: number) {
  const value = clamp(alpha, 0, 1);
  const progress = 1 - Math.pow(1 - value, 1.3);
  return progress >= 0.995 ? 1 : progress;
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
    event === 7 ||
    event === 35 ||
    event === 36 ||
    event === 38 ||
    event === 41
  );
}

function isShotSkill(snapshot: MatchSnapshot) {
  const skill = snapshot.ball.skillTrajectory ?? snapshot.highlight?.skill ?? null;
  return skill === EPlayerSkill.SHOOT_THUNDER || skill === EPlayerSkill.KAISER_SHOT;
}

function getBallAnimationDuration(snapshot: MatchSnapshot, frameDuration: number) {
  const event = snapshot.highlight?.event;
  if (snapshot.ball.ownerPlayerId) return frameDuration;

  const from = {
    x: Number(snapshot.ball.fromX ?? snapshot.ball.x),
    y: Number(snapshot.ball.fromY ?? snapshot.ball.y),
  };
  const travelDistance = distance(from, snapshot.ball);

  if (event === PASS_EVENT || snapshot.highlight?.skill === EPlayerSkill.EAGLE_EYE) {
    return clamp(180 + travelDistance * 4, 220, frameDuration * 0.96);
  }
  if (isShotSkill(snapshot)) {
    return clamp(105 + travelDistance * 1.9, 145, frameDuration * 0.62);
  }
  if (snapshot.ball.skillTrajectory || snapshot.highlight?.skill) return frameDuration;
  if (event === 7 || event === 36 || event === 38) {
    return clamp(115 + travelDistance * 2.2, 155, frameDuration * 0.72);
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
  if (snapshot.ball.ownerPlayerId) return linear(alpha);
  if (event === PASS_EVENT) return linear(alpha);
  if (isShotSkill(snapshot)) return easeInOut(alpha);
  if (snapshot.ball.skillTrajectory || snapshot.highlight?.skill) return easeInOut(alpha);
  if (event === 7 || event === 36 || event === 38) return easeInOut(alpha);
  return easeInOut(alpha);
}

function shouldSnapPlayers(snapshot: MatchSnapshot) {
  const event = snapshot.highlight?.event;
  return event === 51 || event === 53;
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

function interpolatePathByDistance(points: Array<{ x: number; y: number }>, alpha: number) {
  const path = smoothBallPath(points);
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

  return interpolatePathByDistance(
    [releasePosition, ...curvedPath, target],
    passRollProgress(flightAlpha),
  );
}

function interpolateSnapshot(
  previous: MatchSnapshot | null,
  next: MatchSnapshot,
  playerAlpha: number,
  ballAlpha: number,
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
  const ballPosition =
    passBallPosition ??
    (ballPath
      ? interpolatePathByDistance(ballPath, easedBallAlpha)
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

  return {
    ...next,
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
    homePlayers: next.homePlayers,
    awayPlayers: next.awayPlayers,
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
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    onTickCompleteRef.current = options.onTickComplete;
  }, [options.onTickComplete]);

  useEffect(() => {
    if (!snapshot) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
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
      };
    }

    const previous = lastRenderedRef.current ?? nextRef.current;
    const shouldSnapToTimeline = isTimelineDiscontinuity(previous, snapshot);
    previousRef.current = shouldSnapToTimeline ? snapshot : previous;
    nextRef.current = snapshot;
    durationRef.current = shouldSnapToTimeline
      ? 16
      : Math.max(140, Math.min(5000, snapshot.durationMs ?? 400));
    ballDurationRef.current = Math.max(
      120,
      Math.min(durationRef.current, getBallAnimationDuration(snapshot, durationRef.current)),
    );
    startRef.current = performance.now();

    const animate = (now: number) => {
      const next = nextRef.current;
      if (!next) {
        return;
      }

      const elapsed = now - startRef.current;
      const playerProgress = Math.min(1, elapsed / durationRef.current);
      const ballProgress = Math.min(1, elapsed / ballDurationRef.current);
      const frame = interpolateSnapshot(previousRef.current, next, playerProgress, ballProgress);
      lastRenderedRef.current = frame;
      setRendered(frame);

      if (playerProgress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        frameRef.current = null;
        onTickCompleteRef.current?.(next);
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
    };
  }, [snapshot]);

  return rendered ?? snapshot;
}
