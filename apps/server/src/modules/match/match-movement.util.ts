export const SIM_TICK_MS = 1000;
export const SIM_TICK_SECONDS = SIM_TICK_MS / 1000;
export const SIM_TICKS_PER_SECOND = 1000 / SIM_TICK_MS;

export const MOVEMENT = {
  walkingSpeed: 1.35,
  jogSpeed: 3.1,
  sprintSpeed: 5.4,
  playerWithBallSpeedMultiplier: 0.86,
  acceleration: 9.5,
  braking: 7,
  turnSmoothing: 0.88,
  arrivalRadius: 5.5,
  stopRadius: 0.45,
  separationRadius: 5.4,
  separationStrength: 1.35,
  sameTargetOffset: 3.2,
  passSpeed: 24,
  shotSpeed: 36,
  ballFriction: 8.5,
  ballControlRadius: 1.4,
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
  | "RECOVER_DEFENSE";

export type PlayerRole = "GK" | "CB" | "FB" | "DM" | "CM" | "W" | "ST";

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
  homePlayers: Player[];
  awayPlayers: Player[];
  ball: Ball;
  homeTactics?: TeamTactics;
  awayTactics?: TeamTactics;
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
      const strength = ((MOVEMENT.separationRadius - dist) / MOVEMENT.separationRadius) *
        MOVEMENT.separationStrength;
      return add(acc, scale(away, strength / dist));
    },
    { x: 0, y: 0 },
  );

  player.targetPosition = clampToRoleZone(player, add(player.targetPosition, push));
}

export function getTacticalTarget(
  player: Player,
  gameState: GameState,
): { state: PlayerAIState; targetPosition: Vec2 } {
  const allPlayers = [...gameState.homePlayers, ...gameState.awayPlayers];
  const teammates = player.side === "home" ? gameState.homePlayers : gameState.awayPlayers;
  const opponents = player.side === "home" ? gameState.awayPlayers : gameState.homePlayers;
  const owner = allPlayers.find((item) => item.id === gameState.ball.ownerPlayerId) ?? null;
  const hasPossession = gameState.possession === player.side;
  const role = normalizeRole(player.role);
  const direction = attackDirection(player.side);
  const ball = gameState.ball.position;

  if (player.hasBall || owner?.id === player.id) {
    const lane = role === "W" || role === "FB" ? Math.sign(player.homePosition.x - 50) * 4 : 0;
    return {
      state: "DRIBBLE",
      targetPosition: clampToRoleZone(player, {
        x: player.position.x + lane,
        y: player.position.y + direction * 6,
      }),
    };
  }

  if (gameState.ball.intendedReceiverId === player.id) {
    return {
      state: "RECEIVE_PASS",
      targetPosition: predictBallIntercept(player, gameState.ball),
    };
  }

  if (hasPossession) {
    if (role === "GK") {
      return {
        state: "HOLD_POSITION",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.homePosition.x, ball.x, 0.08),
          y: ownGoalY(player.side) - direction * 3,
        }),
      };
    }

    if (role === "CB") {
      return {
        state: "HOLD_POSITION",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.homePosition.x, ball.x, 0.14),
          y: player.homePosition.y + direction * 7,
        }),
      };
    }

    if (role === "DM") {
      return {
        state: "SUPPORT_ATTACK",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.homePosition.x, ball.x, 0.24),
          y: ball.y - direction * 10,
        }),
      };
    }

    if (role === "FB") {
      const sameFlank = isSameFlank(player.homePosition.x, ball.x);
      return {
        state: sameFlank ? "SUPPORT_ATTACK" : "HOLD_POSITION",
        targetPosition: clampToRoleZone(player, {
          x: sameFlank ? player.homePosition.x : lerp(player.homePosition.x, 50, 0.18),
          y: player.homePosition.y + direction * (sameFlank ? 18 : 8),
        }),
      };
    }

    if (role === "W") {
      const wideX = player.homePosition.x < 50 ? 10 : 90;
      return {
        state: "MOVE_TO_SPACE",
        targetPosition: clampToRoleZone(player, {
          x: wideX,
          y: ball.y + direction * 13,
        }),
      };
    }

    if (role === "ST") {
      return {
        state: "MOVE_TO_SPACE",
        targetPosition: clampToRoleZone(player, {
          x: lerp(player.homePosition.x, ball.x, 0.34),
          y: ball.y + direction * 15,
        }),
      };
    }

    return {
      state: "SUPPORT_ATTACK",
      targetPosition: clampToRoleZone(player, {
        x: lerp(player.homePosition.x, ball.x, 0.34),
        y: ball.y - direction * 8,
      }),
    };
  }

  if (isDesignatedPresser(player, teammates, ball)) {
    return { state: "PRESS_BALL", targetPosition: getPressTarget(player, ball) };
  }

  const mark = findNearestOpponent(player, opponents);
  if (mark && role !== "GK") {
    const coverGoalSide = {
      x: lerp(mark.position.x, 50, role === "CB" || role === "DM" ? 0.28 : 0.16),
      y: mark.position.y - direction * getMarkGoalSideGap(role),
    };
    return { state: "MARK_OPPONENT", targetPosition: clampToRoleZone(player, coverGoalSide) };
  }

  return {
    state: "RECOVER_DEFENSE",
    targetPosition: clampToRoleZone(player, {
      x: lerp(player.homePosition.x, ball.x, role === "GK" ? 0.08 : 0.24),
      y: player.homePosition.y - direction * getRecoveryDrop(role),
    }),
  };
}

