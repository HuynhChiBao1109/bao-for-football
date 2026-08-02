export type DefensiveSide = "home" | "away";

export type DefensiveState =
  | "HoldShape"
  | "TrackRunner"
  | "MarkOpponent"
  | "PressBall"
  | "Cover"
  | "BlockLane"
  | "Tackle"
  | "Intercept"
  | "Retreat";

export type DefensiveMarkingStyle = "zonal" | "man" | "hybrid";
export type DefensivePhase = "settled" | "counter_press" | "retreat";

export type DefensivePoint = { x: number; y: number };

export type DefensiveTactics = {
  defensiveLine: number;
  pressingIntensity: number;
  compactness: number;
  markingStyle: DefensiveMarkingStyle;
  riskTolerance: number;
  counterPress: number;
};

export type DefensiveAttributes = {
  awareness: number;
  positioning: number;
  marking: number;
  tackling: number;
  aggression: number;
  stamina: number;
  teamwork: number;
  speed: number;
  acceleration: number;
};

export type DefensiveAiPlayer = {
  id: number;
  side: DefensiveSide;
  role: string;
  position: DefensivePoint;
  velocity: DefensivePoint;
  homePosition: DefensivePoint;
  stamina: number;
  stats: DefensiveAttributes;
  currentState?: DefensiveState | null;
};

export type DefensiveAttacker = {
  id: number;
  side: DefensiveSide;
  role: string;
  position: DefensivePoint;
  velocity: DefensivePoint;
  speed: number;
  ballControl: number;
  vision: number;
};

export type DefensiveBall = {
  position: DefensivePoint;
  velocity: DefensivePoint;
  ownerPlayerId: number | null;
  intendedReceiverId?: number | null;
  isLoose: boolean;
};

export type DefensivePressTrigger =
  | "turnover"
  | "poor_touch"
  | "back_to_goal"
  | "touchline_trap"
  | "isolated_carrier"
  | "risky_pass";

export type DefensiveSituationInput = {
  tick: number;
  defendingSide: DefensiveSide;
  previousPossession?: DefensiveSide | null;
  possessionSide: DefensiveSide;
  possessionTicks: number;
  ball: DefensiveBall;
  carrier: DefensiveAttacker | null;
  defenders: DefensiveAiPlayer[];
  attackers: DefensiveAttacker[];
  tactics: DefensiveTactics;
  latestEvent?: string | null;
};

export type DefensiveSituation = DefensiveSituationInput & {
  ownGoal: DefensivePoint;
  predictedBall: DefensivePoint;
  predictedCarrier: DefensivePoint;
  phase: DefensivePhase;
  pressTriggers: DefensivePressTrigger[];
  centralDanger: number;
  boxDanger: number;
  ballProgressToGoal: number;
};

export type DefensiveThreat = {
  attackerId: number;
  position: DefensivePoint;
  predictedPosition: DefensivePoint;
  score: number;
  goalProximity: number;
  centrality: number;
  openSpace: number;
  receiveThreat: number;
  runThreat: number;
  isCarrier: boolean;
};

export type DefensiveResponsibility = {
  defenderId: number;
  preferredState: DefensiveState;
  target: DefensivePoint;
  opponentId: number | null;
  priority: number;
  reason: string;
};

export type DefensiveActionScore = {
  state: DefensiveState;
  score: number;
  target: DefensivePoint;
  opponentId: number | null;
  reason: string;
};

export type DefensiveAssignment = {
  defenderId: number;
  state: DefensiveState;
  target: DefensivePoint;
  opponentId: number | null;
  utility: number;
  confidence: number;
  reason: string;
  scores: Array<{ state: DefensiveState; score: number }>;
};

export type DefensivePlan = {
  side: DefensiveSide;
  phase: DefensivePhase;
  primaryPresserId: number | null;
  secondaryPresserIds: number[];
  coverPlayerId: number | null;
  pressTriggers: DefensivePressTrigger[];
  threats: DefensiveThreat[];
  assignments: DefensiveAssignment[];
};

export const DEFAULT_DEFENSIVE_TACTICS: DefensiveTactics = {
  defensiveLine: 0.5,
  pressingIntensity: 0.5,
  compactness: 0.58,
  markingStyle: "hybrid",
  riskTolerance: 0.45,
  counterPress: 0.5,
};

export const DEFENSIVE_AI_CONFIG = {
  predictionSeconds: 0.55,
  ballPredictionSeconds: 0.42,
  normalPresserLimit: 1,
  activePressPresserLimit: 2,
  activePressThreshold: 0.82,
  tackleRange: 2.35,
  tackleProbabilityThreshold: 0.61,
  markDistance: 2.6,
  centralCorridorMinX: 31,
  centralCorridorMaxX: 69,
  defensiveBoxDepth: 20,
  maxDecisionNoise: 0.055,
  currentStateBonus: 0.075,
} as const;

const STATES: DefensiveState[] = [
  "HoldShape",
  "TrackRunner",
  "MarkOpponent",
  "PressBall",
  "Cover",
  "BlockLane",
  "Tackle",
  "Intercept",
  "Retreat",
];

