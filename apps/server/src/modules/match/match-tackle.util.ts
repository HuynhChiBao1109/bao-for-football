export type TackleStyle = "standing" | "sliding";
export type TacklePhase = "idle" | "approach" | "commit" | "recovery";
export type TackleOutcome = "won" | "loose_ball" | "foul" | "beaten";
export type TackleCard = "yellow" | "red" | null;

export type TacklePoint = { x: number; y: number };

export type PlayerTackleState = {
  phase: TacklePhase;
  style: TackleStyle | null;
  targetPlayerId: number | null;
  phaseStartedTick: number;
  recoveryUntilTick: number;
  cooldownUntilTick: number;
  approachTarget: TacklePoint | null;
  lastOutcome: TackleOutcome | null;
};

export type TackleEvaluation = {
  action: "hold" | "approach" | "commit";
  reason:
    | "cooldown"
    | "recovering"
    | "too_far"
    | "contain"
    | "bad_angle"
    | "wait_for_touch"
    | "commit";
  style: TackleStyle | null;
  approachTarget: TacklePoint;
  distanceToCarrierMeters: number;
  distanceToBallMeters: number;
  approachDot: number;
  closingSpeedMetersPerSecond: number;
  danger: number;
  defenderQuality: number;
  carrierQuality: number;
  timingQuality: number;
  fromBehind: boolean;
  highRiskFromBehind: boolean;
};

export type TackleEvaluationInput = {
  tick: number;
  defenderId: number;
  carrierId: number;
  defenderSide: "home" | "away";
  defenderPosition: TacklePoint;
  defenderVelocity: TacklePoint;
  carrierPosition: TacklePoint;
  carrierVelocity: TacklePoint;
  ballPosition: TacklePoint;
  ballTarget: TacklePoint;
  defenderStats: {
    tackle: number;
    balance: number;
    speed: number;
    acceleration: number;
    stamina: number;
  };
  carrierStats: {
    dribbling: number;
    balance: number;
    speed: number;
    acceleration: number;
  };
  riskTaking: number;
  hasTankTackle: boolean;
  state?: PlayerTackleState | null;
  decisionRoll: number;
};

export type TackleResolution = {
  outcome: TackleOutcome;
  style: TackleStyle;
  card: TackleCard;
  target: TacklePoint;
  successChance: number;
  foulChance: number;
  recoveryTicks: number;
  cooldownTicks: number;
};

export type TackleResolutionInput = {
  evaluation: TackleEvaluation & { action: "commit"; style: TackleStyle };
  tick: number;
  ballPosition: TacklePoint;
  ballTarget: TacklePoint;
  defenderPosition: TacklePoint;
  carrierPosition: TacklePoint;
  defenderTackle: number;
  riskTaking: number;
  hasTankTackle: boolean;
  currentCard?: TackleCard;
  foulRoll: number;
  successRoll: number;
  controlRoll: number;
  cardRoll: number;
  deflectionSideRoll: number;
};

const STANDING_REACH_METERS = 2.35;
const SLIDING_REACH_METERS = 4.65;
const CONTAIN_DISTANCE_METERS = 11;
const FROM_BEHIND_DOT = -0.28;

export function createIdleTackleState(): PlayerTackleState {
  return {
    phase: "idle",
    style: null,
    targetPlayerId: null,
    phaseStartedTick: 0,
    recoveryUntilTick: 0,
    cooldownUntilTick: 0,
    approachTarget: null,
    lastOutcome: null,
  };
}

export function advanceTackleState(
  state: PlayerTackleState | null | undefined,
  tick: number,
  currentCarrierId?: number | null,
): PlayerTackleState {
  const next = { ...(state ?? createIdleTackleState()) };

  if (next.phase === "commit" && tick > next.phaseStartedTick) {
    next.phase = "recovery";
    next.phaseStartedTick = tick;
    next.approachTarget = null;
  }

  if (next.phase === "recovery" && tick >= next.recoveryUntilTick) {
    next.phase = "idle";
    next.style = null;
    next.targetPlayerId = null;
    next.phaseStartedTick = tick;
    next.approachTarget = null;
  }

  if (
    next.phase === "approach" &&
    currentCarrierId != null &&
    next.targetPlayerId !== currentCarrierId
  ) {
    next.phase = "idle";
    next.style = null;
    next.targetPlayerId = null;
    next.phaseStartedTick = tick;
    next.approachTarget = null;
  }

  return next;
}

