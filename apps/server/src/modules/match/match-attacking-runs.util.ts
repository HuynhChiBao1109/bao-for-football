export type RunTimingPoint = { x: number; y: number };
export type RunTimingSide = "home" | "away";

export type RunTimingState =
  | "HoldPosition"
  | "OfferSupport"
  | "PrepareRun"
  | "TriggerRun"
  | "CurveRun"
  | "CheckBack"
  | "ReceivePass"
  | "AbortRun";

export type TimedRunType =
  | "BehindLine"
  | "Diagonal"
  | "HalfSpace"
  | "Wide"
  | "CrossFace"
  | "DropShort"
  | "ThirdMan"
  | "Support";

export type RunTimingSignal = "RequestRun" | "HoldRun" | "TriggerRun" | "DelayPass";
export type OffsidePositionStatus = "onside" | "near_line" | "offside";
export type RunLane = "left_wide" | "left_half" | "central" | "right_half" | "right_wide";

export type RunTimingMemory = {
  state: RunTimingState;
  stateStartedTick: number;
  minimumCommitUntilTick: number;
  offsideSinceTick: number | null;
  lastTarget: RunTimingPoint;
};

export type RunTimingPlayer = {
  id: number;
  role: string;
  position: RunTimingPoint;
  velocity: RunTimingPoint;
  facing?: RunTimingPoint;
  stamina: number;
  stats: {
    acceleration: number;
    speed: number;
    vision: number;
    balance: number;
    composure?: number;
    anticipation?: number;
    offTheBall?: number;
  };
  runMemory?: RunTimingMemory | null;
};

export type RunTimingTactics = {
  tempo: number;
  directness: number;
  compactness: number;
  riskTolerance: number;
};

export type OffsideLinePrediction = {
  secondLastDefenderY: number;
  effectiveLineY: number;
  ballY: number;
  safeLineY: number;
  predictionSeconds: number;
  defendingGoalY: number;
  trapVelocity: number;
};

export type RunTimingCandidate = {
  state: RunTimingState;
  runType: TimedRunType;
  target: RunTimingPoint;
  waypoint: RunTimingPoint;
  predictedRunnerPosition: RunTimingPoint;
  predictedStatus: OffsidePositionStatus;
  predictedOffsideRisk: number;
  timingQuality: number;
  spaceAtTarget: number;
  progressionValue: number;
  passLaneQuality: number;
  goalThreat: number;
  teammateOverlapPenalty: number;
  interceptionRisk: number;
  score: number;
  reason: string;
};

export type AttackingRunDecision = {
  playerId: number;
  state: RunTimingState;
  runType: TimedRunType;
  lane: RunLane;
  target: RunTimingPoint;
  path: RunTimingPoint[];
  currentStatus: OffsidePositionStatus;
  predictedStatus: OffsidePositionStatus;
  currentPosition: RunTimingPoint;
  predictedRunnerPosition: RunTimingPoint;
  currentOffsideLine: number;
  predictedOffsideLine: number;
  safeLineY: number;
  passReleaseTime: number;
  estimatedBallArrivalTime: number;
  predictedOffsideRisk: number;
  timingQuality: number;
  passLaneQuality: number;
  carrierCanRelease: boolean;
  signals: RunTimingSignal[];
  utility: number;
  reason: string;
  rejectedPassReason: string | null;
  scores: Array<{ state: RunTimingState; runType: TimedRunType; score: number }>;
  nextMemory: RunTimingMemory;
};

export type AttackingRunTimingEvaluation = {
  side: RunTimingSide;
  currentLine: OffsideLinePrediction;
  predictedLine: OffsideLinePrediction;
  passReleaseTime: number;
  defenseDepth: "high" | "balanced" | "deep";
  offsideTrapActive: boolean;
  decisions: AttackingRunDecision[];
  rejectedPasses: Array<{
    playerId: number;
    reason: string;
    currentStatus: OffsidePositionStatus;
    predictedStatus: OffsidePositionStatus;
    predictedPosition: RunTimingPoint;
    predictedLineY: number;
    passReleaseTime: number;
  }>;
};

export type AttackingRunTimingInput = {
  tick: number;
  side: RunTimingSide;
  ball: RunTimingPoint;
  ballVelocity?: RunTimingPoint;
  carrier: RunTimingPlayer;
  runners: RunTimingPlayer[];
  defenders: RunTimingPlayer[];
  pressure: number;
  possessionTicks: number;
  tactics: RunTimingTactics;
};