const STATE_TRANSITIONS: Record<DefensiveState, DefensiveState[]> = {
  HoldShape: [
    "HoldShape",
    "TrackRunner",
    "MarkOpponent",
    "PressBall",
    "Cover",
    "BlockLane",
    "Intercept",
    "Retreat",
  ],
  TrackRunner: [
    "TrackRunner",
    "MarkOpponent",
    "Cover",
    "BlockLane",
    "PressBall",
    "Tackle",
    "Retreat",
    "HoldShape",
  ],
  MarkOpponent: [
    "MarkOpponent",
    "TrackRunner",
    "Cover",
    "BlockLane",
    "PressBall",
    "Tackle",
    "Retreat",
    "HoldShape",
  ],
  PressBall: ["PressBall", "Tackle", "Cover", "BlockLane", "Retreat", "HoldShape"],
  Cover: [
    "Cover",
    "BlockLane",
    "TrackRunner",
    "MarkOpponent",
    "PressBall",
    "Intercept",
    "Retreat",
    "HoldShape",
  ],
  BlockLane: [
    "BlockLane",
    "Intercept",
    "Cover",
    "MarkOpponent",
    "PressBall",
    "Retreat",
    "HoldShape",
  ],
  Tackle: ["Tackle", "PressBall", "Cover", "Retreat"],
  Intercept: ["Intercept", "BlockLane", "Cover", "PressBall", "HoldShape", "Retreat"],
  Retreat: [
    "Retreat",
    "HoldShape",
    "Cover",
    "BlockLane",
    "TrackRunner",
    "MarkOpponent",
    "PressBall",
  ],
};

export type DefensiveResponsibilityPlan = {
  primaryPresserId: number | null;
  secondaryPresserIds: number[];
  coverPlayerId: number | null;
  responsibilities: Map<number, DefensiveResponsibility>;
};

export function collectDefensiveSituation(input: DefensiveSituationInput): DefensiveSituation {
  const ownGoal = { x: 50, y: input.defendingSide === "home" ? 100 : 0 };
  const predictedBall = predictPoint(
    input.ball.position,
    input.ball.velocity,
    DEFENSIVE_AI_CONFIG.ballPredictionSeconds,
  );
  const predictedCarrier = input.carrier
    ? predictPoint(
        input.carrier.position,
        input.carrier.velocity,
        DEFENSIVE_AI_CONFIG.predictionSeconds,
      )
    : predictedBall;
  const goalDistance = distance(predictedBall, ownGoal);
  const ballProgressToGoal = clamp01(1 - goalDistance / 105);
  const centralDanger = centrality(predictedBall.x) * clamp01(0.35 + ballProgressToGoal * 0.9);
  const boxDanger = getBoxDanger(predictedBall, input.defendingSide);
  const pressTriggers = detectPressTriggers({ ...input, ownGoal, predictedCarrier });
  const justLostBall =
    input.previousPossession === input.defendingSide &&
    input.possessionSide !== input.defendingSide;
  const counterPressIsSafe =
    input.tactics.counterPress >= 0.48 &&
    ballProgressToGoal < 0.82 &&
    input.defenders.filter((player) => distance(player.position, predictedCarrier) <= 12).length >=
      2;
  const phase: DefensivePhase = justLostBall
    ? counterPressIsSafe
      ? "counter_press"
      : "retreat"
    : ballProgressToGoal > 0.78 && input.tactics.pressingIntensity < 0.72
      ? "retreat"
      : "settled";

  if (justLostBall && !pressTriggers.includes("turnover")) pressTriggers.unshift("turnover");

  return {
    ...input,
    ownGoal,
    predictedBall,
    predictedCarrier,
    phase,
    pressTriggers,
    centralDanger,
    boxDanger,
    ballProgressToGoal,
  };
}

export function evaluateDefensiveThreats(situation: DefensiveSituation): DefensiveThreat[] {
  const laneOrigin = situation.carrier?.position ?? situation.ball.position;
  return situation.attackers
    .map((attacker) => {
      const predictedPosition = predictPoint(
        attacker.position,
        attacker.velocity,
        DEFENSIVE_AI_CONFIG.predictionSeconds,
      );
      const goalProximity = clamp01(1 - distance(predictedPosition, situation.ownGoal) / 100);
      const attackerCentrality = centrality(predictedPosition.x);
      const nearestDefenderDistance = Math.min(
        ...situation.defenders
          .filter((defender) => normalizeRole(defender.role) !== "GK")
          .map((defender) => distance(defender.position, predictedPosition)),
        24,
      );
      const openSpace = clamp01(nearestDefenderDistance / 13);
      const passDistance = distance(laneOrigin, predictedPosition);
      const receiveQuality = clamp01((attacker.ballControl + attacker.vision) / 200);
      const receiveThreat =
        attacker.id === situation.ball.intendedReceiverId
          ? 1
          : clamp01((1 - passDistance / 65) * 0.58 + openSpace * 0.28 + receiveQuality * 0.22);
      const directionToGoal = normalize(subtract(situation.ownGoal, attacker.position));
      const movement = normalize(attacker.velocity);
      const runAlignment = Math.max(0, dot(directionToGoal, movement));
      const runThreat = clamp01(
        runAlignment * 0.55 +
          clamp01(magnitude(attacker.velocity) / 10) * 0.25 +
          clamp01(attacker.speed / 100) * 0.2,
      );
      const isCarrier = attacker.id === situation.carrier?.id;
      const score = clamp01(
        goalProximity * 0.28 +
          attackerCentrality * 0.18 +
          openSpace * 0.16 +
          receiveThreat * 0.2 +
          runThreat * 0.12 +
          (isCarrier ? 0.16 : 0) +
          (getBoxDanger(predictedPosition, situation.defendingSide) > 0.5 ? 0.1 : 0),
      );

      return {
        attackerId: attacker.id,
        position: attacker.position,
        predictedPosition,
        score,
        goalProximity,
        centrality: attackerCentrality,
        openSpace,
        receiveThreat,
        runThreat,
        isCarrier,
      };
    })
    .sort((left, right) => right.score - left.score || left.attackerId - right.attackerId);
}