export function createApproachTackleState(
  current: PlayerTackleState | null | undefined,
  evaluation: TackleEvaluation,
  targetPlayerId: number,
  tick: number,
): PlayerTackleState {
  const next = advanceTackleState(current, tick, targetPlayerId);
  return {
    ...next,
    phase: "approach",
    style: null,
    targetPlayerId,
    phaseStartedTick: next.phase === "approach" ? next.phaseStartedTick : tick,
    approachTarget: evaluation.approachTarget,
  };
}

export function createCommittedTackleState(
  current: PlayerTackleState | null | undefined,
  resolution: TackleResolution,
  targetPlayerId: number,
  tick: number,
): PlayerTackleState {
  const next = advanceTackleState(current, tick, targetPlayerId);
  return {
    ...next,
    phase: "commit",
    style: resolution.style,
    targetPlayerId,
    phaseStartedTick: tick,
    recoveryUntilTick: tick + resolution.recoveryTicks,
    cooldownUntilTick: tick + resolution.cooldownTicks,
    approachTarget: null,
    lastOutcome: resolution.outcome,
  };
}

export function evaluateTackleDecision(input: TackleEvaluationInput): TackleEvaluation {
  const state = advanceTackleState(input.state, input.tick, input.carrierId);
  const distanceToCarrierMeters = pitchDistanceMeters(
    input.defenderPosition,
    input.carrierPosition,
  );
  const distanceToBallMeters = pitchDistanceMeters(input.defenderPosition, input.ballPosition);
  const carrierDirection = normalizedDirection(
    input.carrierPosition,
    input.ballTarget,
    normalizedVector(input.carrierVelocity, { x: 0, y: input.defenderSide === "home" ? -1 : 1 }),
  );
  const carrierToDefender = normalizedDirection(
    input.carrierPosition,
    input.defenderPosition,
    { x: 0, y: 0 },
  );
  const defenderToCarrier = normalizedDirection(
    input.defenderPosition,
    input.carrierPosition,
    { x: 0, y: 0 },
  );
  const relativeVelocity = {
    x: input.defenderVelocity.x - input.carrierVelocity.x,
    y: input.defenderVelocity.y - input.carrierVelocity.y,
  };
  const closingVectorMeters = velocityToMetersPerSecond(relativeVelocity);
  const closingSpeedMetersPerSecond =
    closingVectorMeters.x * defenderToCarrier.x + closingVectorMeters.y * defenderToCarrier.y;
  const approachDot = dot(carrierDirection, carrierToDefender);
  const fromBehind = approachDot <= FROM_BEHIND_DOT;
  const riskTaking = clamp(input.riskTaking, 0, 1);
  const danger = getDefensiveDanger(input.defenderSide, input.ballPosition, input.ballTarget);
  const highRiskFromBehind = fromBehind && riskTaking >= 0.8 && danger >= 0.68;
  const defenderQuality = clamp(
    (input.defenderStats.tackle * 0.54 +
      input.defenderStats.balance * 0.14 +
      input.defenderStats.speed * 0.12 +
      input.defenderStats.acceleration * 0.12 +
      input.defenderStats.stamina * 0.08) /
      100,
    0,
    1.25,
  );
  const carrierQuality = clamp(
    (input.carrierStats.dribbling * 0.5 +
      input.carrierStats.balance * 0.22 +
      input.carrierStats.speed * 0.16 +
      input.carrierStats.acceleration * 0.12) /
      100,
    0,
    1.25,
  );
  const distanceQuality = clamp(1 - distanceToBallMeters / SLIDING_REACH_METERS, 0, 1);
  const angleQuality = clamp((approachDot + 1) / 2, 0, 1);
  const speedQuality = clamp(1 - Math.max(0, closingSpeedMetersPerSecond - 7) / 8, 0.25, 1);
  const timingQuality =
    distanceQuality * 0.5 + angleQuality * 0.3 + speedQuality * 0.2;
  const approachTarget = getContainmentTarget(
    input.carrierPosition,
    input.ballTarget,
    input.defenderPosition,
  );
  const base: Omit<TackleEvaluation, "action" | "reason" | "style"> = {
    approachTarget,
    distanceToCarrierMeters,
    distanceToBallMeters,
    approachDot,
    closingSpeedMetersPerSecond,
    danger,
    defenderQuality,
    carrierQuality,
    timingQuality,
    fromBehind,
    highRiskFromBehind,
  };

  if (state.phase === "commit" || state.phase === "recovery") {
    return { ...base, action: "hold", reason: "recovering", style: state.style };
  }
  if (input.tick < state.cooldownUntilTick) {
    return { ...base, action: "hold", reason: "cooldown", style: null };
  }

  const tankReachBonus = input.hasTankTackle ? 0.45 : 0;
  const standingReach = STANDING_REACH_METERS + tankReachBonus;
  const slidingReach = SLIDING_REACH_METERS + tankReachBonus;
  const closestContact = Math.min(distanceToCarrierMeters, distanceToBallMeters);
  if (closestContact > CONTAIN_DISTANCE_METERS) {
    return { ...base, action: "hold", reason: "too_far", style: null };
  }
  if (closestContact > slidingReach) {
    return { ...base, action: "approach", reason: "contain", style: null };
  }
  if (fromBehind && !highRiskFromBehind) {
    return { ...base, action: "approach", reason: "bad_angle", style: null };
  }

  const needsSlide = closestContact > standingReach;
  const emergencySlide =
    !needsSlide &&
    danger >= 0.72 &&
    riskTaking >= 0.62 &&
    distanceToCarrierMeters > STANDING_REACH_METERS * 0.72;
  const style: TackleStyle = needsSlide || emergencySlide ? "sliding" : "standing";
  const commitmentScore = clamp(
    0.2 +
      defenderQuality * 0.2 -
      carrierQuality * 0.1 +
      timingQuality * 0.26 +
      danger * 0.2 +
      riskTaking * 0.16 +
      (input.hasTankTackle ? 0.08 : 0) -
      (fromBehind ? 0.22 : 0) -
      (style === "sliding" && danger < 0.48 ? 0.12 : 0),
    0.12,
    0.92,
  );

  if (input.decisionRoll > commitmentScore) {
    return { ...base, action: "approach", reason: "wait_for_touch", style: null };
  }

  return { ...base, action: "commit", reason: "commit", style };
}

