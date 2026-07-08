export const SIM_TICK_MS = 1000;
export const SIM_TICK_SECONDS = SIM_TICK_MS / 1000;
export const SIM_TICKS_PER_SECOND = 1000 / SIM_TICK_MS;

export const MOVEMENT = {
  walkingSpeed: 3.4,
  jogSpeed: 6.8,
  sprintSpeed: 10.2,

  playerWithBallSpeedMultiplier: 0.82,

  acceleration: 8.5,
  braking: 12,

  turnSmoothing: 0.42,

  arrivalRadius: 11,
  stopRadius: 0.8,

  separationRadius: 6,
  separationStrength: 1.4,

  sameTargetOffset: 4,

  passSpeed: 27,
  shotSpeed: 62,

  ballFriction: 10,

  ballControlRadius: 2.0,

  tacticalDeadZoneRadius: 4.2,
  supportDeadZoneRadius: 2.8,
  pressDeadZoneRadius: 1.1,
};

export type Vec2 = { x: number; y: number };
export type Side = "home" | "away";

export type PlayerAIState =
  | "IDLE"
  | "HOLD_POSITION"
  | "MOVE_TO_SPACE"
  | "PRESS_BALL"
  | "SUPPORT_ATTACK"
  | "MARK_OPPONENT"
  | "RECEIVE_PASS"
  | "DRIBBLE"
  | "PASS_SUPPORT"
  | "ATTACK_SPACE"
  | "OVERLAP"
  | "UNDERLAP"
  | "CUT_INSIDE"
  | "HOLD_WIDTH"
  | "HOLD_DEPTH"
  | "COVER_SPACE"
  | "MARK_MAN"
  | "TRACK_RUNNER"
  | "RECOVER_SHAPE"
  | "HOLD_LINE"
  | "RECOVER_DEFENSE"
  | "STAY_ONSIDE"
  | "CHECK_BACK_ONSIDE"
  | "CURVED_RUN"
  | "DELAY_RUN"
  | "ATTACK_SPACE_BEHIND"
  | "RUN_ON_SHOULDER"
  | "DIAGONAL_RUN"
  | "THIRD_MAN_RUN"
  | "BACK_POST_RUN"
  | "DROP_SHORT";

export type PlayerRole = "GK" | "CB" | "FB" | "DM" | "CM" | "W" | "ST";
export type TacticalPhase =
  | "IN_POSSESSION_BUILDUP"
  | "IN_POSSESSION_ATTACK"
  | "DEFENSIVE_PRESS"
  | "DEFENSIVE_BLOCK"
  | "TRANSITION_LOST_BALL"
  | "TRANSITION_WON_BALL";

export type Player = {
  id: number;
  teamId: number;
  side: Side;
  role: string;
  position: Vec2;
  velocity: Vec2;
  targetPosition: Vec2;
  homePosition: Vec2;
  state: PlayerAIState;
  stamina: number;
  hasBall: boolean;
  receivingPass?: boolean;
  markPlayerId?: number | null;
  stats?: {
    speed?: number;
    acceleration?: number;
    stamina?: number;
    dribbling?: number;
  };
};

export type Ball = {
  position: Vec2;
  velocity: Vec2;
  ownerPlayerId: number | null;
  intendedReceiverId?: number | null;
  targetPosition?: Vec2 | null;
  isLoose?: boolean;
};

export type TeamTactics = {
  pressure?: number;
  passRatio?: number;
  shotRatio?: number;
};

export type GameState = {
  tick: number;
  deltaTime: number;
  possession: Side;
  previousPossession?: Side | null;
  possessionTicks?: number;
  homePlayers: Player[];
  awayPlayers: Player[];
  ball: Ball;
  homeTactics?: TeamTactics;
  awayTactics?: TeamTactics;
};

type MovementDecision = { state: PlayerAIState; targetPosition: Vec2 };
type MovementContext = {
  teammates: Player[];
  opponents: Player[];
  owner: Player | null;
  hasPossession: boolean;
  role: PlayerRole;
  direction: number;
  ball: Vec2;
  ballVelocity: Vec2;
  tick: number;
  phase: TacticalPhase;
  possessionTicks: number;
  tactics: TeamTactics;
};

export function updateSimulation(deltaTime: number, gameState: GameState) {
  gameState.deltaTime = deltaTime;
  updateBall(gameState.ball, [...gameState.homePlayers, ...gameState.awayPlayers], deltaTime);

  const allPlayers = [...gameState.homePlayers, ...gameState.awayPlayers];
  allPlayers.forEach((player) => updatePlayerAI(player, gameState));

  applySameTargetOffsets(gameState.homePlayers);
  applySameTargetOffsets(gameState.awayPlayers);

  gameState.homePlayers.forEach((player) => {
    applySeparation(player, gameState.homePlayers);
    updatePlayerMovement(player, deltaTime);
  });
  gameState.awayPlayers.forEach((player) => {
    applySeparation(player, gameState.awayPlayers);
    updatePlayerMovement(player, deltaTime);
  });

  const owner = allPlayers.find((player) => player.id === gameState.ball.ownerPlayerId);
  if (owner) {
    followBallCarrier(gameState.ball, owner);
  }

  gameState.tick += 1;
}

export function updatePlayerAI(player: Player, gameState: GameState) {
  const tactical = getTacticalTarget(player, gameState);
  player.state = tactical.state;
  player.targetPosition = tactical.targetPosition;
}

export function updatePlayerMovement(player: Player, deltaTime: number) {
  const current = clampPoint(player.position);
  const target = clampPoint(player.targetPosition);
  const toTarget = sub(target, current);
  const distance = length(toTarget);

  if (distance < MOVEMENT.stopRadius) {
    player.position = target;
    player.velocity = scale(player.velocity, Math.max(0, 1 - MOVEMENT.braking * deltaTime));
    if (length(player.velocity) < 0.02) player.velocity = { x: 0, y: 0 };
    return;
  }

  const direction = distance > 0 ? scale(toTarget, 1 / distance) : { x: 0, y: 0 };
  const maxSpeed = getPlayerMaxSpeed(player);
  const arrivalScale = clamp(distance / MOVEMENT.arrivalRadius, 0.15, 1);
  const desiredVelocity = scale(direction, maxSpeed * arrivalScale);
  const smoothedDesired = lerpVec(player.velocity, desiredVelocity, MOVEMENT.turnSmoothing);
  const steering = clampVector(
    sub(smoothedDesired, player.velocity),
    getPlayerAcceleration(player) * deltaTime,
  );

  const nextVelocity = clampVector(add(player.velocity, steering), maxSpeed);
  const nextStep = scale(nextVelocity, deltaTime);

  if (length(nextStep) >= distance) {
    player.position = target;
    player.velocity = { x: 0, y: 0 };
    return;
  }

  player.velocity = nextVelocity;
  player.position = clampPoint(add(current, nextStep));
}

export function applySeparation(player: Player, teammates: Player[]) {
  const push = teammates.reduce<Vec2>(
    (acc, teammate) => {
      if (teammate.id === player.id) return acc;
      const away = sub(player.position, teammate.position);
      const dist = length(away);
      if (dist <= 0 || dist >= MOVEMENT.separationRadius) return acc;
      const strength =
        ((MOVEMENT.separationRadius - dist) / MOVEMENT.separationRadius) *
        MOVEMENT.separationStrength;
      return add(acc, scale(away, strength / dist));
    },
    { x: 0, y: 0 },
  );

  const separatedTarget = add(player.targetPosition, push);
  player.targetPosition = player.receivingPass
    ? clampPoint(separatedTarget)
    : clampToRoleZone(player, separatedTarget);
}

export function getTacticalTarget(
  player: Player,
  gameState: GameState,
): { state: PlayerAIState; targetPosition: Vec2 } {
  const allPlayers = [...gameState.homePlayers, ...gameState.awayPlayers];
  const owner = allPlayers.find((item) => item.id === gameState.ball.ownerPlayerId) ?? null;
  const phase = resolveTacticalPhase(player, gameState, owner);
  const context: MovementContext = {
    teammates: player.side === "home" ? gameState.homePlayers : gameState.awayPlayers,
    opponents: player.side === "home" ? gameState.awayPlayers : gameState.homePlayers,
    owner,
    hasPossession: gameState.possession === player.side,
    role: normalizeRole(player.role),
    direction: attackDirection(player.side),
    ball: gameState.ball.position,
    ballVelocity: gameState.ball.velocity,
    tick: gameState.tick,
    phase,
    possessionTicks: Math.max(1, Number(gameState.possessionTicks ?? 8)),
    tactics: player.side === "home" ? (gameState.homeTactics ?? {}) : (gameState.awayTactics ?? {}),
  };

  const decision =
    evaluateImmediateAction(player, gameState, context) ??
    evaluateBallRelatedAction(player, gameState, context) ??
    evaluateTacticalShape(player, context) ??
    evaluateSpaceOccupation(player, context) ??
    evaluateIdlePosition(player, context);

  return stabilizeMovementDecision(player, context, decision);
}

function evaluateImmediateAction(
  player: Player,
  gameState: GameState,
  context: MovementContext,
): MovementDecision | null {
  if (player.hasBall || context.owner?.id === player.id) {
    return evaluateBallCarrierIntent(player, context);
  }

  if (gameState.ball.intendedReceiverId === player.id) {
    return {
      state: "RECEIVE_PASS",
      targetPosition: predictBallIntercept(player, gameState.ball),
    };
  }

  return null;
}

function resolveTacticalPhase(
  player: Player,
  gameState: GameState,
  owner: Player | null,
): TacticalPhase {
  const possessionTicks = Math.max(1, Number(gameState.possessionTicks ?? 8));
  const possessionChanged =
    gameState.previousPossession != null && gameState.previousPossession !== gameState.possession;
  const hasPossession = gameState.possession === player.side;
  const direction = attackDirection(player.side);
  const ball = gameState.ball.position;

  if (possessionChanged && possessionTicks <= 5) {
    return hasPossession ? "TRANSITION_WON_BALL" : "TRANSITION_LOST_BALL";
  }

  if (hasPossession) {
    const ownerRole = owner?.side === player.side ? normalizeRole(owner.role) : null;
    const ballAdvance = direction < 0 ? 50 - ball.y : ball.y - 50;
    return ballAdvance >= 6 && ownerRole !== "GK" && ownerRole !== "CB"
      ? "IN_POSSESSION_ATTACK"
      : "IN_POSSESSION_BUILDUP";
  }

  const pressure =
    player.side === "home" ? gameState.homeTactics?.pressure : gameState.awayTactics?.pressure;
  const pressureBias = clamp(Number(pressure ?? 55) / 100, 0.2, 0.95);
  const danger = dangerLevel(player.side, ball.y);
  const ballCanBePressed = danger < 0.72 || pressureBias > 0.68;

  return ballCanBePressed ? "DEFENSIVE_PRESS" : "DEFENSIVE_BLOCK";
}