export const ATTACKING_RUN_BALANCE = Object.freeze({
  releaseTimeMin: 0.16,
  releaseTimeMax: 0.62,
  nearLineDistance: 2.8,
  safeLineBuffer: 1.35,
  predictedOffsideThreshold: 0.56,
  throughBallOffsideThreshold: 0.42,
  prolongedOffsideTicks: 4,
  minimumRunCommitTicks: 2,
  actionHysteresis: 5.5,
  maximumDeepRunners: 3,
  laneRadius: 4.6,
});

const RUN_STATES: RunTimingState[] = [
  "HoldPosition",
  "OfferSupport",
  "PrepareRun",
  "TriggerRun",
  "CurveRun",
  "CheckBack",
  "AbortRun",
];

const LANE_X: Record<RunLane, number> = {
  left_wide: 10,
  left_half: 34,
  central: 50,
  right_half: 66,
  right_wide: 90,
};

export function calculateOffsideLine(input: {
  side: RunTimingSide;
  defenders: RunTimingPlayer[];
  ball: RunTimingPoint;
  ballVelocity?: RunTimingPoint;
  predictionSeconds?: number;
}): OffsideLinePrediction {
  const predictionSeconds = Math.max(0, input.predictionSeconds ?? 0);
  const direction = attackDirection(input.side);
  const projectedBall = predictPoint(input.ball, input.ballVelocity ?? { x: 0, y: 0 }, predictionSeconds);
  const projectedDefenders = input.defenders
    .map((defender) => predictPoint(defender.position, defender.velocity, predictionSeconds))
    .sort((left, right) => (direction < 0 ? left.y - right.y : right.y - left.y));
  const fallback = direction < 0 ? 18 : 82;
  const secondLastDefenderY = projectedDefenders[1]?.y ?? projectedDefenders[0]?.y ?? fallback;
  const effectiveLineY =
    direction < 0
      ? Math.min(secondLastDefenderY, projectedBall.y)
      : Math.max(secondLastDefenderY, projectedBall.y);
  const safeLineY = clamp(
    effectiveLineY - direction * ATTACKING_RUN_BALANCE.safeLineBuffer,
    2,
    98,
  );
  const trapVelocity = input.defenders.length
    ? input.defenders.reduce(
        (sum, defender) => sum + Math.max(0, -direction * defender.velocity.y),
        0,
      ) / input.defenders.length
    : 0;

  return {
    secondLastDefenderY,
    effectiveLineY,
    ballY: projectedBall.y,
    safeLineY,
    predictionSeconds,
    defendingGoalY: direction < 0 ? 0 : 100,
    trapVelocity,
  };
}

export function evaluateOffsidePosition(input: {
  side: RunTimingSide;
  position: RunTimingPoint;
  ball: RunTimingPoint;
  line: OffsideLinePrediction;
}): { status: OffsidePositionStatus; distanceToLine: number; isAheadOfBall: boolean } {
  const direction = attackDirection(input.side);
  const inOpponentHalf = direction < 0 ? input.position.y < 50 : input.position.y > 50;
  const isAheadOfBall =
    direction < 0 ? input.position.y < input.ball.y - 0.1 : input.position.y > input.ball.y + 0.1;
  const beyondDefender =
    direction < 0
      ? input.position.y < input.line.secondLastDefenderY - 0.1
      : input.position.y > input.line.secondLastDefenderY + 0.1;
  const distanceToLine =
    direction < 0
      ? input.position.y - input.line.effectiveLineY
      : input.line.effectiveLineY - input.position.y;
  const isOffside = inOpponentHalf && isAheadOfBall && beyondDefender;
  const nearLine =
    !isOffside &&
    inOpponentHalf &&
    isAheadOfBall &&
    distanceToLine <= ATTACKING_RUN_BALANCE.nearLineDistance;
  return {
    status: isOffside ? "offside" : nearLine ? "near_line" : "onside",
    distanceToLine,
    isAheadOfBall,
  };
}