export function assignDefensiveResponsibilities(
  situation: DefensiveSituation,
  threats: DefensiveThreat[],
): DefensiveResponsibilityPlan {
  const outfield = situation.defenders.filter((player) => normalizeRole(player.role) !== "GK");
  const responsibilities = new Map<number, DefensiveResponsibility>();
  const primaryPresser = choosePrimaryPresser(situation, outfield);
  const activePress =
    situation.tactics.pressingIntensity >=
      DEFENSIVE_AI_CONFIG.activePressThreshold - situation.tactics.riskTolerance * 0.06 &&
    situation.pressTriggers.length >= 1 &&
    situation.phase !== "retreat";
  const secondaryPresser = activePress
    ? chooseSecondaryPresser(situation, outfield, primaryPresser?.id ?? null)
    : null;
  const secondaryPresserIds = secondaryPresser ? [secondaryPresser.id] : [];

  if (primaryPresser) {
    responsibilities.set(primaryPresser.id, {
      defenderId: primaryPresser.id,
      preferredState: "PressBall",
      target: getPressTarget(situation, primaryPresser),
      opponentId: situation.carrier?.id ?? null,
      priority: 1,
      reason: situation.pressTriggers.length
        ? `primary presser: ${situation.pressTriggers.join(", ")}`
        : "nearest goal-side pressure",
    });
  }
  if (secondaryPresser) {
    responsibilities.set(secondaryPresser.id, {
      defenderId: secondaryPresser.id,
      preferredState: "PressBall",
      target: getPressTarget(situation, secondaryPresser, true),
      opponentId: situation.carrier?.id ?? null,
      priority: 0.82,
      reason: "active pressing support",
    });
  }

  if (!situation.carrier && (situation.ball.isLoose || magnitude(situation.ball.velocity) > 2.4)) {
    const interceptor = [...outfield]
      .filter((player) => !responsibilities.has(player.id))
      .sort(
        (left, right) =>
          distance(left.position, situation.predictedBall) -
            distance(right.position, situation.predictedBall) ||
          right.stats.awareness - left.stats.awareness,
      )[0];
    if (interceptor) {
      responsibilities.set(interceptor.id, {
        defenderId: interceptor.id,
        preferredState: "Intercept",
        target: situation.predictedBall,
        opponentId: situation.ball.intendedReceiverId ?? null,
        priority: 0.92,
        reason: "best-positioned defender attacks predicted ball path",
      });
    }
  }

  const pressers = new Set([primaryPresser?.id, secondaryPresser?.id].filter(isNumber));
  const coverPlayer = primaryPresser
    ? chooseCoverPlayer(situation, outfield, pressers, primaryPresser)
    : null;
  if (coverPlayer && primaryPresser) {
    responsibilities.set(coverPlayer.id, {
      defenderId: coverPlayer.id,
      preferredState: "Cover",
      target: getCoverTarget(situation, primaryPresser),
      opponentId: null,
      priority: 0.88,
      reason: "cover space vacated by primary presser",
    });
  }

  const unavailableDefenders = new Set(responsibilities.keys());
  const assignedOpponents = new Set<number>();
  for (const threat of threats) {
    if (threat.isCarrier || assignedOpponents.has(threat.attackerId)) continue;
    const markingThreshold =
      situation.tactics.markingStyle === "man"
        ? 0.2
        : situation.tactics.markingStyle === "zonal"
          ? 0.58
          : 0.34;
    if (threat.score < markingThreshold && threat.runThreat < 0.72) continue;
    const defender = chooseMarker(situation, threat, outfield, unavailableDefenders);
    if (!defender) continue;
    const attacker = situation.attackers.find((player) => player.id === threat.attackerId);
    if (!attacker) continue;
    const shouldTrack = threat.runThreat >= 0.54 || threat.receiveThreat >= 0.78;
    const markTarget = getGoalSideMarkTarget(situation, threat.predictedPosition);
    responsibilities.set(defender.id, {
      defenderId: defender.id,
      preferredState: shouldTrack ? "TrackRunner" : "MarkOpponent",
      target: markTarget,
      opponentId: attacker.id,
      priority: threat.score,
      reason: shouldTrack ? "track dangerous forward run" : "unique dynamic marking assignment",
    });
    unavailableDefenders.add(defender.id);
    assignedOpponents.add(attacker.id);
  }

  for (const defender of situation.defenders) {
    if (responsibilities.has(defender.id)) continue;
    const role = normalizeRole(defender.role);
    const laneThreat = threats.find(
      (threat) =>
        !threat.isCarrier &&
        threat.receiveThreat >= 0.38 &&
        !assignedOpponents.has(threat.attackerId),
    );
    const ballIsWide = situation.predictedBall.x <= 24 || situation.predictedBall.x >= 76;
    const sameFlank =
      (defender.homePosition.x < 50 && situation.predictedBall.x < 50) ||
      (defender.homePosition.x >= 50 && situation.predictedBall.x >= 50);
    if (role === "FB" && ballIsWide && sameFlank) {
      responsibilities.set(defender.id, {
        defenderId: defender.id,
        preferredState: "BlockLane",
        target: getLaneBlockTarget(situation, {
          x: 50,
          y: situation.defendingSide === "home" ? 86 : 14,
        }),
        opponentId: situation.carrier?.id ?? null,
        priority: 0.72,
        reason: "close crossing lane while showing winger outside",
      });
      continue;
    }
    if ((role === "DM" || role === "CM") && laneThreat) {
      responsibilities.set(defender.id, {
        defenderId: defender.id,
        preferredState: "BlockLane",
        target: getLaneBlockTarget(situation, laneThreat.predictedPosition),
        opponentId: laneThreat.attackerId,
        priority: 0.62 + situation.centralDanger * 0.2,
        reason: "screen central passing lane",
      });
      assignedOpponents.add(laneThreat.attackerId);
      continue;
    }
    const preferredState = situation.phase === "retreat" ? "Retreat" : "HoldShape";
    responsibilities.set(defender.id, {
      defenderId: defender.id,
      preferredState,
      target:
        preferredState === "Retreat"
          ? getRetreatTarget(situation, defender)
          : getShapeTarget(situation, defender),
      opponentId: null,
      priority: 0.5,
      reason:
        role === "FB"
          ? "hold fullback line and protect cross/inside channel"
          : role === "CB"
            ? "maintain back line and protect depth"
            : "maintain compact defensive shape",
    });
  }

  return {
    primaryPresserId: primaryPresser?.id ?? null,
    secondaryPresserIds,
    coverPlayerId: coverPlayer?.id ?? null,
    responsibilities,
  };
}

