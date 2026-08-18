export type MatchSide = "home" | "away";

export type MatchFlowPhase =
  | "balanced"
  | "counter_attack"
  | "protect_lead"
  | "chase_game"
  | "all_out_attack";

export type MatchFlow = {
  phase: MatchFlowPhase;
  urgency: number;
  riskDelta: number;
  tempoDelta: number;
  directnessDelta: number;
  shootingPriorityDelta: number;
  pressingDelta: number;
  compactnessDelta: number;
  movementTempo: number;
  fatigueLoad: number;
};

export type MatchAttackingTactics = {
  risk: number;
  tempo: number;
  directness: number;
  compactness: number;
  shootingPriority: number;
  dribbleFrequency: number;
  carryDirectness: number;
  riskTolerance: number;
};

export type MatchDefensiveTactics = {
  defensiveLine: number;
  pressingIntensity: number;
  compactness: number;
  markingStyle: "zonal" | "man" | "hybrid";
  riskTolerance: number;
  counterPress: number;
};

export type MatchPassStyle =
  | "short"
  | "long"
  | "through"
  | "one_touch"
  | "one_two"
  | "cross"
  | "switch"
  | "cut_back"
  | "back"
  | "lob";

export type MatchActionKind = "pass" | "shot" | "carry" | "tackle";
export type MatchMovementIntensity = "rest" | "walk" | "jog" | "sprint";
export type MatchPoint = { x: number; y: number };
export type MatchPassPresentation = {
  durationMs: number;
  trajectory: MatchPoint[];
};

// Six minutes of active play plus cinematic and dead-ball pauses yields a
// compact mobile manager-mode presentation for every simulated match type.
export const MATCH_ACTIVE_DURATION_MS = 360_000;

const EMPTY_FLOW: Omit<MatchFlow, "phase"> = {
  urgency: 0,
  riskDelta: 0,
  tempoDelta: 0,
  directnessDelta: 0,
  shootingPriorityDelta: 0,
  pressingDelta: 0,
  compactnessDelta: 0,
  movementTempo: 1,
  fatigueLoad: 1,
};

/**
 * Produces a score- and clock-aware plan shared by every auto-simulated match.
 * The modifiers stay deliberately small until the closing stages so player
 * quality and the configured team tactics remain the main deciding factors.
 */