function evaluateBallCarrierIntent(player: Player, context: MovementContext): MovementDecision {
  const { role, direction, ball, tick, teammates, opponents } = context;
  const pressureDistance = getNearestOpponentDistance(player.position, opponents);
  const nearbyPressure = countNearbyOpponents(player.position, opponents, 8);
  const finalThird = isInFinalThird(player.side, ball.y);
  const forwardStep = finalThird ? 4.5 : 6.5;

  if (role === "FB") {
    const wideX = getWideLaneX(player);
    const halfSpaceX = wideX < 50 ? 30 : 70;
    const touchlineTrap = isNearTouchline(player.position.x) || nearbyPressure >= 2;
    const winger =
      teammates.find((item) => {
        const itemRole = normalizeRole(item.role);
        return itemRole === "W" && isSameFlank(item.homePosition.x, player.homePosition.x);
      }) ?? null;
    const wingerHoldsWidth = winger ? Math.abs(winger.position.x - wideX) <= 10 : false;
    const wingerInside = winger ? Math.abs(winger.position.x - wideX) > 13 : false;

    if (touchlineTrap || wingerHoldsWidth) {
      return {
        state: "UNDERLAP",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.position.x, halfSpaceX, 0.72),
          y: player.position.y + direction * forwardStep,
        }),
      };
    }

    if (wingerInside && !finalThird) {
      return {
        state: "OVERLAP",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.position.x, wideX, 0.5),
          y: player.position.y + direction * 7,
        }),
      };
    }

    return {
      state: finalThird || pressureDistance < 5 ? "PASS_SUPPORT" : "UNDERLAP",
      targetPosition: clampToRoleZone(player, {
        x: lerp(player.position.x, halfSpaceX, finalThird ? 0.62 : 0.48),
        y: player.position.y + direction * (finalThird ? 2.5 : 5.5),
      }),
    };
  }

  if (role === "W") {
    const wideX = getWideLaneX(player);
    const halfSpaceX = wideX < 50 ? 32 : 68;
    const insideChannelX = wideX < 50 ? 40 : 60;
    const variant = (tick + player.id) % 5;

    if (isNearTouchline(player.position.x) || nearbyPressure >= 2) {
      return {
        state: nearbyPressure >= 2 ? "PASS_SUPPORT" : "CUT_INSIDE",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.position.x, halfSpaceX, 0.78),
          y: player.position.y + direction * (finalThird ? 2.5 : 5.5),
        }),
      };
    }

    if (finalThird && Math.abs(player.position.x - 50) <= 22) {
      return {
        state: "ATTACK_SPACE",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.position.x, insideChannelX, 0.45),
          y: player.position.y + direction * 4,
        }),
      };
    }

    if (variant === 0 && !finalThird) {
      return {
        state: "HOLD_WIDTH",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.position.x, wideX, 0.36),
          y: player.position.y + direction * 4,
        }),
      };
    }

    return {
      state: "CUT_INSIDE",
      targetPosition: clampToRoleZone(player, {
        x: lerp(player.position.x, halfSpaceX, 0.58),
        y: player.position.y + direction * forwardStep,
      }),
    };
  }

  if (role === "ST") {
    return {
      state: finalThird ? "ATTACK_SPACE" : "PASS_SUPPORT",
      targetPosition: clampToRoleZone(player, {
        x: lerp(player.position.x, 50, 0.25),
        y: player.position.y + direction * (finalThird ? 4.2 : 2.8),
      }),
    };
  }

  if (role === "DM") {
    return {
      state: "HOLD_DEPTH",
      targetPosition: clampToRoleZone(player, {
        x: lerp(player.position.x, 50, 0.22),
        y: ball.y - direction * 9,
      }),
    };
  }

  if (role === "CM") {
    return {
      state: pressureDistance <= 5 ? "PASS_SUPPORT" : "DRIBBLE",
      targetPosition: clampToRoleZone(player, {
        x: player.position.x + clamp((50 - player.position.x) * 0.16, -2.5, 2.5),
        y: player.position.y + direction * 5,
      }),
    };
  }

  return {
    state: "DRIBBLE",
    targetPosition: clampToRoleZone(player, {
      x: player.position.x + clamp((50 - player.position.x) * 0.08, -1.4, 1.4),
      y: player.position.y + direction * 5,
    }),
  };
}

function evaluateBallRelatedAction(
  player: Player,
  gameState: GameState,
  context: MovementContext,
): MovementDecision | null {
  const canChaseLooseBall =
    gameState.ball.ownerPlayerId == null &&
    gameState.ball.intendedReceiverId == null &&
    gameState.ball.isLoose;

  if (canChaseLooseBall && isNearestViableBallChaser(player, context.teammates, context.ball)) {
    return {
      state: "PRESS_BALL",
      targetPosition: predictBallIntercept(player, gameState.ball),
    };
  }

  if (!context.hasPossession && context.phase === "TRANSITION_LOST_BALL") {
    if (isCounterPresser(player, context)) {
      return { state: "PRESS_BALL", targetPosition: getCounterPressTarget(player, context) };
    }

    if (isCounterPressCover(player, context)) {
      return { state: "COVER_SPACE", targetPosition: getCounterPressCoverTarget(player, context) };
    }
  }

  if (
    !context.hasPossession &&
    ((context.phase === "DEFENSIVE_PRESS" &&
      isDesignatedPresser(player, context.teammates, context.ball)) ||
      isBallInDefensiveResponsibilityZone(player, context.ball))
  ) {
    return { state: "PRESS_BALL", targetPosition: getPressTarget(player, context.ball) };
  }

  return null;
}

function evaluateTacticalShape(player: Player, context: MovementContext): MovementDecision | null {
  if (context.hasPossession) return evaluateAttackingShape(player, context);
  return evaluateDefensiveShape(player, context);
}

function evaluateAttackingShape(player: Player, context: MovementContext): MovementDecision | null {
  const { role, direction, ball, teammates } = context;

  if (role === "GK") {
    return {
      state: "HOLD_DEPTH",
      targetPosition: clampToRoleZone(player, {
        x: lerp(player.homePosition.x, ball.x, 0.08),
        y: ownGoalY(player.side) - direction * 3,
      }),
    };
  }

  if (role === "CB") {
    const backLine = teammates
      .filter((item) => {
        const itemRole = normalizeRole(item.role);
        return itemRole === "CB" || itemRole === "FB";
      })
      .sort((left, right) => left.homePosition.x - right.homePosition.x);
    const lineShiftX = getDefensiveUnitShiftX(ball) * 0.65;
    const lineDepth = getAttackingBackLineDepth(player.side, ball, backLine);
    const lineCover = getBackLineCoverOffset(player, backLine);
    return {
      state: "HOLD_LINE",
      targetPosition: applyTeamSpacing(
        player,
        teammates,
        clampToRoleZone(player, {
          x: getCentralLaneX(player) + lineShiftX + lineCover,
          y: lineDepth,
        }),
      ),
    };
  }

  if (role === "DM") {
    return {
      state: "HOLD_DEPTH",
      targetPosition: applyTeamSpacing(
        player,
        teammates,
        clampToRoleZone(player, {
          x: lerp(getCentralLaneX(player), ball.x, 0.2),
          y: ball.y - direction * 10,
        }),
      ),
    };
  }

  if (role === "FB") {
    const support = getFullbackSupportTarget(player, context);
    return {
      state: support.state,
      targetPosition: clampToRoleZone(player, support.targetPosition),
    };
  }

  return null;
}

function getFullbackSupportTarget(
  player: Player,
  context: MovementContext,
): { state: PlayerAIState; targetPosition: Vec2 } {
  const { ball, direction, teammates, tick } = context;
  const sameFlank = isSameFlank(player.homePosition.x, ball.x);
  const wideX = getWideLaneX(player);
  const halfSpaceX = wideX < 50 ? 30 : 70;
  const winger =
    teammates.find(
      (item) =>
        normalizeRole(item.role) === "W" && isSameFlank(item.homePosition.x, player.homePosition.x),
    ) ?? null;
  const wingerInside = winger ? Math.abs(winger.position.x - wideX) > 13 : false;
  const wingerWide = winger ? Math.abs(winger.position.x - wideX) <= 12 : false;
  const finalThird = isInFinalThird(player.side, ball.y);
  const phasePush = context.phase === "IN_POSSESSION_ATTACK" ? 1 : 0.72;

  if (!sameFlank) {
    return {
      state: "HOLD_DEPTH",
      targetPosition: {
        x: lerp(player.homePosition.x, 50, 0.28),
        y: player.homePosition.y + direction * (9 + phasePush * 3),
      },
    };
  }

  if (wingerWide || ((tick + player.id) % 4 === 1 && !wingerInside)) {
    return {
      state: "UNDERLAP",
      targetPosition: {
        x: lerp(player.homePosition.x, halfSpaceX, 0.72),
        y: ball.y + direction * (finalThird ? 3.5 : 10),
      },
    };
  }

  return {
    state: "OVERLAP",
    targetPosition: {
      x: lerp(player.homePosition.x, wideX, finalThird ? 0.34 : 0.58),
      y: ball.y + direction * (finalThird ? 2.5 : 12),
    },
  };
}

function getWingerAttackState(player: Player, context: MovementContext): PlayerAIState {
  const sameFlank = isSameFlank(player.homePosition.x, context.ball.x);
  if (!sameFlank)
    return isInFinalThird(player.side, context.ball.y) ? "ATTACK_SPACE" : "HOLD_WIDTH";
  if (isNearTouchline(player.position.x)) return "CUT_INSIDE";
  return (context.tick + player.id) % 4 === 0 ? "HOLD_WIDTH" : "ATTACK_SPACE";
}