export function resolveTackleOutcome(input: TackleResolutionInput): TackleResolution {
  const evaluation = input.evaluation;
  const style = evaluation.style;
  const tackleStat = clamp(input.defenderTackle / 100, 0, 1.2);
  const qualityDelta = evaluation.defenderQuality - evaluation.carrierQuality;
  const excessiveClosingSpeed = clamp(
    (evaluation.closingSpeedMetersPerSecond - 5.5) / 8,
    0,
    1,
  );
  const rearPenalty = evaluation.fromBehind ? (evaluation.highRiskFromBehind ? 0.2 : 0.5) : 0;
  const skillBonus = input.hasTankTackle ? 0.12 : 0;
  const foulChance = clamp(
    (style === "sliding" ? 0.13 : 0.045) +
      rearPenalty +
      excessiveClosingSpeed * (style === "sliding" ? 0.17 : 0.08) +
      Math.max(0, -qualityDelta) * 0.16 +
      input.riskTaking * (style === "sliding" ? 0.08 : 0.025) -
      tackleStat * 0.075 -
      (input.hasTankTackle ? 0.045 : 0),
    0.015,
    0.72,
  );
  const successChance = clamp(
    (style === "sliding" ? 0.46 : 0.55) +
      qualityDelta * 0.38 +
      evaluation.timingQuality * 0.25 +
      skillBonus -
      rearPenalty * 0.32 -
      excessiveClosingSpeed * 0.1,
    0.12,
    input.hasTankTackle ? 0.91 : 0.84,
  );
  const recoveryTicks =
    style === "sliding"
      ? 5 + (evaluation.fromBehind || excessiveClosingSpeed > 0.5 ? 1 : 0)
      : 2 + (excessiveClosingSpeed > 0.7 ? 1 : 0);
  const cooldownTicks = style === "sliding" ? 8 : 5;

  if (input.foulRoll < foulChance) {
    const severity = clamp(
      (style === "sliding" ? 0.24 : 0.06) +
        rearPenalty * 0.78 +
        excessiveClosingSpeed * 0.28 +
        evaluation.danger * 0.08 -
        tackleStat * 0.08,
      0,
      0.9,
    );
    const directRedChance = clamp(severity - 0.52, 0, 0.38);
    const yellowChance = clamp(0.32 + severity * 0.72, 0.24, 0.92);
    const card: TackleCard =
      input.currentCard === "red" ||
      input.cardRoll < directRedChance ||
      (input.currentCard === "yellow" && input.cardRoll < yellowChance)
        ? "red"
        : input.cardRoll < yellowChance
          ? "yellow"
          : null;

    return {
      outcome: "foul",
      style,
      card,
      target: moveToward(input.ballPosition, input.ballTarget, 0.9),
      successChance,
      foulChance,
      recoveryTicks: recoveryTicks + 1,
      cooldownTicks: cooldownTicks + 1,
    };
  }

  if (input.successRoll < successChance) {
    const controlChance = clamp(
      (style === "standing" ? 0.7 : 0.34) +
        qualityDelta * 0.24 +
        tackleStat * 0.08 +
        (input.hasTankTackle ? 0.2 : 0),
      0.18,
      0.94,
    );
    if (input.controlRoll < controlChance) {
      return {
        outcome: "won",
        style,
        card: null,
        target: moveToward(input.ballPosition, input.defenderPosition, 2.2),
        successChance,
        foulChance,
        recoveryTicks,
        cooldownTicks,
      };
    }

    return {
      outcome: "loose_ball",
      style,
      card: null,
      target: getDeflectionTarget(input),
      successChance,
      foulChance,
      recoveryTicks,
      cooldownTicks,
    };
  }

  const ballContactWindow = clamp(
    successChance + (style === "sliding" ? 0.2 : 0.1) + evaluation.timingQuality * 0.08,
    0.2,
    0.9,
  );
  if (input.successRoll < ballContactWindow) {
    return {
      outcome: "loose_ball",
      style,
      card: null,
      target: getDeflectionTarget(input),
      successChance,
      foulChance,
      recoveryTicks,
      cooldownTicks,
    };
  }

  return {
    outcome: "beaten",
    style,
    card: null,
    target: moveToward(input.ballPosition, input.ballTarget, style === "sliding" ? 4.8 : 3.4),
    successChance,
    foulChance,
    recoveryTicks: recoveryTicks + (style === "sliding" ? 2 : 1),
    cooldownTicks: cooldownTicks + 1,
  };
}