export function evaluateAttackingRunTiming(
  input: AttackingRunTimingInput,
): AttackingRunTimingEvaluation {
  const direction = attackDirection(input.side);
  const releaseTime = getPassReleaseTime(input);
  const currentLine = calculateOffsideLine({
    side: input.side,
    defenders: input.defenders,
    ball: input.ball,
  });
  const predictedLine = calculateOffsideLine({
    side: input.side,
    defenders: input.defenders,
    ball: input.ball,
    ballVelocity: input.ballVelocity,
    predictionSeconds: releaseTime,
  });
  const distanceFromGoal =
    direction < 0 ? predictedLine.secondLastDefenderY : 100 - predictedLine.secondLastDefenderY;
  const defenseDepth = distanceFromGoal >= 28 ? "high" : distanceFromGoal <= 19 ? "deep" : "balanced";
  const offsideTrapActive = predictedLine.trapVelocity >= 1.15;
  const allocations = allocateRunLanes(input, defenseDepth);
  const selectedTargets: RunTimingPoint[] = [];
  const decisions = input.runners
    .filter((runner) => runner.id !== input.carrier.id && normalizeRole(runner.role) !== "GK")
    .map((runner) => {
      const allocation = allocations.get(runner.id) ?? {
        lane: getNaturalLane(runner.position.x),
        allowDeepRun: false,
      };
      const decision = evaluateRunner({
        input,
        runner,
        currentLine,
        predictedLine,
        releaseTime,
        defenseDepth,
        offsideTrapActive,
        lane: allocation.lane,
        allowDeepRun: allocation.allowDeepRun,
        selectedTargets,
      });
      selectedTargets.push(decision.target);
      return decision;
    });
  const rejectedPasses = decisions
    .filter((decision) => decision.rejectedPassReason)
    .map((decision) => ({
      playerId: decision.playerId,
      reason: decision.rejectedPassReason!,
      currentStatus: decision.currentStatus,
      predictedStatus: decision.predictedStatus,
      predictedPosition: decision.predictedRunnerPosition,
      predictedLineY: decision.predictedOffsideLine,
      passReleaseTime: decision.passReleaseTime,
    }));

  return {
    side: input.side,
    currentLine,
    predictedLine,
    passReleaseTime: releaseTime,
    defenseDepth,
    offsideTrapActive,
    decisions,
    rejectedPasses,
  };
}

export function markRunAsReceiving(
  evaluation: AttackingRunTimingEvaluation,
  receiverId: number,
  target: RunTimingPoint,
): AttackingRunTimingEvaluation {
  return {
    ...evaluation,
    decisions: evaluation.decisions.map((decision) => {
      if (decision.playerId !== receiverId) return decision;
      return {
        ...decision,
        state: "ReceivePass" as RunTimingState,
        target,
        path: [decision.currentPosition, decision.predictedRunnerPosition, target],
        signals: uniqueSignals([...decision.signals, "RequestRun", "TriggerRun"]),
        reason: "pass selected; attack the communicated receiving point",
        nextMemory: {
          ...decision.nextMemory,
          state: "ReceivePass" as RunTimingState,
          lastTarget: target,
        },
      };
    }),
  };
}