function evaluateDefensiveShape(player: Player, context: MovementContext): MovementDecision | null {
  const { role, direction, teammates, opponents, owner } = context;
  if (role === "CB" || role === "FB") {
    const lineDecision = getBackLineCohesionDecision(player, context);
    if (lineDecision) return lineDecision;
  }

  const markingDecision = getPriorityMarkingDecision(player, context);
  if (markingDecision && (role === "DM" || role === "CM" || role === "W")) {
    return markingDecision;
  }

  if (role === "DM" || role === "CM") {
    return {
      state: context.phase === "DEFENSIVE_PRESS" ? "COVER_SPACE" : "RECOVER_SHAPE",
      targetPosition: applyTeamSpacing(
        player,
        teammates,
        clampToRoleZone(player, getMidfieldDefensiveSpace(player, context)),
      ),
    };
  }

  if (role === "W") {
    return {
      state: context.phase === "DEFENSIVE_PRESS" ? "COVER_SPACE" : "TRACK_RUNNER",
      targetPosition: clampToRoleZone(player, getWingerDefensiveSpace(player, context)),
    };
  }

  if (role === "ST") {
    return {
      state: context.phase === "DEFENSIVE_PRESS" ? "PRESS_BALL" : "COVER_SPACE",
      targetPosition: clampToRoleZone(player, getStrikerDefensiveScreen(player, context)),
    };
  }

  const mark = findMarkAssignment(player, teammates, opponents, owner);
  if (!mark || role === "GK") return null;

  const markHasBall = owner?.id === mark.id;
  const pressureWeight = markHasBall ? 0.55 : role === "CB" ? 0.28 : 0.18;
  const coverGoalSide = {
    x: lerp(mark.position.x, getCentralLaneX(player), pressureWeight),
    y: mark.position.y - direction * getMarkGoalSideGap(role),
  };

  return {
    state: "MARK_MAN",
    targetPosition: applyTeamSpacing(player, teammates, clampToRoleZone(player, coverGoalSide)),
  };
}

function evaluateSpaceOccupation(
  player: Player,
  context: MovementContext,
): MovementDecision | null {
  if (!context.hasPossession) return null;

  const { role, direction, ball, teammates } = context;

  if (role === "W") {
    return {
      state: getWingerAttackState(player, context),
      targetPosition: clampToRoleZone(player, getWingerAttackingSpace(player, context)),
    };
  }

  if (role === "ST") {
    return {
      state: "ATTACK_SPACE",
      targetPosition: clampToRoleZone(player, getStrikerAttackingSpace(player, context)),
    };
  }

  return {
    state: "PASS_SUPPORT",
    targetPosition: applyTeamSpacing(
      player,
      teammates,
      clampToRoleZone(player, getMidfieldAttackingSpace(player, context)),
    ),
  };
}

function evaluateIdlePosition(player: Player, context: MovementContext): MovementDecision {
  const { role, direction, ball, teammates } = context;
  return {
    state: context.hasPossession ? "PASS_SUPPORT" : "RECOVER_SHAPE",
    targetPosition: applyTeamSpacing(
      player,
      teammates,
      clampToRoleZone(player, {
        x: lerp(getCentralLaneX(player), ball.x, role === "GK" ? 0.08 : 0.2),
        y: player.homePosition.y - direction * getRecoveryDrop(role),
      }),
    ),
  };
}

function stabilizeMovementDecision(
  player: Player,
  context: MovementContext,
  decision: MovementDecision,
): MovementDecision {
  if (isHighCommitmentState(decision.state)) {
    return {
      ...decision,
      targetPosition: applyTargetDeadZone(player, decision.targetPosition, decision.state),
    };
  }

  const zone = getTacticalAnchorZone(player, context);
  const usefulPosition = isUsefulInsideZone(player, context, zone);
  if (usefulPosition && isSettledEnoughForMicroAdjustment(player, context, decision, zone)) {
    const microTarget = getMicroAdjustmentTarget(player, context, zone);
    return {
      ...decision,
      state: getSettledState(decision.state),
      targetPosition: microTarget,
    };
  }

  const zoneTarget = getTacticalZoneCenter(zone);
  const teamShapeTarget = getShapePreservingTarget(player, context, zone);
  const roleIntentTarget = clampToTacticalZone(decision.targetPosition, zone);
  const ballActionTarget = clampToTacticalZone(decision.targetPosition, zone);
  const contextualTarget = combineMovementTargets([
    { target: zoneTarget, weight: 0.24 },
    { target: teamShapeTarget, weight: 0.34 },
    { target: roleIntentTarget, weight: 0.3 },
    {
      target: ballActionTarget,
      weight: getBallActionPriorityWeight(player, context, decision.state),
    },
  ]);
  const cappedTarget = capTacticalTargetStep(
    player,
    clampToTacticalZone(contextualTarget, zone),
    getMaxTacticalAdjustmentPerTick(player, context, decision),
  );
  const targetPosition = applyTargetDeadZone(player, cappedTarget, decision.state);

  return { ...decision, targetPosition };
}

function isHighCommitmentState(state: PlayerAIState) {
  return (
    state === "DRIBBLE" ||
    state === "RECEIVE_PASS" ||
    state === "PRESS_BALL" ||
    state === "OVERLAP" ||
    state === "UNDERLAP" ||
    state === "CUT_INSIDE" ||
    state === "ATTACK_SPACE"
  );
}

function getSettledState(state: PlayerAIState): PlayerAIState {
  if (
    state === "PASS_SUPPORT" ||
    state === "ATTACK_SPACE" ||
    state === "OVERLAP" ||
    state === "UNDERLAP" ||
    state === "CUT_INSIDE" ||
    state === "HOLD_WIDTH" ||
    state === "HOLD_DEPTH" ||
    state === "COVER_SPACE" ||
    state === "MARK_MAN" ||
    state === "TRACK_RUNNER" ||
    state === "RECOVER_SHAPE" ||
    state === "HOLD_LINE" ||
    state === "MOVE_TO_SPACE"
  ) {
    return state;
  }

  return "HOLD_POSITION";
}

function applyTargetDeadZone(player: Player, target: Vec2, state: PlayerAIState) {
  const radius =
    state === "PRESS_BALL"
      ? MOVEMENT.pressDeadZoneRadius
      : state === "HOLD_LINE" ||
          state === "COVER_SPACE" ||
          state === "RECOVER_SHAPE" ||
          state === "MARK_MAN" ||
          state === "TRACK_RUNNER" ||
          state === "HOLD_DEPTH"
        ? 1.25
        : state === "MOVE_TO_SPACE" ||
            state === "SUPPORT_ATTACK" ||
            state === "PASS_SUPPORT" ||
            state === "ATTACK_SPACE" ||
            state === "OVERLAP" ||
            state === "UNDERLAP" ||
            state === "CUT_INSIDE"
          ? MOVEMENT.supportDeadZoneRadius
          : MOVEMENT.tacticalDeadZoneRadius;

  if (distance(player.position, target) <= radius) {
    return player.position;
  }

  const previousTarget = player.targetPosition ?? player.position;
  if (distance(previousTarget, target) <= radius * 0.75) {
    return previousTarget;
  }

  return target;
}

function getTacticalAnchorZone(
  player: Player,
  context: MovementContext,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const role = normalizeRole(player.role);
  const roleX = getRoleXBounds(player, role);
  const roleY = getRoleYBounds(player.side, role);
  const shiftX = context.hasPossession
    ? clamp((context.ball.x - 50) * 0.12, -5, 5)
    : getDefensiveUnitShiftX(context.ball);
  const depthShift = context.hasPossession
    ? context.direction * getAttackDepthShift(role, context.ball, player)
    : -context.direction * getDefenseDepthShift(role, context.ball, player);
  const phaseDepthShift = context.direction * getPhaseDepthShift(role, context);
  const width = getZoneWidth(role);
  const depth = getZoneDepth(role);
  const centerX = clamp(player.homePosition.x + shiftX, roleX.min, roleX.max);
  const centerY = clamp(player.homePosition.y + depthShift + phaseDepthShift, roleY.min, roleY.max);

  return {
    minX: Math.max(roleX.min, centerX - width),
    maxX: Math.min(roleX.max, centerX + width),
    minY: Math.max(roleY.min, centerY - depth),
    maxY: Math.min(roleY.max, centerY + depth),
  };
}

function isUsefulInsideZone(
  player: Player,
  context: MovementContext,
  zone: { minX: number; maxX: number; minY: number; maxY: number },
) {
  if (!isInsideZone(player.position, zone)) return false;

  const role = normalizeRole(player.role);
  if (!context.hasPossession && (role === "CB" || role === "FB")) {
    return preservesBackLineSpacing(player, context.teammates);
  }

  if (role === "DM" || role === "CM") {
    return hasUsefulMidfieldAngle(player, context);
  }

  if (role === "W") {
    return Math.abs(player.position.x - 50) >= 24 || isSameFlank(player.position.x, context.ball.x);
  }

  if (role === "ST") {
    return distance(player.position, context.ball) >= 10;
  }

  return true;
}

function isSettledEnoughForMicroAdjustment(
  player: Player,
  context: MovementContext,
  decision: MovementDecision,
  zone: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const role = normalizeRole(player.role);
  const shapeTarget = getShapePreservingTarget(player, context, zone);
  const roleTarget = clampToTacticalZone(decision.targetPosition, zone);
  const previousTarget = player.targetPosition ?? player.position;
  const shapeGap = distance(player.position, shapeTarget);
  const roleGap = distance(player.position, roleTarget);
  const targetShift = distance(previousTarget, roleTarget);
  const settleRadius =
    role === "CB"
      ? 1.25
      : role === "FB"
        ? 1.6
        : role === "DM" || role === "CM"
          ? 1.9
          : MOVEMENT.supportDeadZoneRadius;

  return shapeGap <= settleRadius && roleGap <= settleRadius && targetShift <= settleRadius;
}

function getShapePreservingTarget(
  player: Player,
  context: MovementContext,
  zone: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const role = normalizeRole(player.role);
  const center = {
    x: (zone.minX + zone.maxX) / 2,
    y: (zone.minY + zone.maxY) / 2,
  };

  if (!context.hasPossession && (role === "CB" || role === "FB")) {
    return clampToTacticalZone(
      {
        x: player.homePosition.x + getDefensiveUnitShiftX(context.ball),
        y: getDefensiveLineDepth(
          player.side,
          context.ball,
          context.teammates.filter((item) => {
            const itemRole = normalizeRole(item.role);
            return itemRole === "CB" || itemRole === "FB";
          }),
          context.ballVelocity,
        ),
      },
      zone,
    );
  }

  if (role === "W" && context.hasPossession) {
    const sameFlank = isSameFlank(player.homePosition.x, context.ball.x);
    const laneX = sameFlank ? (getWideLaneX(player) < 50 ? 30 : 70) : getWideLaneX(player);
    return clampToTacticalZone({ x: laneX, y: center.y }, zone);
  }

  if (role === "W") {
    return clampToTacticalZone({ x: getWideLaneX(player), y: center.y }, zone);
  }

  return center;
}