export function resolveMatchFlow(input: {
  side: MatchSide;
  minute: number;
  homeScore: number;
  awayScore: number;
  possessionTicks?: number;
  ball?: MatchPoint;
}): MatchFlow {
  const minute = clamp(input.minute, 0, 90);
  const ownScore = input.side === "home" ? input.homeScore : input.awayScore;
  const opponentScore = input.side === "home" ? input.awayScore : input.homeScore;
  const scoreDifference = ownScore - opponentScore;
  const lateFactor = smoothStep(55, 90, minute);
  const closingFactor = smoothStep(72, 90, minute);
  const direction = input.side === "home" ? -1 : 1;
  const ballProgress = input.ball ? clamp((50 + direction * (input.ball.y - 50)) / 100, 0, 1) : 0.5;
  const isTransition = Number(input.possessionTicks ?? 99) <= 7;

  if (scoreDifference < 0) {
    const deficit = Math.min(3, Math.abs(scoreDifference));
    const urgency = clamp(
      lateFactor * (0.46 + deficit * 0.22) + (deficit >= 2 ? smoothStep(38, 70, minute) * 0.2 : 0),
      0,
      1,
    );
    const allOut = (minute >= 78 && urgency >= 0.55) || (deficit >= 2 && minute >= 67);
    return {
      phase: allOut ? "all_out_attack" : "chase_game",
      urgency,
      riskDelta: 0.08 + urgency * 0.2,
      tempoDelta: 0.06 + urgency * 0.18,
      directnessDelta: 0.05 + urgency * 0.17,
      shootingPriorityDelta: 0.04 + urgency * 0.2,
      pressingDelta: 0.08 + urgency * 0.2,
      compactnessDelta: -urgency * 0.09,
      movementTempo: 1.02 + urgency * 0.08,
      fatigueLoad: 1.03 + urgency * 0.18,
    };
  }

  if (scoreDifference > 0 && minute >= 58) {
    const lead = Math.min(3, scoreDifference);
    const control = clamp(lateFactor * (0.5 + lead * 0.17), 0, 1);
    return {
      phase: "protect_lead",
      urgency: -control,
      riskDelta: -0.06 - control * 0.14,
      tempoDelta: -0.03 - control * 0.1,
      directnessDelta: -control * 0.05,
      shootingPriorityDelta: -control * 0.08,
      pressingDelta: -0.02 - control * 0.1,
      compactnessDelta: 0.05 + control * 0.12,
      movementTempo: 1 - control * 0.05,
      fatigueLoad: 1 - control * 0.12,
    };
  }

  if (isTransition && ballProgress >= 0.42) {
    const transitionStrength = clamp(0.35 + ballProgress * 0.45, 0, 0.8);
    return {
      phase: "counter_attack",
      urgency: transitionStrength * 0.45,
      riskDelta: transitionStrength * 0.07,
      tempoDelta: transitionStrength * 0.14,
      directnessDelta: transitionStrength * 0.17,
      shootingPriorityDelta: transitionStrength * 0.06,
      pressingDelta: transitionStrength * 0.04,
      compactnessDelta: -transitionStrength * 0.04,
      movementTempo: 1 + transitionStrength * 0.08,
      fatigueLoad: 1 + transitionStrength * 0.09,
    };
  }

  if (scoreDifference === 0 && minute >= 80) {
    const winnerPush = closingFactor * 0.32;
    return {
      phase: "chase_game",
      urgency: winnerPush,
      riskDelta: winnerPush * 0.3,
      tempoDelta: winnerPush * 0.34,
      directnessDelta: winnerPush * 0.25,
      shootingPriorityDelta: winnerPush * 0.32,
      pressingDelta: winnerPush * 0.25,
      compactnessDelta: -winnerPush * 0.08,
      movementTempo: 1 + winnerPush * 0.08,
      fatigueLoad: 1 + winnerPush * 0.1,
    };
  }

  return { phase: "balanced", ...EMPTY_FLOW };
}

export function applyMatchAttackingFlow(
  tactics: MatchAttackingTactics,
  flow: MatchFlow,
): MatchAttackingTactics {
  return {
    risk: clamp01(tactics.risk + flow.riskDelta),
    tempo: clamp01(tactics.tempo + flow.tempoDelta),
    directness: clamp01(tactics.directness + flow.directnessDelta),
    compactness: clamp01(tactics.compactness + flow.compactnessDelta),
    shootingPriority: clamp01(tactics.shootingPriority + flow.shootingPriorityDelta),
    dribbleFrequency: clamp01(
      tactics.dribbleFrequency + flow.tempoDelta * 0.16 + flow.directnessDelta * 0.12,
    ),
    carryDirectness: clamp01(tactics.carryDirectness + flow.directnessDelta * 0.72),
    riskTolerance: clamp01(tactics.riskTolerance + flow.riskDelta * 0.9),
  };
}

export function applyMatchDefensiveFlow(
  tactics: MatchDefensiveTactics,
  flow: MatchFlow,
): MatchDefensiveTactics {
  return {
    ...tactics,
    defensiveLine: clamp01(tactics.defensiveLine + flow.pressingDelta * 0.42),
    pressingIntensity: clamp01(tactics.pressingIntensity + flow.pressingDelta),
    compactness: clamp01(tactics.compactness + flow.compactnessDelta),
    riskTolerance: clamp01(tactics.riskTolerance + flow.riskDelta * 0.72),
    counterPress: clamp01(tactics.counterPress + flow.pressingDelta * 0.82),
  };
}

