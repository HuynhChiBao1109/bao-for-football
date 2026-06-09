import type { MatchPitchPlayer, MatchSnapshot, PlayerMoveIntent } from '../types';

type RawPlayer = Record<string, unknown>;

function toPitchPlayer(raw: RawPlayer, ballOwnerId: string | null): MatchPitchPlayer {
  const id = String(raw.userPlayerId ?? raw.id ?? raw.playerId ?? '');
  const move = raw.move as MatchPitchPlayer['move'] | undefined;
  return {
    id,
    name: String(raw.name ?? raw.shortName ?? 'Player'),
    avatarUrl: (raw.avatarUrl as string | null) ?? null,
    position: String(raw.displayRole ?? raw.position ?? raw.role ?? '—'),
    x: Number(raw.x ?? 50),
    y: Number(raw.y ?? 50),
    hasBall: id === ballOwnerId || Boolean(raw.hasBall),
    activeSkill: Number(raw.activeSkill ?? 0) || null,
    move: move
      ? {
          fromX: Number(move.fromX ?? raw.x ?? 50),
          fromY: Number(move.fromY ?? raw.y ?? 50),
          toX: Number(move.toX ?? raw.x ?? 50),
          toY: Number(move.toY ?? raw.y ?? 50),
          intent: (move.intent as PlayerMoveIntent) ?? 'anchor',
        }
      : undefined,
  };
}

export function normalizeSnapshot(snapshot: MatchSnapshot): MatchSnapshot {
  const ballOwnerId = snapshot.ball?.ownerPlayerId
    ? String(snapshot.ball.ownerPlayerId)
    : null;

  return {
    ...snapshot,
    frameId: Number(snapshot.frameId ?? 0),
    tick: Number(snapshot.tick ?? 0),
    durationMs: Number(snapshot.durationMs ?? 550),
    matchStep: snapshot.matchStep ?? 'play',
    homePlayers: (snapshot.homePlayers as unknown as RawPlayer[]).map((player) =>
      toPitchPlayer(player, ballOwnerId),
    ),
    awayPlayers: (snapshot.awayPlayers as unknown as RawPlayer[]).map((player) =>
      toPitchPlayer(player, ballOwnerId),
    ),
    ball: {
      ...snapshot.ball,
      ownerPlayerId: ballOwnerId,
      fromX: snapshot.ball.fromX,
      fromY: snapshot.ball.fromY,
      trajectory: snapshot.ball.trajectory,
      skillTrajectory: snapshot.ball.skillTrajectory ?? null,
    },
  };
}
