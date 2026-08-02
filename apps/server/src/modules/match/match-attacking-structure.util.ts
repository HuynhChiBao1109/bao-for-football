export type StructurePoint = { x: number; y: number };
export type StructureSide = "home" | "away";

export type AttackingSupportRole =
  | "BallSupport"
  | "ForwardOption"
  | "WidthProvider"
  | "DepthSupport"
  | "Runner"
  | "RestDefense"
  | "BoxOccupier";

export type AttackingLateralZone =
  | "left_wing"
  | "left_half_space"
  | "center"
  | "right_half_space"
  | "right_wing";

export type AttackingVerticalZone = "defensive_third" | "middle_third" | "final_third";

export type AttackingTargetZone = {
  lane: AttackingLateralZone;
  third: AttackingVerticalZone;
  key: string;
};

export type AttackingStructurePlayer = {
  id: number;
  role: string;
  position: StructurePoint;
  formationAnchor?: StructurePoint;
  velocity?: StructurePoint;
};

export type AttackingStructureAssignment = {
  playerId: number;
  supportRole: AttackingSupportRole;
  target: StructurePoint;
  targetZone: AttackingTargetZone;
  occupiedZoneCount: number;
  nearestTeammateDistance: number;
  formationInfluence: number;
  ballShiftInfluence: number;
  reason: string;
};

export type AttackingStructureEvaluation = {
  side: StructureSide;
  assignments: AttackingStructureAssignment[];
  zoneOccupancy: Record<string, number>;
  warnings: string[];
  shape: {
    ballSupportCount: number;
    forwardOptionCount: number;
    leftWidthCount: number;
    rightWidthCount: number;
    depthThreatCount: number;
    restDefenseCount: number;
  };
};

export type AttackingStructureInput = {
  side: StructureSide;
  ball: StructurePoint;
  carrierId: number;
  players: AttackingStructurePlayer[];
  pressure: number;
  compactness: number;
  directness: number;
  isTransition: boolean;
};

export const ATTACKING_STRUCTURE_BALANCE = Object.freeze({
  minimumTeammateSpacing: 7.2,
  maximumBallSupports: 2,
  maximumDepthRunners: 2,
  maximumRestDefense: 3,
  zoneCongestionPenalty: 8,
  maxPlayersPerLane: {
    left_wing: 2,
    left_half_space: 2,
    center: 3,
    right_half_space: 2,
    right_wing: 2,
  } satisfies Record<AttackingLateralZone, number>,
});

type MutableRoleAssignment = {
  player: AttackingStructurePlayer;
  supportRole: AttackingSupportRole;
  reason: string;
};

const LANE_CENTERS: Record<AttackingLateralZone, number> = {
  left_wing: 8,
  left_half_space: 31,
  center: 50,
  right_half_space: 69,
  right_wing: 92,
};

const LANE_ORDER: AttackingLateralZone[] = [
  "left_wing",
  "left_half_space",
  "center",
  "right_half_space",
  "right_wing",
];

