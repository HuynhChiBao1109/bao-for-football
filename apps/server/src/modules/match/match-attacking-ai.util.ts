/**
 * Utility AI for open-play attacking decisions.
 *
 * This module deliberately knows nothing about NestJS, persistence or rendering. The
 * simulation adapter collects a situation, this module creates/scored options, and
 * the match engine remains responsible for executing the selected action.
 */

export type AttackingPoint = { x: number; y: number };
export type AttackingSide = "home" | "away";
export type PreferredFoot = "left" | "right";

export type AttackingPlayerStats = {
  pass: number;
  longPass: number;
  vision: number;
  shoot: number;
  balance: number;
  dribbling: number;
  acceleration: number;
  speed: number;
  stamina: number;
  ballControl?: number;
  agility?: number;
  confidence?: number;
  technique?: number;
  composure?: number;
  heading?: number;
};

export type AttackingAiPlayer = {
  id: number;
  teamId: number;
  role: string;
  position: AttackingPoint;
  velocity: AttackingPoint;
  facing?: AttackingPoint;
  preferredFoot: PreferredFoot;
  isOffside?: boolean;
  stamina: number;
  stats: AttackingPlayerStats;
  personality?: {
    passBias: number;
    dribbleBias: number;
    flair: number;
    riskTaking: number;
  };
};

export type AttackingTactics = {
  risk: number;
  tempo: number;
  directness: number;
  compactness: number;
  shootingPriority: number;
  dribbleFrequency: number;
  carryDirectness: number;
  riskTolerance: number;
};

export type AttackingPassStyle =
  | "short"
  | "long"
  | "through"
  | "one_touch"
  | "one_two"
  | "cross"
  | "switch"
  | "cut_back"
  | "back";

export type AttackingShotStyle =
  | "normal"
  | "long_range"
  | "first_time"
  | "placed"
  | "power"
  | "header";

export type AttackingActionKind = "hold" | "wait" | "carry_ball" | "dribble" | "pass" | "shoot";

export type AttackingActionMemory = {
  currentAction: AttackingActionKind | null;
  actionStartedTick: number;
  lastEvaluationTick: number;
  lastEvaluationPosition: AttackingPoint;
  minimumCommitUntilTick: number;
  dribbleCooldownUntilTick: number;
};
export type AttackingCommunication =
  | "request_ball"
  | "announce_run"
  | "offer_support"
  | "hold_position";
export type AttackingRunType =
  | "RECEIVE"
  | "ONE_TWO_RETURN"
  | "THIRD_MAN_RUN"
  | "OVERLAP"
  | "UNDERLAP"
  | "BOX_RUN"
  | "STRETCH"
  | "SUPPORT"
  | "HOLD_POSITION";

export type AttackingIntent = {
  playerId: number;
  runType: AttackingRunType;
  communication: AttackingCommunication;
  target: AttackingPoint;
  priority: number;
  expiresAtTick: number;
};

export type ActiveAttackingCombination = {
  kind: "one_two" | "triangle";
  step: 1 | 2;
  initiatorPlayerId: number;
  wallPlayerId: number;
  thirdRunnerPlayerId: number | null;
};

export type CollectAttackingSituationInput = {
  carrier: AttackingAiPlayer;
  teammates: AttackingAiPlayer[];
  opponents: AttackingAiPlayer[];
  ball: AttackingPoint;
  side: AttackingSide;
  tick: number;
  possessionTicks: number;
  latestEvent?: string | null;
  lastPassStyle?: AttackingPassStyle | null;
  tactics?: Partial<AttackingTactics>;
  activeCombination?: ActiveAttackingCombination | null;
  actionMemory?: AttackingActionMemory | null;
};

export type AttackingSituation = CollectAttackingSituationInput & {
  direction: -1 | 1;
  goal: AttackingPoint;
  keeper: AttackingAiPlayer | null;
  pressure: number;
  nearestOpponentDistance: number;
  staminaRatio: number;
  bodyAlignment: number;
  tactics: AttackingTactics;
  isTransition: boolean;
  isOneTouchWindow: boolean;
  isSettlingAfterReceive: boolean;
};

export type CarryOptionMetrics = {
  forwardSpace: number;
  corridorSafety: number;
  progressionValue: number;
  dangerProgression: number;
  turnoverRisk: number;
  facingGoalBonus: number;
  roleCarryBias: number;
  directBlockerDistance: number;
};

export type DribbleOptionMetrics = {
  duelDistance: number;
  duelOpportunity: number;
  successProbability: number;
  escapeValue: number;
  roleDribbleBias: number;
};

export type PassOptionMetrics = {
  distance: number;
  progression: number;
  laneSafety: number;
  interceptionRisk: number;
  receiverSpace: number;
  receptionQuality: number;
  movementValue: number;
  completionProbability: number;
  travelSeconds: number;
  receiverAdvantage: number;
  lineBreakValue: number;
  chanceCreationValue: number;
};

export type ShotOptionMetrics = {
  distanceToGoal: number;
  angleQuality: number;
  sightQuality: number;
  blockerRisk: number;
  keeperExposure: number;
  footFit: number;
  expectedGoalValue: number;
};

export type AttackingOption = {
  id: string;
  kind: AttackingActionKind;
  target: AttackingPoint;
  receiverId?: number;
  passStyle?: AttackingPassStyle;
  shotStyle?: AttackingShotStyle;
  pass?: PassOptionMetrics;
  shot?: ShotOptionMetrics;
  carry?: CarryOptionMetrics;
  dribble?: DribbleOptionMetrics;
  baseScore: number;
  executionError: number;
  reasons: string[];
};

export type ScoredAttackingOption = AttackingOption & {
  utility: number;
  noise: number;
  finalScore: number;
};

export type AttackingDecision = {
  situation: AttackingSituation;
  selected: ScoredAttackingOption;
  options: ScoredAttackingOption[];
  intentions: AttackingIntent[];
  nextActionMemory: AttackingActionMemory;
  scoreLog: {
    carryBall: number | null;
    dribble: number | null;
    pass: number | null;
    shoot: number | null;
    hold: number | null;
    selected: AttackingActionKind;
    passRequiredAdvantage: number;
    currentAction: AttackingActionKind | null;
    pressure: number;
  };
};

export const ATTACKING_AI_BALANCE = Object.freeze({
  passCorridorRadius: 4.8,
  hardInterceptionRisk: 0.78,
  passSpeed: 27,
  maxPredictionSeconds: 1.65,
  randomUtilityNoise: 2.2,
  minimumIntentSpacing: 5.4,
  shotMaximumDistance: 44,
  transitionTicks: 7,
  passRequiredAdvantage: 8,
  currentActionBonus: 7,
  actionHysteresis: 5,
  minimumCommitTicks: 2,
  dribbleCooldownTicks: 5,
  receiveSettleTicks: 1,
  strongPressureThreshold: 0.66,
  dangerousPassLineBreak: 0.62,
  reevaluationMinSeconds: 0.3,
  reevaluationMaxSeconds: 0.6,
  reevaluationDistance: 3.5,
});