function getTacticalZoneCenter(zone: { minX: number; maxX: number; minY: number; maxY: number }) {
  return {
    x: (zone.minX + zone.maxX) / 2,
    y: (zone.minY + zone.maxY) / 2,
  };
}

function combineMovementTargets(items: Array<{ target: Vec2; weight: number }>) {
  const totalWeight = items.reduce((total, item) => total + Math.max(0, item.weight), 0);
  if (totalWeight <= 0) return items[0]?.target ?? { x: 50, y: 50 };

  return items.reduce<Vec2>(
    (acc, item) => {
      const weight = Math.max(0, item.weight) / totalWeight;
      return {
        x: acc.x + item.target.x * weight,
        y: acc.y + item.target.y * weight,
      };
    },
    { x: 0, y: 0 },
  );
}

function getBallActionPriorityWeight(
  player: Player,
  context: MovementContext,
  state: PlayerAIState,
) {
  if (
    state === "PRESS_BALL" ||
    state === "RECEIVE_PASS" ||
    state === "DRIBBLE" ||
    state === "OVERLAP" ||
    state === "UNDERLAP" ||
    state === "CUT_INSIDE" ||
    state === "ATTACK_SPACE"
  ) {
    return 0.7;
  }

  const gap = distance(player.position, context.ball);
  const sameFlank = isSameFlank(player.homePosition.x, context.ball.x);
  if (gap <= 12) return 0.28;
  if (gap <= 28) return sameFlank ? 0.13 : 0.08;
  if (gap <= 46 && sameFlank) return 0.04;
  return isCollectiveShapeState(state) ? 0.05 : 0;
}

function getMicroAdjustmentTarget(
  player: Player,
  context: MovementContext,
  zone: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const shapeTarget = getShapePreservingTarget(player, context, zone);
  const spacingVector = getSpacingAdjustmentVector(player, context.teammates, context.opponents);
  const laneVector = getPassingLaneAdjustmentVector(player, context);
  const pulse = {
    x: Math.sin((context.tick + player.id * 5) * 0.37) * 0.35,
    y: Math.cos((context.tick + player.id * 3) * 0.31) * 0.35,
  };
  const desired = add(
    add(scale(sub(shapeTarget, player.position), 0.22), spacingVector),
    add(laneVector, pulse),
  );
  const desiredLength = length(desired);
  const role = normalizeRole(player.role);
  const minStep = role === "GK" ? 0 : 0.45;
  const maxStep = context.hasPossession ? 1.8 : 1.4;
  const step =
    desiredLength < 0.08
      ? { x: pulse.x, y: pulse.y }
      : scale(desired, clamp(desiredLength, minStep, maxStep) / desiredLength);

  return clampToTacticalZone(add(player.position, step), zone);
}

function getMaxTacticalAdjustmentPerTick(
  player: Player,
  context: MovementContext,
  decision: MovementDecision,
) {
  const relevance = getTacticalRelevance(player, context);
  if (decision.state === "MOVE_TO_SPACE" || decision.state === "ATTACK_SPACE") {
    return lerp(2.4, 5.2, relevance);
  }
  if (
    decision.state === "SUPPORT_ATTACK" ||
    decision.state === "PASS_SUPPORT" ||
    decision.state === "OVERLAP" ||
    decision.state === "UNDERLAP" ||
    decision.state === "CUT_INSIDE"
  ) {
    return lerp(1.8, 4.6, relevance);
  }
  if (
    decision.state === "MARK_OPPONENT" ||
    decision.state === "MARK_MAN" ||
    decision.state === "TRACK_RUNNER" ||
    decision.state === "COVER_SPACE" ||
    decision.state === "RECOVER_SHAPE" ||
    decision.state === "RECOVER_DEFENSE"
  ) {
    return lerp(0.8, 3.2, relevance);
  }
  return lerp(0.5, 2.5, relevance);
}

function getTacticalRelevance(player: Player, context: MovementContext) {
  const ballGap = distance(player.position, context.ball);
  const sameSide = isSameFlank(player.homePosition.x, context.ball.x);
  const nearestTeammateGap = getNearestGap(player, context.teammates);
  const nearestOpponentGap = getNearestGap(player, context.opponents);
  const proximity = ballGap <= 14 ? 1 : ballGap >= 58 ? 0.34 : 1 - (ballGap - 14) / 66;
  const sideWeight = sameSide ? 0.22 : 0;
  const pressureWeight = nearestOpponentGap <= 10 ? 0.18 : 0;
  const supportWeight = nearestTeammateGap <= 14 ? 0.08 : 0;
  const role = normalizeRole(player.role);
  const shapeFloor =
    role === "CB" || role === "FB" ? 0.42 : role === "DM" || role === "CM" ? 0.36 : 0.28;

  return clamp(proximity * 0.64 + sideWeight + pressureWeight + supportWeight, shapeFloor, 1);
}

function isCollectiveShapeState(state: PlayerAIState) {
  return (
    state === "HOLD_LINE" ||
    state === "COVER_SPACE" ||
    state === "RECOVER_SHAPE" ||
    state === "RECOVER_DEFENSE" ||
    state === "MARK_MAN" ||
    state === "TRACK_RUNNER" ||
    state === "PASS_SUPPORT" ||
    state === "HOLD_DEPTH" ||
    state === "HOLD_WIDTH"
  );
}

function capTacticalTargetStep(player: Player, target: Vec2, maxStep: number) {
  const delta = sub(target, player.position);
  const gap = length(delta);
  if (gap <= maxStep || gap <= 0) return target;
  return add(player.position, scale(delta, maxStep / gap));
}

function getSpacingAdjustmentVector(player: Player, teammates: Player[], opponents: Player[]) {
  const teammatePush = teammates.reduce<Vec2>(
    (acc, teammate) => {
      if (teammate.id === player.id) return acc;
      const away = sub(player.position, teammate.position);
      const gap = length(away);
      if (gap <= 0 || gap >= 11) return acc;
      return add(acc, scale(away, (11 - gap) / 11 / gap));
    },
    { x: 0, y: 0 },
  );
  const opponentAwareness = opponents.reduce<Vec2>(
    (acc, opponent) => {
      const away = sub(player.position, opponent.position);
      const gap = length(away);
      if (gap <= 0 || gap >= 8) return acc;
      return add(acc, scale(away, (8 - gap) / 8 / gap));
    },
    { x: 0, y: 0 },
  );

  return clampVector(add(scale(teammatePush, 0.65), scale(opponentAwareness, 0.35)), 0.9);
}

function getPassingLaneAdjustmentVector(player: Player, context: MovementContext) {
  const role = normalizeRole(player.role);
  const owner = context.owner;
  if (!owner || owner.id === player.id || role === "GK" || owner.side !== player.side) {
    return { x: 0, y: 0 };
  }

  const carrierToPlayer = sub(player.position, owner.position);
  const gap = length(carrierToPlayer);
  if (gap <= 0 || gap >= 34) return { x: 0, y: 0 };

  const forward = { x: 0, y: context.direction };
  const angle = angleBetween(carrierToPlayer, forward);
  if (angle >= 0.45 && angle <= 2.55) return { x: 0, y: 0 };

  const side = player.position.x < owner.position.x ? -1 : 1;
  return {
    x: side * 0.65,
    y: -context.direction * 0.25,
  };
}

function getNearestGap(player: Player, others: Player[]) {
  const nearest = others
    .filter((item) => item.id !== player.id)
    .map((item) => distance(player.position, item.position))
    .sort((left, right) => left - right)[0];

  return nearest ?? 100;
}

function clampToTacticalZone(
  target: Vec2,
  zone: { minX: number; maxX: number; minY: number; maxY: number },
) {
  return {
    x: clamp(target.x, zone.minX, zone.maxX),
    y: clamp(target.y, zone.minY, zone.maxY),
  };
}

function isInsideZone(
  point: Vec2,
  zone: { minX: number; maxX: number; minY: number; maxY: number },
) {
  return (
    point.x >= zone.minX && point.x <= zone.maxX && point.y >= zone.minY && point.y <= zone.maxY
  );
}

function getZoneWidth(role: PlayerRole) {
  if (role === "GK") return 5;
  if (role === "CB") return 7;
  if (role === "FB" || role === "W") return 8;
  if (role === "DM" || role === "CM") return 10;
  return 9;
}

function getZoneDepth(role: PlayerRole) {
  if (role === "GK") return 3;
  if (role === "CB") return 5;
  if (role === "FB") return 7;
  if (role === "DM" || role === "CM") return 8;
  if (role === "W") return 10;
  return 9;
}

function getAttackDepthShift(role: PlayerRole, ball: Vec2, player: Player) {
  const ballAdvance = attackDirection(player.side) < 0 ? 50 - ball.y : ball.y - 50;
  const base = clamp(ballAdvance * 0.2, -4, 14);
  if (role === "CB") return clamp(base * 0.8, -3, 10);
  if (role === "FB") return clamp(base * 1.05, -3, 13);
  if (role === "DM") return clamp(base * 0.8, -3, 9);
  if (role === "W" || role === "ST") return clamp(base * 1.12, -4, 13);
  return base;
}

function getDefenseDepthShift(role: PlayerRole, ball: Vec2, player: Player) {
  const danger = attackDirection(player.side) < 0 ? ball.y - 50 : 50 - ball.y;
  const base = clamp(danger * 0.16, -4, 11);
  if (role === "ST") return clamp(base * 0.35, -2, 4);
  if (role === "W" || role === "CM") return clamp(base * 0.72, -3, 8);
  if (role === "CB" || role === "FB") return clamp(base * 0.58, -3, 7);
  return base;
}

function getPhaseDepthShift(role: PlayerRole, context: MovementContext) {
  if (context.phase === "IN_POSSESSION_ATTACK") {
    if (role === "CB") return 4.5;
    if (role === "FB") return 6;
    if (role === "DM") return 3.5;
    if (role === "CM") return 4;
    return 2;
  }

  if (context.phase === "IN_POSSESSION_BUILDUP") {
    if (role === "CB" || role === "FB") return 2;
    if (role === "DM" || role === "CM") return 1.5;
    return 0;
  }

  if (context.phase === "DEFENSIVE_PRESS" || context.phase === "TRANSITION_LOST_BALL") {
    if (role === "CB") return 2.5;
    if (role === "FB" || role === "DM" || role === "CM") return 2;
    if (role === "W" || role === "ST") return 1;
  }

  if (context.phase === "DEFENSIVE_BLOCK") {
    if (role === "ST") return -1.5;
    if (role === "W" || role === "CM") return -1;
  }

  return 0;
}