export function scoreDefensiveActions(input: {
  situation: DefensiveSituation;
  threats: DefensiveThreat[];
  assignment: DefensiveResponsibilityPlan;
  defender: DefensiveAiPlayer;
  random?: () => number;
}): DefensiveActionScore[] {
  const { situation, threats, assignment, defender } = input;
  const responsibility = assignment.responsibilities.get(defender.id)!;
  const role = normalizeRole(defender.role);
  const mental = getMentalQuality(defender);
  const stamina = normalizeStat(defender.stamina);
  const carrierDistance = distance(defender.position, situation.predictedCarrier);
  const isPrimary = defender.id === assignment.primaryPresserId;
  const isSecondary = assignment.secondaryPresserIds.includes(defender.id);
  const isCover = defender.id === assignment.coverPlayerId;
  const pressurePermission = isPrimary || isSecondary;
  const tackleProbability = estimateTackleProbability(situation, defender);
  const movingBall = magnitude(situation.ball.velocity) > 2.4 || situation.ball.isLoose;
  const interceptReach = clamp01(
    1 -
      distance(defender.position, situation.predictedBall) /
        (5 + normalizeStat(defender.stats.speed) * 8),
  );
  const assignedThreat = threats.find((threat) => threat.attackerId === responsibility.opponentId);
  const shapeTarget = getShapeTarget(situation, defender);
  const retreatTarget = getRetreatTarget(situation, defender);
  const roleLineBonus = role === "CB" || role === "FB" ? 0.18 : 0.08;
  const triggerStrength = clamp01(situation.pressTriggers.length / 3);
  const formationDisplacement = clamp01(distance(defender.position, shapeTarget) / 18);
  const scores = new Map<DefensiveState, number>();

  if (role === "GK") {
    const random = input.random ?? Math.random;
    return STATES.map((state) => ({
      state,
      score: state === "HoldShape" ? 2 : -2 + (random() * 2 - 1) * 0.005,
      target: getShapeTarget(situation, defender),
      opponentId: null,
      reason: state === "HoldShape" ? "goalkeeper protects goal depth" : getStateReason(state),
    }));
  }

  scores.set(
    "HoldShape",
    0.45 +
      situation.tactics.compactness * 0.24 +
      roleLineBonus +
      formationDisplacement * 0.18 -
      (isPrimary ? 0.7 : 0) -
      (situation.phase === "retreat" ? 0.22 : 0),
  );
  scores.set(
    "TrackRunner",
    (assignedThreat?.runThreat ?? 0) * 0.78 +
      (assignedThreat?.score ?? 0) * 0.58 +
      normalizeStat(defender.stats.awareness) * 0.17 +
      normalizeStat(defender.stats.speed) * 0.13 +
      (responsibility.preferredState === "TrackRunner" ? 0.62 : 0),
  );
  scores.set(
    "MarkOpponent",
    (assignedThreat?.score ?? 0) * 0.62 +
      normalizeStat(defender.stats.marking) * 0.3 +
      (situation.tactics.markingStyle === "man" ? 0.22 : 0.08) +
      (responsibility.preferredState === "MarkOpponent" ? 0.58 : 0),
  );
  scores.set(
    "PressBall",
    pressurePermission
      ? 0.5 +
          situation.tactics.pressingIntensity * 0.45 +
          triggerStrength * 0.34 +
          clamp01(1 - carrierDistance / 19) * 0.34 +
          (isPrimary ? 0.54 : 0.18) +
          normalizeStat(defender.stats.aggression) * 0.1 -
          situation.boxDanger * (role === "CB" ? 0.28 : 0.06)
      : -1.2,
  );
  scores.set(
    "Cover",
    0.38 +
      situation.centralDanger * 0.3 +
      normalizeStat(defender.stats.teamwork) * 0.22 +
      normalizeStat(defender.stats.positioning) * 0.2 +
      (isCover ? 0.75 : 0) +
      (responsibility.preferredState === "Cover" ? 0.3 : 0),
  );
  scores.set(
    "BlockLane",
    0.36 +
      situation.centralDanger * 0.32 +
      (assignedThreat?.receiveThreat ?? 0) * 0.46 +
      (role === "DM" ? 0.28 : role === "CM" ? 0.15 : 0) +
      (responsibility.preferredState === "BlockLane" ? 0.58 : 0),
  );
  scores.set(
    "Tackle",
    pressurePermission &&
      carrierDistance <= DEFENSIVE_AI_CONFIG.tackleRange &&
      tackleProbability >=
        DEFENSIVE_AI_CONFIG.tackleProbabilityThreshold +
          (0.5 - situation.tactics.riskTolerance) * 0.12
      ? 0.82 +
          tackleProbability * 0.94 +
          situation.ballProgressToGoal * 0.2 +
          situation.tactics.riskTolerance * 0.12
      : -1.5,
  );
  scores.set(
    "Intercept",
    movingBall && responsibility.preferredState === "Intercept"
      ? 0.61 + interceptReach * 0.72 + normalizeStat(defender.stats.awareness) * 0.22
      : -0.55,
  );
  scores.set(
    "Retreat",
    0.28 +
      situation.ballProgressToGoal * 0.32 +
      formationDisplacement * 0.2 +
      (situation.phase === "retreat" ? 0.92 : 0) +
      (role === "CB" && situation.boxDanger > 0.55 ? 0.2 : 0),
  );

  const currentState = defender.currentState ?? null;
  const random = input.random ?? Math.random;
  return STATES.map((state) => {
    const preferredBonus =
      state === responsibility.preferredState ? responsibility.priority * 0.26 : 0;
    const currentBonus = state === currentState ? DEFENSIVE_AI_CONFIG.currentStateBonus : 0;
    const transitionPenalty =
      currentState && !STATE_TRANSITIONS[currentState].includes(state) ? 0.28 : 0;
    const fatiguePenalty =
      state === "PressBall" || state === "TrackRunner" || state === "Tackle"
        ? (1 - stamina) * 0.2
        : 0;
    const errorScale = (1 - mental) * DEFENSIVE_AI_CONFIG.maxDecisionNoise;
    const noise = (random() * 2 - 1) * errorScale;
    const target = getActionTarget(state, situation, defender, responsibility, assignedThreat);
    return {
      state,
      score: Number(
        (
          (scores.get(state) ?? 0) +
          preferredBonus +
          currentBonus -
          transitionPenalty -
          fatiguePenalty +
          noise
        ).toFixed(4),
      ),
      target,
      opponentId:
        state === "PressBall" || state === "Tackle"
          ? (situation.carrier?.id ?? null)
          : responsibility.opponentId,
      reason:
        state === responsibility.preferredState ? responsibility.reason : getStateReason(state),
    };
  });
}