function evaluateRunner(input: {
  input: AttackingRunTimingInput;
  runner: RunTimingPlayer;
  currentLine: OffsideLinePrediction;
  predictedLine: OffsideLinePrediction;
  releaseTime: number;
  defenseDepth: "high" | "balanced" | "deep";
  offsideTrapActive: boolean;
  lane: RunLane;
  allowDeepRun: boolean;
  selectedTargets: RunTimingPoint[];
}): AttackingRunDecision {
  const direction = attackDirection(input.input.side);
  const projectedBall = predictPoint(
    input.input.ball,
    input.input.ballVelocity ?? { x: 0, y: 0 },
    input.releaseTime,
  );
  const currentStatus = evaluateOffsidePosition({
    side: input.input.side,
    position: input.runner.position,
    ball: input.input.ball,
    line: input.currentLine,
  }).status;
  const previousOffsideSince = input.runner.runMemory?.offsideSinceTick ?? null;
  const offsideSinceTick =
    currentStatus === "offside" ? previousOffsideSince ?? input.input.tick : null;
  const offsideDuration = offsideSinceTick == null ? 0 : input.input.tick - offsideSinceTick;
  const runnerQuality = getRunnerQuality(input.runner);
  const laneX = LANE_X[input.lane];
  const safeY = input.predictedLine.safeLineY;
  const lineStep = input.offsideTrapActive ? 1.2 : 0;
  const deepDistance = input.defenseDepth === "deep" ? 7 : input.defenseDepth === "high" ? 12 : 9;
  const runType = getPreferredRunType(input.runner, input.lane, input.defenseDepth);
  const carrierFacing = normalize(
    input.input.carrier.facing ??
      (magnitude(input.input.carrier.velocity) > 0.2
        ? input.input.carrier.velocity
        : { x: 0, y: direction }),
  );
  const toRunner = normalize(sub(input.runner.position, input.input.carrier.position));
  const bodyAngle = clamp01((dot(carrierFacing, toRunner) + 1) / 2);
  const baseLaneQuality = evaluatePassLane(
    input.input.carrier.position,
    input.runner.position,
    input.input.defenders,
    input.releaseTime,
  );
  const carrierCanRelease =
    bodyAngle >= 0.3 && baseLaneQuality >= 0.32 && input.input.pressure <= 0.9;
  const supportY = clamp(
    input.input.ball.y - direction * (8 + input.input.tactics.compactness * 7),
    4,
    96,
  );
  const candidates = RUN_STATES.map((state) => {
    const geometry = getCandidateGeometry({
      state,
      runType,
      laneX,
      safeY,
      direction,
      deepDistance,
      lineStep,
      runner: input.runner,
      ball: input.input.ball,
      supportY,
    });
    const predictedRunnerPosition = predictRunnerAtRelease({
      runner: input.runner,
      target: geometry.waypoint,
      state,
      releaseTime: input.releaseTime,
      quality: runnerQuality,
      tick: input.input.tick,
    });
    const predictedStatusResult = evaluateOffsidePosition({
      side: input.input.side,
      position: predictedRunnerPosition,
      ball: projectedBall,
      line: input.predictedLine,
    });
    const predictedOffsideRisk = getPredictedOffsideRisk({
      status: predictedStatusResult.status,
      distanceToLine: predictedStatusResult.distanceToLine,
      runnerQuality,
      forwardSpeed: Math.max(0, input.runner.velocity.y * direction),
      trapActive: input.offsideTrapActive,
      state,
    });
    const spaceAtTarget = evaluateSpace(geometry.target, input.input.defenders);
    const progressionValue = clamp01(
      (distance(input.runner.position, { x: 50, y: direction < 0 ? 0 : 100 }) -
        distance(geometry.target, { x: 50, y: direction < 0 ? 0 : 100 })) /
        24,
    );
    const passLaneQuality = evaluatePassLane(
      input.input.carrier.position,
      geometry.target,
      input.input.defenders,
      input.releaseTime,
    );
    const timingQuality = clamp01(
      runnerQuality * 0.5 +
        (1 - predictedOffsideRisk) * 0.34 +
        (carrierCanRelease ? 0.16 : 0.04),
    );
    const goalThreat = clamp01(
      1 - distance(geometry.target, { x: 50, y: direction < 0 ? 0 : 100 }) / 58,
    );
    const teammateOverlapPenalty = input.selectedTargets.reduce(
      (penalty, target) => Math.max(penalty, clamp01(1 - distance(target, geometry.target) / 10)),
      0,
    );
    const interceptionRisk = 1 - passLaneQuality;
    const roleRunBias = getRoleRunBias(input.runner.role, runType);
    let score =
      (spaceAtTarget * 1.4 +
        progressionValue * 1.3 +
        passLaneQuality * 1.4 +
        timingQuality * 1.5 +
        roleRunBias +
        goalThreat * 1.2 -
        predictedOffsideRisk * 2 -
        teammateOverlapPenalty -
        interceptionRisk) *
      14;

    if (state === "TriggerRun") {
      score += input.defenseDepth === "high" ? 17 : input.defenseDepth === "deep" ? -18 : 5;
      if (!input.allowDeepRun) score -= 34;
      if (!carrierCanRelease) score -= 28;
    } else if (state === "CurveRun") {
      score += input.defenseDepth === "high" ? 12 : 1;
      if (!input.allowDeepRun) score -= 24;
    } else if (state === "PrepareRun") {
      score += currentStatus === "near_line" ? 19 : 8;
      score += carrierCanRelease ? 7 : 1;
    } else if (state === "CheckBack") {
      score += currentStatus === "offside" ? 20 + offsideDuration * 5 : 0;
      score += input.defenseDepth === "deep" ? 14 : 0;
    } else if (state === "OfferSupport") {
      score += input.defenseDepth === "deep" ? 20 : 7;
      score += input.allowDeepRun ? -7 : 10;
    } else if (state === "HoldPosition") {
      score += currentStatus === "offside" && offsideDuration < ATTACKING_RUN_BALANCE.prolongedOffsideTicks ? 15 : 4;
    } else if (state === "AbortRun") {
      score += !carrierCanRelease || passLaneQuality < 0.28 ? 25 : -12;
    }
    if (
      (state === "TriggerRun" || state === "PrepareRun") &&
      predictedOffsideRisk > ATTACKING_RUN_BALANCE.predictedOffsideThreshold
    ) {
      score = -100;
    }
    if (
      currentStatus === "offside" &&
      offsideDuration >= ATTACKING_RUN_BALANCE.prolongedOffsideTicks &&
      state !== "CheckBack" &&
      state !== "AbortRun"
    ) {
      score -= 45;
    }
    if (input.runner.runMemory?.state === state) score += 4.5;

    return {
      state,
      runType: state === "OfferSupport" || state === "CheckBack" ? "DropShort" as TimedRunType : runType,
      target: geometry.target,
      waypoint: geometry.waypoint,
      predictedRunnerPosition,
      predictedStatus: predictedStatusResult.status,
      predictedOffsideRisk,
      timingQuality,
      spaceAtTarget,
      progressionValue,
      passLaneQuality,
      goalThreat,
      teammateOverlapPenalty,
      interceptionRisk,
      score: Number(score.toFixed(3)),
      reason: getCandidateReason(state, currentStatus, input.defenseDepth, carrierCanRelease),
    } satisfies RunTimingCandidate;
  }).sort((left, right) => right.score - left.score);

  let selected = candidates[0];
  const memory = input.runner.runMemory;
  const currentCandidate = memory
    ? candidates.find((candidate) => candidate.state === memory.state)
    : null;
  const emergencyCheckBack =
    currentStatus === "offside" && offsideDuration >= ATTACKING_RUN_BALANCE.prolongedOffsideTicks;
  if (
    currentCandidate &&
    !emergencyCheckBack &&
    input.input.tick < memory!.minimumCommitUntilTick
  ) {
    selected = currentCandidate;
  } else if (
    currentCandidate &&
    !emergencyCheckBack &&
    selected.score < currentCandidate.score + ATTACKING_RUN_BALANCE.actionHysteresis
  ) {
    selected = currentCandidate;
  }

  const signals = getSignals(selected.state, selected.predictedOffsideRisk, carrierCanRelease);
  const rejectedPassReason = getRejectedPassReason({
    currentStatus,
    candidate: selected,
    carrierCanRelease,
  });
  const continues = memory?.state === selected.state;
  const estimatedBallArrivalTime =
    input.releaseTime +
    distance(input.input.carrier.position, selected.target) /
      (22 + input.input.carrier.stats.vision * 0.08);

  return {
    playerId: input.runner.id,
    state: selected.state,
    runType: selected.runType,
    lane: input.lane,
    target: selected.target,
    path: [input.runner.position, selected.waypoint, selected.target],
    currentStatus,
    predictedStatus: selected.predictedStatus,
    currentPosition: input.runner.position,
    predictedRunnerPosition: selected.predictedRunnerPosition,
    currentOffsideLine: input.currentLine.effectiveLineY,
    predictedOffsideLine: input.predictedLine.effectiveLineY,
    safeLineY: input.predictedLine.safeLineY,
    passReleaseTime: input.releaseTime,
    estimatedBallArrivalTime,
    predictedOffsideRisk: selected.predictedOffsideRisk,
    timingQuality: selected.timingQuality,
    passLaneQuality: selected.passLaneQuality,
    carrierCanRelease,
    signals,
    utility: selected.score,
    reason: selected.reason,
    rejectedPassReason,
    scores: candidates.map((candidate) => ({
      state: candidate.state,
      runType: candidate.runType,
      score: candidate.score,
    })),
    nextMemory: {
      state: selected.state,
      stateStartedTick: continues ? memory!.stateStartedTick : input.input.tick,
      minimumCommitUntilTick: continues
        ? memory!.minimumCommitUntilTick
        : input.input.tick + ATTACKING_RUN_BALANCE.minimumRunCommitTicks,
      offsideSinceTick,
      lastTarget: selected.target,
    },
  };
}

