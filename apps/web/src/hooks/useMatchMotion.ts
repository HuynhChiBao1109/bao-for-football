import { useEffect, useRef, useState } from 'react';
import type { MatchPitchPlayer, MatchSnapshot } from '../types';

export type RenderedMatchSnapshot = MatchSnapshot & {
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
};

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
}

function interpolatePlayer(player: MatchPitchPlayer, alpha: number): MatchPitchPlayer {
  const move = player.move;
  if (!move) {
    return player;
  }

  return {
    ...player,
    x: lerp(move.fromX, move.toX, alpha),
    y: lerp(move.fromY, move.toY, alpha),
  };
}

function interpolateSnapshot(target: MatchSnapshot, alpha: number): RenderedMatchSnapshot {
  const ballFromX = target.ball.fromX ?? target.ball.x;
  const ballFromY = target.ball.fromY ?? target.ball.y;

  return {
    ...target,
    ball: {
      ...target.ball,
      x: lerp(ballFromX, target.ball.x, alpha),
      y: lerp(ballFromY, target.ball.y, alpha),
    },
    homePlayers: target.homePlayers.map((player) => interpolatePlayer(player, alpha)),
    awayPlayers: target.awayPlayers.map((player) => interpolatePlayer(player, alpha)),
  };
}

export function useMatchMotion(snapshot: MatchSnapshot | null) {
  const [rendered, setRendered] = useState<RenderedMatchSnapshot | null>(snapshot);
  const targetRef = useRef<MatchSnapshot | null>(snapshot);
  const startRef = useRef(0);
  const durationRef = useRef(550);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!snapshot) {
      setRendered(null);
      targetRef.current = null;
      return;
    }

    targetRef.current = snapshot;
    durationRef.current = Math.max(420, snapshot.durationMs ?? 550);
    startRef.current = performance.now();
    setRendered(interpolateSnapshot(snapshot, 0));

    const animate = (now: number) => {
      const target = targetRef.current;
      if (!target) {
        return;
      }

      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / durationRef.current);
      const eased = easeInOutCubic(progress);
      setRendered(interpolateSnapshot(target, eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [snapshot?.frameId]);

  return rendered ?? snapshot;
}