export function evaluateAttackingStructure(
  input: AttackingStructureInput,
): AttackingStructureEvaluation {
  const direction = input.side === "home" ? -1 : 1;
  const offBall = input.players.filter((player) => player.id !== input.carrierId);
  const roles = allocateSupportRoles(input, offBall);
  const placedTargets: StructurePoint[] = [];
  const zoneOccupancy: Record<string, number> = {};

  const assignments = roles
    .sort((left, right) => getPlacementPriority(right.supportRole) - getPlacementPriority(left.supportRole))
    .map((assignment, index) => {
      let target = buildRoleTarget(input, assignment, direction, index);
      target = moveOutOfCongestedZone(target, assignment.supportRole, direction, zoneOccupancy);
      target = separateTarget(target, assignment.player.id, assignment.supportRole, direction, placedTargets);
      const targetZone = getAttackingTargetZone(target, input.side);
      zoneOccupancy[targetZone.key] = (zoneOccupancy[targetZone.key] ?? 0) + 1;
      placedTargets.push(target);
      const nearestTeammateDistance = placedTargets.length <= 1
        ? 99
        : Math.min(...placedTargets.slice(0, -1).map((other) => distance(other, target)));
      const ballShiftInfluence = getBallShiftInfluence(assignment.supportRole);

      return {
        playerId: assignment.player.id,
        supportRole: assignment.supportRole,
        target,
        targetZone,
        occupiedZoneCount: zoneOccupancy[targetZone.key],
        nearestTeammateDistance: Number(nearestTeammateDistance.toFixed(2)),
        formationInfluence: Number((1 - ballShiftInfluence).toFixed(2)),
        ballShiftInfluence: Number(ballShiftInfluence.toFixed(2)),
        reason: assignment.reason,
      } satisfies AttackingStructureAssignment;
    });

  // Occupancy is a team-level fact, so every assignment receives the final count.
  for (const assignment of assignments) {
    assignment.occupiedZoneCount = zoneOccupancy[assignment.targetZone.key] ?? 1;
    assignment.nearestTeammateDistance = Number(
      Math.min(
        ...assignments
          .filter((other) => other.playerId !== assignment.playerId)
          .map((other) => distance(other.target, assignment.target)),
        99,
      ).toFixed(2),
    );
  }

  const warnings: string[] = [];
  for (const [zone, count] of Object.entries(zoneOccupancy)) {
    if (count >= 3) warnings.push(`ZONE_CONGESTION:${zone}:${count}`);
  }
  for (const assignment of assignments) {
    if (assignment.nearestTeammateDistance < ATTACKING_STRUCTURE_BALANCE.minimumTeammateSpacing) {
      warnings.push(
        `TEAMMATE_SPACING:${assignment.playerId}:${assignment.nearestTeammateDistance.toFixed(1)}`,
      );
    }
  }

  const shape = {
    ballSupportCount: assignments.filter((item) => item.supportRole === "BallSupport").length,
    forwardOptionCount: assignments.filter((item) => item.supportRole === "ForwardOption").length,
    leftWidthCount: assignments.filter(
      (item) => item.supportRole === "WidthProvider" && item.targetZone.lane === "left_wing",
    ).length,
    rightWidthCount: assignments.filter(
      (item) => item.supportRole === "WidthProvider" && item.targetZone.lane === "right_wing",
    ).length,
    depthThreatCount: assignments.filter((item) =>
      item.supportRole === "Runner" || item.supportRole === "BoxOccupier",
    ).length,
    restDefenseCount: assignments.filter((item) => item.supportRole === "RestDefense").length,
  };

  if (shape.ballSupportCount === 0) warnings.push("SHAPE_MISSING:ball_support");
  if (shape.forwardOptionCount === 0) warnings.push("SHAPE_MISSING:forward_option");
  if (shape.leftWidthCount === 0) warnings.push("SHAPE_MISSING:left_width");
  if (shape.rightWidthCount === 0) warnings.push("SHAPE_MISSING:right_width");
  if (shape.restDefenseCount < 2) warnings.push("SHAPE_MISSING:rest_defense");

  return { side: input.side, assignments, zoneOccupancy, warnings, shape };
}

export function getAttackingTargetZone(
  point: StructurePoint,
  side: StructureSide,
): AttackingTargetZone {
  const lane = getLane(point.x);
  const attackingProgress = (side === "home" ? -1 : 1) * (point.y - 50);
  const third: AttackingVerticalZone =
    attackingProgress >= 16.67
      ? "final_third"
      : attackingProgress <= -16.67
        ? "defensive_third"
        : "middle_third";
  return { lane, third, key: `${lane}:${third}` };
}