function allocateRunLanes(
  input: AttackingRunTimingInput,
  defenseDepth: "high" | "balanced" | "deep",
) {
  const output = new Map<number, { lane: RunLane; allowDeepRun: boolean }>();
  const direction = attackDirection(input.side);
  const highLineBonus = defenseDepth === "high" ? 1 : defenseDepth === "deep" ? -1 : 0;
  const maximumDeep = clamp(
    1 + highLineBonus + (input.possessionTicks <= 7 && input.tactics.directness >= 0.58 ? 1 : 0),
    1,
    ATTACKING_RUN_BALANCE.maximumDeepRunners,
  );
  const ranked = input.runners
    .filter((runner) => runner.id !== input.carrier.id && normalizeRole(runner.role) !== "GK")
    .sort((left, right) => {
      const score = (player: RunTimingPlayer) =>
        getRunnerQuality(player) * 30 +
        getRoleRunBias(player.role, "BehindLine") * 12 +
        Math.max(0, direction * player.velocity.y) * 0.8;
      return score(right) - score(left) || left.id - right.id;
    });
  const used = new Set<RunLane>();
  ranked.forEach((runner, index) => {
    const preferences = getLanePreferences(runner);
    const lane = preferences.find((item) => !used.has(item)) ?? preferences[0];
    const allowDeepRun = index < maximumDeep;
    if (allowDeepRun) used.add(lane);
    output.set(runner.id, { lane, allowDeepRun });
  });
  return output;
}