export function predictBallIntercept(player: Player, ball: Ball): Vec2 {
  if (ball.ownerPlayerId != null) return ball.position;
  if (ball.targetPosition) return clampPoint(ball.targetPosition);

  const relative = sub(ball.position, player.position);
  const ballSpeed = Math.max(0.01, length(ball.velocity));
  const playerSpeed = Math.max(0.1, getPlayerMaxSpeed(player));
  const timeToReachBallNow = length(relative) / playerSpeed;
  const predictionTime = clamp(timeToReachBallNow * 0.72, 0.15, 1.8);
  const projected = add(ball.position, scale(ball.velocity, Math.min(predictionTime, 45 / ballSpeed)));

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
  const moveDirection = length(owner.velocity) > 0.02 ? normalize(owner.velocity) : { x: 0, y: attackDirection(owner.side) };
  const offset = scale(moveDirection, 0.65);
  ball.position = clampPoint(add(owner.position, offset));
  ball.velocity = owner.velocity;
}

function getPlayerMaxSpeed(player: Player) {
  const statScale = clamp(Number(player.stats?.speed ?? 70) / 100, 0.72, 1.18);
  const staminaScale = clamp(Number(player.stamina ?? 70) / 100, 0.72, 1.05);
  const stateSpeed =
    player.state === "PRESS_BALL" || player.state === "MOVE_TO_SPACE"
      ? MOVEMENT.sprintSpeed
      : player.state === "IDLE" || player.state === "HOLD_POSITION"
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
      const angle = (Math.PI * 2 * index) / group.length;
      player.targetPosition = clampToRoleZone(player, {
        x: player.targetPosition.x + Math.cos(angle) * MOVEMENT.sameTargetOffset,
        y: player.targetPosition.y + Math.sin(angle) * MOVEMENT.sameTargetOffset,
      });
    });
  });
}

function isDesignatedPresser(player: Player, teammates: Player[], ball: Vec2) {
  const role = normalizeRole(player.role);
  if (role === "GK") return false;

  const direction = attackDirection(player.side);
  const ballInDefensiveHalf = direction < 0 ? ball.y > 52 : ball.y < 48;
  const maxPressers = ballInDefensiveHalf ? 2 : 1;
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
      return { id: item.id, distance: distance(item.position, ball) + leaveHome * 0.12 + rolePenalty };
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, maxPressers);

  return ranked.some((item) => item.id === player.id);
}

function getPressTarget(player: Player, ball: Vec2) {
  const role = normalizeRole(player.role);
  const maxLeaveHome =
    role === "CB" ? 12 : role === "FB" ? 18 : role === "DM" ? 20 : role === "CM" ? 24 : 28;
  return clampToRoleZone(player, {
    x: clamp(ball.x, player.homePosition.x - maxLeaveHome, player.homePosition.x + maxLeaveHome),
    y: clamp(ball.y, player.homePosition.y - maxLeaveHome, player.homePosition.y + maxLeaveHome),
  });
}

function findNearestOpponent(player: Player, opponents: Player[]) {
  return opponents
    .filter((item) => normalizeRole(item.role) !== "GK")
    .map((item) => ({ player: item, distance: distance(player.homePosition, item.position) }))
    .sort((left, right) => left.distance - right.distance)[0]?.player ?? null;
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
    CB: { min: 64, max: 86 },
    FB: { min: 52, max: 84 },
    DM: { min: 48, max: 72 },
    CM: { min: 32, max: 66 },
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
  const laneCenter = player.homePosition.x;
  if (role === "GK") return { min: 40, max: 60 };
  if (role === "CB") return { min: Math.max(22, laneCenter - 16), max: Math.min(78, laneCenter + 16) };
  if (role === "FB") {
    return laneCenter < 50 ? { min: 5, max: 34 } : { min: 66, max: 95 };
  }
  if (role === "W") {
    return laneCenter < 50 ? { min: 5, max: 38 } : { min: 62, max: 95 };
  }
  if (role === "ST") return { min: 30, max: 70 };
  return { min: 18, max: 82 };
}

function ownGoalY(side: Side) {
  return side === "home" ? 92 : 8;
}

function isSameFlank(playerX: number, ballX: number) {
  if (playerX < 35) return ballX < 48;
  if (playerX > 65) return ballX > 52;
  return ballX >= 32 && ballX <= 68;
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