function preservesBackLineSpacing(player: Player, teammates: Player[]) {
  const backLine = teammates
    .filter((item) => {
      const role = normalizeRole(item.role);
      return role === "CB" || role === "FB";
    })
    .sort((left, right) => left.homePosition.x - right.homePosition.x);
  const index = backLine.findIndex((item) => item.id === player.id);
  if (index < 0) return true;

  const left = index > 0 ? backLine[index - 1] : null;
  const right = index < backLine.length - 1 ? backLine[index + 1] : null;
  const stableLeft =
    !left ||
    Math.abs(
      Math.abs(player.position.x - left.position.x) -
        Math.abs(player.homePosition.x - left.homePosition.x),
    ) <= 7;
  const stableRight =
    !right ||
    Math.abs(
      Math.abs(right.position.x - player.position.x) -
        Math.abs(right.homePosition.x - player.homePosition.x),
    ) <= 7;

  return stableLeft && stableRight;
}

function hasUsefulMidfieldAngle(player: Player, context: MovementContext) {
  const owner = context.owner;
  if (!owner || owner.side !== player.side) {
    return distance(player.position, context.ball) >= 8;
  }

  const passingAngle = Math.abs(
    angleBetween(sub(player.position, owner.position), { x: 0, y: context.direction }),
  );
  return distance(player.position, owner.position) >= 8 && passingAngle >= 0.35;
}

export function predictBallIntercept(player: Player, ball: Ball): Vec2 {
  if (ball.ownerPlayerId != null) return ball.position;
  if (ball.targetPosition) return clampPoint(ball.targetPosition);

  const relative = sub(ball.position, player.position);
  const ballSpeed = Math.max(0.01, length(ball.velocity));
  const playerSpeed = Math.max(0.1, getPlayerMaxSpeed(player));
  const timeToReachBallNow = length(relative) / playerSpeed;
  const predictionTime = clamp(timeToReachBallNow * 0.72, 0.15, 1.8);
  const projected = add(
    ball.position,
    scale(ball.velocity, Math.min(predictionTime, 45 / ballSpeed)),
  );

  return clampPoint(projected);
}

export function passBall(ball: Ball, from: Player, receiver: Player, passTarget?: Vec2) {
  const target = passTarget ?? leadReceiver(receiver, from.side);
  const direction = normalize(sub(target, from.position));
  ball.ownerPlayerId = null;
  ball.intendedReceiverId = receiver.id;
  ball.targetPosition = clampPoint(target);
  ball.position = { ...from.position };
  ball.velocity = scale(direction, MOVEMENT.passSpeed);
  receiver.receivingPass = true;
  receiver.state = "RECEIVE_PASS";
  receiver.targetPosition = predictBallIntercept(receiver, ball);
}

export function createAccumulatorLoop(
  gameState: GameState,
  render: (state: GameState, alpha: number) => void,
) {
  let accumulator = 0;
  let previousTime = performance.now();
  let frameId = 0;

  const frame = (now: number) => {
    accumulator += Math.min(250, now - previousTime);
    previousTime = now;

    while (accumulator >= SIM_TICK_MS) {
      updateSimulation(SIM_TICK_SECONDS, gameState);
      accumulator -= SIM_TICK_MS;
    }

    render(gameState, accumulator / SIM_TICK_MS);
    frameId = requestAnimationFrame(frame);
  };

  frameId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(frameId);
}

export function createIntervalLoop(gameState: GameState, publish: (state: GameState) => void) {
  const id = setInterval(() => {
    updateSimulation(SIM_TICK_SECONDS, gameState);
    publish(gameState);
  }, SIM_TICK_MS);

  return () => clearInterval(id);
}

function updateBall(ball: Ball, players: Player[], deltaTime: number) {
  const owner = players.find((player) => player.id === ball.ownerPlayerId);
  if (owner) {
    followBallCarrier(ball, owner);
    return;
  }

  ball.position = clampPoint(add(ball.position, scale(ball.velocity, deltaTime)));
  const speed = length(ball.velocity);
  const nextSpeed = Math.max(0, speed - MOVEMENT.ballFriction * deltaTime);
  ball.velocity = speed > 0 ? scale(ball.velocity, nextSpeed / speed) : { x: 0, y: 0 };

  const receiver = players.find((player) => player.id === ball.intendedReceiverId);
  if (receiver && distance(receiver.position, ball.position) <= MOVEMENT.ballControlRadius) {
    ball.ownerPlayerId = receiver.id;
    ball.intendedReceiverId = null;
    ball.targetPosition = null;
    ball.velocity = { x: 0, y: 0 };
    receiver.hasBall = true;
    receiver.receivingPass = false;
  }
}

function followBallCarrier(ball: Ball, owner: Player) {
  const moveDirection =
    length(owner.velocity) > 0.02
      ? normalize(owner.velocity)
      : { x: 0, y: attackDirection(owner.side) };
  const offset = scale(moveDirection, 0.65);
  ball.position = clampPoint(add(owner.position, offset));
  ball.velocity = owner.velocity;
}

function getPlayerMaxSpeed(player: Player) {
  const statScale = clamp(Number(player.stats?.speed ?? 70) / 100, 0.72, 1.18);
  const staminaScale = clamp(Number(player.stamina ?? 70) / 100, 0.72, 1.05);
  const stateSpeed =
    player.state === "PRESS_BALL" ||
    player.state === "MOVE_TO_SPACE" ||
    player.state === "ATTACK_SPACE" ||
    player.state === "OVERLAP" ||
    player.state === "UNDERLAP" ||
    player.state === "CUT_INSIDE" ||
    player.state === "TRACK_RUNNER"
      ? MOVEMENT.sprintSpeed
      : player.state === "IDLE" ||
          player.state === "HOLD_POSITION" ||
          player.state === "HOLD_LINE" ||
          player.state === "HOLD_DEPTH" ||
          player.state === "HOLD_WIDTH"
        ? MOVEMENT.walkingSpeed
        : MOVEMENT.jogSpeed;
  const ballScale = player.hasBall ? MOVEMENT.playerWithBallSpeedMultiplier : 1;

  return stateSpeed * statScale * staminaScale * ballScale;
}

function getPlayerAcceleration(player: Player) {
  const statScale = clamp(Number(player.stats?.acceleration ?? 70) / 100, 0.75, 1.25);
  return MOVEMENT.acceleration * statScale;
}

function applySameTargetOffsets(players: Player[]) {
  const groups = new Map<string, Player[]>();
  players.forEach((player) => {
    const key = `${Math.round(player.targetPosition.x / 4)}:${Math.round(player.targetPosition.y / 4)}`;
    groups.set(key, [...(groups.get(key) ?? []), player]);
  });

  groups.forEach((group) => {
    if (group.length < 2) return;
    group.forEach((player, index) => {
      const role = normalizeRole(player.role);
      const laneSign =
        role === "CB" || role === "CM" || role === "DM"
          ? Math.sign(getCentralLaneX(player) - 50) || (index % 2 === 0 ? -1 : 1)
          : index % 2 === 0
            ? -1
            : 1;
      const depthSign = index % 2 === 0 ? -1 : 1;
      player.targetPosition = clampToRoleZone(player, {
        x: player.targetPosition.x + laneSign * MOVEMENT.sameTargetOffset,
        y: player.targetPosition.y + depthSign * MOVEMENT.sameTargetOffset * 0.55,
      });
    });
  });
}

function isCounterPresser(player: Player, context: MovementContext) {
  const role = normalizeRole(player.role);
  if (role === "GK") return false;

  const maxPressers = context.possessionTicks <= 3 ? 3 : 2;
  const ranked = context.teammates
    .filter((item) => normalizeRole(item.role) !== "GK")
    .map((item) => {
      const itemRole = normalizeRole(item.role);
      const homeRisk = itemRole === "CB" ? 11 : itemRole === "FB" ? 5 : itemRole === "DM" ? 3 : 0;
      return {
        id: item.id,
        score:
          distance(item.position, context.ball) +
          distance(item.homePosition, context.ball) * 0.1 +
          homeRisk,
      };
    })
    .sort((left, right) => left.score - right.score)
    .slice(0, maxPressers);

  return (
    ranked.some((item) => item.id === player.id) && distance(player.position, context.ball) <= 32
  );
}

function getCounterPressTarget(player: Player, context: MovementContext) {
  const owner = context.owner;
  const coverSide = player.position.x < context.ball.x ? -1 : 1;
  const laneTarget = owner && owner.side !== player.side ? owner.position : context.ball;

  return clampToRoleZone(player, {
    x: clamp(lerp(context.ball.x, laneTarget.x, 0.32) + coverSide * 1.4, 4, 96),
    y: clamp(lerp(context.ball.y, laneTarget.y, 0.32), 4, 96),
  });
}

function isCounterPressCover(player: Player, context: MovementContext) {
  const role = normalizeRole(player.role);
  if (role === "GK" || isCounterPresser(player, context)) return false;
  const gap = distance(player.position, context.ball);
  if (gap > 38) return false;
  if (role === "CB") return dangerLevel(player.side, context.ball.y) <= 0.65;
  return true;
}

function getCounterPressCoverTarget(player: Player, context: MovementContext) {
  const goalSide = ownGoalY(player.side) > context.ball.y ? 1 : -1;
  const centralPull = (50 - player.position.x) * 0.12;
  const side = player.homePosition.x < context.ball.x ? -1 : 1;

  return clampToRoleZone(player, {
    x: context.ball.x + side * 8 + centralPull,
    y: context.ball.y + goalSide * 9,
  });
}