export function normalizeAttackingTactics(
  tactics: Partial<AttackingTactics> = {},
): AttackingTactics {
  return {
    risk: clamp01(tactics.risk ?? 0.5),
    tempo: clamp01(tactics.tempo ?? 0.5),
    directness: clamp01(tactics.directness ?? 0.5),
    compactness: clamp01(tactics.compactness ?? 0.5),
    shootingPriority: clamp01(tactics.shootingPriority ?? 0.5),
    dribbleFrequency: clamp01(tactics.dribbleFrequency ?? 0.56),
    carryDirectness: clamp01(tactics.carryDirectness ?? tactics.directness ?? 0.5),
    riskTolerance: clamp01(tactics.riskTolerance ?? tactics.risk ?? 0.5),
  };
}

export function collectAttackingSituation(
  input: CollectAttackingSituationInput,
): AttackingSituation {
  const direction = input.side === "home" ? -1 : 1;
  const goal = { x: 50, y: direction > 0 ? 100 : 0 };
  const distances = input.opponents.map((opponent) =>
    distance(input.carrier.position, opponent.position),
  );
  const nearestOpponentDistance = distances.length ? Math.min(...distances) : 100;
  const pressure = clamp01(
    input.opponents.reduce((sum, opponent) => {
      const gap = distance(input.carrier.position, opponent.position);
      if (gap >= 18) return sum;
      const closing = dot(
        normalize(sub(input.carrier.position, opponent.position)),
        opponent.velocity,
      );
      return sum + Math.max(0, (18 - gap) / 18) * (1 + clamp(closing / 12, 0, 0.35));
    }, 0) / 1.75,
  );
  const facing = getFacing(input.carrier, direction);
  const bodyAlignment = clamp01(
    (dot(facing, normalize(sub(goal, input.carrier.position))) + 1) / 2,
  );

  return {
    ...input,
    direction,
    goal,
    keeper: input.opponents.find((player) => normalizeRole(player.role) === "GK") ?? null,
    pressure,
    nearestOpponentDistance,
    staminaRatio: getStaminaRatio(input.carrier),
    bodyAlignment,
    tactics: normalizeAttackingTactics(input.tactics),
    isTransition: input.possessionTicks <= ATTACKING_AI_BALANCE.transitionTicks,
    isOneTouchWindow: input.latestEvent === "PASS" || input.latestEvent === "pass",
    isSettlingAfterReceive:
      (input.latestEvent === "PASS" || input.latestEvent === "pass") &&
      pressure < ATTACKING_AI_BALANCE.strongPressureThreshold,
  };
}

export function generateAttackingOptions(situation: AttackingSituation): AttackingOption[] {
  const options: AttackingOption[] = [
    createHoldOption(situation),
    createWaitOption(situation),
    createCarryBallOption(situation),
  ];

  const dribbleRange = normalizeRole(situation.carrier.role) === "W" ? 16 : 13;
  const dribbleOnCooldown =
    (situation.actionMemory?.dribbleCooldownUntilTick ?? 0) > situation.tick;
  if (situation.nearestOpponentDistance <= dribbleRange && !dribbleOnCooldown) {
    options.push(createDribbleOption(situation));
  }

  for (const receiver of situation.teammates) {
    if (
      receiver.id === situation.carrier.id ||
      normalizeRole(receiver.role) === "GK" ||
      receiver.isOffside
    ) {
      continue;
    }
    const styles = getAvailablePassStyles(situation, receiver);
    for (const style of styles) {
      const option = createPassOption(situation, receiver, style);
      const allowedRisk =
        ATTACKING_AI_BALANCE.hardInterceptionRisk +
        situation.tactics.risk * 0.1 +
        (style === "cross" || style === "long" ? 0.04 : 0);
      if (option.pass && option.pass.interceptionRisk <= allowedRisk) options.push(option);
    }
  }

  for (const style of getAvailableShotStyles(situation)) {
    options.push(createShotOption(situation, style));
  }

  return options;
}

export function scoreAttackingOptions(
  situation: AttackingSituation,
  options: AttackingOption[],
): AttackingOption[] {
  return options.map((option) => ({
    ...option,
    baseScore: clamp(scoreOption(situation, option), 0, 100),
  }));
}

export function selectAttackingAction(
  scoredOptions: AttackingOption[],
  random: () => number = Math.random,
  situation?: AttackingSituation,
): ScoredAttackingOption {
  if (!scoredOptions.length) {
    throw new Error("Attacking utility AI needs at least one option");
  }

  const randomized = scoredOptions
    .map((option): ScoredAttackingOption => {
      const noise = (clamp01(random()) * 2 - 1) * ATTACKING_AI_BALANCE.randomUtilityNoise;
      return { ...option, utility: option.baseScore, noise, finalScore: option.baseScore + noise };
    })
    .sort((left, right) => right.finalScore - left.finalScore || left.id.localeCompare(right.id));

  if (!situation) return randomized[0];

  const bestCarry = randomized.find((option) => option.kind === "carry_ball") ?? null;
  const eligible = randomized.filter((option) => {
    if (option.kind !== "pass" || !bestCarry || !option.pass) return true;
    const pressureRelease = situation.pressure >= ATTACKING_AI_BALANCE.strongPressureThreshold;
    const dangerousPass =
      option.pass.lineBreakValue >= ATTACKING_AI_BALANCE.dangerousPassLineBreak ||
      option.pass.chanceCreationValue >= 0.68 ||
      getCombinationBonus(situation, option) > 0;
    return (
      pressureRelease ||
      dangerousPass ||
      option.finalScore >= bestCarry.finalScore + ATTACKING_AI_BALANCE.passRequiredAdvantage
    );
  });
  const ranked = eligible.length ? eligible : randomized;
  const memory = situation.actionMemory;
  const currentOption = memory?.currentAction
    ? ranked.find((option) => option.kind === memory.currentAction)
    : null;
  const insideMinimumCommit = Boolean(
    memory?.currentAction &&
    situation.tick < memory.minimumCommitUntilTick &&
    situation.pressure < ATTACKING_AI_BALANCE.strongPressureThreshold,
  );
  if (insideMinimumCommit && currentOption) return currentOption;

  const best = ranked[0];
  if (
    currentOption &&
    best.kind !== currentOption.kind &&
    best.finalScore < currentOption.finalScore + ATTACKING_AI_BALANCE.actionHysteresis
  ) {
    return currentOption;
  }
  return best;
}

