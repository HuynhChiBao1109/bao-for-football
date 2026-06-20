import { useEffect, useRef, useState } from 'react';
import type { MatchPitchPlayer, MatchSnapshot } from '../types';

export type RenderedMatchSnapshot = MatchSnapshot & {
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
};

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
    event === 36 ||
    event === 38 ||
    event === 41
  );
}

function getBallAnimationDuration(snapshot: MatchSnapshot, frameDuration: number) {
  const event = snapshot.highlight?.event;
  if (snapshot.ball.skillTrajectory || snapshot.highlight?.skill) return 220;
  if (event === 7 || event === 36 || event === 38) return 220;
  if (event === 35) return 430;
  return frameDuration;
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
  const pathIndex = ballPath
    ? clamp(Math.floor(ballAlpha * (ballPath.length - 1)), 0, ballPath.length - 2)
    : 0;
  const pathLocalAlpha = ballPath ? ballAlpha * (ballPath.length - 1) - pathIndex : 0;
  const pathFrom = ballPath?.[pathIndex];
  const pathTo = ballPath?.[pathIndex + 1];

  return {
    ...next,
    ball: {
      ...next.ball,
      x:
        pathFrom && pathTo
          ? lerp(pathFrom.x, pathTo.x, pathLocalAlpha)
          : lerp(ballFromX, next.ball.x, ballAlpha),
      y:
        pathFrom && pathTo
          ? lerp(pathFrom.y, pathTo.y, pathLocalAlpha)
          : lerp(ballFromY, next.ball.y, ballAlpha),
    },
    homePlayers: interpolatePlayers(previous?.homePlayers ?? [], next.homePlayers, playerAlpha),
    awayPlayers: interpolatePlayers(previous?.awayPlayers ?? [], next.awayPlayers, playerAlpha),
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
    durationRef.current = Math.max(80, Math.min(1200, snapshot.durationMs ?? 1000));
    ballDurationRef.current = Math.max(
      80,
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