export function selectDefensiveAction(input: {
  situation: DefensiveSituation;
  defender: DefensiveAiPlayer;
  actions: DefensiveActionScore[];
}): DefensiveAssignment {
  const sorted = [...input.actions].sort(
    (left, right) =>
      right.score - left.score || STATES.indexOf(left.state) - STATES.indexOf(right.state),
  );
  const selected = sorted[0];
  const runnerUp = sorted[1];
  const mental = getMentalQuality(input.defender);
  const targetError = (1 - mental) * 1.25 * (selected.state === "HoldShape" ? 0.45 : 1);
  const angle = seededUnit(input.situation.tick, input.defender.id, 17) * Math.PI * 2;
  const target = {
    x: clamp(selected.target.x + Math.cos(angle) * targetError, 2, 98),
    y: clamp(selected.target.y + Math.sin(angle) * targetError, 2, 98),
  };
  return {
    defenderId: input.defender.id,
    state: selected.state,
    target,
    opponentId: selected.opponentId,
    utility: selected.score,
    confidence: clamp01(
      0.5 + (selected.score - (runnerUp?.score ?? selected.score)) * 0.55 + mental * 0.2,
    ),
    reason: selected.reason,
    scores: input.actions.map((action) => ({ state: action.state, score: action.score })),
  };
}