export function createAttackingIntentions(
  situation: AttackingSituation,
  selected: ScoredAttackingOption,
): AttackingIntent[] {
  const candidates: AttackingIntent[] = [];
  const direction = situation.direction;
  const receiverId = selected.receiverId ?? null;
  const teammates = situation.teammates.filter((player) => player.id !== situation.carrier.id);
  const receiver = teammates.find((player) => player.id === receiverId) ?? null;

  if (receiver) {
    candidates.push({
      playerId: receiver.id,
      runType: "RECEIVE",
      communication: "request_ball",
      target: selected.target,
      priority: 100,
      expiresAtTick: situation.tick + 5,
    });
  }

  if (selected.passStyle === "one_two") {
    candidates.push({
      playerId: situation.carrier.id,
      runType: "ONE_TWO_RETURN",
      communication: "announce_run",
      target: {
        x: clamp(situation.carrier.position.x + (50 - situation.carrier.position.x) * 0.18, 8, 92),
        y: clamp(situation.carrier.position.y + direction * 18, 7, 93),
      },
      priority: 98,
      expiresAtTick: situation.tick + 8,
    });
  }

  const wideCarrier = Math.abs(situation.carrier.position.x - 50) >= 22;
  const sameFlankFullback = teammates.find(
    (player) =>
      normalizeRole(player.role) === "FB" &&
      Math.sign(player.position.x - 50) === Math.sign(situation.carrier.position.x - 50),
  );
  if (sameFlankFullback && sameFlankFullback.id !== receiverId) {
    const overlap = wideCarrier && situation.tactics.compactness < 0.62;
    candidates.push({
      playerId: sameFlankFullback.id,
      runType: overlap ? "OVERLAP" : "UNDERLAP",
      communication: "announce_run",
      target: {
        x: overlap
          ? clamp(
              sameFlankFullback.position.x + Math.sign(sameFlankFullback.position.x - 50) * 8,
              5,
              95,
            )
          : clamp(lerp(sameFlankFullback.position.x, 50, 0.42), 15, 85),
        y: clamp(Math.max(8, Math.min(92, situation.ball.y + direction * 22)), 7, 93),
      },
      priority: 78,
      expiresAtTick: situation.tick + 10,
    });
  }

  const thirdRunner = teammates
    .filter(
      (player) =>
        player.id !== receiverId &&
        normalizeRole(player.role) !== "CB" &&
        normalizeRole(player.role) !== "GK",
    )
    .sort((left, right) => {
      const leftFit =
        normalizeRole(left.role) === "CM" ? 1 : normalizeRole(left.role) === "W" ? 0.8 : 0.6;
      const rightFit =
        normalizeRole(right.role) === "CM" ? 1 : normalizeRole(right.role) === "W" ? 0.8 : 0.6;
      return (
        rightFit - leftFit ||
        distance(left.position, situation.ball) - distance(right.position, situation.ball)
      );
    })[0];
  if (thirdRunner) {
    candidates.push({
      playerId: thirdRunner.id,
      runType: "THIRD_MAN_RUN",
      communication: "announce_run",
      target: {
        x: clamp(lerp(thirdRunner.position.x, 50, 0.34), 16, 84),
        y: clamp(situation.ball.y + direction * (situation.isTransition ? 25 : 17), 7, 93),
      },
      priority: 74,
      expiresAtTick: situation.tick + 9,
    });
  }

  for (const teammate of teammates) {
    if (candidates.some((intent) => intent.playerId === teammate.id)) continue;
    const role = normalizeRole(teammate.role);
    if (role === "GK") {
      candidates.push({
        playerId: teammate.id,
        runType: "HOLD_POSITION",
        communication: "hold_position",
        target: { ...teammate.position },
        priority: 20,
        expiresAtTick: situation.tick + 8,
      });
      continue;
    }
    const isForward = role === "ST" || role === "W";
    const isBehindBall = direction * (teammate.position.y - situation.ball.y) < -2;
    const runType: AttackingRunType = isForward
      ? role === "W"
        ? "STRETCH"
        : "BOX_RUN"
      : isBehindBall
        ? "SUPPORT"
        : "HOLD_POSITION";
    candidates.push({
      playerId: teammate.id,
      runType,
      communication: isForward ? "announce_run" : isBehindBall ? "offer_support" : "hold_position",
      target: getSupportingTarget(situation, teammate, runType),
      priority: isForward ? 62 : isBehindBall ? 50 : 34,
      expiresAtTick: situation.tick + 8,
    });
  }

  return deconflictIntentTargets(candidates, situation.direction);
}

export function runAttackingUtilityAi(
  input: CollectAttackingSituationInput,
  random: () => number = Math.random,
): AttackingDecision {
  const situation = collectAttackingSituation(input);
  const options = scoreAttackingOptions(situation, generateAttackingOptions(situation));
  const selected = selectAttackingAction(options, random, situation);
  const nextActionMemory = createNextActionMemory(situation, selected);
  const getBestScore = (kind: AttackingActionKind) => {
    const matching = options.filter((option) => option.kind === kind);
    return matching.length ? Math.max(...matching.map((option) => option.baseScore)) : null;
  };
  return {
    situation,
    selected,
    options: options
      .map((option) => ({
        ...option,
        utility: option.baseScore,
        noise: 0,
        finalScore: option.baseScore,
      }))
      .sort((left, right) => right.finalScore - left.finalScore),
    intentions: createAttackingIntentions(situation, selected),
    nextActionMemory,
    scoreLog: {
      carryBall: getBestScore("carry_ball"),
      dribble: getBestScore("dribble"),
      pass: getBestScore("pass"),
      shoot: getBestScore("shoot"),
      hold: Math.max(getBestScore("hold") ?? 0, getBestScore("wait") ?? 0),
      selected: selected.kind,
      passRequiredAdvantage: ATTACKING_AI_BALANCE.passRequiredAdvantage,
      currentAction: situation.actionMemory?.currentAction ?? null,
      pressure: situation.pressure,
    },
  };
}

function createNextActionMemory(
  situation: AttackingSituation,
  selected: ScoredAttackingOption,
): AttackingActionMemory {
  const previous = situation.actionMemory;
  const continuesAction = previous?.currentAction === selected.kind;
  const isCommittedBallAction = selected.kind === "carry_ball" || selected.kind === "dribble";
  return {
    currentAction: selected.kind,
    actionStartedTick: continuesAction ? previous.actionStartedTick : situation.tick,
    lastEvaluationTick: situation.tick,
    lastEvaluationPosition: { ...situation.carrier.position },
    minimumCommitUntilTick: continuesAction
      ? previous.minimumCommitUntilTick
      : situation.tick + (isCommittedBallAction ? ATTACKING_AI_BALANCE.minimumCommitTicks : 0),
    dribbleCooldownUntilTick:
      selected.kind === "dribble"
        ? situation.tick + ATTACKING_AI_BALANCE.dribbleCooldownTicks
        : (previous?.dribbleCooldownUntilTick ?? 0),
  };
}

function createHoldOption(situation: AttackingSituation): AttackingOption {
  return {
    id: "hold",
    kind: "hold",
    target: situation.carrier.position,
    baseScore: 0,
    executionError: getExecutionError(situation, "control"),
    reasons: ["retain possession", "scan for movement"],
  };
}

function createWaitOption(situation: AttackingSituation): AttackingOption {
  return {
    id: "wait",
    kind: "wait",
    target: {
      x: clamp(
        situation.carrier.position.x + Math.sin(situation.tick + situation.carrier.id) * 1.4,
        2,
        98,
      ),
      y: clamp(situation.carrier.position.y - situation.direction * 0.8, 2, 98),
    },
    baseScore: 0,
    executionError: getExecutionError(situation, "control"),
    reasons: ["wait for teammate movement"],
  };
}