function getCandidateGeometry(input: {
  state: RunTimingState;
  runType: TimedRunType;
  laneX: number;
  safeY: number;
  direction: -1 | 1;
  deepDistance: number;
  lineStep: number;
  runner: RunTimingPlayer;
  ball: RunTimingPoint;
  supportY: number;
}) {
  const safeY = clamp(input.safeY - input.direction * input.lineStep, 3, 97);
  if (input.state === "CheckBack" || input.state === "AbortRun") {
    const target = {
      x: clamp(lerp(input.runner.position.x, input.ball.x, input.state === "AbortRun" ? 0.35 : 0.18), 4, 96),
      y: clamp(safeY - input.direction * (input.state === "AbortRun" ? 4.5 : 2.7), 4, 96),
    };
    return { waypoint: target, target };
  }
  if (input.state === "OfferSupport") {
    const target = { x: clamp(lerp(input.laneX, input.ball.x, 0.36), 6, 94), y: input.supportY };
    return { waypoint: target, target };
  }
  if (input.state === "PrepareRun") {
    const target = { x: clamp(input.laneX, 5, 95), y: safeY };
    return { waypoint: target, target };
  }
  if (input.state === "CurveRun") {
    const curveSide = input.runner.position.x <= 50 ? -1 : 1;
    const waypoint = { x: clamp(input.laneX + curveSide * 5.5, 5, 95), y: safeY };
    const target = {
      x: clamp(input.laneX, 5, 95),
      y: clamp(safeY + input.direction * (input.deepDistance - 1.5), 3, 97),
    };
    return { waypoint, target };
  }
  if (input.state === "TriggerRun") {
    const diagonalShift = input.runType === "Diagonal" || input.runType === "CrossFace" ? (50 - input.laneX) * 0.34 : 0;
    const waypoint = { x: clamp(input.laneX, 5, 95), y: safeY };
    const target = {
      x: clamp(input.laneX + diagonalShift, 5, 95),
      y: clamp(safeY + input.direction * input.deepDistance, 3, 97),
    };
    return { waypoint, target };
  }
  const target = { ...input.runner.position };
  return { waypoint: target, target };
}

function predictRunnerAtRelease(input: {
  runner: RunTimingPlayer;
  target: RunTimingPoint;
  state: RunTimingState;
  releaseTime: number;
  quality: number;
  tick: number;
}) {
  const desired = normalize(sub(input.target, input.runner.position));
  const stateSpeed =
    input.state === "TriggerRun"
      ? input.runner.stats.speed * 0.105
      : input.state === "CurveRun"
        ? input.runner.stats.speed * 0.074
        : input.state === "CheckBack" || input.state === "AbortRun"
          ? input.runner.stats.speed * 0.062
          : input.runner.stats.speed * 0.038;
  const reactionNoise = (seededUnit(input.tick, input.runner.id, 31) * 2 - 1) * (1 - input.quality);
  const earlyRunSeconds = Math.max(0, reactionNoise) * 0.34;
  const effectiveSeconds = input.releaseTime + (input.state === "TriggerRun" ? earlyRunSeconds : 0);
  const desiredVelocity = {
    x: desired.x * stateSpeed,
    y: desired.y * stateSpeed,
  };
  const accelerationBlend = clamp01(
    (input.runner.stats.acceleration / 100) * input.releaseTime * 1.8,
  );
  const velocity = {
    x: lerp(input.runner.velocity.x, desiredVelocity.x, accelerationBlend),
    y: lerp(input.runner.velocity.y, desiredVelocity.y, accelerationBlend),
  };
  return predictPoint(input.runner.position, velocity, effectiveSeconds);
}

function getPredictedOffsideRisk(input: {
  status: OffsidePositionStatus;
  distanceToLine: number;
  runnerQuality: number;
  forwardSpeed: number;
  trapActive: boolean;
  state: RunTimingState;
}) {
  const statusRisk = input.status === "offside" ? 0.82 : input.status === "near_line" ? 0.26 : 0.04;
  const lineRisk = clamp01((2.2 - input.distanceToLine) / 5.4) * 0.24;
  const mistiming = (1 - input.runnerQuality) * (0.16 + clamp01(input.forwardSpeed / 9) * 0.22);
  const trapRisk = input.trapActive ? 0.14 : 0;
  const adjustment =
    input.state === "CheckBack" || input.state === "AbortRun"
      ? -0.24
      : input.state === "CurveRun"
        ? -0.1
        : 0;
  return clamp01(statusRisk + lineRisk + mistiming + trapRisk + adjustment);
}