export function runDefensiveUtilityAi(
  input: DefensiveSituationInput,
  random: () => number = Math.random,
): DefensivePlan {
  const situation = collectDefensiveSituation(input);
  const threats = evaluateDefensiveThreats(situation);
  const responsibility = assignDefensiveResponsibilities(situation, threats);
  const assignments = situation.defenders.map((defender) =>
    selectDefensiveAction({
      situation,
      defender,
      actions: scoreDefensiveActions({
        situation,
        threats,
        assignment: responsibility,
        defender,
        random,
      }),
    }),
  );

  return {
    side: situation.defendingSide,
    phase: situation.phase,
    primaryPresserId: responsibility.primaryPresserId,
    secondaryPresserIds: responsibility.secondaryPresserIds,
    coverPlayerId: responsibility.coverPlayerId,
    pressTriggers: situation.pressTriggers,
    threats,
    assignments,
  };
}

function detectPressTriggers(
  input: DefensiveSituationInput & { ownGoal: DefensivePoint; predictedCarrier: DefensivePoint },
): DefensivePressTrigger[] {
  const triggers: DefensivePressTrigger[] = [];
  const carrier = input.carrier;
  if (!carrier) return input.ball.isLoose ? ["poor_touch"] : triggers;
  const ballSeparation = distance(carrier.position, input.ball.position);
  if (ballSeparation > 2.15) triggers.push("poor_touch");
  const carrierMovement = normalize(carrier.velocity);
  const toGoal = normalize(subtract(input.ownGoal, carrier.position));
  if (magnitude(carrier.velocity) > 0.25 && dot(carrierMovement, toGoal) < -0.28) {
    triggers.push("back_to_goal");
  }
  if (carrier.position.x <= 9 || carrier.position.x >= 91) triggers.push("touchline_trap");
  const nearbySupport = input.attackers.filter(
    (attacker) => attacker.id !== carrier.id && distance(attacker.position, carrier.position) <= 13,
  ).length;
  const nearbyDefenders = input.defenders.filter(
    (defender) =>
      normalizeRole(defender.role) !== "GK" && distance(defender.position, carrier.position) <= 11,
  ).length;
  if (nearbySupport === 0 && nearbyDefenders >= 1) triggers.push("isolated_carrier");
  if (
    input.latestEvent?.toUpperCase().includes("PASS") &&
    (input.ball.intendedReceiverId != null || magnitude(input.ball.velocity) > 8)
  ) {
    triggers.push("risky_pass");
  }
  return triggers;
}

function choosePrimaryPresser(situation: DefensiveSituation, defenders: DefensiveAiPlayer[]) {
  if (!defenders.length || !situation.carrier) return null;
  const ranked = [...defenders].sort((left, right) => {
    const score = (player: DefensiveAiPlayer) => {
      const role = normalizeRole(player.role);
      const roleCost = role === "CB" && situation.boxDanger < 0.7 ? 0.8 : role === "FB" ? 0.25 : 0;
      const displaced = distance(player.position, player.homePosition) * 0.025;
      const goalSide =
        distance(player.position, situation.ownGoal) <
        distance(situation.predictedCarrier, situation.ownGoal);
      const workRate =
        (normalizeStat(player.stats.aggression) + normalizeStat(player.stats.stamina)) * 0.8;
      return (
        distance(player.position, situation.predictedCarrier) +
        roleCost +
        displaced -
        (goalSide ? 0.4 : 0) -
        workRate * 0.25
      );
    };
    return score(left) - score(right) || left.id - right.id;
  });
  const nearest = ranked[0];
  const maximumPressDistance =
    14 + situation.tactics.pressingIntensity * 7 + situation.ballProgressToGoal * 3;
  return distance(nearest.position, situation.predictedCarrier) <= maximumPressDistance
    ? nearest
    : null;
}

function chooseSecondaryPresser(
  situation: DefensiveSituation,
  defenders: DefensiveAiPlayer[],
  primaryId: number | null,
) {
  return (
    [...defenders]
      .filter((player) => player.id !== primaryId && normalizeRole(player.role) !== "CB")
      .filter((player) => distance(player.position, situation.predictedCarrier) <= 11)
      .sort(
        (left, right) =>
          distance(left.position, situation.predictedCarrier) -
            distance(right.position, situation.predictedCarrier) ||
          right.stats.aggression - left.stats.aggression,
      )[0] ?? null
  );
}

function chooseCoverPlayer(
  situation: DefensiveSituation,
  defenders: DefensiveAiPlayer[],
  excluded: Set<number | undefined>,
  presser: DefensiveAiPlayer,
) {
  return (
    [...defenders]
      .filter((player) => !excluded.has(player.id))
      .sort((left, right) => {
        const cost = (player: DefensiveAiPlayer) => {
          const role = normalizeRole(player.role);
          const roleBonus = role === "CB" || role === "DM" || role === "FB" ? -2.4 : 0;
          return distance(player.position, presser.homePosition) + roleBonus;
        };
        return cost(left) - cost(right) || left.id - right.id;
      })[0] ?? null
  );
}