function createCarryBallOption(situation: AttackingSituation): AttackingOption {
  const carryLane = findBestCarryLane(situation);
  const facingGoalBonus = situation.bodyAlignment;
  const roleCarryBias = getRoleCarryBias(situation.carrier.role);
  return {
    id: "carry_ball",
    kind: "carry_ball",
    target: carryLane.target,
    baseScore: 0,
    executionError: getExecutionError(situation, "dribble"),
    reasons: ["safe forward corridor", "advance the team shape", "retain ball control"],
    carry: {
      forwardSpace: carryLane.forwardSpace,
      corridorSafety: carryLane.corridorSafety,
      progressionValue: carryLane.progressionValue,
      dangerProgression: carryLane.dangerProgression,
      turnoverRisk: carryLane.turnoverRisk,
      facingGoalBonus,
      roleCarryBias,
      directBlockerDistance: carryLane.directBlockerDistance,
    },
  };
}

function createDribbleOption(situation: AttackingSituation): AttackingOption {
  const closestOpponent = situation.opponents
    .filter((opponent) => normalizeRole(opponent.role) !== "GK")
    .sort(
      (left, right) =>
        distance(left.position, situation.carrier.position) -
        distance(right.position, situation.carrier.position),
    )[0];
  const opponentPosition = closestOpponent?.position ?? {
    x: situation.carrier.position.x,
    y: situation.carrier.position.y + situation.direction * 8,
  };
  const duelDistance = distance(situation.carrier.position, opponentPosition);
  const escapeSide =
    Math.sign(situation.carrier.position.x - opponentPosition.x) ||
    (situation.carrier.id % 2 === 0 ? 1 : -1);
  const target = {
    x: clamp(
      situation.carrier.position.x + escapeSide * (5.2 + situation.tactics.riskTolerance * 2),
      4,
      96,
    ),
    y: clamp(
      situation.carrier.position.y +
        situation.direction * (4 + situation.tactics.carryDirectness * 4),
      3,
      97,
    ),
  };
  const playerQuality = getDribbleQuality(situation.carrier);
  const defenderQuality = closestOpponent
    ? clamp01(
        (closestOpponent.stats.balance * 0.32 +
          closestOpponent.stats.speed * 0.35 +
          closestOpponent.stats.acceleration * 0.33) /
          100,
      )
    : 0.5;
  const duelOpportunity = clamp01(1 - Math.abs(duelDistance - 5.5) / 11);
  const successProbability = clamp01(
    0.36 + playerQuality * 0.48 - defenderQuality * 0.24 - situation.pressure * 0.13,
  );
  const escapeValue = clamp01(
    directionProgress(situation, target) / 10 +
      Math.abs(target.x - situation.carrier.position.x) / 18,
  );
  return {
    id: "dribble",
    kind: "dribble",
    target,
    baseScore: 0,
    executionError: getExecutionError(situation, "dribble"),
    reasons: ["beat direct opponent", "change direction under pressure"],
    dribble: {
      duelDistance,
      duelOpportunity,
      successProbability,
      escapeValue,
      roleDribbleBias: getRoleDribbleBias(situation.carrier.role),
    },
  };
}

function createPassOption(
  situation: AttackingSituation,
  receiver: AttackingAiPlayer,
  style: AttackingPassStyle,
): AttackingOption {
  const initialDistance = distance(situation.carrier.position, receiver.position);
  const travelSeconds = clamp(
    initialDistance / ATTACKING_AI_BALANCE.passSpeed,
    0.18,
    ATTACKING_AI_BALANCE.maxPredictionSeconds,
  );
  const target = predictReceiverPosition(situation, receiver, style, travelSeconds);
  const passDistance = distance(situation.carrier.position, target);
  const lane = evaluatePassingLane(situation, target, travelSeconds);
  const receiverSpace = evaluateReceiverSpace(situation.opponents, target);
  const movementDirection = dot(normalize(receiver.velocity), { x: 0, y: situation.direction });
  const movementValue = clamp01(
    0.5 + movementDirection * 0.34 + Math.min(0.16, magnitude(receiver.velocity) / 60),
  );
  const receiverFacing = getFacing(receiver, situation.direction);
  const receptionAngle = dot(receiverFacing, normalize(sub(situation.goal, target)));
  const receptionQuality = clamp01(
    0.32 + receiverSpace * 0.32 + (receptionAngle + 1) * 0.12 + receiver.stats.balance / 500,
  );
  const progression = clamp(directionProgress(situation, target) / 38, -1, 1);
  const passerQuality =
    (style === "long" || style === "switch" || style === "cross"
      ? situation.carrier.stats.longPass * 0.48 +
        situation.carrier.stats.vision * 0.34 +
        situation.carrier.stats.pass * 0.18
      : situation.carrier.stats.pass * 0.5 +
        situation.carrier.stats.vision * 0.32 +
        situation.carrier.stats.balance * 0.18) / 100;
  const rangePenalty =
    Math.max(
      0,
      passDistance - (style === "long" || style === "switch" ? 44 : style === "cross" ? 36 : 25),
    ) / 70;
  const styleFit = getPassStyleFit(situation, receiver, style, target);
  const completionProbability = clamp01(
    0.13 +
      passerQuality * 0.42 +
      lane.safety * 0.28 +
      receptionQuality * 0.16 +
      styleFit * 0.12 -
      situation.pressure * 0.18 -
      rangePenalty,
  );
  const lineBreakValue = clamp01(
    Math.max(0, progression) * 0.72 +
      (style === "through" ? 0.28 : style === "long" || style === "switch" ? 0.12 : 0),
  );
  const currentGoalDistance = distance(situation.carrier.position, situation.goal);
  const targetGoalDistance = distance(target, situation.goal);
  const dangerGain = clamp01((currentGoalDistance - targetGoalDistance + 2) / 28);
  const centralThreat = clamp01((28 - Math.abs(target.x - 50)) / 28);
  const chanceCreationValue = clamp01(
    dangerGain * 0.56 +
      centralThreat * (targetGoalDistance <= 34 ? 0.24 : 0.08) +
      (style === "through" || style === "cut_back" || style === "cross" ? 0.2 : 0),
  );
  const receiverAdvantage = clamp01(
    receiverSpace * 0.32 +
      receptionQuality * 0.3 +
      movementValue * 0.2 +
      Math.max(0, progression) * 0.18,
  );

  return {
    id: `pass:${style}:${receiver.id}`,
    kind: "pass",
    target,
    receiverId: receiver.id,
    passStyle: style,
    baseScore: 0,
    executionError: getExecutionError(situation, "pass", style),
    reasons: ["safe passing lane", "receiver movement", "ball progression"],
    pass: {
      distance: passDistance,
      progression,
      laneSafety: lane.safety,
      interceptionRisk: lane.risk,
      receiverSpace,
      receptionQuality,
      movementValue,
      completionProbability,
      travelSeconds,
      receiverAdvantage,
      lineBreakValue,
      chanceCreationValue,
    },
  };
}

