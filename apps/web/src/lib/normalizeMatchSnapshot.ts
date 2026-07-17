import type { MatchPitchPlayer, MatchSnapshot, PlayerMoveIntent } from '../types';

type RawPlayer = Record<string, unknown>;

function clampPercent(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(100, Math.max(0, numeric));
}

function toPitchPlayer(
  raw: RawPlayer,
  ballOwnerId: string | null,
  teamSide: 'home' | 'away',
  index: number,
): MatchPitchPlayer {
  const rawId = raw.userPlayerId ?? raw.id ?? raw.playerId ?? `${teamSide}-${index}`;
  const id = String(rawId);
  const move = raw.move as MatchPitchPlayer['move'] | undefined;
  const x = clampPercent(raw.x, teamSide === 'home' ? 32 : 68);
  const y = clampPercent(raw.y, 8 + index * 8);
  const skills = Array.isArray(raw.skills)
    ? raw.skills.map((skill) => Number(skill)).filter((skill) => Number.isFinite(skill))
    : [];
  const skillCharges = Array.isArray(raw.skillCharges)
    ? raw.skillCharges
        .map((item) => {
          const value = item as { skill?: unknown; charge?: unknown };
          return {
            skill: Number(value.skill ?? 0),
            charge: clampPercent(value.charge, 0),
          };
        })
        .filter((item) => Number.isFinite(item.skill) && item.skill > 0)
    : skills.map((skill) => ({ skill, charge: 0 }));
  const offside = raw.offside as MatchPitchPlayer['offside'] | undefined;

  return {
    id,
    name: String(raw.name ?? raw.shortName ?? 'Player'),
    avatarUrl: (raw.avatarUrl as string | null) ?? null,
    position: String(raw.displayRole ?? raw.position ?? raw.role ?? '-'),
    jerseyNumber: (raw.jerseyNumber as string | number | undefined) ?? index + 1,
    teamSide,
    skills,
    skillCharges,
    x,
    y,
    homeX: clampPercent(raw.homeX, x),
    homeY: clampPercent(raw.homeY, y),
    vx: Number(raw.vx ?? 0),
    vy: Number(raw.vy ?? 0),
    targetX: clampPercent(raw.targetX, move?.targetX ?? x),
    targetY: clampPercent(raw.targetY, move?.targetY ?? y),
    aiState: raw.aiState as MatchPitchPlayer['aiState'],
    hasBall: id === ballOwnerId || Boolean(raw.hasBall),
    card: (raw.card as MatchPitchPlayer['card']) ?? null,
    activeSkill: Number(raw.activeSkill ?? 0) || null,
    offside,
    move: move
      ? {
          fromX: clampPercent(move.fromX, x),
          fromY: clampPercent(move.fromY, y),
          toX: clampPercent(move.toX, x),
          toY: clampPercent(move.toY, y),
          intent: (move.intent as PlayerMoveIntent) ?? 'anchor',
          directionX: Number(move.directionX ?? 0),
          directionY: Number(move.directionY ?? 0),
          targetX: clampPercent(move.targetX, x),
          targetY: clampPercent(move.targetY, y),
        }
      : undefined,
  };
}

export function normalizeSnapshot(
  snapshot: Partial<MatchSnapshot> | null | undefined,
): MatchSnapshot {
  const ballOwnerId = snapshot?.ball?.ownerPlayerId ? String(snapshot.ball.ownerPlayerId) : null;
  const homePlayers = Array.isArray(snapshot?.homePlayers) ? snapshot.homePlayers : [];
  const awayPlayers = Array.isArray(snapshot?.awayPlayers) ? snapshot.awayPlayers : [];
  const minute = Number(snapshot?.minute ?? 0);
  const second = Number(snapshot?.second ?? 0);

  return {
    ...snapshot,
    frameId: Number(snapshot?.frameId ?? 0),
    tick: Number(snapshot?.tick ?? 0),
    durationMs: Number(snapshot?.durationMs ?? 550),
    matchStep: snapshot?.matchStep ?? 'play',
    minute,
    second,
    clockLabel: snapshot?.clockLabel ?? `${minute}:${String(second).padStart(2, '0')}`,
    phase: snapshot?.phase ?? snapshot?.matchStep ?? 'play',
    homeScore: Number(snapshot?.homeScore ?? 0),
    awayScore: Number(snapshot?.awayScore ?? 0),
    possession: snapshot?.possession ?? 'home',
    ball: {
      x: clampPercent(snapshot?.ball?.x, 50),
      y: clampPercent(snapshot?.ball?.y, 50),
      fromX: snapshot?.ball?.fromX,
      fromY: snapshot?.ball?.fromY,
      ownerPlayerId: ballOwnerId,
      speed: Number(snapshot?.ball?.speed ?? 0),
      ownerSide: snapshot?.ball?.ownerSide ?? null,
      trajectory: Array.isArray(snapshot?.ball?.trajectory) ? snapshot.ball.trajectory : undefined,
      skillTrajectory: snapshot?.ball?.skillTrajectory ?? null,
    },
    highlight: {
      event: snapshot?.highlight?.event ?? null,
      label: snapshot?.highlight?.label ?? '',
      teamSide: snapshot?.highlight?.teamSide ?? null,
      actorPlayerId: snapshot?.highlight?.actorPlayerId
        ? String(snapshot.highlight.actorPlayerId)
        : null,
      secondaryPlayerId: snapshot?.highlight?.secondaryPlayerId
        ? String(snapshot.highlight.secondaryPlayerId)
        : null,
      skill: snapshot?.highlight?.skill ?? null,
      kickoffWhistle: Boolean(snapshot?.highlight?.kickoffWhistle),
    },
    homePlayers: (homePlayers as unknown as RawPlayer[]).map((player, index) =>
      toPitchPlayer(player, ballOwnerId, 'home', index),
    ),
    awayPlayers: (awayPlayers as unknown as RawPlayer[]).map((player, index) =>
      toPitchPlayer(player, ballOwnerId, 'away', index),
    ),
  };
}