function chooseMarker(
  situation: DefensiveSituation,
  threat: DefensiveThreat,
  defenders: DefensiveAiPlayer[],
  unavailable: Set<number>,
) {
  return (
    [...defenders]
      .filter((player) => !unavailable.has(player.id))
      .sort((left, right) => {
        const cost = (player: DefensiveAiPlayer) => {
          const role = normalizeRole(player.role);
          const wideThreat = threat.predictedPosition.x < 28 || threat.predictedPosition.x > 72;
          const roleCost =
            wideThreat && role === "FB"
              ? -3
              : !wideThreat && (role === "CB" || role === "DM")
                ? -2.4
                : role === "ST"
                  ? 4
                  : 0;
          const markingQuality =
            normalizeStat(player.stats.marking) + normalizeStat(player.stats.awareness);
          return (
            distance(player.position, threat.predictedPosition) + roleCost - markingQuality * 2.2
          );
        };
        return cost(left) - cost(right) || left.id - right.id;
      })[0] ?? null
  );
}

function estimateTackleProbability(situation: DefensiveSituation, defender: DefensiveAiPlayer) {
  if (!situation.carrier) return 0;
  const distanceScore = clamp01(1 - distance(defender.position, situation.predictedCarrier) / 3.2);
  const goalSide =
    distance(defender.position, situation.ownGoal) <=
    distance(situation.carrier.position, situation.ownGoal);
  const relativeSpeed = clamp01(
    0.5 + (magnitude(defender.velocity) - magnitude(situation.carrier.velocity)) / 18,
  );
  const technique =
    normalizeStat(defender.stats.tackling) * 0.48 +
    normalizeStat(defender.stats.positioning) * 0.2 +
    normalizeStat(defender.stats.awareness) * 0.14;
  const carrierControl = normalizeStat(situation.carrier.ballControl);
  return clamp01(
    technique +
      distanceScore * 0.26 +
      relativeSpeed * 0.08 +
      (goalSide ? 0.1 : -0.22) -
      carrierControl * 0.2 -
      (1 - normalizeStat(defender.stamina)) * 0.08,
  );
}

function getActionTarget(
  state: DefensiveState,
  situation: DefensiveSituation,
  defender: DefensiveAiPlayer,
  responsibility: DefensiveResponsibility,
  threat?: DefensiveThreat,
) {
  switch (state) {
    case "PressBall":
    case "Tackle":
      return getPressTarget(situation, defender);
    case "Cover":
      return responsibility.preferredState === "Cover"
        ? responsibility.target
        : getCoverTarget(situation, defender);
    case "BlockLane":
      return threat
        ? getLaneBlockTarget(situation, threat.predictedPosition)
        : getLaneBlockTarget(situation, { x: 50, y: situation.ownGoal.y });
    case "TrackRunner":
    case "MarkOpponent":
      return threat
        ? getGoalSideMarkTarget(situation, threat.predictedPosition)
        : responsibility.target;
    case "Intercept":
      return situation.predictedBall;
    case "Retreat":
      return getRetreatTarget(situation, defender);
    case "HoldShape":
    default:
      return getShapeTarget(situation, defender);
  }
}

function getPressTarget(
  situation: DefensiveSituation,
  defender: DefensiveAiPlayer,
  secondary = false,
) {
  const carrier = situation.predictedCarrier;
  const outsideDirection = carrier.x < 50 ? -1 : 1;
  const toGoal = normalize(subtract(situation.ownGoal, carrier));
  const standoff = secondary ? 3.2 : 1.4;
  return {
    x: clamp(carrier.x + toGoal.x * standoff - outsideDirection * (secondary ? 1.7 : 0.7), 2, 98),
    y: clamp(carrier.y + toGoal.y * standoff, 2, 98),
  };
}

function getCoverTarget(situation: DefensiveSituation, presser: DefensiveAiPlayer) {
  const carrier = situation.predictedCarrier;
  const towardGoal = normalize(subtract(situation.ownGoal, carrier));
  return {
    x: clamp(presser.homePosition.x * 0.54 + carrier.x * 0.46 + towardGoal.x * 5, 8, 92),
    y: clamp(presser.homePosition.y * 0.42 + carrier.y * 0.58 + towardGoal.y * 6.5, 6, 94),
  };
}

function getGoalSideMarkTarget(situation: DefensiveSituation, attacker: DefensivePoint) {
  const towardGoal = normalize(subtract(situation.ownGoal, attacker));
  return {
    x: clamp(attacker.x + towardGoal.x * DEFENSIVE_AI_CONFIG.markDistance, 3, 97),
    y: clamp(attacker.y + towardGoal.y * DEFENSIVE_AI_CONFIG.markDistance, 3, 97),
  };
}

function getLaneBlockTarget(situation: DefensiveSituation, receiver: DefensivePoint) {
  const origin = situation.carrier?.position ?? situation.ball.position;
  const centralWeight = centrality(receiver.x) * 0.12;
  return {
    x: clamp(origin.x * 0.58 + receiver.x * 0.42 + (50 - receiver.x) * centralWeight, 5, 95),
    y: clamp(origin.y * 0.58 + receiver.y * 0.42, 5, 95),
  };
}