function createShotOption(
  situation: AttackingSituation,
  style: AttackingShotStyle,
): AttackingOption {
  const distanceToGoal = distance(situation.carrier.position, situation.goal);
  const angleQuality = clamp01(Math.atan2(7.2, Math.max(2, distanceToGoal)) / 0.82);
  const lane = evaluateShotLane(situation);
  const keeper = situation.keeper;
  const keeperExposure = keeper
    ? clamp01(
        0.25 +
          Math.abs(keeper.position.x - situation.carrier.position.x) / 34 +
          Math.max(0, distance(keeper.position, situation.goal) - 5) / 24,
      )
    : 0.86;
  const footFit = getShootingFootFit(situation);
  const finishing = clamp01(
    (situation.carrier.stats.shoot * 0.62 +
      getComposure(situation.carrier) * 0.22 +
      getTechnique(situation.carrier) * 0.16) /
      100,
  );
  const rangeQuality = clamp01(1 - Math.max(0, distanceToGoal - 8) / 40);
  const styleFit = getShotStyleFit(situation, style, distanceToGoal);
  const expectedGoalValue = clamp01(
    0.015 +
      rangeQuality * 0.31 +
      angleQuality * 0.18 +
      lane.sight * 0.21 +
      keeperExposure * 0.1 +
      finishing * 0.18 +
      footFit * 0.06 +
      styleFit * 0.08 -
      situation.pressure * 0.16,
  );

  return {
    id: `shoot:${style}`,
    kind: "shoot",
    target: situation.goal,
    shotStyle: style,
    baseScore: 0,
    executionError: getExecutionError(situation, "shot", undefined, style),
    reasons: ["shot angle", "clear sight of goal", "goalkeeper exposure"],
    shot: {
      distanceToGoal,
      angleQuality,
      sightQuality: lane.sight,
      blockerRisk: lane.risk,
      keeperExposure,
      footFit,
      expectedGoalValue,
    },
  };
}

function scoreOption(situation: AttackingSituation, option: AttackingOption): number {
  const tactics = situation.tactics;
  if (option.kind === "hold") {
    return withCurrentActionBonus(
      situation,
      option,
      28 +
        (1 - situation.pressure) * 10 +
        (1 - tactics.tempo) * 7 +
        tactics.compactness * 3 +
        (situation.isSettlingAfterReceive ? 7 : 0),
    );
  }
  if (option.kind === "wait") {
    const usefulRuns = situation.teammates.filter(
      (player) => magnitude(player.velocity) > 2.5,
    ).length;
    return withCurrentActionBonus(
      situation,
      option,
      24 +
        (1 - situation.pressure) * 10 +
        Math.min(7, usefulRuns * 1.5) +
        (1 - tactics.tempo) * 6 +
        (situation.isSettlingAfterReceive ? 5 : 0),
    );
  }
  if (option.kind === "carry_ball" && option.carry) {
    const carry = option.carry;
    const technicalQuality = getCarryTechnicalQuality(situation.carrier);
    const personality = situation.carrier.personality;
    const personalityCarryBias = clamp(
      ((personality?.dribbleBias ?? 1) - 1) * 8 +
        (personality?.flair ?? 0) * 5 +
        ((personality?.riskTaking ?? 0.5) - 0.5) * 4 -
        Math.max(0, (personality?.passBias ?? 1) - 1) * 5,
      -7,
      12,
    );
    return withCurrentActionBonus(
      situation,
      option,
      8 +
        carry.forwardSpace * 21 +
        carry.progressionValue * 18 +
        technicalQuality * 20 +
        carry.dangerProgression * 10 +
        carry.facingGoalBonus * 7 +
        carry.roleCarryBias * 8 +
        tactics.dribbleFrequency * 6 +
        tactics.carryDirectness * 4 +
        personalityCarryBias +
        (situation.isSettlingAfterReceive ? 6 : 0) -
        situation.pressure * 23 -
        carry.turnoverRisk * 18 -
        option.executionError * 5,
    );
  }
  if (option.kind === "dribble" && option.dribble) {
    const dribble = option.dribble;
    const personality = situation.carrier.personality;
    const creativeConfidence = clamp01(
      getConfidence(situation.carrier) * 0.48 +
        clamp01(((personality?.dribbleBias ?? 1) - 0.65) / 1.1) * 0.3 +
        (personality?.flair ?? 0) * 0.22,
    );
    return withCurrentActionBonus(
      situation,
      option,
      12 +
        dribble.successProbability * 27 +
        dribble.duelOpportunity * 14 +
        dribble.escapeValue * 10 +
        dribble.roleDribbleBias * 8 +
        creativeConfidence * 10 +
        tactics.dribbleFrequency * 9 +
        tactics.riskTolerance * 5 -
        situation.pressure * 13 -
        option.executionError * 8,
    );
  }
  if (option.kind === "pass" && option.pass) {
    const pass = option.pass;
    const passSafety = pass.completionProbability * 0.58 + pass.laneSafety * 0.42;
    const transitionBonus =
      situation.isTransition && pass.lineBreakValue > 0.35 ? 6 * tactics.tempo : 0;
    const comboBonus = getCombinationBonus(situation, option);
    const backwardPassPenalty = pass.progression < -0.04 ? 16 + Math.abs(pass.progression) * 18 : 0;
    const lowProgressPassPenalty =
      pass.progression < 0.12 && pass.lineBreakValue < 0.24 && pass.chanceCreationValue < 0.32
        ? 13
        : 0;
    const pressureReleaseBonus =
      situation.pressure >= ATTACKING_AI_BALANCE.strongPressureThreshold ? 13 : 0;
    const dangerousRunBonus =
      pass.lineBreakValue >= ATTACKING_AI_BALANCE.dangerousPassLineBreak ||
      pass.chanceCreationValue >= 0.68
        ? 10
        : 0;
    const personalityPassBias = clamp(
      ((situation.carrier.personality?.passBias ?? 1) - 1) * 7 -
        ((situation.carrier.personality?.dribbleBias ?? 1) - 1) * 4,
      -8,
      9,
    );
    const styleBonus =
      option.passStyle === "switch"
        ? pass.lineBreakValue * tactics.directness * 4
        : option.passStyle === "back"
          ? situation.pressure * 5
          : option.passStyle === "one_touch"
            ? tactics.tempo * 3
            : 0;
    const receiveSettlePenalty =
      situation.isSettlingAfterReceive && dangerousRunBonus === 0 && comboBonus <= 0 ? 16 : 0;
    return withCurrentActionBonus(
      situation,
      option,
      10 +
        pass.receiverAdvantage * 18 +
        pass.lineBreakValue * 24 +
        passSafety * 18 +
        pass.chanceCreationValue * 20 +
        transitionBonus +
        comboBonus +
        styleBonus +
        pressureReleaseBonus +
        dangerousRunBonus +
        personalityPassBias -
        pass.interceptionRisk * 26 -
        backwardPassPenalty -
        lowProgressPassPenalty -
        receiveSettlePenalty -
        option.executionError * 6,
    );
  }
  if (option.kind === "shoot" && option.shot) {
    const shot = option.shot;
    const xgValue = shot.expectedGoalValue * 82;
    const playerConfidence = getComposure(situation.carrier) / 100;
    const styleBonus =
      getShotStyleFit(situation, option.shotStyle ?? "normal", shot.distanceToGoal) * 7;
    return withCurrentActionBonus(
      situation,
      option,
      5 +
        xgValue +
        shot.sightQuality * 10 +
        shot.footFit * 5 +
        playerConfidence * 5 +
        tactics.shootingPriority * 15 +
        styleBonus -
        shot.blockerRisk * 13 -
        option.executionError * 9,
    );
  }
  return 0;
}