function allocateSupportRoles(
  input: AttackingStructureInput,
  players: AttackingStructurePlayer[],
): MutableRoleAssignment[] {
  const remaining = new Map(players.map((player) => [player.id, player]));
  const result: MutableRoleAssignment[] = [];
  const take = (
    supportRole: AttackingSupportRole,
    count: number,
    score: (player: AttackingStructurePlayer) => number,
    reason: string,
  ) => {
    [...remaining.values()]
      .sort((left, right) => score(right) - score(left) || left.id - right.id)
      .slice(0, Math.max(0, count))
      .forEach((player) => {
        remaining.delete(player.id);
        result.push({ player, supportRole, reason });
      });
  };

  const naturalRestPlayers = [...remaining.values()].filter((player) =>
    ["GK", "CB", "DM"].includes(normalizeRole(player.role)),
  );
  const restCount = Math.min(
    ATTACKING_STRUCTURE_BALANCE.maximumRestDefense,
    Math.max(2, naturalRestPlayers.length >= 3 ? 3 : naturalRestPlayers.length),
  );
  take(
    "RestDefense",
    restCount,
    (player) => restDefenseFit(player),
    "preserve two or three players behind the attack",
  );

  take(
    "WidthProvider",
    1,
    (player) => widthFit(player, -1),
    "hold the left touchline and stretch the defensive block",
  );
  take(
    "WidthProvider",
    1,
    (player) => widthFit(player, 1),
    "hold the right touchline and create a switch outlet",
  );

  const ballSupportCount = input.pressure >= 0.62 ? 2 : 1;
  take(
    "BallSupport",
    Math.min(ballSupportCount, ATTACKING_STRUCTURE_BALANCE.maximumBallSupports),
    (player) =>
      40 - distance(player.position, input.ball) +
      (["DM", "CM", "FB"].includes(normalizeRole(player.role)) ? 16 : 0),
    "form a short passing angle without pulling the whole team to the ball",
  );

  take(
    "DepthSupport",
    1,
    (player) =>
      (["DM", "CM", "FB", "CB"].includes(normalizeRole(player.role)) ? 18 : 0) -
      distance(player.position, input.ball) * 0.25,
    "offer a safe outlet behind the ball",
  );

  const runnerCount = Math.min(
    ATTACKING_STRUCTURE_BALANCE.maximumDepthRunners,
    input.isTransition || input.directness >= 0.68 ? 2 : 1,
  );
  take(
    "Runner",
    runnerCount,
    (player) => {
      const role = normalizeRole(player.role);
      const roleFit = role === "ST" ? 32 : role === "W" ? 28 : role === "AM" ? 20 : 0;
      return (
        roleFit +
        Number(player.velocity?.y ?? 0) * (input.side === "home" ? -0.8 : 0.8)
      );
    },
    "threaten depth in a dedicated lane",
  );

  take(
    "ForwardOption",
    1,
    (player) => (["AM", "CM", "W", "ST"].includes(normalizeRole(player.role)) ? 18 : 0),
    "occupy space between the lines as the forward passing option",
  );

  for (const player of remaining.values()) {
    const role = normalizeRole(player.role);
    result.push({
      player,
      supportRole: role === "ST" || role === "AM" ? "BoxOccupier" : "ForwardOption",
      reason:
        role === "ST" || role === "AM"
          ? "occupy the box while another attacker provides depth"
          : "retain a separate forward or lateral connection",
    });
  }
  return result;
}

function buildRoleTarget(
  input: AttackingStructureInput,
  assignment: MutableRoleAssignment,
  direction: -1 | 1,
  order: number,
): StructurePoint {
  const player = assignment.player;
  const anchor = player.formationAnchor ?? player.position;
  const ballShiftInfluence = getBallShiftInfluence(assignment.supportRole);
  const shiftedAnchor = {
    x: anchor.x + (input.ball.x - 50) * ballShiftInfluence,
    y: anchor.y + (input.ball.y - 50) * ballShiftInfluence,
  };
  const naturalSide = anchor.x < 48 ? -1 : anchor.x > 52 ? 1 : player.id % 2 === 0 ? -1 : 1;
  let target = shiftedAnchor;

  if (assignment.supportRole === "BallSupport") {
    target = {
      x: input.ball.x + naturalSide * (10.5 + (order % 2) * 3),
      y: input.ball.y - direction * 2.5,
    };
  } else if (assignment.supportRole === "DepthSupport") {
    target = {
      x: lerp(shiftedAnchor.x, input.ball.x, 0.32),
      y: input.ball.y - direction * 11,
    };
  } else if (assignment.supportRole === "WidthProvider") {
    target = {
      x: naturalSide < 0 ? LANE_CENTERS.left_wing : LANE_CENTERS.right_wing,
      y: lerp(shiftedAnchor.y, input.ball.y + direction * 3, 0.34),
    };
  } else if (assignment.supportRole === "ForwardOption") {
    const halfSpaceX = naturalSide < 0 ? LANE_CENTERS.left_half_space : LANE_CENTERS.right_half_space;
    target = {
      x: lerp(shiftedAnchor.x, halfSpaceX, 0.55),
      y: lerp(shiftedAnchor.y, input.ball.y + direction * 12, 0.58),
    };
  } else if (assignment.supportRole === "Runner") {
    target = {
      x: clamp(lerp(shiftedAnchor.x, naturalSide < 0 ? 37 : 63, 0.42), 9, 91),
      y: clamp(input.ball.y + direction * (input.isTransition ? 25 : 19), 4, 96),
    };
  } else if (assignment.supportRole === "BoxOccupier") {
    target = {
      x: clamp(lerp(shiftedAnchor.x, 50, 0.62), 35, 65),
      y: clamp(input.ball.y + direction * 17, 5, 95),
    };
  } else {
    const minimumBehindBall = input.ball.y - direction * (input.isTransition ? 13 : 18);
    target = {
      x: shiftedAnchor.x,
      y:
        direction < 0
          ? Math.max(shiftedAnchor.y, minimumBehindBall)
          : Math.min(shiftedAnchor.y, minimumBehindBall),
    };
  }

  return { x: clamp(target.x, 4, 96), y: clamp(target.y, 4, 96) };
}