function isDesignatedPresser(player: Player, teammates: Player[], ball: Vec2) {
  const role = normalizeRole(player.role);
  if (role === "GK") return false;

  const direction = attackDirection(player.side);
  const ballInDefensiveHalf = direction < 0 ? ball.y > 52 : ball.y < 48;
  const maxPressers = ballInDefensiveHalf ? 2 : 2;
  const ranked = teammates
    .filter((item) => normalizeRole(item.role) !== "GK")
    .map((item) => {
      const itemRole = normalizeRole(item.role);
      const leaveHome = distance(item.homePosition, ball);
      const rolePenalty =
        itemRole === "CB" && !ballInDefensiveHalf
          ? 18
          : itemRole === "FB"
            ? 4
            : itemRole === "ST" || itemRole === "W"
              ? 2
              : 0;
      return {
        id: item.id,
        distance: distance(item.position, ball) + leaveHome * 0.12 + rolePenalty,
      };
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, maxPressers);

  return ranked.some((item) => item.id === player.id);
}

function isBallInDefensiveResponsibilityZone(player: Player, ball: Vec2) {
  const role = normalizeRole(player.role);
  if (role === "GK") return distance(player.position, ball) <= 14;

  const direction = attackDirection(player.side);
  const ballBetweenPlayerAndGoal =
    direction < 0 ? ball.y >= player.homePosition.y - 8 : ball.y <= player.homePosition.y + 8;
  const lateralGap = Math.abs(ball.x - player.homePosition.x);
  const zoneWidth =
    role === "CB" ? 12 : role === "FB" ? 16 : role === "DM" || role === "CM" ? 18 : 14;
  const depthGap = Math.abs(ball.y - player.homePosition.y);

  return ballBetweenPlayerAndGoal && lateralGap <= zoneWidth && depthGap <= 24;
}

function isNearestViableBallChaser(player: Player, teammates: Player[], ball: Vec2) {
  const role = normalizeRole(player.role);
  if (role === "GK") return distance(player.position, ball) <= 18;

  const direction = attackDirection(player.side);
  const ballBehindLine =
    direction < 0 ? ball.y > player.homePosition.y + 16 : ball.y < player.homePosition.y - 16;
  const roleRisk =
    role === "CB" && !ballBehindLine ? 16 : role === "FB" ? 6 : role === "DM" ? 3 : 0;

  const ranked = teammates
    .filter((item) => normalizeRole(item.role) !== "GK")
    .map((item) => {
      const itemRole = normalizeRole(item.role);
      const itemBallBehindLine =
        direction < 0 ? ball.y > item.homePosition.y + 16 : ball.y < item.homePosition.y - 16;
      const itemRisk =
        itemRole === "CB" && !itemBallBehindLine
          ? 16
          : itemRole === "FB"
            ? 6
            : itemRole === "DM"
              ? 3
              : 0;
      return {
        id: item.id,
        score: distance(item.position, ball) + distance(item.homePosition, ball) * 0.08 + itemRisk,
      };
    })
    .sort((left, right) => left.score - right.score);

  return ranked[0]?.id === player.id && distance(player.position, ball) + roleRisk <= 34;
}

function getBackLineCohesionDecision(
  player: Player,
  context: MovementContext,
): MovementDecision | null {
  const { role, ball, direction, teammates, opponents, owner } = context;
  const backLine = teammates
    .filter((item) => {
      const itemRole = normalizeRole(item.role);
      return itemRole === "CB" || itemRole === "FB";
    })
    .sort((left, right) => left.homePosition.x - right.homePosition.x);

  if (backLine.length < 2) return null;

  const lineShiftX = getDefensiveUnitShiftX(ball);
  const lineDepth = getDefensiveLineDepth(player.side, ball, backLine, context.ballVelocity);
  const runner = role === "CB" ? findDangerousRunnerBehindLine(player, context, lineDepth) : null;
  if (runner) {
    return {
      state: "TRACK_RUNNER",
      targetPosition: applyTeamSpacing(
        player,
        teammates,
        clampToRoleZone(player, getRunnerTrackingTarget(player, runner, lineDepth, lineShiftX)),
      ),
    };
  }

  const mark = findMarkAssignment(player, teammates, opponents, owner);
  const dangerousMark =
    mark &&
    isOpponentBetweenLines(mark, player.side) &&
    distance(mark.position, player.position) <= 18
      ? mark
      : null;
  const nearestLineDefender = backLine
    .map((item) => ({ id: item.id, gap: distance(item.position, ball) }))
    .sort((left, right) => left.gap - right.gap)[0];
  const canStepOut =
    nearestLineDefender?.id === player.id &&
    (isBallInDefensiveResponsibilityZone(player, ball) ||
      canBackLinePlayerStepOutToCentralDanger(player, context, backLine, lineDepth)) &&
    distance(player.position, ball) <= (role === "CB" ? 22 : 20);

  if (canStepOut) {
    return {
      state: "PRESS_BALL",
      targetPosition: getPressTarget(player, ball),
    };
  }

  const lineCover = getBackLineCoverOffset(player, backLine);
  const markPull = dangerousMark
    ? {
        x: (dangerousMark.position.x - player.homePosition.x) * 0.18,
        y: (dangerousMark.position.y - lineDepth) * 0.22,
      }
    : { x: 0, y: 0 };
  const fullbackTuck =
    role === "FB" && !isSameFlank(player.homePosition.x, ball.x)
      ? (50 - player.homePosition.x) * 0.16
      : 0;

  return {
    state: dangerousMark
      ? "MARK_MAN"
      : context.phase === "DEFENSIVE_BLOCK"
        ? "HOLD_LINE"
        : "RECOVER_SHAPE",
    targetPosition: applyTeamSpacing(
      player,
      teammates,
      clampToRoleZone(player, {
        x: player.homePosition.x + lineShiftX + lineCover + markPull.x + fullbackTuck,
        y: lineDepth + markPull.y - direction * (role === "CB" ? 0 : 1.5),
      }),
    ),
  };
}

function canBackLinePlayerStepOutToCentralDanger(
  player: Player,
  context: MovementContext,
  backLine: Player[],
  lineDepth: number,
) {
  const role = normalizeRole(player.role);
  if (role !== "CB" && role !== "FB") return false;

  const carrier = context.owner && context.owner.side !== player.side ? context.owner : null;
  const carrierPoint = carrier?.position ?? context.ball;
  const centralDanger = carrierPoint.x >= 30 && carrierPoint.x <= 70;
  const betweenLines =
    player.side === "home"
      ? carrierPoint.y >= lineDepth - 22 && carrierPoint.y <= lineDepth + 10
      : carrierPoint.y <= lineDepth + 22 && carrierPoint.y >= lineDepth - 10;
  const coverBehind = backLine.some((teammate) => {
    if (teammate.id === player.id) return false;
    const teammateRole = normalizeRole(teammate.role);
    if (teammateRole !== "CB" && teammateRole !== "DM") return false;
    return player.side === "home"
      ? teammate.position.y >= player.position.y - 3
      : teammate.position.y <= player.position.y + 3;
  });
  const noDangerousRunner = !findDangerousRunnerBehindLine(player, context, lineDepth);
  const pressureDistance = carrier
    ? getNearestOpponentDistance(
        carrier.position,
        context.teammates.filter((item) => item.id !== player.id),
      )
    : 99;

  return centralDanger && betweenLines && coverBehind && noDangerousRunner && pressureDistance >= 4;
}

function getPriorityMarkingDecision(
  player: Player,
  context: MovementContext,
): MovementDecision | null {
  const role = normalizeRole(player.role);
  if (role === "GK" || context.hasPossession) return null;

  const mark = findMarkAssignment(player, context.teammates, context.opponents, context.owner);
  if (!mark) return null;

  const priority = getMarkPriority(player, mark, context.owner, context.teammates);
  const gap = distance(player.position, mark.position);
  const roleCanTrack =
    role === "W"
      ? normalizeRole(mark.role) === "FB" || normalizeRole(mark.role) === "W"
      : role === "DM" || role === "CM";

  if (priority < 3 && (!roleCanTrack || gap > 18)) return null;

  const state: PlayerAIState = isRunnerBehindLine(mark, player.side, context.teammates)
    ? "TRACK_RUNNER"
    : "MARK_MAN";
  const pressureWeight = context.owner?.id === mark.id ? 0.5 : 0.28;

  return {
    state,
    targetPosition: applyTeamSpacing(
      player,
      context.teammates,
      clampToRoleZone(player, {
        x: lerp(mark.position.x, getCentralLaneX(player), pressureWeight),
        y: mark.position.y - context.direction * getMarkGoalSideGap(role),
      }),
    ),
  };
}

function getDefensiveUnitShiftX(ball: Vec2) {
  return clamp((ball.x - 50) * 0.22, -6.5, 6.5);
}

function getAttackingBackLineDepth(side: Side, ball: Vec2, backLine: Player[]) {
  const averageHomeY =
    backLine.length > 0
      ? backLine.reduce((total, player) => total + player.homePosition.y, 0) / backLine.length
      : side === "home"
        ? 74
        : 26;
  const direction = attackDirection(side);
  const advance = direction < 0 ? 62 - ball.y : ball.y - 38;
  const stablePossessionPush =
    direction < 0 ? clamp(58 - ball.y, 0, 18) : clamp(ball.y - 42, 0, 18);
  const push = clamp(12 + advance * 0.32 + stablePossessionPush * 0.18, 8, 29);

  return direction < 0 ? clamp(averageHomeY - push, 45, 78) : clamp(averageHomeY + push, 22, 55);
}

function getDefensiveLineDepth(side: Side, ball: Vec2, backLine: Player[], ballVelocity: Vec2) {
  const averageHomeY =
    backLine.reduce((total, player) => total + player.homePosition.y, 0) / backLine.length;
  const direction = attackDirection(side);
  const ownGoal = ownGoalY(side);
  const opponentDirection = -direction;
  const attackTempo = clamp((ballVelocity.y * opponentDirection + 4) / 18, 0, 1);
  const ballPressureDepth = direction < 0 ? clamp(ball.y + 9, 54, 78) : clamp(ball.y - 9, 22, 46);
  const retreatDepth = direction < 0 ? ownGoal - 20 : ownGoal + 20;
  const dangerDepth = lerp(ballPressureDepth, retreatDepth, attackTempo * 0.34);
  const lineDepth = lerp(averageHomeY, dangerDepth, 0.42 + attackTempo * 0.1);

  return direction < 0
    ? clamp(lineDepth, Math.min(ownGoal - 42, averageHomeY), ownGoal - 15)
    : clamp(lineDepth, ownGoal + 15, Math.max(ownGoal + 42, averageHomeY));
}

function findDangerousRunnerBehindLine(
  player: Player,
  context: MovementContext,
  lineDepth: number,
) {
  const ownGoal = ownGoalY(player.side);
  const directionToOwnGoal = ownGoal > lineDepth ? 1 : -1;
  const runnerLaneX = player.homePosition.x;

  return (
    context.opponents
      .filter((opponent) => normalizeRole(opponent.role) === "ST")
      .map((opponent) => {
        const goalSideGap = (opponent.position.y - lineDepth) * directionToOwnGoal;
        const runningBehind = goalSideGap > -2 && opponent.velocity.y * directionToOwnGoal > 0.2;
        const alreadyBehind = goalSideGap > 1.5;
        const lateralGap = Math.abs(opponent.position.x - runnerLaneX);
        const score =
          lateralGap * 0.85 +
          Math.abs(goalSideGap) * 0.35 +
          distance(opponent.position, player.position) * 0.2;

        return { opponent, runningBehind, alreadyBehind, lateralGap, score };
      })
      .filter((item) => (item.runningBehind || item.alreadyBehind) && item.lateralGap <= 22)
      .sort((left, right) => left.score - right.score)[0]?.opponent ?? null
  );
}

function getRunnerTrackingTarget(
  player: Player,
  runner: Player,
  lineDepth: number,
  lineShiftX: number,
) {
  const ownGoal = ownGoalY(player.side);
  const coverDepth = lerp(lineDepth, runner.position.y, 0.48);
  const goalSideBuffer = ownGoal > lineDepth ? 2.5 : -2.5;

  return {
    x: lerp(player.homePosition.x + lineShiftX, runner.position.x, 0.58),
    y: coverDepth + goalSideBuffer,
  };
}

function getBackLineCoverOffset(player: Player, backLine: Player[]) {
  const index = backLine.findIndex((item) => item.id === player.id);
  if (index < 0) return 0;

  const homeGapLeft = index > 0 ? player.homePosition.x - backLine[index - 1].homePosition.x : 0;
  const homeGapRight =
    index < backLine.length - 1 ? backLine[index + 1].homePosition.x - player.homePosition.x : 0;
  const currentGapLeft =
    index > 0 ? player.position.x - backLine[index - 1].position.x : homeGapLeft;
  const currentGapRight =
    index < backLine.length - 1 ? backLine[index + 1].position.x - player.position.x : homeGapRight;
  const leftCorrection = homeGapLeft ? (homeGapLeft - currentGapLeft) * 0.16 : 0;
  const rightCorrection = homeGapRight ? (currentGapRight - homeGapRight) * 0.16 : 0;

  return clamp(leftCorrection + rightCorrection, -3, 3);
}

function getMidfieldDefensiveSpace(player: Player, context: MovementContext) {
  const { ball, direction, teammates, opponents, owner } = context;
  const centralBias = clamp((50 - player.homePosition.x) * 0.24, -8, 8);
  const laneBlock = getPassingLaneBlockPoint(player, ball, owner, opponents);
  const nearestGap = findNearestDefensiveGap(player, teammates, ball);

  return {
    x: lerp(player.homePosition.x + centralBias, laneBlock.x, 0.55) + nearestGap.x,
    y: lerp(player.homePosition.y - direction * 4, laneBlock.y, 0.5) + nearestGap.y,
  };
}

function getMidfieldAttackingSpace(player: Player, context: MovementContext) {
  const { ball, direction, teammates } = context;
  const triangle = getSupportTrianglePoint(player, teammates, ball, direction);
  const betweenLineY = ball.y - direction * (normalizeRole(player.role) === "DM" ? 10 : 7);

  return {
    x: lerp(triangle.x, getCentralLaneX(player), 0.35),
    y: lerp(triangle.y, betweenLineY, 0.45),
  };
}

function getWingerDefensiveSpace(player: Player, context: MovementContext) {
  const { ball, direction } = context;
  const wideX = getWideLaneX(player);
  const halfSpaceX = wideX < 50 ? 28 : 72;
  const shouldTuck = isSameFlank(player.homePosition.x, ball.x);

  return {
    x: shouldTuck ? lerp(wideX, halfSpaceX, 0.48) : wideX,
    y: lerp(
      player.homePosition.y - direction * 5,
      ball.y - direction * 10,
      shouldTuck ? 0.42 : 0.2,
    ),
  };
}

function getWingerAttackingSpace(player: Player, context: MovementContext) {
  const { ball, direction } = context;
  const sameFlank = isSameFlank(player.homePosition.x, ball.x);
  const wideX = getWideLaneX(player);
  const halfSpaceX = wideX < 50 ? 32 : 68;

  return {
    x: sameFlank ? lerp(wideX, halfSpaceX, 0.38) : wideX,
    y: sameFlank ? ball.y + direction * 14 : ball.y + direction * 18,
  };
}

function getStrikerDefensiveScreen(player: Player, context: MovementContext) {
  const { ball, direction, tick } = context;
  const microShift = Math.sin((tick + player.id * 7) * 0.7) * 2.2;

  return {
    x: clamp(lerp(player.homePosition.x, ball.x, 0.22) + microShift, 32, 68),
    y: clamp(ball.y - direction * 14, 22, 78),
  };
}

function getStrikerAttackingSpace(player: Player, context: MovementContext) {
  const { ball, direction, opponents, tick } = context;
  const centerBacks = opponents.filter((item) => normalizeRole(item.role) === "CB");
  const defenderGap = getLargestHorizontalGap(centerBacks);
  const onsideLine = getOffsideLine(player.side, opponents);
  const microShift = Math.sin((tick + player.id * 11) * 0.85) * 2.4;
  const targetY =
    direction < 0
      ? Math.max(onsideLine + 1.5, ball.y + direction * 16)
      : Math.min(onsideLine - 1.5, ball.y + direction * 16);

  return {
    x: clamp(lerp(player.homePosition.x, defenderGap, 0.62) + microShift, 28, 72),
    y: targetY,
  };
}

function getPassingLaneBlockPoint(
  player: Player,
  ball: Vec2,
  owner: Player | null,
  opponents: Player[],
) {
  const centralThreat =
    opponents
      .filter((item) => normalizeRole(item.role) !== "GK")
      .map((item) => ({
        player: item,
        score: Math.abs(item.position.x - 50) + distance(item.position, ball) * 0.18,
      }))
      .sort((left, right) => left.score - right.score)[0]?.player ?? null;
  const laneTarget = centralThreat?.position ?? { x: 50, y: player.homePosition.y };
  const laneStart = owner?.position ?? ball;

  return {
    x: lerp(laneStart.x, laneTarget.x, 0.5),
    y: lerp(laneStart.y, laneTarget.y, 0.5),
  };
}

function findNearestDefensiveGap(player: Player, teammates: Player[], ball: Vec2) {
  const midfielders = teammates.filter((item) => {
    const role = normalizeRole(item.role);
    return role === "DM" || role === "CM";
  });
  const sameLine = midfielders.filter((item) => item.id !== player.id);
  const leftGap =
    sameLine
      .filter((item) => item.position.x < player.position.x)
      .sort((left, right) => right.position.x - left.position.x)[0] ?? null;
  const rightGap =
    sameLine
      .filter((item) => item.position.x > player.position.x)
      .sort((left, right) => left.position.x - right.position.x)[0] ?? null;
  const leftTooFar = leftGap ? player.position.x - leftGap.position.x > 18 : false;
  const rightTooFar = rightGap ? rightGap.position.x - player.position.x > 18 : false;

  return {
    x: leftTooFar ? -4 : rightTooFar ? 4 : clamp((ball.x - 50) * 0.08, -3, 3),
    y: 0,
  };
}

function getSupportTrianglePoint(
  player: Player,
  teammates: Player[],
  ball: Vec2,
  direction: number,
) {
  const nearbyCarrierSupport =
    teammates
      .filter((item) => item.id !== player.id && normalizeRole(item.role) !== "GK")
      .map((item) => ({ player: item, gap: distance(item.position, ball) }))
      .sort((left, right) => left.gap - right.gap)[0]?.player ?? null;
  const base = nearbyCarrierSupport?.position ?? ball;
  const sideOffset = player.homePosition.x < 50 ? -10 : player.homePosition.x > 50 ? 10 : 0;

  return {
    x: base.x + sideOffset,
    y: base.y - direction * 8,
  };
}

function getLargestHorizontalGap(defenders: Player[]) {
  if (defenders.length === 0) return 50;

  const sorted = defenders.map((item) => item.position.x).sort((left, right) => left - right);
  const points = [24, ...sorted, 76];
  let bestCenter = 50;
  let bestGap = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const gap = points[index + 1] - points[index];
    if (gap > bestGap) {
      bestGap = gap;
      bestCenter = points[index] + gap / 2;
    }
  }

  return bestCenter;
}