function withCurrentActionBonus(
  situation: AttackingSituation,
  option: AttackingOption,
  score: number,
): number {
  return (
    score +
    (situation.actionMemory?.currentAction === option.kind
      ? ATTACKING_AI_BALANCE.currentActionBonus
      : 0)
  );
}

function findBestCarryLane(situation: AttackingSituation): {
  target: AttackingPoint;
  forwardSpace: number;
  corridorSafety: number;
  progressionValue: number;
  dangerProgression: number;
  turnoverRisk: number;
  directBlockerDistance: number;
} {
  const role = getDetailedRole(situation.carrier.role);
  const runLength =
    (role === "CB" || role === "DM" ? 6.5 : role === "W" ? 9 : 8) +
    situation.tactics.carryDirectness * 3;
  const current = situation.carrier.position;
  const inwardSign = Math.sign(50 - current.x) || (situation.carrier.id % 2 === 0 ? 1 : -1);
  const lateralOffsets =
    role === "W"
      ? [0, inwardSign * runLength * 0.52, -inwardSign * runLength * 0.28]
      : role === "AM" || role === "SS"
        ? [inwardSign * runLength * 0.38, 0, -inwardSign * runLength * 0.26]
        : [0, -runLength * 0.38, runLength * 0.38];
  const currentGoalDistance = distance(current, situation.goal);

  return lateralOffsets
    .map((lateralOffset) => {
      const target = {
        x: clamp(current.x + lateralOffset, 4, 96),
        y: clamp(current.y + situation.direction * runLength, 3, 97),
      };
      let nearestCorridorGap = 99;
      let directBlockerDistance = 99;
      for (const opponent of situation.opponents) {
        if (normalizeRole(opponent.role) === "GK") continue;
        const projection = pointSegmentProjection(opponent.position, current, target);
        if (projection.t <= 0.04 || projection.t > 1) continue;
        const corridorGap = distance(opponent.position, projection.point);
        nearestCorridorGap = Math.min(nearestCorridorGap, corridorGap);
        if (corridorGap <= 7.5) {
          directBlockerDistance = Math.min(
            directBlockerDistance,
            distance(current, opponent.position),
          );
        }
      }
      const corridorSafety = clamp01(
        clamp01((nearestCorridorGap - 1.8) / 10) * 0.48 +
          clamp01(directBlockerDistance / 22) * 0.52,
      );
      const forwardSpace = clamp01(directBlockerDistance / 22);
      const progressionValue = clamp01(directionProgress(situation, target) / runLength);
      const dangerProgression = clamp01(
        (currentGoalDistance - distance(target, situation.goal)) / 13,
      );
      const turnoverRisk = clamp01(
        situation.pressure * 0.56 +
          (1 - corridorSafety) * 0.38 +
          (1 - situation.bodyAlignment) * 0.06,
      );
      const laneValue =
        forwardSpace * 1.4 +
        corridorSafety * 1.15 +
        progressionValue * 0.9 +
        dangerProgression * 0.75 +
        (role === "W" && lateralOffset === 0 ? 0.18 : 0);
      return {
        target,
        forwardSpace,
        corridorSafety,
        progressionValue,
        dangerProgression,
        turnoverRisk,
        directBlockerDistance,
        laneValue,
      };
    })
    .sort((left, right) => right.laneValue - left.laneValue)[0];
}

function getCarryTechnicalQuality(player: AttackingAiPlayer): number {
  return clamp01(
    (player.stats.dribbling * 0.8 +
      getBallControl(player) * 0.7 +
      player.stats.acceleration * 0.5 +
      getAgility(player) * 0.45 +
      player.stats.balance * 0.35 +
      getConfidence(player) * 0.55) /
      335,
  );
}

function getDribbleQuality(player: AttackingAiPlayer): number {
  return clamp01(
    (player.stats.dribbling * 0.38 +
      getBallControl(player) * 0.2 +
      getAgility(player) * 0.16 +
      player.stats.acceleration * 0.1 +
      player.stats.balance * 0.08 +
      getConfidence(player) * 0.08) /
      100,
  );
}

function getBallControl(player: AttackingAiPlayer): number {
  return clamp(
    player.stats.ballControl ??
      player.stats.dribbling * 0.5 + player.stats.balance * 0.28 + player.stats.pass * 0.22,
    1,
    100,
  );
}

function getAgility(player: AttackingAiPlayer): number {
  return clamp(
    player.stats.agility ??
      player.stats.acceleration * 0.42 +
        player.stats.balance * 0.34 +
        player.stats.dribbling * 0.24,
    1,
    100,
  );
}

function getConfidence(player: AttackingAiPlayer): number {
  const personality = player.personality;
  return clamp(
    player.stats.confidence ??
      getComposure(player) * 0.54 +
        clamp((personality?.dribbleBias ?? 1) / 1.5, 0, 1) * 22 +
        (personality?.flair ?? 0) * 16 +
        (personality?.riskTaking ?? 0.5) * 8,
    1,
    100,
  );
}

function getRoleCarryBias(role: string): number {
  const detailedRole = getDetailedRole(role);
  const values: Record<ReturnType<typeof getDetailedRole>, number> = {
    GK: 0.04,
    CB: 0.48,
    FB: 0.72,
    DM: 0.62,
    CM: 0.86,
    AM: 0.98,
    W: 1,
    ST: 0.76,
    SS: 0.96,
  };
  return values[detailedRole];
}

function getRoleDribbleBias(role: string): number {
  const detailedRole = getDetailedRole(role);
  const values: Record<ReturnType<typeof getDetailedRole>, number> = {
    GK: 0.02,
    CB: 0.24,
    FB: 0.62,
    DM: 0.38,
    CM: 0.68,
    AM: 0.94,
    W: 1,
    ST: 0.72,
    SS: 0.96,
  };
  return values[detailedRole];
}

function getDetailedRole(
  role: string,
): "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "ST" | "SS" {
  const value = role.toUpperCase();
  if (value.includes("GK")) return "GK";
  if (value.includes("CB")) return "CB";
  if (value.includes("LB") || value.includes("RB") || value.includes("WB") || value.includes("FB"))
    return "FB";
  if (value.includes("CDM") || value === "DM") return "DM";
  if (value.includes("CAM") || value === "AM") return "AM";
  if (value.includes("LW") || value.includes("RW") || value === "W") return "W";
  if (value.includes("SS")) return "SS";
  if (value.includes("ST") || value.includes("CF") || value.includes("FW")) return "ST";
  return "CM";
}