function getContainmentTarget(
  carrierPosition: TacklePoint,
  ballTarget: TacklePoint,
  defenderPosition: TacklePoint,
): TacklePoint {
  const runDirection = normalizedDirection(carrierPosition, ballTarget, { x: 0, y: 0 });
  const lateralDirection = { x: -runDirection.y, y: runDirection.x };
  const defenderSide = Math.sign(
    (defenderPosition.x - carrierPosition.x) * lateralDirection.x +
      (defenderPosition.y - carrierPosition.y) * lateralDirection.y,
  );
  return clampPoint({
    x: carrierPosition.x + runDirection.x * 2.2 + lateralDirection.x * defenderSide * 0.75,
    y: carrierPosition.y + runDirection.y * 2.2 + lateralDirection.y * defenderSide * 0.75,
  });
}

function getDeflectionTarget(input: TackleResolutionInput): TacklePoint {
  const travel = normalizedDirection(input.ballPosition, input.ballTarget, { x: 0, y: 1 });
  const lateral = { x: -travel.y, y: travel.x };
  const side = input.deflectionSideRoll < 0.5 ? -1 : 1;
  const power = input.evaluation.style === "sliding" ? 8.5 : 6;
  return {
    x: clamp(input.ballPosition.x + travel.x * 3 + lateral.x * power * side, -4, 104),
    y: clamp(input.ballPosition.y + travel.y * 3 + lateral.y * power * side, -4, 104),
  };
}

function getDefensiveDanger(
  defenderSide: "home" | "away",
  ball: TacklePoint,
  ballTarget: TacklePoint,
): number {
  const ownGoalY = defenderSide === "home" ? 96 : 4;
  const current = Math.abs(ownGoalY - ball.y);
  const projected = Math.abs(ownGoalY - ballTarget.y);
  return clamp(1 - Math.min(current, projected) / 54, 0, 1);
}

function pitchDistanceMeters(left: TacklePoint, right: TacklePoint): number {
  return Math.hypot(
    ((left.x - right.x) / 100) * 68,
    ((left.y - right.y) / 100) * 105,
  );
}

function velocityToMetersPerSecond(velocity: TacklePoint): TacklePoint {
  return { x: (velocity.x / 100) * 68, y: (velocity.y / 100) * 105 };
}

function normalizedDirection(
  from: TacklePoint,
  to: TacklePoint,
  fallback: TacklePoint,
): TacklePoint {
  return normalizedVector({ x: to.x - from.x, y: to.y - from.y }, fallback);
}

function normalizedVector(vector: TacklePoint, fallback: TacklePoint): TacklePoint {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0.0001 ? { x: vector.x / length, y: vector.y / length } : fallback;
}

function moveToward(from: TacklePoint, to: TacklePoint, maxDistance: number): TacklePoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= maxDistance || length <= 0.0001) return { ...to };
  return {
    x: from.x + (dx / length) * maxDistance,
    y: from.y + (dy / length) * maxDistance,
  };
}

function clampPoint(point: TacklePoint): TacklePoint {
  return { x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 100) };
}

function dot(left: TacklePoint, right: TacklePoint): number {
  return left.x * right.x + left.y * right.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