function getOffsideLine(attackingSide: Side, opponents: Player[]) {
  const outfield = opponents
    .filter((item) => normalizeRole(item.role) !== "GK")
    .map((item) => item.position.y)
    .sort((left, right) => left - right);

  if (outfield.length === 0) return attackingSide === "home" ? 8 : 92;
  return attackingSide === "home"
    ? (outfield[1] ?? outfield[0])
    : (outfield[outfield.length - 2] ?? outfield[0]);
}

function isOpponentBetweenLines(opponent: Player, defenderSide: Side) {
  return defenderSide === "home"
    ? opponent.position.y >= 48 && opponent.position.y <= 86
    : opponent.position.y >= 14 && opponent.position.y <= 52;
}

function getPressTarget(player: Player, ball: Vec2) {
  const role = normalizeRole(player.role);
  const maxLeaveHome =
    role === "CB" ? 16 : role === "FB" ? 22 : role === "DM" ? 22 : role === "CM" ? 26 : 30;
  return clampToRoleZone(player, {
    x: clamp(ball.x, player.homePosition.x - maxLeaveHome, player.homePosition.x + maxLeaveHome),
    y: clamp(ball.y, player.homePosition.y - maxLeaveHome, player.homePosition.y + maxLeaveHome),
  });
}

function findMarkAssignment(
  player: Player,
  teammates: Player[],
  opponents: Player[],
  owner: Player | null,
) {
  const role = normalizeRole(player.role);
  if (role === "GK") return null;
  if (owner && owner.side !== player.side && distance(player.position, owner.position) <= 10) {
    return owner;
  }

  const teammateMarkers = teammates
    .filter((item) => item.id !== player.id && normalizeRole(item.role) !== "GK")
    .map((item) => ({
      marker: item,
      target: choosePreferredMark(item, opponents, owner, () => 0, teammates),
    }))
    .filter((item) => item.target != null);

  return choosePreferredMark(
    player,
    opponents,
    owner,
    (candidate) => {
      const duplicateCount = teammateMarkers.filter(
        (item) => item.target?.id === candidate.id,
      ).length;
      return duplicateCount * 9;
    },
    teammates,
  );
}