function getAvailablePassStyles(
  situation: AttackingSituation,
  receiver: AttackingAiPlayer,
): AttackingPassStyle[] {
  const gap = distance(situation.carrier.position, receiver.position);
  const progression = directionProgress(situation, receiver.position);
  const lateral = Math.abs(receiver.position.x - situation.carrier.position.x);
  const carrierAdvanced = situation.direction > 0 ? situation.ball.y >= 68 : situation.ball.y <= 32;
  const nearByline = situation.direction > 0 ? situation.ball.y >= 84 : situation.ball.y <= 16;
  const carrierWide = Math.abs(situation.ball.x - 50) >= 24;
  const receiverCentral = Math.abs(receiver.position.x - 50) <= 23;
  const styles = new Set<AttackingPassStyle>();

  if (gap <= 31) styles.add("short");
  if (gap >= 24) styles.add("long");
  if (
    progression >= 4 &&
    (magnitude(receiver.velocity) >= 1.2 || receiver.stats.acceleration >= 66)
  ) {
    styles.add("through");
  }
  if (situation.isOneTouchWindow && gap <= 25) styles.add("one_touch");
  if (gap >= 5 && gap <= 22 && progression >= -3) styles.add("one_two");
  if (lateral >= 34 && gap >= 30) styles.add("switch");
  if (carrierAdvanced && carrierWide && receiverCentral) styles.add("cross");
  if (nearByline && carrierWide && receiverCentral && progression <= 1) styles.add("cut_back");
  if (progression <= -2) styles.add("back");

  if (!styles.size) styles.add(gap > 28 ? "long" : "short");
  return [...styles];
}

function getAvailableShotStyles(situation: AttackingSituation): AttackingShotStyle[] {
  const goalDistance = distance(situation.carrier.position, situation.goal);
  if (goalDistance > ATTACKING_AI_BALANCE.shotMaximumDistance) return [];
  const styles = new Set<AttackingShotStyle>(["normal"]);
  if (goalDistance >= 22) styles.add("long_range");
  if (situation.isOneTouchWindow) styles.add("first_time");
  if (goalDistance <= 28 && situation.bodyAlignment >= 0.46) styles.add("placed");
  if (goalDistance >= 13 || situation.pressure >= 0.5) styles.add("power");
  if (situation.lastPassStyle === "cross" && goalDistance <= 22) styles.add("header");
  return [...styles];
}

function predictReceiverPosition(
  situation: AttackingSituation,
  receiver: AttackingAiPlayer,
  style: AttackingPassStyle,
  seconds: number,
): AttackingPoint {
  const velocityScale =
    style === "through" ? 1.15 : style === "cross" ? 0.78 : style === "back" ? 0.35 : 0.8;
  const role = normalizeRole(receiver.role);
  const runBoost =
    style === "through" || style === "one_two"
      ? situation.direction * (2.5 + receiver.stats.acceleration / 35) * seconds
      : 0;
  const boxBias =
    style === "cross" && (role === "ST" || role === "W") ? (50 - receiver.position.x) * 0.28 : 0;
  return {
    x: clamp(receiver.position.x + receiver.velocity.x * seconds * velocityScale + boxBias, 3, 97),
    y: clamp(receiver.position.y + receiver.velocity.y * seconds * velocityScale + runBoost, 3, 97),
  };
}

function evaluatePassingLane(
  situation: AttackingSituation,
  target: AttackingPoint,
  travelSeconds: number,
): { safety: number; risk: number } {
  let survival = 1;
  for (const opponent of situation.opponents) {
    const projection = pointSegmentProjection(
      opponent.position,
      situation.carrier.position,
      target,
    );
    if (projection.t <= 0.04 || projection.t >= 0.99) continue;
    const ballArrival = travelSeconds * projection.t;
    const predictedOpponent = {
      x: opponent.position.x + opponent.velocity.x * Math.min(ballArrival, 0.8),
      y: opponent.position.y + opponent.velocity.y * Math.min(ballArrival, 0.8),
    };
    const gap = distance(predictedOpponent, projection.point);
    const reach =
      ATTACKING_AI_BALANCE.passCorridorRadius +
      opponent.stats.speed / 42 +
      (ballArrival * opponent.stats.acceleration) / 80;
    const individualRisk = clamp01((reach - gap + 2.4) / (reach + 2.4));
    survival *= 1 - individualRisk * 0.92;
  }
  const risk = clamp01(1 - survival);
  return { safety: 1 - risk, risk };
}

function evaluateShotLane(situation: AttackingSituation): { sight: number; risk: number } {
  let survival = 1;
  for (const opponent of situation.opponents) {
    if (normalizeRole(opponent.role) === "GK") continue;
    const projection = pointSegmentProjection(
      opponent.position,
      situation.carrier.position,
      situation.goal,
    );
    if (projection.t <= 0.03 || projection.t >= 0.94) continue;
    const gap = distance(opponent.position, projection.point);
    const risk = clamp01((5.2 - gap) / 5.2) * (1 - projection.t * 0.35);
    survival *= 1 - risk * 0.9;
  }
  const risk = clamp01(1 - survival);
  return { sight: 1 - risk, risk };
}

function evaluateReceiverSpace(opponents: AttackingAiPlayer[], target: AttackingPoint): number {
  if (!opponents.length) return 1;
  const nearest = Math.min(...opponents.map((opponent) => distance(opponent.position, target)));
  return clamp01((nearest - 2.2) / 15);
}

function getPassStyleFit(
  situation: AttackingSituation,
  receiver: AttackingAiPlayer,
  style: AttackingPassStyle,
  target: AttackingPoint,
): number {
  const gap = distance(situation.carrier.position, target);
  const progression = directionProgress(situation, target);
  const fits: Record<AttackingPassStyle, number> = {
    short: clamp01(1 - Math.max(0, gap - 18) / 24),
    long: clamp01((gap - 18) / 35 + situation.carrier.stats.longPass / 180),
    through: clamp01(0.35 + Math.max(0, progression) / 28 + magnitude(receiver.velocity) / 25),
    one_touch: clamp01((situation.isOneTouchWindow ? 0.65 : 0.1) + situation.tactics.tempo * 0.35),
    one_two: clamp01(1 - Math.abs(gap - 12) / 18),
    cross: clamp01(0.35 + Math.abs(situation.carrier.position.x - 50) / 45),
    switch: clamp01(Math.abs(target.x - situation.carrier.position.x) / 48),
    cut_back: clamp01(0.45 + Math.max(0, -progression) / 18),
    back: clamp01(0.45 + Math.max(0, -progression) / 16),
  };
  return fits[style];
}

function getShotStyleFit(
  situation: AttackingSituation,
  style: AttackingShotStyle,
  goalDistance: number,
): number {
  const fits: Record<AttackingShotStyle, number> = {
    normal: 0.72,
    long_range: clamp01((goalDistance - 18) / 22 + situation.carrier.stats.shoot / 190),
    first_time: situation.isOneTouchWindow ? clamp01(getTechnique(situation.carrier) / 100) : 0.12,
    placed: clamp01((1 - situation.pressure) * 0.55 + getComposure(situation.carrier) / 210),
    power: clamp01(0.3 + goalDistance / 65 + situation.carrier.stats.shoot / 260),
    header:
      situation.lastPassStyle === "cross" ? clamp01(getHeading(situation.carrier) / 100) : 0.05,
  };
  return fits[style];
}

function getCombinationBonus(situation: AttackingSituation, option: AttackingOption): number {
  const combination = situation.activeCombination;
  if (!combination || option.kind !== "pass") return 0;
  const priorityIds = [
    combination.initiatorPlayerId,
    combination.wallPlayerId,
    combination.thirdRunnerPlayerId,
  ];
  if (priorityIds.includes(option.receiverId ?? -1)) return 24;
  return -12;
}