export function getMatchActionDurationMs(input: {
  kind: MatchActionKind;
  distance: number;
  style?: MatchPassStyle | string | null;
  hasSkill?: boolean;
  outcome?: "goal" | "save" | "catch" | "miss" | null;
}): number {
  const distance = clamp(input.distance, 0, 100);

  if (input.kind === "pass") {
    const styleMultiplier: Record<MatchPassStyle, number> = {
      short: 0.95,
      long: 1.14,
      through: 0.96,
      one_touch: 0.78,
      one_two: 0.82,
      cross: 1.12,
      switch: 1.2,
      cut_back: 0.86,
      back: 0.92,
      lob: 1.16,
    };
    const multiplier = styleMultiplier[input.style as MatchPassStyle] ?? 0.98;
    const skillMultiplier = input.hasSkill ? 0.9 : 1;
    return Math.round(clamp((440 + distance * 14) * multiplier * skillMultiplier, 420, 1_350));
  }

  if (input.kind === "shot") {
    const outcomeDelay = input.outcome === "save" ? 130 : input.outcome === "catch" ? 170 : 0;
    const skillMultiplier = input.hasSkill ? 0.92 : 1;
    return Math.round(clamp((500 + distance * 7 + outcomeDelay) * skillMultiplier, 480, 1_050));
  }

  if (input.kind === "carry") {
    const skillMultiplier = input.hasSkill ? 0.88 : 1;
    return Math.round(clamp((500 + distance * 28) * skillMultiplier, 520, 1_100));
  }

  const skillMultiplier = input.hasSkill ? 0.92 : 1;
  return Math.round(clamp((560 + distance * 13) * skillMultiplier, 560, 850));
}

/** Builds a deterministic top-down curve. Lofted passes bend more while quick
 * combinations stay nearly straight and reach the receiver sooner. */
export function buildMatchPassTrajectory(input: {
  from: MatchPoint;
  to: MatchPoint;
  style: MatchPassStyle | string;
  frames: number;
  curveSign?: number;
}): MatchPoint[] {
  const frames = Math.max(2, Math.floor(input.frames));
  const dx = input.to.x - input.from.x;
  const dy = input.to.y - input.from.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const perpendicular = { x: -dy / length, y: dx / length };
  const lofted = ["long", "lob", "cross", "switch"].includes(input.style);
  const quick = ["one_touch", "one_two", "cut_back"].includes(input.style);
  const bend = lofted ? clamp(length * 0.055, 0.8, 3.8) : quick ? 0.12 : 0.34;
  const sign = Math.sign(input.curveSign ?? 1) || 1;

  return Array.from({ length: frames }, (_, index) => {
    const progress = (index + 1) / frames;
    const travel = quick
      ? 1 - Math.pow(1 - progress, 1.45)
      : lofted
        ? progress * progress * (3 - 2 * progress)
        : 1 - Math.pow(1 - progress, 1.22);
    const curve = Math.sin(Math.PI * progress) * bend * sign;
    return {
      x: clamp(input.from.x + dx * travel + perpendicular.x * curve, 0, 100),
      y: clamp(input.from.y + dy * travel + perpendicular.y * curve, 0, 100),
    };
  });
}

export function getMatchPassPresentation(input: {
  from: MatchPoint;
  intendedTarget: MatchPoint;
  style: MatchPassStyle | string;
  frames: number;
  curveSign?: number;
  hasSkill?: boolean;
}): MatchPassPresentation {
  const intendedDistance = Math.hypot(
    input.intendedTarget.x - input.from.x,
    input.intendedTarget.y - input.from.y,
  );
  return {
    durationMs: getMatchActionDurationMs({
      kind: "pass",
      distance: intendedDistance,
      style: input.style,
      hasSkill: input.hasSkill,
    }),
    trajectory: buildMatchPassTrajectory({
      from: input.from,
      to: input.intendedTarget,
      style: input.style,
      frames: input.frames,
      curveSign: input.curveSign,
    }),
  };
}

/** Retargets only the outcome end of an already chosen pass. The original
 * release timing and curve are retained for interceptions and offside calls. */
export function retargetMatchTrajectory(
  trajectory: MatchPoint[],
  outcomeTarget: MatchPoint,
): MatchPoint[] {
  if (!trajectory.length) return [{ ...outcomeTarget }];
  const sourceEnd = trajectory[trajectory.length - 1];
  const correction = {
    x: outcomeTarget.x - sourceEnd.x,
    y: outcomeTarget.y - sourceEnd.y,
  };
  const divisor = Math.max(1, trajectory.length - 1);
  return trajectory.map((point, index) => {
    const progress = index / divisor;
    const correctionShare = progress * progress;
    return {
      x: clamp(point.x + correction.x * correctionShare, 0, 100),
      y: clamp(point.y + correction.y * correctionShare, 0, 100),
    };
  });
}