function choosePreferredMark(
  player: Player,
  opponents: Player[],
  owner: Player | null,
  duplicatePenalty: (candidate: Player) => number = () => 0,
  teammates: Player[] = [],
) {
  const role = normalizeRole(player.role);
  const laneX = getCentralLaneX(player);
  const ballOwnerBonus = owner && owner.side !== player.side ? owner.id : null;
  const viable = opponents.filter((item) => normalizeRole(item.role) !== "GK");
  const defendingTeammates = teammates.length ? teammates : [player];

  return (
    viable
      .map((candidate) => {
        const candidateRole = normalizeRole(candidate.role);
        const markPriority = getMarkPriority(player, candidate, owner, defendingTeammates);
        const sameLane = Math.abs(candidate.position.x - laneX);
        const roleMatch =
          role === "CB"
            ? candidateRole === "ST"
              ? -10
              : candidateRole === "W"
                ? 3
                : 0
            : role === "FB" || role === "W"
              ? candidateRole === "W" || candidateRole === "FB"
                ? -7
                : 2
              : candidateRole === "CM" || candidateRole === "DM"
                ? -5
                : 0;
        const ownerWeight = ballOwnerBonus === candidate.id ? -5 : 0;
        return {
          player: candidate,
          score:
            distance(player.position, candidate.position) * 0.45 +
            sameLane * 0.32 +
            distance(player.homePosition, candidate.position) * 0.18 +
            roleMatch +
            ownerWeight +
            duplicatePenalty(candidate) -
            markPriority * 7.5,
        };
      })
      .sort((left, right) => left.score - right.score)[0]?.player ?? null
  );
}

function getMarkPriority(
  marker: Player,
  candidate: Player,
  owner: Player | null,
  defenders: Player[],
) {
  if (owner?.id === candidate.id && owner.side !== marker.side) return 5;
  if (isRunnerBehindLine(candidate, marker.side, defenders)) return 4;
  if (isOpponentBetweenLines(candidate, marker.side)) return 3;
  if (isFreeCentralOpponent(candidate, defenders)) return 2;
  if (isSameFlank(marker.homePosition.x, candidate.position.x)) return 1;
  return 0;
}

function isRunnerBehindLine(candidate: Player, defenderSide: Side, defenders: Player[]) {
  const defenderYs = defenders
    .filter((item) => normalizeRole(item.role) !== "GK")
    .map((item) => item.position.y)
    .sort((left, right) => (defenderSide === "home" ? right - left : left - right));
  const lineY = defenderYs[0] ?? (defenderSide === "home" ? 78 : 22);
  const towardGoal = defenderSide === "home" ? 1 : -1;
  const beyondLine = (candidate.position.y - lineY) * towardGoal > -1;
  const runningBehind = candidate.velocity.y * towardGoal > 0.25;

  return beyondLine && (runningBehind || normalizeRole(candidate.role) === "ST");
}

function isFreeCentralOpponent(candidate: Player, opponents: Player[]) {
  if (candidate.position.x < 32 || candidate.position.x > 68) return false;
  const nearest = getNearestOpponentDistance(
    candidate.position,
    opponents.filter((item) => item.id !== candidate.id),
  );
  return nearest >= 9;
}

function clampToRoleZone(player: Player, target: Vec2) {
  const role = normalizeRole(player.role);
  const yBounds = getRoleYBounds(player.side, role);
  const xBounds = getRoleXBounds(player, role);

  return {
    x: clamp(target.x, xBounds.min, xBounds.max),
    y: clamp(target.y, yBounds.min, yBounds.max),
  };
}

function getRoleYBounds(side: Side, role: PlayerRole) {
  const homeBounds: Record<PlayerRole, { min: number; max: number }> = {
    GK: { min: 88, max: 96 },
    CB: { min: 44, max: 86 },
    FB: { min: 22, max: 84 },
    DM: { min: 38, max: 74 },
    CM: { min: 24, max: 72 },
    W: { min: 12, max: 62 },
    ST: { min: 8, max: 45 },
  };
  const bounds = homeBounds[role];

  if (side === "home") {
    return bounds;
  }

  return { min: 100 - bounds.max, max: 100 - bounds.min };
}

function getRoleXBounds(player: Player, role: PlayerRole) {
  const laneCenter = role === "W" || role === "FB" ? getWideLaneX(player) : player.homePosition.x;
  if (role === "GK") return { min: 40, max: 60 };
  if (role === "CB")
    return { min: Math.max(22, laneCenter - 16), max: Math.min(78, laneCenter + 16) };
  if (role === "FB") {
    return laneCenter < 50 ? { min: 5, max: 34 } : { min: 66, max: 95 };
  }
  if (role === "W") {
    return laneCenter < 50 ? { min: 5, max: 38 } : { min: 62, max: 95 };
  }
  if (role === "ST") return { min: 30, max: 70 };
  return { min: 18, max: 82 };
}

function getCentralLaneX(player: Player) {
  const role = player.role.toUpperCase();
  if (role.startsWith("L")) return role.includes("CB") ? 37 : 34;
  if (role.startsWith("R")) return role.includes("CB") ? 63 : 66;
  if (role === "CDM" || role === "DM" || role === "CM" || role === "CAM") return 50;
  return player.homePosition.x;
}

function applyTeamSpacing(player: Player, teammates: Player[], target: Vec2) {
  const role = normalizeRole(player.role);
  const minDistance = role === "CB" ? 8.5 : role === "CM" || role === "DM" ? 7.5 : 6;
  const push = teammates.reduce<Vec2>(
    (acc, teammate) => {
      if (teammate.id === player.id) return acc;
      const teammateRole = normalizeRole(teammate.role);
      if (teammateRole === "GK") return acc;
      const teammateTarget = teammate.targetPosition ?? teammate.position;
      const delta = sub(target, teammateTarget);
      const gap = length(delta);
      if (gap <= 0 || gap >= minDistance) return acc;
      const direction = scale(delta, 1 / gap);
      return add(acc, scale(direction, (minDistance - gap) * 0.7));
    },
    { x: 0, y: 0 },
  );

  return clampToRoleZone(player, add(target, push));
}

function getWideLaneX(player: Player) {
  const role = player.role.toUpperCase();
  if (role === "LW" || role === "LM" || role === "LB" || role === "LWB") return 10;
  if (role === "RW" || role === "RM" || role === "RB" || role === "RWB") return 90;
  return player.homePosition.x < 50 ? 10 : 90;
}

function getWideLaneDirection(player: Player) {
  return getWideLaneX(player) < 50 ? -1 : 1;
}

function ownGoalY(side: Side) {
  return side === "home" ? 92 : 8;
}

function dangerLevel(side: Side, ballY: number) {
  return side === "home" ? clamp((ballY - 50) / 42, 0, 1) : clamp((50 - ballY) / 42, 0, 1);
}

function isInFinalThird(side: Side, y: number) {
  return side === "home" ? y <= 35 : y >= 65;
}

function isNearTouchline(x: number) {
  return x <= 12 || x >= 88;
}

function isSameFlank(playerX: number, ballX: number) {
  if (playerX < 35) return ballX < 48;
  if (playerX > 65) return ballX > 52;
  return ballX >= 32 && ballX <= 68;
}

function countNearbyOpponents(point: Vec2, opponents: Player[], radius: number) {
  return opponents.filter(
    (opponent) =>
      normalizeRole(opponent.role) !== "GK" && distance(point, opponent.position) <= radius,
  ).length;
}

function getNearestOpponentDistance(point: Vec2, opponents: Player[]) {
  return (
    opponents
      .filter((opponent) => normalizeRole(opponent.role) !== "GK")
      .map((opponent) => distance(point, opponent.position))
      .sort((left, right) => left - right)[0] ?? 99
  );
}

function getMarkGoalSideGap(role: PlayerRole) {
  if (role === "CB") return 5;
  if (role === "DM" || role === "CM") return 4;
  if (role === "FB") return 3.5;
  return 2.5;
}

function getRecoveryDrop(role: PlayerRole) {
  if (role === "GK") return 0;
  if (role === "CB") return 4;
  if (role === "FB" || role === "DM") return 5;
  if (role === "CM") return 6;
  return 7;
}

function leadReceiver(receiver: Player, side: Side) {
  return clampPoint({
    x: receiver.position.x + receiver.velocity.x * 0.45,
    y: receiver.position.y + attackDirection(side) * 3 + receiver.velocity.y * 0.45,
  });
}

export function normalizeRole(role: string): PlayerRole {
  if (role === "GK") return "GK";
  if (role.includes("CB")) return "CB";
  if (role === "LB" || role === "RB") return "FB";
  if (role === "CM" || role === "CDM" || role.includes("DM")) return "DM";
  if (role.includes("CM")) return "CM";
  if (role === "LM" || role === "RM" || role === "LW" || role === "RW") return "W";
  return "ST";
}

export function attackDirection(side: Side) {
  return side === "home" ? -1 : 1;
}

function normalize(vector: Vec2) {
  const vectorLength = length(vector);
  return vectorLength > 0 ? scale(vector, 1 / vectorLength) : { x: 0, y: 0 };
}

function clampVector(vector: Vec2, maxLength: number) {
  const vectorLength = length(vector);
  if (vectorLength <= maxLength || vectorLength <= 0) return vector;
  return scale(vector, maxLength / vectorLength);
}

function clampPoint(point: Vec2) {
  return { x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 100) };
}

function add(left: Vec2, right: Vec2) {
  return { x: left.x + right.x, y: left.y + right.y };
}

function sub(left: Vec2, right: Vec2) {
  return { x: left.x - right.x, y: left.y - right.y };
}

function scale(vector: Vec2, value: number) {
  return { x: vector.x * value, y: vector.y * value };
}

function length(vector: Vec2) {
  return Math.hypot(vector.x, vector.y);
}

function distance(left: Vec2, right: Vec2) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function angleBetween(left: Vec2, right: Vec2) {
  const leftLength = Math.max(0.001, length(left));
  const rightLength = Math.max(0.001, length(right));
  const dot = left.x * right.x + left.y * right.y;
  return Math.acos(clamp(dot / (leftLength * rightLength), -1, 1));
}

function lerp(left: number, right: number, alpha: number) {
  return left + (right - left) * alpha;
}

function lerpVec(left: Vec2, right: Vec2, alpha: number) {
  return {
    x: lerp(left.x, right.x, alpha),
    y: lerp(left.y, right.y, alpha),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