function getExecutionError(
  situation: AttackingSituation,
  action: "control" | "dribble" | "pass" | "shot",
  passStyle?: AttackingPassStyle,
  shotStyle?: AttackingShotStyle,
): number {
  const player = situation.carrier;
  const technique = getTechnique(player) / 100;
  const vision = player.stats.vision / 100;
  const composure = getComposure(player) / 100;
  const relevant =
    action === "pass"
      ? ((passStyle === "long" || passStyle === "switch" || passStyle === "cross"
          ? player.stats.longPass
          : player.stats.pass) /
          100) *
          0.5 +
        vision * 0.25 +
        technique * 0.25
      : action === "shot"
        ? (player.stats.shoot / 100) * 0.56 + composure * 0.25 + technique * 0.19
        : action === "dribble"
          ? (player.stats.dribbling / 100) * 0.58 +
            (player.stats.balance / 100) * 0.22 +
            technique * 0.2
          : technique * 0.6 + composure * 0.4;
  const fatigue = 1 - situation.staminaRatio;
  const difficulty =
    (passStyle === "through" || passStyle === "cross" || passStyle === "switch" ? 0.08 : 0) +
    (shotStyle === "first_time" || shotStyle === "header" || shotStyle === "long_range" ? 0.09 : 0);
  return clamp01(
    0.04 + (1 - relevant) * 0.38 + fatigue * 0.2 + situation.pressure * 0.3 + difficulty,
  );
}

function getShootingFootFit(situation: AttackingSituation): number {
  const goalVector = normalize(sub(situation.goal, situation.carrier.position));
  const facing = getFacing(situation.carrier, situation.direction);
  const facingFit = clamp01((dot(facing, goalVector) + 1) / 2);
  const ballSide = Math.sign(situation.goal.x - situation.carrier.position.x);
  const preferredSide = situation.carrier.preferredFoot === "right" ? -1 : 1;
  const footOpening = ballSide === 0 ? 0.82 : ballSide === preferredSide ? 1 : 0.68;
  return clamp01(facingFit * 0.62 + footOpening * 0.38);
}

function getSupportingTarget(
  situation: AttackingSituation,
  teammate: AttackingAiPlayer,
  runType: AttackingRunType,
): AttackingPoint {
  const direction = situation.direction;
  if (runType === "BOX_RUN") {
    return {
      x: clamp(lerp(teammate.position.x, 50, 0.45), 34, 66),
      y: clamp(situation.ball.y + direction * 22, 6, 94),
    };
  }
  if (runType === "STRETCH") {
    const side = teammate.position.x < 50 ? -1 : 1;
    return {
      x: clamp(50 + side * (31 + (1 - situation.tactics.compactness) * 10), 5, 95),
      y: clamp(situation.ball.y + direction * 14, 8, 92),
    };
  }
  if (runType === "SUPPORT") {
    return {
      x: clamp(lerp(teammate.position.x, situation.ball.x, 0.26), 8, 92),
      y: clamp(situation.ball.y - direction * (8 + situation.tactics.compactness * 8), 8, 92),
    };
  }
  return { ...teammate.position };
}

function deconflictIntentTargets(intents: AttackingIntent[], direction: -1 | 1): AttackingIntent[] {
  const placed: AttackingIntent[] = [];
  for (const intent of [...intents].sort((left, right) => right.priority - left.priority)) {
    let target = { ...intent.target };
    for (let attempt = 0; intent.runType !== "HOLD_POSITION" && attempt < 5; attempt += 1) {
      const conflict = placed.find(
        (other) => distance(other.target, target) < ATTACKING_AI_BALANCE.minimumIntentSpacing,
      );
      if (!conflict) break;
      const side = (intent.playerId + attempt) % 2 === 0 ? 1 : -1;
      target = {
        x: clamp(
          target.x + side * (ATTACKING_AI_BALANCE.minimumIntentSpacing + attempt * 1.4),
          4,
          96,
        ),
        y: clamp(target.y - direction * attempt * 1.2, 4, 96),
      };
    }
    placed.push({ ...intent, target });
  }
  return placed;
}

function directionProgress(situation: AttackingSituation, target: AttackingPoint): number {
  return situation.direction * (target.y - situation.carrier.position.y);
}

function getFacing(player: AttackingAiPlayer, direction: -1 | 1): AttackingPoint {
  if (player.facing && magnitude(player.facing) > 0.01) return normalize(player.facing);
  if (magnitude(player.velocity) > 0.2) return normalize(player.velocity);
  return { x: 0, y: direction };
}

function getTechnique(player: AttackingAiPlayer): number {
  return clamp(
    player.stats.technique ??
      player.stats.dribbling * 0.45 + player.stats.pass * 0.35 + player.stats.balance * 0.2,
    1,
    100,
  );
}

function getComposure(player: AttackingAiPlayer): number {
  return clamp(
    player.stats.composure ??
      player.stats.vision * 0.44 + player.stats.balance * 0.32 + player.stats.shoot * 0.24,
    1,
    100,
  );
}

function getHeading(player: AttackingAiPlayer): number {
  return clamp(
    player.stats.heading ??
      player.stats.shoot * 0.48 + player.stats.balance * 0.32 + player.stats.acceleration * 0.2,
    1,
    100,
  );
}

function getStaminaRatio(player: AttackingAiPlayer): number {
  const current = player.stamina <= 1 ? player.stamina : player.stamina / 100;
  const natural = clamp01(player.stats.stamina / 100);
  return clamp01(current * 0.72 + natural * 0.28);
}

function normalizeRole(role: string): "GK" | "CB" | "FB" | "CM" | "W" | "ST" {
  const value = role.toUpperCase();
  if (value.includes("GK")) return "GK";
  if (value.includes("CB")) return "CB";
  if (value.includes("LB") || value.includes("RB") || value.includes("WB") || value.includes("FB"))
    return "FB";
  if (value.includes("LW") || value.includes("RW") || value === "W") return "W";
  if (value.includes("ST") || value.includes("CF") || value.includes("FW")) return "ST";
  return "CM";
}

function pointSegmentProjection(point: AttackingPoint, start: AttackingPoint, end: AttackingPoint) {
  const segment = sub(end, start);
  const lengthSquared = dot(segment, segment);
  const t =
    lengthSquared <= 0.0001 ? 0 : clamp(dot(sub(point, start), segment) / lengthSquared, 0, 1);
  return { t, point: { x: start.x + segment.x * t, y: start.y + segment.y * t } };
}

function distance(left: AttackingPoint, right: AttackingPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function sub(left: AttackingPoint, right: AttackingPoint): AttackingPoint {
  return { x: left.x - right.x, y: left.y - right.y };
}

function dot(left: AttackingPoint, right: AttackingPoint): number {
  return left.x * right.x + left.y * right.y;
}

function magnitude(point: AttackingPoint): number {
  return Math.hypot(point.x, point.y);
}

function normalize(point: AttackingPoint): AttackingPoint {
  const length = magnitude(point);
  return length <= 0.0001 ? { x: 0, y: 0 } : { x: point.x / length, y: point.y / length };
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
