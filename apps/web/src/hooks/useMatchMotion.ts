import { useEffect, useRef, useState } from 'react';
import type { MatchPitchPlayer, MatchSnapshot } from '../types';

export type RenderedMatchSnapshot = MatchSnapshot & {
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
};

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function easeInOut(alpha: number) {
  const value = clamp(alpha, 0, 1);
  return value * value * (3 - 2 * value);
}

function easeOut(alpha: number) {
  const value = clamp(alpha, 0, 1);
  return 1 - Math.pow(1 - value, 3);
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

function playerKey(player: MatchPitchPlayer) {
  return `${player.teamSide ?? 'team'}:${player.id}`;
}

function indexPlayers(players: MatchPitchPlayer[]) {
  return new Map(players.map((player) => [playerKey(player), player]));
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

function getBallAnimationDuration(snapshot: MatchSnapshot, frameDuration: number) {
  const event = snapshot.highlight?.event;
  if (snapshot.ball.ownerPlayerId) return frameDuration;
  if (event === 35) return frameDuration;
  if (snapshot.ball.skillTrajectory || snapshot.highlight?.skill) return Math.max(520, frameDuration * 0.9);
  if (event === 7 || event === 36 || event === 38) return Math.max(500, frameDuration * 0.86);
  return frameDuration;
}

function getBallProgressAlpha(snapshot: MatchSnapshot, alpha: number) {
  const event = snapshot.highlight?.event;
  if (snapshot.ball.ownerPlayerId || event === 35) return linear(alpha);
  if (snapshot.ball.skillTrajectory || snapshot.highlight?.skill) return easeOut(alpha);
  if (event === 7 || event === 36 || event === 38) return easeOut(alpha);
  return easeInOut(alpha);
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

function interpolatePathByDistance(points: Array<{ x: number; y: number }>, alpha: number) {
  const path = normalizeBallPath(points);
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

function interpolatePlayers(
  previousPlayers: MatchPitchPlayer[],
  nextPlayers: MatchPitchPlayer[],
  alpha: number,
) {
  const previousById = indexPlayers(previousPlayers);

  return nextPlayers.map((nextPlayer) => {
    const previousPlayer = previousById.get(playerKey(nextPlayer));
    if (!previousPlayer) {
      const move = nextPlayer.move;
      return {
        ...nextPlayer,
        x: lerp(move?.fromX ?? nextPlayer.x, nextPlayer.x, alpha),
        y: lerp(move?.fromY ?? nextPlayer.y, nextPlayer.y, alpha),
      };
    }

    return {
      ...nextPlayer,
      x: lerp(previousPlayer.x, nextPlayer.x, alpha),
      y: lerp(previousPlayer.y, nextPlayer.y, alpha),
    };
  });
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
  const ballPath =
    shouldUseBallTrajectory(next) && next.ball.trajectory?.length
      ? [
          { x: ballFromX, y: ballFromY },
          ...next.ball.trajectory,
          { x: next.ball.x, y: next.ball.y },
        ]
      : null;
  const easedPlayerAlpha = linear(playerAlpha);
  const easedBallAlpha = getBallProgressAlpha(next, ballAlpha);
  const ballPosition = ballPath
    ? interpolatePathByDistance(ballPath, easedBallAlpha)
    : {
        x: lerp(ballFromX, next.ball.x, easedBallAlpha),
        y: lerp(ballFromY, next.ball.y, easedBallAlpha),
      };

  return {
    ...next,
    ball: {
      ...next.ball,
      x: ballPosition.x,
      y: ballPosition.y,
    },
    homePlayers: interpolatePlayers(previous?.homePlayers ?? [], next.homePlayers, easedPlayerAlpha),
    awayPlayers: interpolatePlayers(previous?.awayPlayers ?? [], next.awayPlayers, easedPlayerAlpha),
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
  const durationRef = useRef(550);
  const ballDurationRef = useRef(550);
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

    previousRef.current = lastRenderedRef.current ?? nextRef.current;
    nextRef.current = snapshot;
    durationRef.current = Math.max(160, Math.min(1400, snapshot.durationMs ?? 1000));
    ballDurationRef.current = Math.max(
      160,
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