function getShapeTarget(situation: DefensiveSituation, defender: DefensiveAiPlayer) {
  const role = normalizeRole(defender.role);
  const ballSideShift =
    (situation.predictedBall.x - 50) * (0.18 + situation.tactics.compactness * 0.24);
  const goalY = situation.ownGoal.y;
  if (role === "GK") {
    return {
      x: clamp(50 + (situation.predictedBall.x - 50) * 0.13, 42, 58),
      y: goalY === 100 ? 94 : 6,
    };
  }
  if (role === "CB" || role === "FB") {
    const distanceFromGoal = 17 + situation.tactics.defensiveLine * 17;
    const baseLineY = goalY === 100 ? 100 - distanceFromGoal : distanceFromGoal;
    const ballDepthShift = clamp((situation.predictedBall.y - 50) * 0.16, -7, 7);
    const orientedShift = goalY === 100 ? ballDepthShift : -ballDepthShift;
    const lineY = baseLineY + orientedShift + (role === "FB" ? (goalY === 100 ? 1.2 : -1.2) : 0);
    const tuckedX =
      defender.homePosition.x +
      ballSideShift +
      (50 - defender.homePosition.x) * situation.tactics.compactness * 0.16;
    return { x: clamp(tuckedX, 9, 91), y: clamp(lineY, 12, 88) };
  }
  const verticalShift =
    (situation.predictedBall.y - 50) * (0.14 + situation.tactics.compactness * 0.1);
  const centralPull = (50 - defender.homePosition.x) * situation.tactics.compactness * 0.2;
  return {
    x: clamp(defender.homePosition.x + ballSideShift + centralPull, 7, 93),
    y: clamp(defender.homePosition.y + verticalShift, 8, 92),
  };
}

function getRetreatTarget(situation: DefensiveSituation, defender: DefensiveAiPlayer) {
  const shape = getShapeTarget(situation, defender);
  const toGoal = normalize(subtract(situation.ownGoal, defender.position));
  const retreatDistance = normalizeRole(defender.role) === "CB" ? 4.5 : 7;
  return {
    x: clamp(shape.x * 0.72 + defender.position.x * 0.28 + toGoal.x * retreatDistance, 5, 95),
    y: clamp(shape.y * 0.72 + defender.position.y * 0.28 + toGoal.y * retreatDistance, 4, 96),
  };
}

function getMentalQuality(player: DefensiveAiPlayer) {
  return clamp01(
    normalizeStat(player.stats.awareness) * 0.28 +
      normalizeStat(player.stats.positioning) * 0.24 +
      normalizeStat(player.stats.marking) * 0.16 +
      normalizeStat(player.stats.teamwork) * 0.22 +
      normalizeStat(player.stamina) * 0.1,
  );
}

function getStateReason(state: DefensiveState) {
  const reasons: Record<DefensiveState, string> = {
    HoldShape: "protect team structure",
    TrackRunner: "follow dangerous run",
    MarkOpponent: "deny receiving space",
    PressBall: "pressure ball carrier",
    Cover: "protect vacated space",
    BlockLane: "close dangerous passing lane",
    Tackle: "ball-winning probability above threshold",
    Intercept: "attack predicted ball path",
    Retreat: "delay counterattack and recover goal-side",
  };
  return reasons[state];
}

function getBoxDanger(point: DefensivePoint, side: DefensiveSide) {
  const depth = side === "home" ? point.y : 100 - point.y;
  return (
    clamp01(
      (depth - (100 - DEFENSIVE_AI_CONFIG.defensiveBoxDepth)) /
        DEFENSIVE_AI_CONFIG.defensiveBoxDepth,
    ) * clamp01(1 - Math.abs(point.x - 50) / 32)
  );
}

function normalizeRole(role: string): "GK" | "CB" | "FB" | "DM" | "CM" | "W" | "ST" {
  const upper = role.toUpperCase();
  if (upper === "GK") return "GK";
  if (upper.includes("CB")) return "CB";
  if (upper === "LB" || upper === "RB" || upper.includes("WB")) return "FB";
  if (upper === "CDM" || upper === "DM") return "DM";
  if (upper === "CM" || upper === "CAM") return "CM";
  if (["LW", "RW", "LM", "RM"].includes(upper)) return "W";
  return "ST";
}

function normalizeStat(value: number) {
  return clamp01(Number(value ?? 50) / 100);
}

function predictPoint(position: DefensivePoint, velocity: DefensivePoint, seconds: number) {
  return {
    x: clamp(position.x + velocity.x * seconds, 0, 100),
    y: clamp(position.y + velocity.y * seconds, 0, 100),
  };
}

function centrality(x: number) {
  return clamp01(1 - Math.abs(x - 50) / 38);
}

function subtract(left: DefensivePoint, right: DefensivePoint) {
  return { x: left.x - right.x, y: left.y - right.y };
}

function normalize(point: DefensivePoint) {
  const length = magnitude(point);
  return length > 0.0001 ? { x: point.x / length, y: point.y / length } : { x: 0, y: 0 };
}

function magnitude(point: DefensivePoint) {
  return Math.hypot(point.x, point.y);
}

function distance(left: DefensivePoint, right: DefensivePoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function dot(left: DefensivePoint, right: DefensivePoint) {
  return left.x * right.x + left.y * right.y;
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function seededUnit(tick: number, id: number, salt: number) {
  const value = Math.sin(tick * 12.9898 + id * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function isNumber(value: number | undefined): value is number {
  return typeof value === "number";
}