function getPassReleaseTime(input: AttackingRunTimingInput) {
  const composure = normalizeStat(
    input.carrier.stats.composure ??
      input.carrier.stats.vision * 0.55 + input.carrier.stats.balance * 0.45,
  );
  return clamp(
    0.2 +
      (1 - input.tactics.tempo) * 0.19 +
      (1 - composure) * 0.12 -
      input.pressure * 0.1,
    ATTACKING_RUN_BALANCE.releaseTimeMin,
    ATTACKING_RUN_BALANCE.releaseTimeMax,
  );
}

function getRunnerQuality(player: RunTimingPlayer) {
  const anticipation =
    player.stats.anticipation ?? player.stats.vision * 0.58 + player.stats.acceleration * 0.42;
  const offTheBall =
    player.stats.offTheBall ??
    player.stats.acceleration * 0.38 + player.stats.speed * 0.32 + player.stats.vision * 0.3;
  const composure =
    player.stats.composure ?? player.stats.vision * 0.55 + player.stats.balance * 0.45;
  return clamp01(
    (anticipation * 0.3 +
      offTheBall * 0.32 +
      player.stats.acceleration * 0.22 +
      composure * 0.16) /
      100,
  );
}

function getPreferredRunType(
  player: RunTimingPlayer,
  lane: RunLane,
  depth: "high" | "balanced" | "deep",
): TimedRunType {
  const role = normalizeRole(player.role);
  if (depth === "deep") return role === "FB" ? "Wide" : "DropShort";
  if (role === "W" || role === "FB") return lane.includes("wide") ? "Wide" : "Diagonal";
  if (role === "CM" || role === "DM") return lane.includes("half") ? "HalfSpace" : "ThirdMan";
  if (role === "ST") return lane === "central" ? "BehindLine" : "CrossFace";
  return "Support";
}

function getRoleRunBias(role: string, runType: TimedRunType) {
  const normalized = normalizeRole(role);
  if (normalized === "ST") return runType === "BehindLine" || runType === "CrossFace" ? 1 : 0.64;
  if (normalized === "W") return runType === "Wide" || runType === "Diagonal" ? 0.96 : 0.68;
  if (normalized === "CM") return runType === "HalfSpace" || runType === "ThirdMan" ? 0.88 : 0.56;
  if (normalized === "FB") return runType === "Wide" ? 0.78 : 0.48;
  if (normalized === "DM") return runType === "Support" || runType === "ThirdMan" ? 0.58 : 0.28;
  return 0.24;
}

function getLanePreferences(player: RunTimingPlayer): RunLane[] {
  const role = normalizeRole(player.role);
  const left = player.position.x < 50;
  if (role === "W" || role === "FB") {
    return left
      ? ["left_wide", "left_half", "central", "right_half", "right_wide"]
      : ["right_wide", "right_half", "central", "left_half", "left_wide"];
  }
  if (role === "ST") return left
    ? ["central", "left_half", "right_half", "left_wide", "right_wide"]
    : ["central", "right_half", "left_half", "right_wide", "left_wide"];
  return left
    ? ["left_half", "central", "right_half", "left_wide", "right_wide"]
    : ["right_half", "central", "left_half", "right_wide", "left_wide"];
}

function getNaturalLane(x: number): RunLane {
  if (x <= 20) return "left_wide";
  if (x <= 42) return "left_half";
  if (x < 58) return "central";
  if (x < 80) return "right_half";
  return "right_wide";
}

function getSignals(
  state: RunTimingState,
  offsideRisk: number,
  carrierCanRelease: boolean,
): RunTimingSignal[] {
  if (state === "TriggerRun" && carrierCanRelease && offsideRisk < ATTACKING_RUN_BALANCE.throughBallOffsideThreshold) {
    return ["RequestRun", "TriggerRun"];
  }
  if (state === "CurveRun") return carrierCanRelease ? ["RequestRun", "TriggerRun"] : ["HoldRun", "DelayPass"];
  if (state === "PrepareRun" || state === "CheckBack") return ["HoldRun", "DelayPass"];
  if (state === "OfferSupport") return ["RequestRun"];
  return ["HoldRun"];
}