export function getDifficultPassDistancePenalty(style: string, distance: number): number {
  if (style === "cross") {
    return clamp01((distance - 20) / 45) * 0.1;
  }
  if (style === "long" || style === "switch" || style === "lob") {
    return clamp01((distance - 32) / 55) * 0.055;
  }
  return 0;
}

export function getMatchClockAdvanceSeconds(durationMs: number, clockFrozen: boolean): number {
  if (clockFrozen) return 0;
  return clamp(Number(durationMs) / 1000, 0.12, 3);
}

/** A snapshot contains the destination state for the action it presents, so
 * movement integrates using that snapshot's duration, bounded for stability. */
export function getMatchMovementDeltaSeconds(input: {
  durationMs: number;
  isOpenPlay: boolean;
  baseTickSeconds: number;
}): number {
  if (!input.isOpenPlay) return input.baseTickSeconds;
  return clamp((Number(input.durationMs) / 1000) * 0.72, 0.24, 0.9);
}

export function getMatchMovementIntensity(
  intent: string,
  movedDistance: number,
): MatchMovementIntensity {
  if (movedDistance <= 0.04) return "rest";
  if (["anchor", "hold_depth", "hold_line", "hold_width"].includes(intent)) return "walk";
  if (
    [
      "run",
      "press",
      "chase",
      "attack_space",
      "overlap",
      "underlap",
      "cut_inside",
      "track",
      "recover",
    ].includes(intent)
  ) {
    return "sprint";
  }
  return "jog";
}

export function updateMatchStamina(input: {
  current: number;
  natural: number;
  intensity: MatchMovementIntensity;
  elapsedSeconds: number;
  fatigueLoad?: number;
  halfTimeRecovery?: boolean;
}): number {
  const natural = clamp(input.natural, 1, 100);
  let current = clamp(input.current, Math.max(28, natural * 0.42), natural);

  if (input.halfTimeRecovery) {
    current = Math.min(natural, current + clamp(natural * 0.055, 2.8, 5.5));
  }

  const drainPerSecond: Record<MatchMovementIntensity, number> = {
    rest: -0.012,
    walk: 0.006,
    jog: 0.045,
    sprint: 0.105,
  };
  const enduranceFactor = clamp(1.12 - ((natural - 45) / 55) * 0.28, 0.82, 1.16);
  const load = clamp(input.fatigueLoad ?? 1, 0.72, 1.35);
  const drain =
    drainPerSecond[input.intensity] * clamp(input.elapsedSeconds, 0, 3) * enduranceFactor * load;
  const next = clamp(current - drain, Math.max(28, natural * 0.42), natural);
  return Number(next.toFixed(3));
}

export function getShotMovementAccuracyPenalty(input: {
  velocity: MatchPoint;
  balance: number;
  shotType: string;
}): number {
  const runningSpeed = Math.hypot(input.velocity.x, input.velocity.y);
  const speedRatio = clamp((runningSpeed - 1.8) / 9.2, 0, 1);
  const balanceRatio = clamp((input.balance - 45) / 55, 0, 1);
  const basePenalty = speedRatio * (0.12 - balanceRatio * 0.052);
  const typeMultiplier =
    input.shotType === "FIRST_TIME_SHOT" || input.shotType === "DESPERATE_SHOT"
      ? 0.42
      : input.shotType === "HEADER_SHOT"
        ? 0.3
        : input.shotType === "PLACED_SHOT"
          ? 1.08
          : input.shotType === "POWER_SHOT" || input.shotType === "KAISER_SHOT"
            ? 0.9
            : 1;

  return Number(clamp(basePenalty * typeMultiplier, 0, 0.12).toFixed(4));
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const progress = clamp((value - edge0) / Math.max(0.001, edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
