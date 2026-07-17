import { type PlayerAiProfile, type PlayerAiTendencies } from "src/modules/player/player-ai.types";

export const SIM_TICK_MS = 500;
export const SIM_TICK_SECONDS = SIM_TICK_MS / 1000;
export const SIM_TICKS_PER_SECOND = 1000 / SIM_TICK_MS;
const TRANSITION_WINDOW_TICKS = Math.max(4, Math.round(3.5 * SIM_TICKS_PER_SECOND));

export const MOVEMENT = {
  walkingSpeed: 3.9,
  jogSpeed: 7.6,
  sprintSpeed: 10.2,

  playerWithBallSpeedMultiplier: 0.86,

  acceleration: 8.4,
  braking: 12,

  turnSmoothing: 0.44,

  arrivalRadius: 7.4,
  stopRadius: 0.65,

  separationRadius: 6,
  separationStrength: 1.4,

  collisionMinX: 5.8,
  collisionMinY: 3.65,
  collisionPadding: 1.015,
  collisionIterations: 32,
  collisionVelocityDamping: 0.72,

  sameTargetOffset: 4,

  passSpeed: 34,
  shotSpeed: 78,

  ballFriction: 7,

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
  | "DROP_SHORT"
  | "KEEPER_DIVE"
  | "KEEPER_CATCH"
  | "KEEPER_HOLD";

export type PlayerRole = "GK" | "CB" | "FB" | "DM" | "CM" | "W" | "ST";
export type TacticalPhase =
  | "IN_POSSESSION_BUILDUP"
  | "IN_POSSESSION_ATTACK"
  | "DEFENSIVE_PRESS"
  | "DEFENSIVE_BLOCK"
  | "TRANSITION_LOST_BALL"
  | "TRANSITION_WON_BALL";
type AttackingBuildUpZone = "first_phase" | "progression" | "final_third";

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
  aiProfile?: PlayerAiProfile;
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

  allPlayers.forEach((player) => applySeparation(player, allPlayers));
  allPlayers.forEach((player) => updatePlayerMovement(player, deltaTime));
  resolvePlayerCollisions(allPlayers);

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
  const hasPossession = gameState.possession === player.side;
  const direction = attackDirection(player.side);
  const ball = gameState.ball.position;

  if (possessionTicks <= TRANSITION_WINDOW_TICKS) {
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

    return {
      state: context.role === "GK" ? "HOLD_DEPTH" : "RECOVER_DEFENSE",
      targetPosition: getTransitionRecoveryTarget(player, context),
    };
  }

  if (
    !context.hasPossession &&
    ((context.phase === "DEFENSIVE_PRESS" &&
      isDesignatedPresser(player, context.teammates, context.ball)) ||
      isEmergencyBallPressure(player, context))
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
    if (isBuildUpPhase(context)) {
      return {
        state: "PASS_SUPPORT",
        targetPosition: applyTeamSpacing(
          player,
          teammates,
          clampToRoleZone(player, getBuildUpCenterBackSupportTarget(player, context)),
        ),
      };
    }

    const backLine = teammates
      .filter((item) => {
        const itemRole = normalizeRole(item.role);
        return itemRole === "CB" || itemRole === "FB";
      })
      .sort((left, right) => left.homePosition.x - right.homePosition.x);
    const lineShiftX = getDefensiveUnitShiftX(ball) * 0.65;
    const lineDepth = getAttackingBackLineDepth(player.side, ball, backLine);
    const lineCover = getBackLineCoverOffset(player, backLine);
    if (shouldCenterBackStepIntoSupport(player, context, backLine)) {
      const attackingZone = getAttackingBuildUpZone(context);
      return {
        state: "PASS_SUPPORT",
        targetPosition: applyTeamSpacing(
          player,
          teammates,
          clampToRoleZone(player, {
            x: lerp(getCentralLaneX(player) + lineCover, ball.x, 0.3),
            y: lineDepth + direction * (attackingZone === "final_third" ? 5 : 7),
          }),
        ),
      };
    }

    return {
      state: "COVER_SPACE",
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
    if (isBuildUpPhase(context)) {
      return {
        state: "PASS_SUPPORT",
        targetPosition: applyTeamSpacing(
          player,
          teammates,
          clampToRoleZone(player, getBuildUpPivotSupportTarget(player, context)),
        ),
      };
    }

    return {
      state: "COVER_SPACE",
      targetPosition: applyTeamSpacing(
        player,
        teammates,
        clampToRoleZone(player, {
          x: lerp(getCentralLaneX(player), ball.x, 0.28),
          y: ball.y - direction * 7,
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

function isBuildUpPhase(context: MovementContext) {
  const ownerRole = context.owner ? normalizeRole(context.owner.role) : null;
  const attackingZone = getAttackingBuildUpZone(context);
  if (!context.hasPossession || attackingZone === "final_third") return false;
  if (attackingZone === "first_phase") return true;
  if (ownerRole === "GK" || ownerRole === "CB") return true;
  return context.phase === "IN_POSSESSION_BUILDUP" && ownerRole !== "CM" && ownerRole !== "W";
}

function getAttackingBuildUpZone(context: MovementContext): AttackingBuildUpZone {
  const attackProgress = context.direction < 0 ? 100 - context.ball.y : context.ball.y;
  if (attackProgress < 38) return "first_phase";
  if (attackProgress < 68) return "progression";
  return "final_third";
}

function getBuildUpCenterBackSupportTarget(player: Player, context: MovementContext) {
  const { ball, direction, owner, teammates } = context;
  const laneX = getCentralLaneX(player);
  const ownerRole = owner ? normalizeRole(owner.role) : null;
  const attackingZone = getAttackingBuildUpZone(context);
  const sideSign = laneX < 50 ? -1 : laneX > 50 ? 1 : player.homePosition.x < 50 ? -1 : 1;
  const centerBacks = teammates
    .filter((item) => normalizeRole(item.role) === "CB")
    .sort((left, right) => left.homePosition.x - right.homePosition.x || left.id - right.id);
  const partner = centerBacks.find((item) => item.id !== player.id);
  const supportCenterBack = [...centerBacks].sort(
    (left, right) =>
      Math.abs(left.homePosition.x - ball.x) - Math.abs(right.homePosition.x - ball.x) ||
      left.id - right.id,
  )[0];
  const isBallSideSupport = supportCenterBack?.id === player.id;
  const splitWidth = ownerRole === "GK" || ownerRole === "CB" ? 6.5 : 3.5;
  const partnerBalance = partner
    ? clamp((player.position.x - partner.position.x) * 0.08, -2, 2)
    : 0;
  const targetY =
    ownerRole === "GK"
      ? ball.y + direction * (isBallSideSupport ? 15 : 12)
      : ownerRole === "CB"
        ? ball.y - direction * (isBallSideSupport ? 2 : 5)
        : ball.y -
          direction *
            (attackingZone === "first_phase"
              ? isBallSideSupport
                ? 8
                : 13
              : isBallSideSupport
                ? 10
                : 16);

  return {
    x: clamp(
      lerp(
        laneX + sideSign * splitWidth + partnerBalance,
        ball.x,
        isBallSideSupport && ownerRole !== "GK" ? 0.16 : 0.04,
      ) +
        getDefensiveUnitShiftX(ball) * 0.24,
      22,
      78,
    ),
    y: clamp(targetY, 30, 86),
  };
}

function shouldCenterBackStepIntoSupport(
  player: Player,
  context: MovementContext,
  backLine: Player[],
) {
  if (getAttackingBuildUpZone(context) === "first_phase") {
    return false;
  }

  const centerBacks = backLine.filter((item) => normalizeRole(item.role) === "CB");
  if (centerBacks.length < 2 || getNearestOpponentDistance(context.ball, context.opponents) < 3.5) {
    return false;
  }

  const designatedSupport = [...centerBacks].sort(
    (left, right) =>
      Math.abs(left.homePosition.x - context.ball.x) -
        Math.abs(right.homePosition.x - context.ball.x) || left.id - right.id,
  )[0];
  return designatedSupport?.id === player.id;
}

function getBuildUpPivotSupportTarget(player: Player, context: MovementContext) {
  const { ball, direction, owner, opponents } = context;
  const ownerRole = owner ? normalizeRole(owner.role) : null;
  const nearestOpponentGap = getNearestOpponentDistance(player.position, opponents);
  const escapeSide = ball.x < 42 ? 1 : ball.x > 58 ? -1 : player.homePosition.x < 50 ? -1 : 1;
  const depth =
    ownerRole === "CB" || ownerRole === "GK"
      ? direction * 8
      : nearestOpponentGap <= 8
        ? -direction * 4
        : direction * 5;

  return {
    x: clamp(lerp(50, ball.x, 0.22) + escapeSide * 7, 26, 74),
    y: clamp(ball.y + depth, 28, 78),
  };
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
  const finalThird = isInFinalThird(player.side, context.ball.y);
  const variant = (context.tick + player.id) % 6;
  if (!sameFlank) {
    if (finalThird) return variant <= 2 ? "BACK_POST_RUN" : "ATTACK_SPACE";
    return variant === 0 ? "DIAGONAL_RUN" : "HOLD_WIDTH";
  }
  if (isNearTouchline(player.position.x)) return "CUT_INSIDE";
  if (variant === 0) return "DROP_SHORT";
  if (variant <= 2) return "CUT_INSIDE";
  return variant === 3 ? "HOLD_WIDTH" : "ATTACK_SPACE";
}

export function resolvePlayerCollisions(players: Player[]) {
  const minX = MOVEMENT.collisionMinX;
  const minY = MOVEMENT.collisionMinY;

  for (let iteration = 0; iteration < MOVEMENT.collisionIterations; iteration += 1) {
    for (let leftIndex = 0; leftIndex < players.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < players.length; rightIndex += 1) {
        const left = players[leftIndex];
        const right = players[rightIndex];
        let dx = right.position.x - left.position.x;
        let dy = right.position.y - left.position.y;
        let normalizedDistance = Math.hypot(dx / minX, dy / minY);

        if (normalizedDistance >= 1) continue;

        if (normalizedDistance < 0.0001) {
          const seed = (left.id * 31 + right.id * 17) % 360;
          const angle = (seed * Math.PI) / 180;
          dx = Math.cos(angle) * 0.01;
          dy = Math.sin(angle) * 0.01;
          normalizedDistance = Math.hypot(dx / minX, dy / minY);
        }

        const expansion = MOVEMENT.collisionPadding / Math.max(normalizedDistance, 0.0001) - 1;
        const correction = {
          x: dx * expansion,
          y: dy * expansion,
        };
        const leftShare = left.hasBall ? 0.28 : right.hasBall ? 0.72 : 0.5;
        const rightShare = 1 - leftShare;

        left.position = clampPoint({
          x: left.position.x - correction.x * leftShare,
          y: left.position.y - correction.y * leftShare,
        });
        right.position = clampPoint({
          x: right.position.x + correction.x * rightShare,
          y: right.position.y + correction.y * rightShare,
        });

        left.velocity = scale(left.velocity, MOVEMENT.collisionVelocityDamping);
        right.velocity = scale(right.velocity, MOVEMENT.collisionVelocityDamping);
      }
    }
  }
}

function getPlayerAiTendency(player: Player, key: keyof PlayerAiTendencies, fallback: number) {
  const value = Number(player.aiProfile?.tendencies?.[key] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function getDefensiveWorkRate(player: Player) {
  return clamp(getPlayerAiTendency(player, "defensiveWorkRate", 1), 0.05, 1.2);
}

function getStayForwardBias(player: Player) {
  return clamp(getPlayerAiTendency(player, "stayForwardBias", 0), 0, 1);
}

function getOffBallRunBias(player: Player) {
  return clamp(getPlayerAiTendency(player, "offBallRunBias", 1), 0.6, 2);
}

function getBoxInfiltrationBias(player: Player) {
  return clamp(getPlayerAiTendency(player, "boxInfiltrationBias", 0), 0, 1);
}

function shouldStayHighOutOfPossession(player: Player, context: MovementContext) {
  const role = normalizeRole(player.role);
  if (role !== "ST" && role !== "W") return false;
  if (context.phase === "TRANSITION_LOST_BALL") return false;
  if (dangerLevel(player.side, context.ball.y) >= 0.78) return false;
  return getStayForwardBias(player) >= 0.45 && getDefensiveWorkRate(player) <= 0.55;
}

function getStayHighDefensiveDecision(player: Player, context: MovementContext): MovementDecision {
  const role = normalizeRole(player.role);
  const stayForward = getStayForwardBias(player);
  const laneX =
    role === "W"
      ? lerp(getWideLaneX(player), context.ball.x, 0.08)
      : lerp(getCentralLaneX(player), context.ball.x, 0.12);
  const recoveryDepth = 3 + (1 - stayForward) * 7;
  const highY = player.homePosition.y - context.direction * recoveryDepth;
  const safetyRecovery = dangerLevel(player.side, context.ball.y) * 6;

  return {
    state: "COVER_SPACE",
    targetPosition: clampToRoleZone(player, {
      x: laneX,
      y: highY - context.direction * safetyRecovery,
    }),
  };
}

function evaluateDefensiveShape(player: Player, context: MovementContext): MovementDecision | null {
  const { role, direction, teammates, opponents, owner } = context;
  if (role === "CB" || role === "FB") {
    const lineDecision = getBackLineCohesionDecision(player, context);
    if (lineDecision) return lineDecision;
  }

  if (shouldStayHighOutOfPossession(player, context)) {
    return getStayHighDefensiveDecision(player, context);
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

  if (role === "CM" && shouldInfiltrateFromMidfield(player, context)) {
    return {
      state: "ATTACK_SPACE",
      targetPosition: clampToRoleZone(player, getInfiltratingMidfielderSpace(player, context)),
    };
  }

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

  const zone = getTacticalAnchorZone(player, context, decision);
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
  const attackingSupport =
    context.hasPossession &&
    (decision.state === "PASS_SUPPORT" ||
      decision.state === "SUPPORT_ATTACK" ||
      decision.state === "MOVE_TO_SPACE" ||
      decision.state === "COVER_SPACE");
  const contextualTarget = combineMovementTargets([
    { target: zoneTarget, weight: attackingSupport ? 0.1 : 0.24 },
    { target: teamShapeTarget, weight: attackingSupport ? 0.16 : 0.34 },
    { target: roleIntentTarget, weight: attackingSupport ? 0.46 : 0.3 },
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
    state === "ATTACK_SPACE" ||
    state === "RECOVER_DEFENSE"
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
  decision: MovementDecision,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const role = normalizeRole(player.role);
  const roleX = getRoleXBounds(player, role);
  const roleY = getRoleYBounds(player.side, role);
  const shiftX = context.hasPossession
    ? clamp((context.ball.x - 50) * 0.12, -5, 5)
    : getDefensiveUnitShiftX(context.ball);
  const defensiveWorkRate = getDefensiveWorkRate(player);
  const stayForwardPush =
    (context.phase === "TRANSITION_LOST_BALL" ? 0 : getStayForwardBias(player)) *
    (role === "ST" || role === "W" ? 8 : role === "CM" ? 3 : 0);
  const defenseDepthShift =
    -context.direction * getDefenseDepthShift(role, context.ball, player) * defensiveWorkRate +
    context.direction * stayForwardPush;
  const depthShift = context.hasPossession
    ? context.direction * getAttackDepthShift(role, context.ball, player)
    : defenseDepthShift;
  const phaseDepthShift = context.direction * getPhaseDepthShift(role, context);
  const baseCenterX = clamp(player.homePosition.x + shiftX, roleX.min, roleX.max);
  const baseCenterY = clamp(
    player.homePosition.y + depthShift + phaseDepthShift,
    roleY.min,
    roleY.max,
  );
  const attackingFlex = context.hasPossession
    ? role === "CB"
      ? decision.state === "PASS_SUPPORT"
        ? 0.72
        : 0.52
      : role === "FB"
        ? 0.72
        : role === "DM"
          ? 0.66
          : role === "CM"
            ? 0.82
            : role === "W" || role === "ST"
              ? 0.86
              : 0.18
    : 0;
  const width = getZoneWidth(role) * (context.hasPossession ? (role === "GK" ? 1 : 1.3) : 1);
  const depth = getZoneDepth(role) * (context.hasPossession ? (role === "GK" ? 1 : 1.45) : 1);
  const centerX = clamp(
    lerp(baseCenterX, decision.targetPosition.x, attackingFlex),
    roleX.min,
    roleX.max,
  );
  const centerY = clamp(
    lerp(baseCenterY, decision.targetPosition.y, attackingFlex),
    roleY.min,
    roleY.max,
  );

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

  if (
    context.hasPossession &&
    (state === "PASS_SUPPORT" || state === "SUPPORT_ATTACK" || state === "MOVE_TO_SPACE")
  ) {
    const sameFlank = isSameFlank(player.homePosition.x, context.ball.x);
    return sameFlank ? 0.46 : 0.34;
  }

  if (
    context.hasPossession &&
    (state === "COVER_SPACE" || state === "HOLD_DEPTH" || state === "HOLD_LINE")
  ) {
    return 0.18;
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
  const role = normalizeRole(player.role);
  if (
    context.hasPossession &&
    (decision.state === "PASS_SUPPORT" ||
      decision.state === "SUPPORT_ATTACK" ||
      decision.state === "COVER_SPACE" ||
      decision.state === "HOLD_DEPTH" ||
      decision.state === "HOLD_LINE")
  ) {
    return role === "CB" || role === "DM" ? lerp(5.2, 8.2, relevance) : lerp(6, 9.5, relevance);
  }

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
    decision.state === "RECOVER_DEFENSE" ||
    decision.state === "HOLD_LINE" ||
    decision.state === "HOLD_DEPTH"
  ) {
    return lerp(1.15, 3.8, relevance);
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
  const base = clamp(ballAdvance * 0.23, -4, 16);
  if (role === "CB") return clamp(base, -3, 14);
  if (role === "FB") return clamp(base * 1.08, -3, 15);
  if (role === "DM") return clamp(base * 0.95, -3, 11);
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
    if (role === "CB") return 6.5;
    if (role === "FB") return 7.2;
    if (role === "DM") return 5.2;
    if (role === "CM") return 4.8;
    return 2;
  }

  if (context.phase === "IN_POSSESSION_BUILDUP") {
    if (role === "CB" || role === "FB") return 2;
    if (role === "DM" || role === "CM") return 1.5;
    return 0;
  }

  if (context.phase === "DEFENSIVE_PRESS") {
    if (role === "CB") return 2.5;
    if (role === "FB" || role === "DM" || role === "CM") return 2;
    if (role === "W" || role === "ST") return 1;
  }

  if (context.phase === "TRANSITION_LOST_BALL") {
    if (role === "GK" || role === "CB") return 0;
    if (role === "FB" || role === "DM" || role === "CM") return -1.5;
    return -2.5;
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

export function predictBallIntercept(player: Player, ball: Ball, playerSpeedMultiplier = 1): Vec2 {
  if (ball.ownerPlayerId != null) return ball.position;

  const target = ball.targetPosition ? clampPoint(ball.targetPosition) : null;
  const ballSpeed = length(ball.velocity);
  if (ballSpeed < 0.05) return target ?? clampPoint(ball.position);

  const direction = normalize(ball.velocity);
  const playerSpeed = Math.max(0.1, getPlayerMaxSpeed(player) * playerSpeedMultiplier);
  const stopTime = ballSpeed / Math.max(0.01, MOVEMENT.ballFriction);
  const predictionLimit = clamp(stopTime, 0.2, 2.2);
  const targetDistance = target ? distance(ball.position, target) : Number.POSITIVE_INFINITY;

  const projectBallAt = (seconds: number) => {
    const time = Math.min(seconds, stopTime);
    const travel = Math.max(0, ballSpeed * time - 0.5 * MOVEMENT.ballFriction * time * time);
    if (target && travel >= targetDistance) return target;
    return clampPoint(add(ball.position, scale(direction, travel)));
  };

  for (let seconds = 0.08; seconds <= predictionLimit; seconds += 0.08) {
    const projected = projectBallAt(seconds);
    const playerReach = playerSpeed * seconds + MOVEMENT.ballControlRadius;
    if (distance(player.position, projected) <= playerReach) return projected;
    if (target && projected.x === target.x && projected.y === target.y) return target;
  }

  return target ?? projectBallAt(predictionLimit);
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
  const statScale = clamp(Number(player.stats?.speed ?? 70) / 100, 0.78, 1.12);
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
  const statScale = clamp(Number(player.stats?.acceleration ?? 70) / 100, 0.8, 1.12);
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
      const lowWorkPenalty =
        (1 - getDefensiveWorkRate(item)) * (itemRole === "ST" || itemRole === "W" ? 18 : 8) +
        getStayForwardBias(item) * 8;
      return {
        id: item.id,
        score:
          distance(item.position, context.ball) +
          distance(item.homePosition, context.ball) * 0.1 +
          homeRisk +
          lowWorkPenalty,
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
  if (
    (role === "ST" || role === "W") &&
    getDefensiveWorkRate(player) <= 0.55 &&
    getStayForwardBias(player) >= 0.45
  ) {
    return false;
  }
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

function getTransitionRecoveryTarget(player: Player, context: MovementContext) {
  const role = normalizeRole(player.role);
  if (role === "GK") {
    return clampToRoleZone(player, {
      x: lerp(player.position.x, 50, 0.45),
      y: ownGoalY(player.side) - context.direction * 3,
    });
  }

  const workRate = getDefensiveWorkRate(player);
  const ownward = -context.direction;
  const retreatStep =
    role === "CB" || role === "FB" ? 7 : role === "DM" || role === "CM" ? 6 : 3.5 + workRate * 3;
  const screenGap =
    role === "CB" ? 15 : role === "FB" || role === "DM" ? 12 : role === "CM" ? 10 : 8;
  const immediateRecoveryY = player.position.y + ownward * retreatStep;
  const ballGoalSideY = context.ball.y + ownward * screenGap;
  const shapeRecoveryY = lerp(player.position.y, player.homePosition.y, 0.35 + workRate * 0.3);
  const desiredY = lerp(ballGoalSideY, shapeRecoveryY, role === "ST" || role === "W" ? 0.62 : 0.45);
  const recoveryY =
    ownward > 0 ? Math.max(immediateRecoveryY, desiredY) : Math.min(immediateRecoveryY, desiredY);

  return clampToRoleZone(player, {
    x: lerp(player.position.x, lerp(player.homePosition.x, context.ball.x, 0.28), 0.62),
    y: recoveryY,
  });
}

function isDesignatedPresser(player: Player, teammates: Player[], ball: Vec2) {
  const role = normalizeRole(player.role);
  if (role === "GK") return false;

  const direction = attackDirection(player.side);
  const ballInDefensiveHalf = direction < 0 ? ball.y > 52 : ball.y < 48;
  const danger = dangerLevel(player.side, ball.y);
  const maxPressers = ballInDefensiveHalf && danger >= 0.42 ? 2 : 1;
  const ranked = teammates
    .filter((item) => normalizeRole(item.role) !== "GK")
    .map((item) => {
      const itemRole = normalizeRole(item.role);
      const leaveHome = distance(item.homePosition, ball);
      const rolePenalty =
        itemRole === "CB"
          ? ballInDefensiveHalf && danger >= 0.7
            ? 10
            : 28
          : itemRole === "FB"
            ? ballInDefensiveHalf
              ? 7
              : 12
            : itemRole === "DM"
              ? 3
              : itemRole === "ST" || itemRole === "W"
                ? 2
                : 0;
      const lowWorkPenalty =
        (1 - getDefensiveWorkRate(item)) * (itemRole === "ST" || itemRole === "W" ? 18 : 8) +
        getStayForwardBias(item) * 8;
      return {
        id: item.id,
        distance: distance(item.position, ball) + leaveHome * 0.12 + rolePenalty + lowWorkPenalty,
      };
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, maxPressers);

  return ranked.some((item) => item.id === player.id);
}

function isEmergencyBallPressure(player: Player, context: MovementContext) {
  const role = normalizeRole(player.role);
  if (role === "GK") return distance(player.position, context.ball) <= 10;
  if (!isBallInDefensiveResponsibilityZone(player, context.ball)) return false;

  const gap = distance(player.position, context.ball);
  const danger = dangerLevel(player.side, context.ball.y);
  const ownerCanShoot =
    context.owner &&
    context.owner.side !== player.side &&
    distance(context.owner.position, context.ball) <= 3;

  if (role === "CB")
    return (
      danger >= 0.54 &&
      gap <= 15 &&
      (Boolean(ownerCanShoot) || (context.ball.x >= 24 && context.ball.x <= 76))
    );
  if (role === "FB")
    return danger >= 0.42 && gap <= 14 && isSameFlank(player.homePosition.x, context.ball.x);
  if (role === "DM" || role === "CM") return gap <= 12 || (danger >= 0.42 && gap <= 16);
  return gap <= 8;
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
    distance(player.position, ball) <= (role === "CB" ? 28 : 24);

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
  const centralDanger = carrierPoint.x >= 24 && carrierPoint.x <= 76;
  const betweenLines =
    player.side === "home"
      ? carrierPoint.y >= lineDepth - 26 && carrierPoint.y <= lineDepth + 12
      : carrierPoint.y <= lineDepth + 26 && carrierPoint.y >= lineDepth - 12;
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

  return (
    centralDanger && betweenLines && coverBehind && noDangerousRunner && pressureDistance >= 2.5
  );
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
  const advance = direction < 0 ? 66 - ball.y : ball.y - 34;
  const stablePossessionPush =
    direction < 0 ? clamp(62 - ball.y, 0, 24) : clamp(ball.y - 38, 0, 24);
  const push = clamp(14 + advance * 0.38 + stablePossessionPush * 0.24, 10, 34);

  return direction < 0 ? clamp(averageHomeY - push, 38, 78) : clamp(averageHomeY + push, 22, 62);
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
  const { ball, direction, owner, opponents, tick } = context;
  const role = normalizeRole(player.role);
  const attackingZone = getAttackingBuildUpZone(context);
  const supportOrigin = owner?.side === player.side ? owner.position : ball;
  const nearestOpponentGap = getNearestOpponentDistance(player.position, opponents);
  const escapeSide = ball.x < 45 ? 1 : ball.x > 55 ? -1 : player.homePosition.x < 50 ? -1 : 1;
  const sameFlank = isSameFlank(player.homePosition.x, ball.x);
  const laneSign = player.homePosition.x < 50 ? -1 : player.homePosition.x > 50 ? 1 : escapeSide;

  if (attackingZone === "first_phase") {
    return {
      x: clamp(supportOrigin.x + laneSign * (role === "DM" ? 8 : 12), 22, 78),
      y: clamp(supportOrigin.y + direction * (role === "DM" ? 7 : 12), 18, 82),
    };
  }

  if (attackingZone === "progression") {
    if (sameFlank) {
      return {
        x: clamp(ball.x + escapeSide * (nearestOpponentGap <= 8 ? 12 : 9), 22, 78),
        y: clamp(ball.y - direction * (nearestOpponentGap <= 8 ? 6 : 4), 18, 82),
      };
    }

    return {
      x: clamp(lerp(getCentralLaneX(player), 50 + laneSign * 15, 0.62), 24, 76),
      y: clamp(ball.y + direction * (role === "DM" ? 5 : 12), 16, 84),
    };
  }

  const thirdManPulse = (tick + player.id) % 5 <= 1;
  const finalThirdDepth =
    role === "DM" || !thirdManPulse
      ? ball.y - direction * (nearestOpponentGap <= 8 ? 9 : 7)
      : ball.y + direction * 10;

  return {
    x: clamp(lerp(getCentralLaneX(player), 50 + laneSign * 14, sameFlank ? 0.72 : 0.46), 24, 76),
    y: clamp(finalThirdDepth, 12, 88),
  };
}

function shouldInfiltrateFromMidfield(player: Player, context: MovementContext) {
  const infiltrationBias = getBoxInfiltrationBias(player);
  if (context.owner?.id === player.id) return false;

  const ballAdvance = context.direction < 0 ? 50 - context.ball.y : context.ball.y - 50;
  const runCycle = (context.tick + player.id) % 8;
  const activeRunTicks = Math.round(1 + infiltrationBias * 4);
  return context.phase === "IN_POSSESSION_ATTACK" && ballAdvance >= 4 && runCycle < activeRunTicks;
}

function getInfiltratingMidfielderSpace(player: Player, context: MovementContext) {
  const { ball, direction, opponents, tick } = context;
  const centerBacks = opponents.filter((item) => normalizeRole(item.role) === "CB");
  const defenderGap = getLargestHorizontalGap(centerBacks);
  const onsideLine = getOffsideLine(player.side, opponents);
  const offBallRunBias = getOffBallRunBias(player);
  const infiltrationBias = getBoxInfiltrationBias(player);
  const curvedRun = Math.sin((tick + player.id * 5) * 0.62) * (2.4 + infiltrationBias * 2);
  const desiredDepth = 9 + offBallRunBias * 5;
  const lineSafety = direction < 0 ? onsideLine + 1.8 : onsideLine - 1.8;
  const forwardTarget = ball.y + direction * desiredDepth;
  const targetY =
    direction < 0 ? Math.max(lineSafety, forwardTarget) : Math.min(lineSafety, forwardTarget);

  return {
    x: clamp(lerp(player.position.x, defenderGap, 0.58) + curvedRun, 28, 72),
    y: clamp(targetY, 10, 90),
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
  const { ball, direction, tick, owner } = context;
  const sameFlank = isSameFlank(player.homePosition.x, ball.x);
  const wideX = getWideLaneX(player);
  const halfSpaceX = wideX < 50 ? 32 : 68;
  const insideChannelX = wideX < 50 ? 38 : 62;
  const finalThird = isInFinalThird(player.side, ball.y);
  const ownerRole = owner ? normalizeRole(owner.role) : null;
  const variant = (tick + player.id) % 6;

  if (!sameFlank && finalThird) {
    return {
      x: clamp(lerp(wideX, insideChannelX, variant <= 2 ? 0.56 : 0.28), 8, 92),
      y: ball.y + direction * (variant <= 2 ? 18 : 12),
    };
  }

  if (sameFlank && (ownerRole === "FB" || ownerRole === "CM" || variant === 0)) {
    return {
      x: lerp(wideX, halfSpaceX, variant === 0 ? 0.8 : 0.5),
      y: ball.y - direction * (variant === 0 ? 5 : 1),
    };
  }

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
  const variant = (tick + player.id) % 5;
  if (variant === 0) {
    return {
      x: clamp(lerp(player.homePosition.x, ball.x, 0.28) + microShift, 32, 68),
      y: clamp(ball.y - direction * 8, 16, 84),
    };
  }

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
  const baseYBounds = getRoleYBounds(player.side, role);
  const infiltrationDepth = role === "CM" ? Math.round(getBoxInfiltrationBias(player) * 14) : 0;
  const yBounds =
    player.side === "home"
      ? { min: Math.max(10, baseYBounds.min - infiltrationDepth), max: baseYBounds.max }
      : { min: baseYBounds.min, max: Math.min(90, baseYBounds.max + infiltrationDepth) };
  const xBounds = getRoleXBounds(player, role);

  return {
    x: clamp(target.x, xBounds.min, xBounds.max),
    y: clamp(target.y, yBounds.min, yBounds.max),
  };
}

function getRoleYBounds(side: Side, role: PlayerRole) {
  const homeBounds: Record<PlayerRole, { min: number; max: number }> = {
    GK: { min: 88, max: 96 },
    CB: { min: 32, max: 88 },
    FB: { min: 14, max: 86 },
    DM: { min: 28, max: 78 },
    CM: { min: 16, max: 76 },
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
  if (role === "CDM" || role.includes("DM")) return "DM";
  if (role === "AM" || role === "CAM") return "CM";
  if (role === "CM") return "CM";
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