function getRejectedPassReason(input: {
  currentStatus: OffsidePositionStatus;
  candidate: RunTimingCandidate;
  carrierCanRelease: boolean;
}) {
  if (input.currentStatus === "offside") return "receiver currently offside; wait for check-back";
  if (input.candidate.predictedStatus === "offside") return "receiver predicted offside at pass release";
  if (input.candidate.predictedOffsideRisk > ATTACKING_RUN_BALANCE.predictedOffsideThreshold) {
    return "predicted offside risk above threshold";
  }
  if (!input.carrierCanRelease && input.candidate.state !== "OfferSupport") {
    return "passer has no safe release angle or time";
  }
  if (input.candidate.passLaneQuality < 0.28) return "passing lane blocked; abort or change run";
  if (input.candidate.state === "PrepareRun" || input.candidate.state === "CheckBack") {
    return "runner requested DelayPass before release";
  }
  return null;
}

function getCandidateReason(
  state: RunTimingState,
  status: OffsidePositionStatus,
  depth: "high" | "balanced" | "deep",
  carrierCanRelease: boolean,
) {
  if (state === "TriggerRun") return "timed acceleration through an available high line";
  if (state === "CurveRun") return "curve across the line to reduce early-run offside risk";
  if (state === "PrepareRun") return "hold level with the safe line before accelerating";
  if (state === "CheckBack") return status === "offside" ? "return onside before becoming involved" : "drop to receive against a deep block";
  if (state === "OfferSupport") return depth === "deep" ? "offer underneath support against a deep defense" : "occupy the space below a deep runner";
  if (state === "AbortRun") return carrierCanRelease ? "passing lane closed" : "passer turned away or lacks release time";
  return status === "offside" ? "remain uninvolved briefly" : "hold position and preserve spacing";
}

function evaluateSpace(target: RunTimingPoint, defenders: RunTimingPlayer[]) {
  const nearest = Math.min(...defenders.map((defender) => distance(target, defender.position)), 18);
  return clamp01(nearest / 11);
}

function evaluatePassLane(
  from: RunTimingPoint,
  to: RunTimingPoint,
  defenders: RunTimingPlayer[],
  predictionSeconds: number,
) {
  let risk = 0;
  for (const defender of defenders) {
    const projected = predictPoint(defender.position, defender.velocity, predictionSeconds);
    const projection = pointSegmentProjection(projected, from, to);
    if (projection.t <= 0.05 || projection.t >= 0.98) continue;
    const corridorDistance = distance(projected, projection.point);
    risk = Math.max(risk, clamp01((ATTACKING_RUN_BALANCE.laneRadius - corridorDistance) / ATTACKING_RUN_BALANCE.laneRadius));
  }
  return clamp01(1 - risk);
}

function pointSegmentProjection(point: RunTimingPoint, start: RunTimingPoint, end: RunTimingPoint) {
  const segment = sub(end, start);
  const lengthSquared = dot(segment, segment);
  const t = lengthSquared <= 0.0001 ? 0 : clamp(dot(sub(point, start), segment) / lengthSquared, 0, 1);
  return { t, point: { x: start.x + segment.x * t, y: start.y + segment.y * t } };
}

function normalizeRole(role: string): "GK" | "CB" | "FB" | "DM" | "CM" | "W" | "ST" {
  const value = role.toUpperCase();
  if (value.includes("GK")) return "GK";
  if (value.includes("CB")) return "CB";
  if (value.includes("LB") || value.includes("RB") || value.includes("WB")) return "FB";
  if (value.includes("CDM") || value === "DM") return "DM";
  if (value.includes("LW") || value.includes("RW") || value === "W" || value === "LM" || value === "RM") return "W";
  if (value.includes("ST") || value.includes("CF") || value.includes("SS")) return "ST";
  return "CM";
}

function attackDirection(side: RunTimingSide): -1 | 1 {
  return side === "home" ? -1 : 1;
}

function predictPoint(position: RunTimingPoint, velocity: RunTimingPoint, seconds: number) {
  return {
    x: clamp(position.x + velocity.x * seconds, 0, 100),
    y: clamp(position.y + velocity.y * seconds, 0, 100),
  };
}

function normalizeStat(value: number) {
  return clamp01(Number(value ?? 50) / 100);
}

function uniqueSignals(signals: RunTimingSignal[]) {
  return [...new Set(signals)];
}

function sub(left: RunTimingPoint, right: RunTimingPoint) {
  return { x: left.x - right.x, y: left.y - right.y };
}

function normalize(point: RunTimingPoint) {
  const length = magnitude(point);
  return length <= 0.0001 ? { x: 0, y: 0 } : { x: point.x / length, y: point.y / length };
}

function magnitude(point: RunTimingPoint) {
  return Math.hypot(point.x, point.y);
}

function distance(left: RunTimingPoint, right: RunTimingPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function dot(left: RunTimingPoint, right: RunTimingPoint) {
  return left.x * right.x + left.y * right.y;
}

function lerp(from: number, to: number, alpha: number) {
  return from + (to - from) * alpha;
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
