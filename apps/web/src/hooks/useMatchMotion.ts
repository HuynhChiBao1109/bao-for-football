import { useEffect, useRef, useState } from 'react';
import type { MatchPitchPlayer, MatchSnapshot } from '../types';

export type RenderedMatchSnapshot = MatchSnapshot & {
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
};

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function playerKey(player: MatchPitchPlayer) {
  return `${player.teamSide ?? 'team'}:${player.id}`;
}

function indexPlayers(players: MatchPitchPlayer[]) {
  return new Map(players.map((player) => [playerKey(player), player]));
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
  alpha: number,
): RenderedMatchSnapshot {
  const previousBall = previous?.ball;
  const ballFromX = previousBall?.x ?? next.ball.fromX ?? next.ball.x;
  const ballFromY = previousBall?.y ?? next.ball.fromY ?? next.ball.y;

  return {
    ...next,
    ball: {
      ...next.ball,
      x: lerp(ballFromX, next.ball.x, alpha),
      y: lerp(ballFromY, next.ball.y, alpha),
    },
    homePlayers: interpolatePlayers(previous?.homePlayers ?? [], next.homePlayers, alpha),
    awayPlayers: interpolatePlayers(previous?.awayPlayers ?? [], next.awayPlayers, alpha),
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
    startRef.current = performance.now();

    const animate = (now: number) => {
      const next = nextRef.current;
      if (!next) {
        return;
      }

      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / durationRef.current);
      const frame = interpolateSnapshot(previousRef.current, next, progress);
      lastRenderedRef.current = frame;
      setRendered(frame);

      if (progress < 1) {
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