function moveOutOfCongestedZone(
  target: StructurePoint,
  role: AttackingSupportRole,
  direction: -1 | 1,
  occupancy: Record<string, number>,
) {
  let candidate = { ...target };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const zone = getAttackingTargetZone(candidate, direction < 0 ? "home" : "away");
    const cap = ATTACKING_STRUCTURE_BALANCE.maxPlayersPerLane[zone.lane];
    if ((occupancy[zone.key] ?? 0) < cap) return candidate;
    const laneIndex = LANE_ORDER.indexOf(zone.lane);
    const offsets = role === "WidthProvider" ? [0] : attempt % 2 === 0 ? [-1, 1] : [1, -1];
    const nextLane = offsets
      .map((offset) => LANE_ORDER[laneIndex + offset])
      .find(Boolean);
    if (nextLane) candidate.x = LANE_CENTERS[nextLane];
    else candidate.y = clamp(candidate.y - direction * 8, 4, 96);
  }
  return candidate;
}

function separateTarget(
  target: StructurePoint,
  playerId: number,
  role: AttackingSupportRole,
  direction: -1 | 1,
  placed: StructurePoint[],
) {
  let candidate = { ...target };
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const nearest = placed
      .map((other) => ({ other, gap: distance(other, candidate) }))
      .sort((left, right) => left.gap - right.gap)[0];
    if (!nearest || nearest.gap >= ATTACKING_STRUCTURE_BALANCE.minimumTeammateSpacing) break;
    const away = normalize({ x: candidate.x - nearest.other.x, y: candidate.y - nearest.other.y });
    const fallbackSide = (playerId + attempt) % 2 === 0 ? 1 : -1;
    const separation = ATTACKING_STRUCTURE_BALANCE.minimumTeammateSpacing - nearest.gap + 1.2;
    candidate = {
      x: clamp(candidate.x + (Math.abs(away.x) > 0.1 ? away.x : fallbackSide) * separation, 4, 96),
      y: clamp(
        candidate.y +
          (Math.abs(away.y) > 0.1 ? away.y : role === "RestDefense" ? -direction : direction) *
            separation * 0.55,
        4,
        96,
      ),
    };
  }
  return candidate;
}

function getBallShiftInfluence(role: AttackingSupportRole) {
  const values: Record<AttackingSupportRole, number> = {
    BallSupport: 0.34,
    ForwardOption: 0.24,
    WidthProvider: 0.16,
    DepthSupport: 0.2,
    Runner: 0.22,
    RestDefense: 0.1,
    BoxOccupier: 0.2,
  };
  return values[role];
}

function getPlacementPriority(role: AttackingSupportRole) {
  const priorities: Record<AttackingSupportRole, number> = {
    RestDefense: 100,
    WidthProvider: 92,
    BallSupport: 86,
    DepthSupport: 82,
    ForwardOption: 76,
    Runner: 72,
    BoxOccupier: 68,
  };
  return priorities[role];
}

function restDefenseFit(player: AttackingStructurePlayer) {
  const role = normalizeRole(player.role);
  return role === "GK" ? 100 : role === "CB" ? 90 : role === "DM" ? 72 : role === "FB" ? 55 : 0;
}

function widthFit(player: AttackingStructurePlayer, side: -1 | 1) {
  const role = normalizeRole(player.role);
  const anchorX = player.formationAnchor?.x ?? player.position.x;
  const onSide = Math.sign(anchorX - 50) === side ? 20 : -18;
  const roleFit = role === "W" ? 32 : role === "FB" ? 28 : role === "CM" || role === "AM" ? 10 : 0;
  return roleFit + onSide + Math.abs(anchorX - 50) * 0.3;
}

function getLane(x: number): AttackingLateralZone {
  if (x < 19) return "left_wing";
  if (x < 41) return "left_half_space";
  if (x <= 59) return "center";
  if (x <= 81) return "right_half_space";
  return "right_wing";
}

function normalizeRole(role: string): "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "ST" {
  const value = role.toUpperCase();
  if (value.includes("GK")) return "GK";
  if (value.includes("CB")) return "CB";
  if (value.includes("LB") || value.includes("RB") || value.includes("WB")) return "FB";
  if (value.includes("CDM") || value === "DM") return "DM";
  if (value.includes("CAM") || value === "AM" || value.includes("SS")) return "AM";
  if (value.includes("LW") || value.includes("RW") || value === "W") return "W";
  if (value.includes("ST") || value.includes("CF") || value.includes("FW")) return "ST";
  return "CM";
}

function normalize(point: StructurePoint) {
  const length = Math.hypot(point.x, point.y);
  return length <= 0.001 ? { x: 0, y: 0 } : { x: point.x / length, y: point.y / length };
}

function distance(left: StructurePoint, right: StructurePoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
