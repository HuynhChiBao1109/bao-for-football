import { EPlayerSkill, getPlayerSkillSlug } from "src/modules/player/enum/player-skill.enum";
import { ETeamFormation } from "src/modules/team/enums/team-formation.enum";
import { EMatchEvent } from "./enums";
import {
  buildMagicDribbleTrajectory,
  buildThunderShotTrajectory,
  getSkillLabel,
  resolveSkillActivation,
  TrajectoryPoint,
} from "./match-skills.util";
import {
  applySeparation,
  getTacticalTarget,
  MOVEMENT,
  Player as MovementPlayer,
  PlayerAIState,
  TacticalPhase,
  predictBallIntercept,
  SIM_TICK_MS,
  SIM_TICK_SECONDS,
  SIM_TICKS_PER_SECOND,
  updatePlayerMovement,
} from "./match-movement.util";

export const MATCH_REAL_DURATION_MS = 180_000;
export const MATCH_CLOCK_SECONDS = 180;
export const MATCH_TICK_MS = SIM_TICK_MS;
export const TICKS_PER_SECOND = SIM_TICKS_PER_SECOND;
export const TICKS_PER_MINUTE = 60 * TICKS_PER_SECOND;
export const MATCH_DURATION_TICKS = MATCH_CLOCK_SECONDS * TICKS_PER_SECOND;
export const DEBUG_TICK_STEP = 1;
export const FRAME_DURATION_MS = 620;
export const AUTO_TICK_INTERVAL_MS = FRAME_DURATION_MS;
const SKILL_FRAME_DURATION_MS = 620;
const PASS_FRAME_DURATION_MS = 560;
const DEAD_BALL_FRAME_DURATION_MS = 720;
const MIN_OWNER_POSSESSION_TICKS = Math.max(2, Math.round(1.8 * TICKS_PER_SECOND));
const MIN_TEAM_POSSESSION_TICKS = Math.max(1, Math.round(0.8 * TICKS_PER_SECOND));
const PASS_CADENCE_TICKS = Math.max(5, Math.round(5 * TICKS_PER_SECOND));
const TACKLE_CADENCE_TICKS = Math.max(2, Math.round(1.4 * TICKS_PER_SECOND));
const SHOT_CADENCE_TICKS = Math.max(1, Math.round(1.4 * TICKS_PER_SECOND));
const BALL_CONTROL_DISTANCE = 2.4;
const PLAYER_SPEED_UNITS_PER_TICK: Record<PlayerMoveIntent, number> = {
  anchor: 1.8,
  kickoff: 4,
  cover: 4.1,
  cover_space: 4.4,
  hold_depth: 2.4,
  hold_line: 2.4,
  hold_width: 3,
  mark: 4.6,
  track: 5.4,
  recover: 4.8,
  support: 5.2,
  pass_support: 5.2,
  chase: 6,
  run: 7,
  attack_space: 7.2,
  overlap: 7.4,
  underlap: 7.2,
  cut_inside: 7.1,
  press: 7.8,
};
const PASS_SPEED_UNITS_PER_TICK = MOVEMENT.passSpeed * SIM_TICK_SECONDS;
const SHOT_SPEED_UNITS_PER_TICK = MOVEMENT.shotSpeed * SIM_TICK_SECONDS;
export const FRAMES_PER_ACTION = 5;
export const ACTIONS_PER_HALF = 14;

type Side = "home" | "away";
type MatchStep =
  | "first_half_start"
  | "play"
  | "goal_reset"
  | "half_time"
  | "second_half_start"
  | "full_time";
type PlayActionType = "pass" | "shoot" | "block" | "goal" | "save";
type PossessionTempoKind = "pass" | "hold" | "carry" | "reposition";
type PassStyle = "short" | "through" | "lob" | "switch";
type RunTimingState =
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
type OffsideLineInfo = {
  secondLastDefenderY: number;
  ballY: number;
  effectiveOffsideLineY: number;
  safeLineY: number;
  direction: number;
  defendingGoalY: number;
};
type OffsideDebug = {
  isOffsidePosition: boolean;
  offsideLineY: number;
  safeLineY: number;
  distanceToOffsideLine: number;
  runTimingState: RunTimingState;
  isRequestingThroughBall: boolean;
  isCheckingBack: boolean;
  isLegalReceiver: boolean;
};
type OffsideSnapshot = {
  passerId: number;
  receiverId: number;
  passStartTick: number;
  ballStartPosition: TrajectoryPoint;
  receiverPositionAtPass: TrajectoryPoint;
  offsideLineAtPass: OffsideLineInfo;
  wasReceiverOffsideAtPass: boolean;
  involvedPlayers: number[];
};
type ShotType =
  | "POWER_SHOT"
  | "PLACED_SHOT"
  | "LOW_DRIVEN_SHOT"
  | "CHIP_SHOT"
  | "NEAR_POST_SHOT"
  | "FAR_POST_SHOT"
  | "FIRST_TIME_SHOT"
  | "DESPERATE_SHOT";
type ShotTargetZone =
  | "top-left corner"
  | "top-right corner"
  | "bottom-left corner"
  | "bottom-right corner"
  | "center-low"
  | "center-high"
  | "near post"
  | "far post"
  | "across-goal finish"
  | "low driven shot"
  | "high powerful shot";
type ShotHeightProfile = "low" | "mid" | "high" | "chip";
type ShotMetadata = {
  shooterId: number;
  shotType: ShotType;
  targetZone: ShotTargetZone;
  originalTarget: TrajectoryPoint;
  finalTargetAfterError: TrajectoryPoint;
  shotSpeed: number;
  accuracy: number;
  difficulty: number;
  expectedGoalValue: number;
  isOnTarget: boolean;
  isSaveable: boolean;
  saveDifficulty: number;
  missReason: string | null;
  goalkeeperPosition: TrajectoryPoint;
  goalkeeperReactionDifficulty: number;
};

export type PlayerMoveIntent =
  | "run"
  | "press"
  | "support"
  | "pass_support"
  | "attack_space"
  | "anchor"
  | "chase"
  | "kickoff"
  | "cover"
  | "cover_space"
  | "mark"
  | "track"
  | "recover"
  | "overlap"
  | "underlap"
  | "cut_inside"
  | "hold_width"
  | "hold_depth"
  | "hold_line";

export type PlayerMotion = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  intent: PlayerMoveIntent;
  directionX: number;
  directionY: number;
  targetX: number;
  targetY: number;
};

export type SimulationRosterPlayer = {
  userPlayerId: number;
  playerId: number;
  teamId: number;
  name: string;
  slug: string | null;
  positions: Array<{ position: string; effect: number }>;
  skills: EPlayerSkill[];
  skillSlugs: string[];
  stats: {
    pass: number;
    longPass: number;
    vision: number;
    shoot: number;
    tackle: number;
    balance: number;
    dribbling: number;
    acceleration: number;
    speed: number;
    stamina: number;
    gkKeeping: number;
    gkReflex: number;
    gkDiving: number;
    gkReach: number;
  };
};

export type SimulationTeamInput = {
  id: number;
  name: string;
  formation: ETeamFormation | null;
  passRatio: number;
  shotRatio: number;
  pressure: number;
  players: SimulationRosterPlayer[];
};

export type MatchRenderPlayer = {
  userPlayerId: number;
  playerId: number;
  teamId: number;
  side: Side;
  role: string;
  displayRole: string;
  name: string;
  shortName: string;
  slug: string | null;
  skills?: EPlayerSkill[];
  skillSlugs: string[];
  skillCharges?: Array<{ skill: EPlayerSkill; charge: number }>;
  x: number;
  y: number;
  homeX?: number;
  homeY?: number;
  vx?: number;
  vy?: number;
  targetX?: number;
  targetY?: number;
  aiState?: PlayerAIState;
  stamina: number;
  activeSkill: EPlayerSkill | null;
  hasBall: boolean;
  move?: PlayerMotion;
  offside?: OffsideDebug;
};

export type MatchSnapshot = {
  frameId: number;
  tick: number;
  durationMs: number;
  matchStep: MatchStep;
  minute: number;
  second: number;
  clockLabel: string;
  phase: "first_half" | "half_time" | "second_half" | "full_time";
  homeScore: number;
  awayScore: number;
  possession: Side;
  ball: {
    x: number;
    y: number;
    fromX?: number;
    fromY?: number;
    ownerPlayerId: number | null;
    speed: number;
    trajectory?: TrajectoryPoint[];
    skillTrajectory?: EPlayerSkill | null;
  };
  homePlayers: MatchRenderPlayer[];
  awayPlayers: MatchRenderPlayer[];
  tactical?: {
    phase: TacticalPhase;
    possessionTicks: number;
  };
  highlight: {
    event: EMatchEvent | null;
    label: string;
    teamSide: Side | null;
    actorPlayerId: number | null;
    secondaryPlayerId: number | null;
    skill: EPlayerSkill | null;
    skillSlug: string | null;
  };
};

export type SimulationEventDraft = {
  event: EMatchEvent;
  minute: number;
  teamId: number | null;
  actorPlayerId: number | null;
  secondaryPlayerId: number | null;
  payload: Record<string, unknown> | null;
};

export type SimulationPlayerStatsDraft = {
  playerId: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  passes: number;
  passAccuracy: number;
  tackles: number;
  tackleAccuracy: number;
  interceptions: number;
  minutesPlayed: number;
  shots: number;
  shotAccuracy: number;
  dribbles: number;
  dribbleAccuracy: number;
  foulsCommitted: number;
  foulsSuffered: number;
  offsides: number;
  rating: number;
};

export type MatchSimulationResult = {
  timeline: MatchSnapshot[];
  events: SimulationEventDraft[];
  playerStats: SimulationPlayerStatsDraft[];
  homeLineup: MatchRenderPlayer[];
  awayLineup: MatchRenderPlayer[];
  homeScore: number;
  awayScore: number;
};

export type MatchNextTickResult = {
  snapshot: MatchSnapshot;
  event: SimulationEventDraft;
};

export type MatchKickoffLineups = {
  homeLineup: MatchRenderPlayer[];
  awayLineup: MatchRenderPlayer[];
};

type FormationSlot = { role: string; label: string; x: number; y: number };
type InternalLineupPlayer = MatchRenderPlayer & {
  anchors: { x: number; y: number };
  raw: SimulationRosterPlayer;
};
type PositionState = {
  players: Map<
    number,
    {
      x: number;
      y: number;
      vx: number;
      vy: number;
      targetX: number;
      targetY: number;
      aiState: PlayerAIState;
    }
  >;
  ball: { x: number; y: number };
  possession?: Side;
  possessionTicks?: number;
  tacticalPhase?: TacticalPhase;
};
type ResolvedAction = {
  type: PlayActionType;
  event: EMatchEvent;
  label: string;
  possession: Side;
  actor: InternalLineupPlayer;
  partner: InternalLineupPlayer | null;
  defender: InternalLineupPlayer;
  keeper: InternalLineupPlayer;
  isGoal: boolean;
  skill: EPlayerSkill | null;
  skillLabel: string | null;
};

const FORMATION_LAYOUTS: Record<number, FormationSlot[]> = {
  [ETeamFormation.F433]: [
    { role: "GK", label: "GK", x: 50, y: 92 },
    { role: "LB", label: "LB", x: 18, y: 77 },
    { role: "CB", label: "CB", x: 38, y: 79 },
    { role: "CB", label: "CB", x: 62, y: 79 },
    { role: "RB", label: "RB", x: 82, y: 77 },
    { role: "LCM", label: "CM", x: 31, y: 57 },
    { role: "CM", label: "CM", x: 50, y: 53 },
    { role: "RCM", label: "CM", x: 69, y: 57 },
    { role: "LW", label: "LW", x: 20, y: 30 },
    { role: "ST", label: "ST", x: 50, y: 22 },
    { role: "RW", label: "RW", x: 80, y: 30 },
  ],
  [ETeamFormation.F442]: [
    { role: "GK", label: "GK", x: 50, y: 92 },
    { role: "LB", label: "LB", x: 18, y: 77 },
    { role: "CB", label: "CB", x: 38, y: 79 },
    { role: "CB", label: "CB", x: 62, y: 79 },
    { role: "RB", label: "RB", x: 82, y: 77 },
    { role: "LM", label: "LM", x: 18, y: 56 },
    { role: "LCM", label: "CM", x: 40, y: 58 },
    { role: "RCM", label: "CM", x: 60, y: 58 },
    { role: "RM", label: "RM", x: 82, y: 56 },
    { role: "LST", label: "ST", x: 42, y: 25 },
    { role: "RST", label: "ST", x: 58, y: 25 },
  ],
};

const SLOT_POSITION_MAP: Record<string, string[]> = {
  GK: ["GK"],
  LB: ["LB"],
  RB: ["RB"],
  CB: ["CB"],
  LCM: ["CM", "CDM", "AM"],
  CM: ["CM", "CDM", "AM"],
  RCM: ["CM", "CDM", "AM"],
  LM: ["LM", "LW"],
  RM: ["RM", "RW"],
  LW: ["LW", "LM", "ST"],
  RW: ["RW", "RM", "ST"],
  ST: ["ST", "SS", "AM"],
  LST: ["ST", "SS", "AM"],
  RST: ["ST", "SS", "AM"],
};

export function prepareMatchKickoffLineups(
  homeTeam: SimulationTeamInput,
  awayTeam: SimulationTeamInput,
): MatchKickoffLineups {
  const homeLineup = selectLineup(homeTeam, "home");
  const awayLineup = selectLineup(awayTeam, "away");

  applyKickoffShape(homeLineup, awayLineup);
  applyHomeKickoffPair(homeLineup);

  return {
    homeLineup: stripInternalLineup(homeLineup),
    awayLineup: stripInternalLineup(awayLineup),
  };
}

export function simulateMatch(
  homeTeam: SimulationTeamInput,
  awayTeam: SimulationTeamInput,
  _seedValue: number,
): MatchSimulationResult {
  const homeLineup = selectLineup(homeTeam, "home");
  const awayLineup = selectLineup(awayTeam, "away");
  const statsMap = new Map<number, SimulationPlayerStatsDraft>();

  [...homeLineup, ...awayLineup].forEach((player) => {
    statsMap.set(player.userPlayerId, createEmptyStats(player.userPlayerId));
  });

  const timeline: MatchSnapshot[] = [];
  const events: SimulationEventDraft[] = [];
  const homeScore = 0;
  const awayScore = 0;
  let frameId = 0;
  let positionState = createInitialPositionState(homeLineup, awayLineup);

  const pushFrames = (input: {
    count: number;
    tick?: number;
    minute: number;
    matchStep: MatchStep;
    phase: MatchSnapshot["phase"];
    possession: Side;
    ballOwner: InternalLineupPlayer;
    ballPath: TrajectoryPoint[];
    highlight: MatchSnapshot["highlight"];
    activeSkill?: EPlayerSkill | null;
    focusId?: number | null;
    pressId?: number | null;
  }) => {
    for (let tick = 0; tick < input.count; tick += 1) {
      const renderTick = (input.tick ?? frameId) + tick;
      const ball = input.ballPath[Math.min(tick, input.ballPath.length - 1)] ?? {
        x: input.ballOwner.anchors.x,
        y: input.ballOwner.anchors.y,
      };
      const snapshot = buildSnapshot({
        frameId,
        minute: input.minute,
        second: input.minute * 60 + Math.floor(renderTick / TICKS_PER_SECOND),
        tick: renderTick,
        matchStep: input.matchStep,
        phase: input.phase,
        homeScore,
        awayScore,
        possession: input.possession,
        homeLineup,
        awayLineup,
        ballOwner: input.ballOwner,
        ball,
        ballPath: input.ballPath,
        highlight: input.highlight,
        activeSkill: input.activeSkill ?? null,
        focusId: input.focusId ?? input.ballOwner.userPlayerId,
        pressId: input.pressId ?? null,
        positionState,
      });
      positionState = extractPositionState(snapshot);
      timeline.push(snapshot);
      frameId += 1;
    }
  };

  applyKickoffShape(homeLineup, awayLineup);
  const { homeKickoff, homeKickoffPartner } = applyHomeKickoffPair(homeLineup);
  positionState = createInitialPositionState(homeLineup, awayLineup);

  pushEvent(events, EMatchEvent.FIRST_HALF_START, 0, homeTeam.id, homeKickoff.userPlayerId, null, {
    label: "Tick 0: start hiep 1",
  });
  pushFrames({
    count: 1,
    tick: 0,
    minute: 0,
    matchStep: "first_half_start",
    phase: "first_half",
    possession: "home",
    ballOwner: homeKickoff,
    ballPath: fixedBallPath(homeKickoff.anchors.x, homeKickoff.anchors.y),
    highlight: createHighlight(
      EMatchEvent.FIRST_HALF_START,
      "Tick 0: start hiep 1",
      "home",
      homeKickoff.userPlayerId,
      homeKickoffPartner.userPlayerId,
      null,
    ),
  });

  addPass(statsMap, homeKickoff.userPlayerId, true);
  pushEvent(
    events,
    EMatchEvent.PASS,
    0,
    homeTeam.id,
    homeKickoff.userPlayerId,
    homeKickoffPartner.userPlayerId,
    {
      label: "Tick 2: pass giao bong",
    },
  );
  pushFrames({
    count: 1,
    tick: DEBUG_TICK_STEP,
    minute: 0,
    matchStep: "play",
    phase: "first_half",
    possession: "home",
    ballOwner: homeKickoffPartner,
    ballPath: fixedBallPath(homeKickoffPartner.anchors.x, homeKickoffPartner.anchors.y),
    highlight: createHighlight(
      EMatchEvent.PASS,
      "Tick 2: pass giao bong",
      "home",
      homeKickoff.userPlayerId,
      homeKickoffPartner.userPlayerId,
      null,
    ),
  });

  finalizeRatings(statsMap);
  return {
    timeline,
    events,
    playerStats: Array.from(statsMap.values()),
    homeLineup: stripInternalLineup(homeLineup),
    awayLineup: stripInternalLineup(awayLineup),
    homeScore,
    awayScore,
  };
}

export function generateNextMatchTick(input: {
  previousTicks: MatchSnapshot[];
  homeLineup: MatchRenderPlayer[];
  awayLineup: MatchRenderPlayer[];
  homeTeamId: number | null;
  simulationSeed?: number;
}): MatchNextTickResult | null {
  const previousTicks = [...input.previousTicks].sort(
    (left, right) => left.frameId - right.frameId,
  );
  const frameId = previousTicks.length;
  const latestTick = previousTicks.at(-1);
  const homeLineup = input.homeLineup.map(toInternalLineupPlayer);
  const awayLineup = input.awayLineup.map(toInternalLineupPlayer);
  addTickSkillCharge([...homeLineup, ...awayLineup]);

  if (!homeLineup.length || !awayLineup.length) {
    return null;
  }

  const { kickoff: fallbackHomeKickoff } = selectKickoffPair(homeLineup, "home");
  const previousPositionState = latestTick
    ? extractPositionState(latestTick)
    : createInitialPositionState(homeLineup, awayLineup);

  if (!latestTick) {
    const { homeKickoff, homeKickoffPartner } = applyHomeKickoffPair(homeLineup);
    const snapshot = buildSnapshot({
      frameId,
      minute: 0,
      second: 0,
      tick: 0,
      matchStep: "first_half_start",
      phase: "first_half",
      homeScore: 0,
      awayScore: 0,
      possession: "home",
      homeLineup,
      awayLineup,
      ballOwner: homeKickoff,
      ball: { x: homeKickoff.anchors.x, y: homeKickoff.anchors.y },
      ballPath: fixedBallPath(homeKickoff.anchors.x, homeKickoff.anchors.y),
      highlight: createHighlight(
        EMatchEvent.FIRST_HALF_START,
        "Tick 0: start hiep 1",
        "home",
        homeKickoff.userPlayerId,
        homeKickoffPartner.userPlayerId,
        null,
      ),
      activeSkill: null,
      focusId: homeKickoff.userPlayerId,
      pressId: null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: EMatchEvent.FIRST_HALF_START,
        minute: 0,
        teamId: input.homeTeamId,
        actorPlayerId: homeKickoff.userPlayerId,
        secondaryPlayerId: homeKickoffPartner.userPlayerId,
        payload: { label: snapshot.highlight.label },
      },
    };
  }

  const nextTickValue = latestTick.tick + DEBUG_TICK_STEP;
  const actionTick = nextTickValue + Math.abs(Math.floor(input.simulationSeed ?? 0) % 997);
  const second = getNextMatchClockSecond(latestTick);
  const minute = Math.floor(second / 60);
  const lifecycleAction = resolveMatchLifecycleAction(latestTick, nextTickValue, second);
  if (lifecycleAction) {
    const allPlayers = [...homeLineup, ...awayLineup];
    const currentOwnerId = Number(
      latestTick.ball.ownerPlayerId ?? latestTick.highlight?.actorPlayerId,
    );
    const currentOwner =
      allPlayers.find((player) => player.userPlayerId === currentOwnerId) ??
      (lifecycleAction.event === EMatchEvent.SECOND_HALF_START
        ? (awayLineup.find((player) => player.role !== "GK") ?? awayLineup[0])
        : fallbackHomeKickoff);
    const secondHalfKickoff =
      lifecycleAction.event === EMatchEvent.SECOND_HALF_START
        ? applyAwayKickoffPair(awayLineup)
        : null;
    const lifecycleOwner = secondHalfKickoff?.awayKickoff ?? currentOwner;
    const lifecyclePartner = secondHalfKickoff?.awayKickoffPartner ?? null;
    const ball =
      lifecycleAction.event === EMatchEvent.SECOND_HALF_START
        ? { x: lifecycleOwner.anchors.x, y: lifecycleOwner.anchors.y }
        : { x: latestTick.ball.x, y: latestTick.ball.y };
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: lifecycleAction.matchStep,
      phase: lifecycleAction.phase,
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: lifecycleAction.possession ?? latestTick.possession ?? "home",
      homeLineup,
      awayLineup,
      ballOwner: lifecycleOwner,
      ball,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, ball),
      highlight: createHighlight(
        lifecycleAction.event,
        lifecycleAction.label,
        lifecycleAction.possession ?? latestTick.possession ?? "home",
        lifecycleOwner.userPlayerId,
        lifecyclePartner?.userPlayerId ?? null,
        null,
      ),
      activeSkill: null,
      focusId: lifecycleOwner.userPlayerId,
      pressId: null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: lifecycleAction.event,
        minute,
        teamId: lifecycleOwner.teamId,
        actorPlayerId: lifecycleOwner.userPlayerId,
        secondaryPlayerId: lifecyclePartner?.userPlayerId ?? null,
        payload: { label: snapshot.highlight.label },
      },
    };
  }

  if (latestTick.highlight?.event === EMatchEvent.GOAL) {
    const losingSide: Side = latestTick.highlight.teamSide === "home" ? "away" : "home";
    const kickoffLineup = losingSide === "home" ? homeLineup : awayLineup;
    resetLineupsToOwnHalf(homeLineup, awayLineup);
    const { kickoff: kickoffPlayer } = selectKickoffPair(kickoffLineup, losingSide);
    const kickoffSpot = getKickoffSpot(losingSide);
    const resetPositionState = createInitialPositionState(homeLineup, awayLineup, losingSide);
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "goal_reset",
      phase: latestTick.phase === "second_half" ? "second_half" : "first_half",
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: losingSide,
      homeLineup,
      awayLineup,
      ballOwner: kickoffPlayer,
      ball: kickoffSpot,
      ballPath: fixedBallPath(kickoffSpot.x, kickoffSpot.y),
      highlight: createHighlight(
        EMatchEvent.GOAL_RESET,
        `Tick ${nextTickValue}: ${losingSide === "home" ? "Home" : "Away"} ve phan san nha sau ban thua`,
        losingSide,
        kickoffPlayer.userPlayerId,
        null,
        null,
      ),
      activeSkill: null,
      focusId: kickoffPlayer.userPlayerId,
      pressId: null,
      positionState: resetPositionState,
    });

    return {
      snapshot,
      event: {
        event: EMatchEvent.GOAL_RESET,
        minute,
        teamId: kickoffPlayer.teamId,
        actorPlayerId: kickoffPlayer.userPlayerId,
        secondaryPlayerId: null,
        payload: {
          label: snapshot.highlight.label,
          clockFrozen: true,
          resetAfterGoal: true,
          kickoffSide: losingSide,
          ball: kickoffSpot,
        },
      },
    };
  }

  if (latestTick.highlight?.event === EMatchEvent.GOAL_RESET) {
    const losingSide = latestTick.possession ?? "home";
    const kickoffLineup = losingSide === "home" ? homeLineup : awayLineup;
    const { kickoff: kickoffPlayer, partner: kickoffPartner } =
      losingSide === "home"
        ? applyHomeKickoffPair(kickoffLineup)
        : applyAwayKickoffPair(kickoffLineup);
    const kickoffSpot = { x: kickoffPlayer.anchors.x, y: kickoffPlayer.anchors.y };
    const ball = { x: kickoffPartner.anchors.x, y: kickoffPartner.anchors.y };
    const kickoffPositionState = createInitialPositionState(homeLineup, awayLineup, losingSide);
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase: latestTick.phase === "second_half" ? "second_half" : "first_half",
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: losingSide,
      homeLineup,
      awayLineup,
      ballOwner: kickoffPartner,
      ball,
      ballPath: pathBetween(kickoffSpot, ball),
      highlight: createHighlight(
        EMatchEvent.PASS,
        `Tick ${nextTickValue}: ${losingSide === "home" ? "Home" : "Away"} giao bong lai`,
        losingSide,
        kickoffPlayer.userPlayerId,
        kickoffPartner.userPlayerId,
        null,
      ),
      activeSkill: null,
      focusId: kickoffPartner.userPlayerId,
      pressId: null,
      positionState: kickoffPositionState,
    });

    return {
      snapshot,
      event: {
        event: EMatchEvent.PASS,
        minute,
        teamId: kickoffPlayer.teamId,
        actorPlayerId: kickoffPlayer.userPlayerId,
        secondaryPlayerId: kickoffPartner.userPlayerId,
        payload: {
          label: snapshot.highlight.label,
          kickoffAfterGoal: true,
          clockFrozen: true,
          from: kickoffSpot,
          to: ball,
        },
      },
    };
  }

  if (latestTick.highlight?.event === EMatchEvent.OFFSIDE) {
    const freeKickSide = latestTick.possession ?? "home";
    const freeKickLineup = freeKickSide === "home" ? homeLineup : awayLineup;
    const taker =
      freeKickLineup.find((player) => player.userPlayerId === latestTick.ball.ownerPlayerId) ??
      findNearestPlayer(freeKickLineup, latestTick.ball, (player) => player.role !== "GK") ??
      freeKickLineup[0];
    const partner =
      freeKickLineup
        .filter((player) => player.userPlayerId !== taker.userPlayerId && player.role !== "GK")
        .map((player) => ({
          player,
          distance: distance(player.anchors, latestTick.ball),
        }))
        .sort((left, right) => left.distance - right.distance)[0]?.player ?? taker;
    const restartTarget = moveToward(
      latestTick.ball,
      {
        x: clamp(partner.anchors.x, 8, 92),
        y: clamp(partner.anchors.y, 8, 92),
      },
      PASS_SPEED_UNITS_PER_TICK,
    );
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase: latestTick.phase === "second_half" ? "second_half" : "first_half",
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: freeKickSide,
      homeLineup,
      awayLineup,
      ballOwner: partner,
      ball: restartTarget,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, restartTarget),
      highlight: createHighlight(
        EMatchEvent.FREE_KICK,
        `Tick ${nextTickValue}: ${taker.shortName} da phat sau loi viet vi`,
        freeKickSide,
        taker.userPlayerId,
        partner.userPlayerId,
        null,
      ),
      activeSkill: null,
      focusId: partner.userPlayerId,
      pressId: null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: EMatchEvent.FREE_KICK,
        minute,
        teamId: taker.teamId,
        actorPlayerId: taker.userPlayerId,
        secondaryPlayerId: partner.userPlayerId,
        payload: {
          label: snapshot.highlight.label,
          reason: "offside_restart",
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: restartTarget,
        },
      },
    };
  }

  if (latestTick.highlight?.event === EMatchEvent.FOUL) {
    const freeKickSide = latestTick.possession ?? "home";
    const attackingLineup = freeKickSide === "home" ? homeLineup : awayLineup;
    const defendingLineup = freeKickSide === "home" ? awayLineup : homeLineup;
    const taker =
      attackingLineup.find(
        (player) => player.userPlayerId === latestTick.highlight?.actorPlayerId,
      ) ??
      findNearestPlayer(attackingLineup, latestTick.ball, (player) => player.role !== "GK") ??
      attackingLineup[0];
    const freeKick = resolveFreeKickAction({
      taker,
      attacking: attackingLineup,
      defending: defendingLineup,
      ball: latestTick.ball,
      possession: freeKickSide,
      previousPositionState,
      nextTick: actionTick,
    });
    const homeScore =
      Number(latestTick.homeScore ?? 0) + (freeKick.isGoal && freeKickSide === "home" ? 1 : 0);
    const awayScore =
      Number(latestTick.awayScore ?? 0) + (freeKick.isGoal && freeKickSide === "away" ? 1 : 0);
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase: latestTick.phase === "second_half" ? "second_half" : "first_half",
      homeScore,
      awayScore,
      possession: freeKick.isGoal ? freeKickSide : freeKick.nextPossession,
      homeLineup,
      awayLineup,
      ballOwner: freeKick.nextOwner,
      ball: freeKick.target,
      ballPath: freeKick.ballPath,
      highlight: createHighlight(
        freeKick.event,
        `Tick ${nextTickValue}: ${taker.shortName} ${freeKick.label}`,
        freeKickSide,
        taker.userPlayerId,
        freeKick.secondaryPlayerId,
        null,
      ),
      activeSkill: null,
      focusId: taker.userPlayerId,
      pressId: freeKick.wallPlayerIds[0] ?? null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: freeKick.event,
        minute,
        teamId: taker.teamId,
        actorPlayerId: taker.userPlayerId,
        secondaryPlayerId: freeKick.secondaryPlayerId,
        payload: {
          label: snapshot.highlight.label,
          freeKick: true,
          freeKickDecision: freeKick.decision,
          wallCount: freeKick.wallPlayerIds.length,
          wallPlayerIds: freeKick.wallPlayerIds,
          distanceToGoal: freeKick.distanceToGoal,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: freeKick.target,
          isGoal: freeKick.isGoal,
          homeScore,
          awayScore,
        },
      },
    };
  }

  if (isOutOfPlayRestartEvent(latestTick.highlight?.event ?? null)) {
    const restart = resolveOutOfPlayRestart({
      latestTick,
      homeLineup,
      awayLineup,
      previousPositionState,
      nextTick: actionTick,
    });
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase: latestTick.phase === "second_half" ? "second_half" : "first_half",
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: restart.possession,
      homeLineup,
      awayLineup,
      ballOwner: restart.receiver,
      ball: restart.target,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, restart.target),
      highlight: createHighlight(
        restart.event,
        `Tick ${nextTickValue}: ${restart.label}`,
        restart.possession,
        restart.taker.userPlayerId,
        restart.receiver.userPlayerId,
        null,
      ),
      activeSkill: null,
      focusId: restart.receiver.userPlayerId,
      pressId: null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: restart.event,
        minute,
        teamId: restart.taker.teamId,
        actorPlayerId: restart.taker.userPlayerId,
        secondaryPlayerId: restart.receiver.userPlayerId,
        payload: {
          label: snapshot.highlight.label,
          restart: true,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: restart.target,
        },
      },
    };
  }

  const outOfPlay = resolveOutOfPlayEvent({
    latestTick,
    homeLineup,
    awayLineup,
  });
  if (outOfPlay) {
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase: latestTick.phase === "second_half" ? "second_half" : "first_half",
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: outOfPlay.restartSide,
      homeLineup,
      awayLineup,
      ballOwner: outOfPlay.taker,
      ball: outOfPlay.spot,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, outOfPlay.spot),
      highlight: createHighlight(
        outOfPlay.event,
        `Tick ${nextTickValue}: ${outOfPlay.label}`,
        outOfPlay.restartSide,
        outOfPlay.taker.userPlayerId,
        null,
        null,
      ),
      activeSkill: null,
      focusId: outOfPlay.taker.userPlayerId,
      pressId: null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: outOfPlay.event,
        minute,
        teamId: outOfPlay.taker.teamId,
        actorPlayerId: outOfPlay.taker.userPlayerId,
        secondaryPlayerId: null,
        payload: {
          label: snapshot.highlight.label,
          outOfPlay: true,
          restartSide: outOfPlay.restartSide,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: outOfPlay.spot,
        },
      },
    };
  }

  const looseBallContest = resolveLooseBallContest({
    latestTick,
    homeLineup,
    awayLineup,
    previousPositionState,
  });
  if (looseBallContest) {
    if (looseBallContest.winner) {
      const newPossession = looseBallContest.winner.side;
      const isRecoveryByOpponent =
        looseBallContest.winner.userPlayerId !== looseBallContest.receiver.userPlayerId;
      const controlledEvent = isRecoveryByOpponent ? EMatchEvent.INTERCEPTION : EMatchEvent.DRIBBLE;
      const snapshot = buildSnapshot({
        frameId,
        minute,
        second,
        tick: nextTickValue,
        matchStep: "play",
        phase: latestTick.phase === "second_half" ? "second_half" : "first_half",
        homeScore: Number(latestTick.homeScore ?? 0),
        awayScore: Number(latestTick.awayScore ?? 0),
        possession: newPossession,
        homeLineup,
        awayLineup,
        ballOwner: looseBallContest.winner,
        ball: looseBallContest.ball,
        ballPath: pathBetween(
          { x: latestTick.ball.x, y: latestTick.ball.y },
          looseBallContest.ball,
        ),
        highlight: createHighlight(
          controlledEvent,
          isRecoveryByOpponent
            ? `Tick ${nextTickValue}: ${looseBallContest.winner.shortName} lao vao cuop bong loi`
            : `Tick ${nextTickValue}: ${looseBallContest.winner.shortName} nhan bong`,
          newPossession,
          looseBallContest.winner.userPlayerId,
          looseBallContest.receiver.userPlayerId,
          null,
        ),
        activeSkill: null,
        focusId: looseBallContest.winner.userPlayerId,
        pressId: isRecoveryByOpponent
          ? looseBallContest.receiver.userPlayerId
          : (looseBallContest.challenger?.userPlayerId ?? null),
        positionState: previousPositionState,
      });

      return {
        snapshot,
        event: {
          event: controlledEvent,
          minute,
          teamId: looseBallContest.winner.teamId,
          actorPlayerId: looseBallContest.winner.userPlayerId,
          secondaryPlayerId: looseBallContest.receiver.userPlayerId,
          payload: {
            label: snapshot.highlight.label,
            looseBallRecovery: true,
            contestedByPlayerId: looseBallContest.challenger?.userPlayerId ?? null,
            from: { x: latestTick.ball.x, y: latestTick.ball.y },
            to: looseBallContest.ball,
            recoveredPossession: newPossession,
          },
        },
      };
    }

    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase: latestTick.phase === "second_half" ? "second_half" : "first_half",
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: latestTick.possession ?? looseBallContest.receiver.side,
      homeLineup,
      awayLineup,
      ballOwner: looseBallContest.receiver,
      ball: looseBallContest.ball,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, looseBallContest.ball),
      highlight: createHighlight(
        looseBallContest.event,
        `Tick ${nextTickValue}: ${looseBallContest.receiver.shortName} va ${looseBallContest.challenger?.shortName ?? "doi thu"} lao vao bong loi`,
        latestTick.possession ?? looseBallContest.receiver.side,
        looseBallContest.actorId,
        looseBallContest.receiver.userPlayerId,
        null,
      ),
      activeSkill: null,
      focusId: looseBallContest.receiver.userPlayerId,
      pressId: looseBallContest.challenger?.userPlayerId ?? null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: looseBallContest.event,
        minute,
        teamId: looseBallContest.receiver.teamId,
        actorPlayerId: looseBallContest.actorId,
        secondaryPlayerId: looseBallContest.receiver.userPlayerId,
        payload: {
          label: snapshot.highlight.label,
          looseBallContest: true,
          challengerPlayerId: looseBallContest.challenger?.userPlayerId ?? null,
          receiverDistanceToBall: looseBallContest.receiverDistanceToBall,
          challengerDistanceToBall: looseBallContest.challengerDistanceToBall,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: looseBallContest.ball,
        },
      },
    };
  }

  const latestOwnerId = Number(
    latestTick.ball.ownerPlayerId ?? latestTick.highlight?.secondaryPlayerId,
  );
  const latestOwner = [...homeLineup, ...awayLineup].find(
    (player) => player.userPlayerId === latestOwnerId,
  );
  const possession = latestOwner?.side ?? latestTick.possession ?? "home";
  const attacking = possession === "home" ? homeLineup : awayLineup;
  const defending = possession === "home" ? awayLineup : homeLineup;
  const actor =
    (latestOwner?.side === possession ? latestOwner : null) ??
    findNearestPlayer(attacking, latestTick.ball, (player) => player.role !== "GK") ??
    attacking[0];
  const phase = latestTick.phase === "second_half" ? "second_half" : "first_half";
  const tempoDecision = resolveDebugPossessionTempoAction({
    previousTicks,
    latestEvent: latestTick.highlight?.event ?? null,
    actor,
    defending,
    previousPositionState,
    ball: latestTick.ball,
    nextTick: actionTick,
    possession,
  });
  const shotAction = resolveDebugShotAction(
    {
      shooter: actor,
      attacking,
      defending,
      possession,
      ball: latestTick.ball,
      previousPositionState,
      nextTick: actionTick,
      latestEvent: latestTick.highlight?.event ?? null,
    },
    true,
  );

  if (shotAction) {
    const homeScore =
      Number(latestTick.homeScore ?? 0) + (shotAction.isGoal && possession === "home" ? 1 : 0);
    const awayScore =
      Number(latestTick.awayScore ?? 0) + (shotAction.isGoal && possession === "away" ? 1 : 0);
    const keeper = shotAction.keeper;
    const nextOwner = shotAction.isGoal ? actor : keeper;
    consumeSkillCharge(actor, shotAction.skill);
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase,
      homeScore,
      awayScore,
      possession: shotAction.isGoal ? possession : possession === "home" ? "away" : "home",
      homeLineup,
      awayLineup,
      ballOwner: nextOwner,
      ball: shotAction.target,
      ballPath: shotAction.ballPath,
      highlight: createHighlight(
        shotAction.event,
        `Tick ${nextTickValue}: ${actor.shortName} ${
          shotAction.skillLabel ? `dung ${shotAction.skillLabel}` : shotAction.label
        }`,
        possession,
        actor.userPlayerId,
        keeper.userPlayerId,
        shotAction.skill,
      ),
      activeSkill: shotAction.skill,
      focusId: actor.userPlayerId,
      pressId: keeper.userPlayerId,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: shotAction.event,
        minute,
        teamId: actor.teamId,
        actorPlayerId: actor.userPlayerId,
        secondaryPlayerId: keeper.userPlayerId,
        payload: {
          label: snapshot.highlight.label,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: shotAction.target,
          ballPath: shotAction.ballPath,
          shotQuality: shotAction.shotQuality,
          distanceToGoal: shotAction.distanceToGoal,
          isGoal: shotAction.isGoal,
          shotMetadata: shotAction.shotMetadata,
          skill: shotAction.skill,
          skillLabel: shotAction.skillLabel,
          homeScore,
          awayScore,
        },
      },
    };
  }

  if (tempoDecision.kind !== "pass") {
    const tackleDecision =
      tempoDecision.pressDefender != null
        ? resolveDebugDefensiveAction({
            defender: tempoDecision.pressDefender,
            actor,
            ball: latestTick.ball,
            ballTarget: tempoDecision.ballTarget,
            previousPositionState,
            nextTick: actionTick,
          })
        : null;

    if (tackleDecision) {
      if (tackleDecision.isFoul) {
        const snapshot = buildSnapshot({
          frameId,
          minute,
          second,
          tick: nextTickValue,
          matchStep: "play",
          phase,
          homeScore: Number(latestTick.homeScore ?? 0),
          awayScore: Number(latestTick.awayScore ?? 0),
          possession,
          homeLineup,
          awayLineup,
          ballOwner: actor,
          ball: tackleDecision.target,
          ballPath: pathBetween(
            { x: latestTick.ball.x, y: latestTick.ball.y },
            tackleDecision.target,
          ),
          highlight: createHighlight(
            EMatchEvent.FOUL,
            `Tick ${nextTickValue}: ${tempoDecision.pressDefender.shortName} xoac sai, pham loi voi ${actor.shortName}`,
            possession,
            actor.userPlayerId,
            tempoDecision.pressDefender.userPlayerId,
            null,
          ),
          activeSkill: null,
          focusId: actor.userPlayerId,
          pressId: tempoDecision.pressDefender.userPlayerId,
          positionState: previousPositionState,
        });

        return {
          snapshot,
          event: {
            event: EMatchEvent.FOUL,
            minute,
            teamId: actor.teamId,
            actorPlayerId: actor.userPlayerId,
            secondaryPlayerId: tempoDecision.pressDefender.userPlayerId,
            payload: {
              label: snapshot.highlight.label,
              foulByPlayerId: tempoDecision.pressDefender.userPlayerId,
              fouledPlayerId: actor.userPlayerId,
              freeKickSide: possession,
              from: { x: latestTick.ball.x, y: latestTick.ball.y },
              to: tackleDecision.target,
            },
          },
        };
      }

      const newPossession: Side = possession === "home" ? "away" : "home";
      consumeSkillCharge(tempoDecision.pressDefender, tackleDecision.skill ?? null);
      const snapshot = buildSnapshot({
        frameId,
        minute,
        second,
        tick: nextTickValue,
        matchStep: "play",
        phase,
        homeScore: Number(latestTick.homeScore ?? 0),
        awayScore: Number(latestTick.awayScore ?? 0),
        possession: newPossession,
        homeLineup,
        awayLineup,
        ballOwner: tempoDecision.pressDefender,
        ball: tackleDecision.target,
        ballPath: pathBetween(
          { x: latestTick.ball.x, y: latestTick.ball.y },
          tackleDecision.target,
        ),
        highlight: createHighlight(
          tackleDecision.event,
          `Tick ${nextTickValue}: ${tempoDecision.pressDefender.shortName} ${tackleDecision.label}`,
          newPossession,
          tempoDecision.pressDefender.userPlayerId,
          actor.userPlayerId,
          tackleDecision.skill ?? null,
        ),
        activeSkill: tackleDecision.skill ?? null,
        focusId: tempoDecision.pressDefender.userPlayerId,
        pressId: actor.userPlayerId,
        forceLooseBall: tackleDecision.isDeflection,
        positionState: previousPositionState,
      });

      return {
        snapshot,
        event: {
          event: tackleDecision.event,
          minute,
          teamId: tempoDecision.pressDefender.teamId,
          actorPlayerId: tempoDecision.pressDefender.userPlayerId,
          secondaryPlayerId: actor.userPlayerId,
          payload: {
            label: snapshot.highlight.label,
            from: { x: latestTick.ball.x, y: latestTick.ball.y },
            to: tackleDecision.target,
            recoveredPossession: newPossession,
            skill: tackleDecision.skill ?? null,
            skillLabel: tackleDecision.skillLabel ?? null,
            isDeflection: Boolean(tackleDecision.isDeflection),
          },
        },
      };
    }

    const skill = getChargedSkill(actor, "dribble");
    const ballPath =
      skill === EPlayerSkill.DRIBBLE_MAGIC
        ? buildMagicDribbleTrajectory(
            latestTick.ball.x,
            latestTick.ball.y,
            tempoDecision.ballTarget.x,
            tempoDecision.ballTarget.y,
            FRAMES_PER_ACTION,
            createDeterministicSkillRandom(actionTick, actor.userPlayerId),
          )
        : pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, tempoDecision.ballTarget);
    consumeSkillCharge(actor, skill);
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase,
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession,
      homeLineup,
      awayLineup,
      ballOwner: actor,
      ball: tempoDecision.ballTarget,
      ballPath,
      highlight: createHighlight(
        skill ? EMatchEvent.SKILL_USED : EMatchEvent.DRIBBLE,
        `Tick ${nextTickValue}: ${actor.shortName} ${
          skill ? `dung ${getSkillLabel(skill)}` : tempoDecision.label
        }`,
        possession,
        actor.userPlayerId,
        null,
        skill,
      ),
      activeSkill: skill,
      focusId: actor.userPlayerId,
      pressId: tempoDecision.pressDefender?.userPlayerId ?? null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: skill ? EMatchEvent.SKILL_USED : EMatchEvent.DRIBBLE,
        minute,
        teamId: actor.teamId,
        actorPlayerId: actor.userPlayerId,
        secondaryPlayerId: null,
        payload: {
          label: snapshot.highlight.label,
          action: tempoDecision.kind,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: tempoDecision.ballTarget,
          skill,
          skillLabel: skill ? getSkillLabel(skill) : null,
        },
      },
    };
  }

  const passDecision = resolveDebugPassingAction({
    lineup: attacking,
    defending,
    actor,
    previousPositionState,
    ball: latestTick.ball,
    tick: latestTick.tick,
    nextTick: actionTick,
    possession,
  });
  const { receiver, ballTarget, pressDefender, passStyle, offside, offsideSnapshot } = passDecision;
  const defensiveAction = passDecision.interception;
  const offsideReceive = checkOffsideOnReceive(receiver, offsideSnapshot);

  if (offsideReceive.offsideCalledOnReceive) {
    const newPossession: Side = possession === "home" ? "away" : "home";
    const freeKickTaker =
      pressDefender ??
      findNearestPlayer(defending, ballTarget, (player) => player.role !== "GK") ??
      defending[0];
    const offsideSpot = {
      x: clamp(receiver.anchors.x, 6, 94),
      y: clamp(offside.lineY, 6, 94),
    };
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase,
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: newPossession,
      homeLineup,
      awayLineup,
      ballOwner: freeKickTaker,
      ball: offsideSpot,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, offsideSpot),
      highlight: createHighlight(
        EMatchEvent.OFFSIDE,
        `Tick ${nextTickValue}: ${receiver.shortName} viet vi khi nhan ${getPassStyleLabel(passStyle)}`,
        newPossession,
        freeKickTaker.userPlayerId,
        null,
        null,
      ),
      activeSkill: null,
      focusId: freeKickTaker.userPlayerId,
      pressId: null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: EMatchEvent.OFFSIDE,
        minute,
        teamId: freeKickTaker.teamId,
        actorPlayerId: freeKickTaker.userPlayerId,
        secondaryPlayerId: receiver.userPlayerId,
        payload: {
          label: snapshot.highlight.label,
          reason: "offside",
          offenderPlayerId: receiver.userPlayerId,
          passStyle,
          lineY: offside.lineY,
          offsideSnapshot,
          receiverWasOffsideAtPass: offsideReceive.receiverWasOffsideAtPass,
          passWasLegal: false,
          offsideCalledOnReceive: true,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: offsideSpot,
          recoveredPossession: newPossession,
        },
      },
    };
  }

  if (defensiveAction && pressDefender) {
    const newPossession: Side = possession === "home" ? "away" : "home";
    const recoveredBall = {
      x: defensiveAction.target.x,
      y: defensiveAction.target.y,
    };
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase,
      homeScore: Number(latestTick.homeScore ?? 0),
      awayScore: Number(latestTick.awayScore ?? 0),
      possession: newPossession,
      homeLineup,
      awayLineup,
      ballOwner: pressDefender,
      ball: recoveredBall,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, recoveredBall),
      highlight: createHighlight(
        EMatchEvent.INTERCEPTION,
        `Tick ${nextTickValue}: ${pressDefender.shortName} ${defensiveAction.label}`,
        newPossession,
        pressDefender.userPlayerId,
        actor.userPlayerId,
        null,
      ),
      activeSkill: null,
      focusId: pressDefender.userPlayerId,
      pressId: actor.userPlayerId,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: EMatchEvent.INTERCEPTION,
        minute,
        teamId: pressDefender.teamId,
        actorPlayerId: pressDefender.userPlayerId,
        secondaryPlayerId: actor.userPlayerId,
        payload: {
          label: snapshot.highlight.label,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: recoveredBall,
          recoveredPossession: newPossession,
          passStyle,
          offsideSnapshot,
          receiverWasOffsideAtPass: passDecision.receiverWasOffsideAtPass,
          passWasLegal: passDecision.passWasLegal,
          offsideCalledOnReceive: false,
        },
      },
    };
  }

  const passLabel = getPassStyleLabel(passStyle);
  const snapshot = buildSnapshot({
    frameId,
    minute,
    second,
    tick: nextTickValue,
    matchStep: "play",
    phase,
    homeScore: Number(latestTick.homeScore ?? 0),
    awayScore: Number(latestTick.awayScore ?? 0),
    possession,
    homeLineup,
    awayLineup,
    ballOwner: receiver,
    ball: ballTarget,
    ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, ballTarget),
    highlight: createHighlight(
      EMatchEvent.PASS,
      `Tick ${nextTickValue}: ${actor.shortName} ${passLabel} cho ${receiver.shortName}`,
      possession,
      actor.userPlayerId,
      receiver.userPlayerId,
      null,
    ),
    activeSkill: null,
    focusId: receiver.userPlayerId,
    pressId: pressDefender?.userPlayerId ?? null,
    positionState: previousPositionState,
  });

  return {
    snapshot,
    event: {
      event: EMatchEvent.PASS,
      minute,
      teamId: actor.teamId,
      actorPlayerId: actor.userPlayerId,
      secondaryPlayerId: receiver.userPlayerId,
      payload: {
        label: snapshot.highlight.label,
        from: { x: latestTick.ball.x, y: latestTick.ball.y },
        to: ballTarget,
        passStyle,
        receiverRunTarget: ballTarget,
        offsideSnapshot,
        receiverWasOffsideAtPass: passDecision.receiverWasOffsideAtPass,
        passWasLegal: passDecision.passWasLegal,
        offsideCalledOnReceive: false,
      },
    },
  };
}

function pushActionFrames(
  pushFrames: (input: {
    count: number;
    minute: number;
    matchStep: MatchStep;
    phase: MatchSnapshot["phase"];
    possession: Side;
    ballOwner: InternalLineupPlayer;
    ballPath: TrajectoryPoint[];
    highlight: MatchSnapshot["highlight"];
    activeSkill?: EPlayerSkill | null;
    focusId?: number | null;
    pressId?: number | null;
  }) => void,
  result: { action: ResolvedAction; ballPath: TrajectoryPoint[] },
  phase: MatchSnapshot["phase"],
  minute: number,
) {
  pushFrames({
    count: FRAMES_PER_ACTION,
    minute,
    matchStep: "play",
    phase,
    possession: result.action.possession,
    ballOwner: result.action.actor,
    ballPath: result.ballPath,
    highlight: createHighlight(
      result.action.event,
      result.action.label,
      result.action.possession,
      result.action.actor.userPlayerId,
      result.action.partner?.userPlayerId ?? result.action.defender.userPlayerId,
      result.action.skill,
    ),
    activeSkill: result.action.skill,
    focusId: result.action.actor.userPlayerId,
    pressId: result.action.defender.userPlayerId,
  });
}

function playSimpleAction(input: {
  minute: number;
  homeTeam: SimulationTeamInput;
  awayTeam: SimulationTeamInput;
  homeLineup: InternalLineupPlayer[];
  awayLineup: InternalLineupPlayer[];
  homeScore: number;
  awayScore: number;
  statsMap: Map<number, SimulationPlayerStatsDraft>;
  events: SimulationEventDraft[];
  random: () => number;
}) {
  const possession: Side = input.random() > 0.5 ? "home" : "away";
  const attacking = possession === "home" ? input.homeLineup : input.awayLineup;
  const defending = possession === "home" ? input.awayLineup : input.homeLineup;
  const attackingTeam = possession === "home" ? input.homeTeam : input.awayTeam;
  const defendingTeam = possession === "home" ? input.awayTeam : input.homeTeam;
  const actor = pickAttacker(attacking, input.random);
  const partner = pickPartner(attacking, actor.userPlayerId, input.random);
  const defender = pickDefender(defending, input.random);
  const keeper = defending.find((p) => p.role === "GK") ?? defending[0];
  const passBias = clamp((attackingTeam.passRatio ?? 50) / 100, 0.2, 0.85);
  const shotBias = clamp((attackingTeam.shotRatio ?? 50) / 100, 0.2, 0.85);
  const roll = input.random();
  let homeScore = input.homeScore;
  let awayScore = input.awayScore;
  let action: ResolvedAction;

  if (roll < 0.22 + passBias * 0.1) {
    const receiver = partner ?? actor;
    const completed =
      actor.raw.stats.pass + actor.raw.stats.vision * 0.35 + input.random() * 25 >=
      (defender.raw.stats.tackle + defender.raw.stats.speed * 0.2) * 0.72;
    addPass(input.statsMap, actor.userPlayerId, completed);
    if (!completed) {
      addInterception(input.statsMap, defender.userPlayerId);
      action = makeAction(
        "block",
        EMatchEvent.INTERCEPTION,
        `${defender.shortName} cat duong chuyen`,
        possession,
        actor,
        receiver,
        defender,
        keeper,
        null,
      );
      pushEvent(
        input.events,
        EMatchEvent.INTERCEPTION,
        input.minute,
        defendingTeam.id,
        defender.userPlayerId,
        actor.userPlayerId,
        { label: action.label },
      );
      return finishAction(input, action, homeScore, awayScore);
    }
    action = makeAction(
      "pass",
      EMatchEvent.PASS,
      `${actor.shortName} chuyen bong`,
      possession,
      actor,
      receiver,
      defender,
      keeper,
      null,
    );
    pushEvent(
      input.events,
      EMatchEvent.PASS,
      input.minute,
      attackingTeam.id,
      actor.userPlayerId,
      receiver.userPlayerId,
      { label: action.label },
    );
  } else if (roll < 0.5) {
    const skill = getChargedSkill(actor, "dribble");
    const activation = skill
      ? resolveSkillActivation(skill, createSkillContext(actor, defender, keeper, input.random))
      : null;
    const success =
      activation?.dribbleSuccess ??
      actor.raw.stats.dribbling +
        actor.raw.stats.balance * 0.25 +
        (activation?.attackBonus ?? 0) +
        input.random() * 24 >
        defender.raw.stats.tackle +
          defender.raw.stats.speed * 0.2 -
          (activation?.defensePenalty ?? 0) +
          4;

    addDribble(input.statsMap, actor.userPlayerId, success);
    if (!success) addTackle(input.statsMap, defender.userPlayerId);
    action = makeAction(
      success ? "pass" : "block",
      skill ? EMatchEvent.SKILL_USED : EMatchEvent.DRIBBLE,
      skill ? `${actor.shortName} dung ${getSkillLabel(skill)}` : `${actor.shortName} qua nguoi`,
      possession,
      actor,
      success ? partner : null,
      defender,
      keeper,
      skill,
    );
    if (skill)
      pushSkillEvent(
        input.events,
        input.minute,
        attackingTeam.id,
        actor.userPlayerId,
        defender.userPlayerId,
        action,
      );
    consumeSkillCharge(actor, skill);
    pushEvent(
      input.events,
      EMatchEvent.DRIBBLE,
      input.minute,
      attackingTeam.id,
      actor.userPlayerId,
      defender.userPlayerId,
      {
        label: action.label,
        success,
        skill,
        skillLabel: action.skillLabel,
      },
    );
  } else if (roll < 0.9 + shotBias * 0.08) {
    addSkillCharge(actor, EPlayerSkill.SHOOT_THUNDER, 25);
    const skill = getChargedSkill(actor, "shoot");
    const activation = skill
      ? resolveSkillActivation(skill, createSkillContext(actor, defender, keeper, input.random))
      : null;
    const shotSuccess =
      actor.raw.stats.shoot +
        actor.raw.stats.dribbling * 0.3 +
        (activation?.attackBonus ?? 0) +
        input.random() * 30 >
      defender.raw.stats.tackle * 0.45 +
        keeper.raw.stats.gkKeeping +
        keeper.raw.stats.gkReflex * 0.35 -
        (activation?.defensePenalty ?? 0) +
        10;

    addShot(input.statsMap, actor.userPlayerId, shotSuccess);
    if (skill)
      pushSkillEvent(
        input.events,
        input.minute,
        attackingTeam.id,
        actor.userPlayerId,
        keeper.userPlayerId,
        makeAction(
          "shoot",
          EMatchEvent.SKILL_USED,
          `${actor.shortName} dung ${getSkillLabel(skill)}`,
          possession,
          actor,
          partner,
          defender,
          keeper,
          skill,
        ),
      );
    consumeSkillCharge(actor, skill);

    if (shotSuccess && input.random() > (skill === EPlayerSkill.SHOOT_THUNDER ? 0.42 : 0.55)) {
      if (possession === "home") homeScore += 1;
      else awayScore += 1;
      addGoal(input.statsMap, actor.userPlayerId, partner?.userPlayerId ?? null);
      action = makeAction(
        "goal",
        EMatchEvent.GOAL,
        `${actor.shortName} ghi ban!`,
        possession,
        actor,
        partner,
        defender,
        keeper,
        skill,
      );
      pushEvent(
        input.events,
        EMatchEvent.GOAL,
        input.minute,
        attackingTeam.id,
        actor.userPlayerId,
        partner?.userPlayerId ?? null,
        {
          label: action.label,
          homeScore,
          awayScore,
          skill,
          skillLabel: action.skillLabel,
        },
      );
    } else if (input.random() > 0.5) {
      action = makeAction(
        "save",
        EMatchEvent.GOALKEEPER_SAVE,
        `${keeper.shortName} cuu thua`,
        possession,
        actor,
        partner,
        defender,
        keeper,
        skill,
      );
      pushEvent(
        input.events,
        EMatchEvent.GOALKEEPER_SAVE,
        input.minute,
        defendingTeam.id,
        keeper.userPlayerId,
        actor.userPlayerId,
        {
          label: action.label,
          skill,
          skillLabel: action.skillLabel,
        },
      );
    } else {
      addTackle(input.statsMap, defender.userPlayerId);
      action = makeAction(
        "block",
        EMatchEvent.BLOCK,
        `${defender.shortName} chan bong`,
        possession,
        actor,
        partner,
        defender,
        keeper,
        skill,
      );
      pushEvent(
        input.events,
        EMatchEvent.BLOCK,
        input.minute,
        defendingTeam.id,
        defender.userPlayerId,
        actor.userPlayerId,
        {
          label: action.label,
          skill,
          skillLabel: action.skillLabel,
        },
      );
    }
    pushEvent(
      input.events,
      EMatchEvent.SHOOT,
      input.minute,
      attackingTeam.id,
      actor.userPlayerId,
      null,
      {
        label: `${actor.shortName} sut`,
        skill,
        skillLabel: action.skillLabel,
      },
    );
  } else {
    const receiver = partner ?? actor;
    addPass(input.statsMap, actor.userPlayerId, true);
    action = makeAction(
      "pass",
      EMatchEvent.PASS,
      `${actor.shortName} giu nhip va chuyen bong`,
      possession,
      actor,
      receiver,
      defender,
      keeper,
      null,
    );
    pushEvent(
      input.events,
      EMatchEvent.PASS,
      input.minute,
      attackingTeam.id,
      actor.userPlayerId,
      receiver.userPlayerId,
      { label: action.label },
    );
  }

  return finishAction(input, action, homeScore, awayScore);
}

function makeAction(
  type: PlayActionType,
  event: EMatchEvent,
  label: string,
  possession: Side,
  actor: InternalLineupPlayer,
  partner: InternalLineupPlayer | null,
  defender: InternalLineupPlayer,
  keeper: InternalLineupPlayer,
  skill: EPlayerSkill | null,
): ResolvedAction {
  return {
    type,
    event,
    label,
    possession,
    actor,
    partner,
    defender,
    keeper,
    isGoal: type === "goal",
    skill,
    skillLabel: skill ? getSkillLabel(skill) : null,
  };
}

function finishAction(
  input: {
    homeLineup: InternalLineupPlayer[];
    awayLineup: InternalLineupPlayer[];
    statsMap: Map<number, SimulationPlayerStatsDraft>;
    random: () => number;
  },
  action: ResolvedAction,
  homeScore: number,
  awayScore: number,
) {
  [...input.homeLineup, ...input.awayLineup].forEach((player) => {
    const row = input.statsMap.get(player.userPlayerId);
    if (row) row.minutesPlayed += 3;
  });
  return { action, ballPath: buildBallPath(action, input.random), homeScore, awayScore };
}

function toInternalLineupPlayer(player: MatchRenderPlayer): InternalLineupPlayer {
  const skills = Array.isArray(player.skills) ? player.skills : [];
  return {
    ...player,
    skills,
    skillCharges: normalizeSkillCharges(skills, player.skillCharges),
    anchors: {
      x: Number(player.homeX ?? player.x ?? 50),
      y: Number(player.homeY ?? player.y ?? 50),
    },
    raw: {
      userPlayerId: player.userPlayerId,
      playerId: player.playerId,
      teamId: player.teamId,
      name: player.name,
      slug: player.slug,
      positions: [{ position: player.displayRole || player.role, effect: 1 }],
      skills,
      skillSlugs: player.skillSlugs,
      stats: {
        pass: 70,
        longPass: 70,
        vision: 70,
        shoot: 70,
        tackle: 70,
        balance: 70,
        dribbling: 70,
        acceleration: 70,
        speed: 70,
        stamina: Number(player.stamina ?? 70),
        gkKeeping: 70,
        gkReflex: 70,
        gkDiving: 70,
        gkReach: 70,
      },
    },
  };
}

function resolveDebugPossessionTempoAction(input: {
  previousTicks: MatchSnapshot[];
  latestEvent: EMatchEvent | null;
  actor: InternalLineupPlayer;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
  ball: TrajectoryPoint;
  nextTick: number;
  possession: Side;
}): {
  kind: PossessionTempoKind;
  label: string;
  ballTarget: TrajectoryPoint;
  pressDefender: InternalLineupPlayer | null;
} {
  const teamTicks = countConsecutivePossessionTicks(input.previousTicks, input.possession);
  const ownerTicks = countConsecutiveOwnerTicks(input.previousTicks, input.actor.userPlayerId);
  const restartPass =
    input.latestEvent === EMatchEvent.FIRST_HALF_START ||
    input.latestEvent === EMatchEvent.SECOND_HALF_START;
  const latestWasPass = input.latestEvent === EMatchEvent.PASS;
  const pressure = evaluateBallPressure({
    actor: input.actor,
    defending: input.defending,
    ball: input.ball,
    previousPositionState: input.previousPositionState,
  });
  const forwardSpace = evaluateForwardCarrySpace({
    actor: input.actor,
    defending: input.defending,
    ball: input.ball,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });
  const goalDistance = distanceToAttackingGoal(input.possession, input.ball);
  const role = normalizeRole(input.actor.role);
  if (role === "GK") {
    return {
      kind: "pass",
      label: "thu mon phat bong nhanh",
      ballTarget: input.ball,
      pressDefender: null,
    };
  }

  const releaseRoll =
    ((input.nextTick * 19 + input.actor.userPlayerId * 11 + teamTicks * 7) % 100) / 100;
  const hasShootSkill = input.actor.raw.skills.includes(EPlayerSkill.SHOOT_THUNDER);
  const inShotZone = goalDistance <= getRoleMaxShotDistance(role, hasShootSkill) + 4;
  const mustSettle =
    !restartPass &&
    (teamTicks < MIN_TEAM_POSSESSION_TICKS ||
      (latestWasPass && ownerTicks < MIN_OWNER_POSSESSION_TICKS && pressure.distance > 4.5));
  const passScore = clamp(
    pressure.score * (inShotZone ? 0.24 : 0.42) +
      clamp((ownerTicks - 1) / PASS_CADENCE_TICKS, 0, 0.32) +
      clamp((goalDistance - 18) / 42, 0, inShotZone ? 0.06 : 0.18) +
      (role === "CB" || role === "FB" ? 0.08 : 0) +
      releaseRoll * (inShotZone ? 0.06 : 0.14) -
      (inShotZone ? 0.18 : 0),
    0,
    1,
  );
  const carryScore = clamp(
    forwardSpace * 0.5 +
      clamp((pressure.distance - 5) / 18, 0, 0.26) +
      (role === "W" || role === "ST" ? 0.12 : role === "CM" ? 0.08 : 0) +
      (latestWasPass ? 0.08 : 0),
    0,
    1,
  );
  const shouldRelease =
    restartPass ||
    (!mustSettle &&
      (pressure.distance <= 3.8 ||
        ownerTicks >= PASS_CADENCE_TICKS ||
        (!inShotZone && goalDistance <= 22 && pressure.distance <= 7) ||
        (!inShotZone && passScore > carryScore + 0.12) ||
        (inShotZone && pressure.distance <= 2.8 && passScore > carryScore + 0.2)));

  if (shouldRelease) {
    return {
      kind: "pass",
      label: pressure.distance <= 3.8 ? "xa ap luc bang duong chuyen" : "tim duong chuyen",
      ballTarget: input.ball,
      pressDefender: null,
    };
  }

  const pressDefender =
    findNearestPlayer(input.defending, input.ball, (player) => player.role !== "GK") ??
    input.defending[0] ??
    null;
  const roll = (input.nextTick + input.actor.userPlayerId + teamTicks + ownerTicks) % 4;

  if (pressure.distance < 6 && forwardSpace < 0.42) {
    return {
      kind: "reposition",
      label: "che bong doi goc thoat pressing",
      ballTarget: repositionBallTarget({
        actor: input.actor,
        ball: input.ball,
        possession: input.possession,
        nextTick: input.nextTick,
      }),
      pressDefender,
    };
  }

  if (forwardSpace >= 0.36 || roll <= 1) {
    return {
      kind: "carry",
      label: forwardSpace >= 0.58 ? "tang toc dan bong len" : "keo bong giu nhip",
      ballTarget: carryBallTarget({
        actor: input.actor,
        ball: input.ball,
        possession: input.possession,
        nextTick: input.nextTick,
      }),
      pressDefender,
    };
  }

  if (roll === 2) {
    return {
      kind: "hold",
      label: "giu bong cho doi hinh len",
      ballTarget: settleBallNearOwner(input.actor, input.ball, 0.18),
      pressDefender,
    };
  }

  return {
    kind: "reposition",
    label: "doi nhip va tim goc chuyen",
    ballTarget: repositionBallTarget({
      actor: input.actor,
      ball: input.ball,
      possession: input.possession,
      nextTick: input.nextTick,
    }),
    pressDefender,
  };
}

function countConsecutivePossessionTicks(previousTicks: MatchSnapshot[], possession: Side) {
  let count = 0;
  for (let index = previousTicks.length - 1; index >= 0; index -= 1) {
    if ((previousTicks[index]?.possession ?? possession) !== possession) break;
    count += 1;
  }
  return count;
}

function countConsecutiveOwnerTicks(previousTicks: MatchSnapshot[], ownerId: number) {
  let count = 0;
  for (let index = previousTicks.length - 1; index >= 0; index -= 1) {
    if (Number(previousTicks[index]?.ball?.ownerPlayerId) !== ownerId) break;
    count += 1;
  }
  return count;
}

function settleBallNearOwner(
  actor: InternalLineupPlayer,
  ball: TrajectoryPoint,
  ownerPull: number,
): TrajectoryPoint {
  return {
    x: clamp(lerp(ball.x, actor.anchors.x, ownerPull), 5, 95),
    y: clamp(lerp(ball.y, actor.anchors.y, ownerPull), 5, 95),
  };
}

function carryBallTarget(input: {
  actor: InternalLineupPlayer;
  ball: TrajectoryPoint;
  possession: Side;
  nextTick: number;
}): TrajectoryPoint {
  const direction = attackDirection(input.possession);
  const role = normalizeRole(input.actor.role);
  const wideLaneX = getWideLaneX(input.actor);
  const halfSpaceX = wideLaneX < 50 ? 30 : 70;
  const nearTouchline = input.ball.x <= 12 || input.ball.x >= 88;
  const finalThird = isFinalThird(input.possession, input.ball.y);
  const wobble = ((input.nextTick % 5) - 2) * 0.7;

  if (role === "FB" || role === "W") {
    const variant = (input.nextTick + input.actor.userPlayerId) % 4;
    const shouldCutInside = nearTouchline || role === "W" || variant <= 1;
    const desiredX = shouldCutInside
      ? lerp(input.ball.x, halfSpaceX, finalThird ? 0.55 : 0.72)
      : lerp(input.ball.x, wideLaneX, 0.2);
    const desired = {
      x: clamp(desiredX + wobble, 7, 93),
      y: clamp(input.ball.y + direction * (finalThird ? 4.5 : 7), 6, 94),
    };

    return moveToward(input.ball, desired, PLAYER_SPEED_UNITS_PER_TICK.run);
  }

  const desired = {
    x: clamp(input.ball.x + clamp((50 - input.ball.x) * 0.08, -2.5, 2.5) + wobble, 6, 94),
    y: clamp(input.ball.y + direction * 7, 6, 94),
  };

  return moveToward(input.ball, desired, PLAYER_SPEED_UNITS_PER_TICK.run);
}

function repositionBallTarget(input: {
  actor: InternalLineupPlayer;
  ball: TrajectoryPoint;
  possession: Side;
  nextTick: number;
}): TrajectoryPoint {
  const direction = attackDirection(input.possession);
  const sideStep = input.nextTick % 2 === 0 ? -3 : 3;
  const desired = {
    x: clamp(lerp(input.ball.x, input.actor.anchors.x, 0.24) + sideStep, 7, 93),
    y: clamp(lerp(input.ball.y, input.actor.anchors.y + direction * 4, 0.2), 7, 93),
  };

  return moveToward(input.ball, desired, PLAYER_SPEED_UNITS_PER_TICK.support);
}

function resolveDebugPassingAction(input: {
  lineup: InternalLineupPlayer[];
  defending: InternalLineupPlayer[];
  actor: InternalLineupPlayer;
  previousPositionState: PositionState;
  ball: TrajectoryPoint;
  tick: number;
  nextTick: number;
  possession: Side;
}) {
  const candidates = input.lineup.filter(
    (player) => player.userPlayerId !== input.actor.userPlayerId && player.role !== "GK",
  );

  if (!candidates.length) {
    return {
      receiver: input.actor,
      ballTarget: moveToward(input.ball, input.actor.anchors, PASS_SPEED_UNITS_PER_TICK),
      pressDefender: input.defending[0],
      passStyle: "short" as PassStyle,
      interception: null,
    };
  }

  const ranked = candidates
    .map((player, index) => {
      const previous =
        input.previousPositionState.players.get(player.userPlayerId) ?? player.anchors;
      const distanceToBall = distance(previous, input.ball);
      const ballTarget = getDebugPassTarget({
        receiver: player,
        receiverPreviousPosition: previous,
        ball: input.ball,
        tick: input.tick,
        possession: input.possession,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const lane = evaluatePassLane({
        from: input.ball,
        to: ballTarget,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const availability = evaluateTeammateAvailability({
        receiver: player,
        target: ballTarget,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const tacticalAdvantage = evaluateTacticalAdvantage({
        receiver: player,
        from: input.ball,
        to: ballTarget,
        possession: input.possession,
      });
      const supportGeometry = evaluateSupportGeometry({
        actor: input.actor,
        receiver: player,
        receiverPosition: previous,
        from: input.ball,
        to: ballTarget,
        possession: input.possession,
      });
      const combinationValue = evaluateCombinationPattern({
        actor: input.actor,
        receiver: player,
        receiverPosition: previous,
        from: input.ball,
        to: ballTarget,
        possession: input.possession,
      });
      const passStyle = resolvePassStyle({
        actor: input.actor,
        receiver: player,
        receiverPosition: previous,
        from: input.ball,
        to: ballTarget,
        possession: input.possession,
        laneScore: lane.score,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const offside = evaluateOffside({
        receiver: player,
        receiverPosition: previous,
        ball: input.ball,
        defending: input.defending,
        possession: input.possession,
        previousPositionState: input.previousPositionState,
      });
      const offsideSnapshot = captureOffsideSnapshot({
        passer: input.actor,
        receiver: player,
        receiverPosition: previous,
        passStartTick: input.nextTick,
        ball: input.ball,
        defending: input.defending,
        possession: input.possession,
        previousPositionState: input.previousPositionState,
      });
      const throughRunScore = evaluateThroughRun({
        receiver: player,
        receiverPosition: previous,
        ball: input.ball,
        target: ballTarget,
        possession: input.possession,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const role = normalizeRole(player.role);
      const roleWeight =
        role === "ST"
          ? 0.1
          : role === "W"
            ? 0.08
            : role === "CM"
              ? 0.06
              : role === "FB"
                ? 0.03
                : 0.01;
      const laneRotation = ((input.tick / 2 + index) % candidates.length) * 0.72;
      const distanceScore = clamp(1 - Math.abs(distanceToBall - 26) / 48, 0, 1);
      const styleWeight =
        passStyle === "switch"
          ? 0.09
          : passStyle === "lob"
            ? 0.11
            : passStyle === "through"
              ? 0.14 + throughRunScore * 0.16
              : 0;
      const offsidePenalty = offside.isOffside ? 2.2 : offside.warning ? 0.24 : 0;
      const legalRunBonus =
        !offside.isOffside && (passStyle === "through" || passStyle === "lob")
          ? throughRunScore * 0.12
          : 0;

      return {
        player,
        ballTarget,
        lane,
        passStyle,
        offside,
        offsideSnapshot,
        score:
          lane.score * 0.3 +
          availability * 0.22 +
          tacticalAdvantage * 0.2 +
          supportGeometry * 0.18 +
          combinationValue * 0.14 +
          distanceScore * 0.1 +
          styleWeight +
          legalRunBonus +
          roleWeight +
          laneRotation * 0.01 -
          offsidePenalty,
      };
    })
    .sort((left, right) => right.score - left.score);

  const onsideRanked = ranked.filter((item) => !item.offside.isOffside);
  const selected = onsideRanked[0] ??
    ranked[0] ?? {
      player: candidates[0],
      ballTarget: getDebugPassTarget({
        receiver: candidates[0],
        receiverPreviousPosition:
          input.previousPositionState.players.get(candidates[0].userPlayerId) ??
          candidates[0].anchors,
        ball: input.ball,
        tick: input.tick,
        possession: input.possession,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      }),
      lane: evaluatePassLane({
        from: input.ball,
        to: candidates[0].anchors,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      }),
      passStyle: "short" as PassStyle,
      offside: { isOffside: false, warning: false, lineY: 50 },
      offsideSnapshot: null as OffsideSnapshot | null,
      score: 0,
    };
  const pressDefender = selected.lane.defender ?? input.defending[0];

  return {
    receiver: selected.player,
    ballTarget: selected.ballTarget,
    pressDefender,
    passStyle: selected.passStyle,
    offside: selected.offside,
    offsideSnapshot: selected.offsideSnapshot,
    receiverWasOffsideAtPass: Boolean(selected.offsideSnapshot?.wasReceiverOffsideAtPass),
    passWasLegal: !Boolean(selected.offsideSnapshot?.wasReceiverOffsideAtPass),
    interception: resolveDebugPassInterception({
      defender: pressDefender,
      actor: input.actor,
      receiver: selected.player,
      ball: input.ball,
      ballTarget: selected.ballTarget,
      laneDistance: selected.lane.distance,
      laneScore: selected.lane.score,
      passStyle: selected.passStyle,
      nextTick: input.nextTick,
    }),
  };
}

function resolvePassStyle(input: {
  actor: InternalLineupPlayer;
  receiver: InternalLineupPlayer;
  receiverPosition: TrajectoryPoint;
  from: TrajectoryPoint;
  to: TrajectoryPoint;
  possession: Side;
  laneScore: number;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
}): PassStyle {
  const direction = attackDirection(input.possession);
  const receiverRole = normalizeRole(input.receiver.role);
  const forwardProgress = (input.to.y - input.from.y) * direction;
  const anchorDistance = distance(input.actor.anchors, input.receiver.anchors);
  const offside = evaluateOffside({
    receiver: input.receiver,
    receiverPosition: input.receiverPosition,
    ball: input.from,
    defending: input.defending,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });
  const canAttackSpace = !offside.isOffside && !offside.warning;
  const switchFlank =
    Math.abs(input.actor.anchors.x - input.receiver.anchors.x) >= 34 &&
    anchorDistance >= 24 &&
    input.laneScore >= 0.45;

  if (switchFlank) return "switch";
  if (canAttackSpace && (receiverRole === "W" || receiverRole === "ST") && forwardProgress >= 6) {
    return "through";
  }
  if ((receiverRole === "W" || receiverRole === "ST") && forwardProgress >= 7) {
    return input.laneScore < 0.48 || anchorDistance >= 20 ? "lob" : "through";
  }
  if (forwardProgress >= 6) return "through";
  return "short";
}

function getPassStyleLabel(style: PassStyle) {
  switch (style) {
    case "lob":
      return "chuyen bong bong";
    case "switch":
      return "phat bong doi canh";
    case "through":
      return "choc khe";
    default:
      return "chuyen";
  }
}

function evaluatePassLane(input: {
  from: TrajectoryPoint;
  to: TrajectoryPoint;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
}) {
  const defenders = input.defending.filter((player) => player.role !== "GK");
  const ranked = defenders
    .map((defender) => {
      const position =
        input.previousPositionState.players.get(defender.userPlayerId) ?? defender.anchors;
      return {
        defender,
        distance: distanceToSegment(position, input.from, input.to),
        ballDistance: distance(position, input.from),
      };
    })
    .sort(
      (left, right) => left.distance - right.distance || left.ballDistance - right.ballDistance,
    );
  const closest = ranked[0];

  if (!closest) {
    return { score: 1, distance: Number.POSITIVE_INFINITY, defender: null };
  }

  const score = clamp((closest.distance - 4) / 22, 0, 1);
  return { score, distance: closest.distance, defender: closest.defender };
}

function evaluateTeammateAvailability(input: {
  receiver: InternalLineupPlayer;
  target: TrajectoryPoint;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
}) {
  const receiverPosition =
    input.previousPositionState.players.get(input.receiver.userPlayerId) ?? input.receiver.anchors;
  const nearestMarker = input.defending
    .filter((player) => player.role !== "GK")
    .map((defender) => {
      const defenderPosition =
        input.previousPositionState.players.get(defender.userPlayerId) ?? defender.anchors;
      return Math.min(
        distance(defenderPosition, receiverPosition),
        distance(defenderPosition, input.target),
      );
    })
    .sort((left, right) => left - right)[0];
  const markerDistance = nearestMarker ?? 28;
  const role = normalizeRole(input.receiver.role);
  const roleAvailability = role === "CM" ? 0.08 : role === "W" || role === "ST" ? 0.04 : 0;

  return clamp((markerDistance - 5) / 24 + roleAvailability, 0, 1);
}

function evaluateTacticalAdvantage(input: {
  receiver: InternalLineupPlayer;
  from: TrajectoryPoint;
  to: TrajectoryPoint;
  possession: Side;
}) {
  const direction = attackDirection(input.possession);
  const forwardProgress = (input.to.y - input.from.y) * direction;
  const goalY = input.possession === "home" ? 4 : 96;
  const goalDistance = Math.abs(input.to.y - goalY);
  const role = normalizeRole(input.receiver.role);
  const forwardScore = clamp((forwardProgress + 8) / 28, 0, 1);
  const goalThreat = clamp((62 - goalDistance) / 54, 0, 1);
  const widthValue = role === "W" ? clamp(Math.abs(input.to.x - 50) / 38, 0, 1) : 0.5;

  return clamp(forwardScore * 0.5 + goalThreat * 0.32 + widthValue * 0.18, 0, 1);
}

function evaluateSupportGeometry(input: {
  actor: InternalLineupPlayer;
  receiver: InternalLineupPlayer;
  receiverPosition: TrajectoryPoint;
  from: TrajectoryPoint;
  to: TrajectoryPoint;
  possession: Side;
}) {
  const direction = attackDirection(input.possession);
  const passDistance = distance(input.from, input.to);
  const forwardProgress = (input.to.y - input.from.y) * direction;
  const lateralSeparation = Math.abs(input.to.x - input.from.x);
  const receiverReach = distance(input.receiverPosition, input.to);
  const actorRole = normalizeRole(input.actor.role);
  const receiverRole = normalizeRole(input.receiver.role);
  const triangleDistance = clamp(1 - Math.abs(passDistance - 22) / 30, 0, 1);
  const diagonalLane =
    clamp(lateralSeparation / 28, 0, 1) * clamp((forwardProgress + 8) / 24, 0, 1);
  const reachableSpace = clamp(
    (getReceiverReachForTick(input.receiver) * 1.6 - receiverReach) / 10,
    0,
    1,
  );
  const safetyOutlet =
    forwardProgress < -2 && (actorRole === "CB" || actorRole === "FB" || receiverRole === "CM")
      ? 0.18
      : 0;
  const widthRelief =
    receiverRole === "W" || receiverRole === "FB"
      ? clamp(Math.abs(input.to.x - 50) / 42, 0, 1) * 0.14
      : 0;

  return clamp(
    triangleDistance * 0.3 +
      diagonalLane * 0.26 +
      reachableSpace * 0.24 +
      clamp(forwardProgress / 28, 0, 1) * 0.18 +
      safetyOutlet +
      widthRelief,
    0,
    1,
  );
}

function evaluateCombinationPattern(input: {
  actor: InternalLineupPlayer;
  receiver: InternalLineupPlayer;
  receiverPosition: TrajectoryPoint;
  from: TrajectoryPoint;
  to: TrajectoryPoint;
  possession: Side;
}) {
  const actorRole = normalizeRole(input.actor.role);
  const receiverRole = normalizeRole(input.receiver.role);
  const direction = attackDirection(input.possession);
  const forwardProgress = (input.to.y - input.from.y) * direction;
  const sameFlank = isSameFlank(input.actor.anchors.x, input.receiver.anchors.x);
  const lateralGap = Math.abs(input.actor.anchors.x - input.receiver.anchors.x);
  const receiverHalfSpace = input.to.x >= 24 && input.to.x <= 76;
  const receiverWide = Math.abs(input.to.x - 50) >= 28;
  let score = 0;

  if (
    ((actorRole === "W" && receiverRole === "FB") ||
      (actorRole === "FB" && receiverRole === "W")) &&
    sameFlank
  ) {
    score += receiverWide ? 0.34 : 0.26;
    if (forwardProgress >= -2) score += 0.12;
  }

  if (
    ((actorRole === "CM" || actorRole === "DM") && receiverRole === "W") ||
    (actorRole === "W" && (receiverRole === "CM" || receiverRole === "DM"))
  ) {
    score += receiverHalfSpace || lateralGap >= 16 ? 0.28 : 0.16;
  }

  if (
    actorRole === "ST" &&
    (receiverRole === "CM" || receiverRole === "DM") &&
    forwardProgress < 2
  ) {
    score += 0.3;
  }

  if (actorRole === "DM" && lateralGap >= 34) {
    score += 0.32;
  }

  if (actorRole === "FB" && (receiverRole === "CM" || receiverRole === "DM") && receiverHalfSpace) {
    score += 0.26;
  }

  return clamp(score, 0, 1);
}

function resolveDebugPassInterception(input: {
  defender: InternalLineupPlayer | null;
  actor: InternalLineupPlayer;
  receiver: InternalLineupPlayer;
  ball: TrajectoryPoint;
  ballTarget: TrajectoryPoint;
  laneDistance: number;
  laneScore: number;
  passStyle: PassStyle;
  nextTick: number;
}): { label: string; target: TrajectoryPoint } | null {
  if (!input.defender || !Number.isFinite(input.laneDistance)) {
    return null;
  }

  const passerQuality = input.actor.raw.stats.pass * 0.55 + input.actor.raw.stats.vision * 0.45;
  const defenderQuality =
    input.defender.raw.stats.tackle * 0.5 +
    input.defender.raw.stats.speed * 0.3 +
    input.defender.raw.stats.acceleration * 0.2;
  const laneRisk = 1 - input.laneScore;
  const qualityRisk = clamp((defenderQuality - passerQuality + 18) / 110, 0, 0.28);
  const immediateLaneThreat = input.laneDistance <= 3.5 ? 0.14 : input.laneDistance <= 5 ? 0.05 : 0;
  const styleRiskMultiplier =
    input.passStyle === "lob" ? 0.48 : input.passStyle === "switch" ? 0.42 : 1;
  const risk = clamp(
    (laneRisk * 0.36 + qualityRisk + immediateLaneThreat) * styleRiskMultiplier,
    0,
    input.passStyle === "short" ? 0.72 : 0.52,
  );
  const deterministicRoll =
    ((input.nextTick * 17 + input.defender.userPlayerId * 13 + input.receiver.userPlayerId * 7) %
      100) /
    100;

  const minimumRiskToIntercept =
    input.passStyle === "lob" || input.passStyle === "switch" ? 0.48 : 0.64;

  if (risk < minimumRiskToIntercept || deterministicRoll > risk) {
    return null;
  }

  const interceptionPoint = closestPointOnSegment(
    input.defender.anchors,
    input.ball,
    input.ballTarget,
  );
  const contestedPoint = {
    x: clamp(lerp(interceptionPoint.x, input.defender.anchors.x, 0.45), 5, 95),
    y: clamp(lerp(interceptionPoint.y, input.defender.anchors.y, 0.45), 5, 95),
  };

  return {
    label: input.passStyle === "lob" ? "doc duoc diem roi bong" : "cat duong chuyen",
    target: moveToward(input.ball, contestedPoint, PASS_SPEED_UNITS_PER_TICK),
  };
}

function getDebugPassTarget(input: {
  receiver: InternalLineupPlayer;
  receiverPreviousPosition: TrajectoryPoint;
  ball: TrajectoryPoint;
  tick: number;
  possession: Side;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
}): TrajectoryPoint {
  const direction = attackDirection(input.possession);
  const role = normalizeRole(input.receiver.role);
  const offside = evaluateOffside({
    receiver: input.receiver,
    receiverPosition: input.receiverPreviousPosition,
    ball: input.ball,
    defending: input.defending,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });
  const throughPoint = getThroughPassTarget({
    receiver: input.receiver,
    receiverPreviousPosition: input.receiverPreviousPosition,
    ball: input.ball,
    tick: input.tick,
    possession: input.possession,
    defending: input.defending,
    previousPositionState: input.previousPositionState,
  });

  if (throughPoint && !offside.isOffside) {
    return moveToward(input.ball, throughPoint, PASS_SPEED_UNITS_PER_TICK);
  }

  const wideLaneX = getWideLaneX(input.receiver);
  const halfSpaceX = wideLaneX < 50 ? 30 : 70;
  const nearTouchline =
    input.receiverPreviousPosition.x <= 13 || input.receiverPreviousPosition.x >= 87;
  const widthPull =
    role === "W" || role === "FB"
      ? lerp(
          input.receiverPreviousPosition.x,
          nearTouchline || role === "FB" ? halfSpaceX : wideLaneX,
          role === "FB" ? 0.35 : 0.28,
        ) - input.receiverPreviousPosition.x
      : (50 - input.receiverPreviousPosition.x) * 0.12;
  const progress =
    role === "CB" ? 5 : role === "FB" ? 7 : role === "CM" ? 8 : role === "W" ? 11 : 9;
  const supportOffset = ((input.tick / 2) % 3) - 1;

  const desired = {
    x: clamp(
      lerp(input.receiverPreviousPosition.x, input.receiver.anchors.x, 0.22) +
        widthPull +
        supportOffset * 2,
      7,
      93,
    ),
    y: clamp(
      Math.min(
        94,
        Math.max(
          6,
          lerp(input.receiverPreviousPosition.y, input.receiver.anchors.y, 0.18) +
            direction * progress,
        ),
      ),
      6,
      94,
    ),
  };

  const receivePoint = moveToward(
    input.receiverPreviousPosition,
    desired,
    getReceiverReachForTick(input.receiver),
  );

  return moveToward(input.ball, receivePoint, PASS_SPEED_UNITS_PER_TICK);
}

function getThroughPassTarget(input: {
  receiver: InternalLineupPlayer;
  receiverPreviousPosition: TrajectoryPoint;
  ball: TrajectoryPoint;
  tick: number;
  possession: Side;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
}): TrajectoryPoint | null {
  const role = normalizeRole(input.receiver.role);
  if (role !== "ST" && role !== "W" && role !== "CM") return null;

  const direction = attackDirection(input.possession);
  const offside = evaluateOffside({
    receiver: input.receiver,
    receiverPosition: input.receiverPreviousPosition,
    ball: input.ball,
    defending: input.defending,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });
  if (offside.isOffside) return null;

  const lineGap = Math.abs(input.receiverPreviousPosition.y - offside.lineY);
  const forwardFromBall = (input.receiverPreviousPosition.y - input.ball.y) * direction;
  const canBreakLine =
    (role === "ST" || role === "W") &&
    forwardFromBall > -8 &&
    lineGap <= 18 &&
    distance(input.ball, input.receiverPreviousPosition) <= 38;

  if (!canBreakLine) return null;

  const laneShift =
    role === "W"
      ? getWideLaneDirection(input.receiver) *
        (input.receiverPreviousPosition.x <= 13 || input.receiverPreviousPosition.x >= 87 ? -3 : 4)
      : (((input.tick + input.receiver.userPlayerId) % 3) - 1) * 3;
  const lineSafety = direction < 0 ? offside.lineY + 1.2 : offside.lineY - 1.2;
  const breakDepth = role === "ST" ? 9.5 : 8;
  const desiredY = clamp(Math.min(94, Math.max(6, lineSafety + direction * breakDepth)), 6, 94);
  const desired = {
    x: clamp(
      role === "W"
        ? lerp(
            input.receiverPreviousPosition.x,
            input.receiverPreviousPosition.x <= 13 || input.receiverPreviousPosition.x >= 87
              ? getWideLaneX(input.receiver) < 50
                ? 32
                : 68
              : getWideLaneX(input.receiver),
            0.48,
          ) + laneShift
        : lerp(input.receiverPreviousPosition.x, input.receiver.anchors.x, 0.25) + laneShift,
      8,
      92,
    ),
    y: desiredY,
  };
  const receiverReach = getReceiverReachForTick(input.receiver) * 1.45;

  return moveToward(input.receiverPreviousPosition, desired, receiverReach);
}

function evaluateThroughRun(input: {
  receiver: InternalLineupPlayer;
  receiverPosition: TrajectoryPoint;
  ball: TrajectoryPoint;
  target: TrajectoryPoint;
  possession: Side;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
}) {
  const role = normalizeRole(input.receiver.role);
  if (role !== "ST" && role !== "W") return 0;

  const direction = attackDirection(input.possession);
  const offside = evaluateOffside({
    receiver: input.receiver,
    receiverPosition: input.receiverPosition,
    ball: input.ball,
    defending: input.defending,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });
  const breakProgress = (input.target.y - input.receiverPosition.y) * direction;
  const ballProgress = (input.target.y - input.ball.y) * direction;
  const lineGap = Math.abs(input.receiverPosition.y - offside.lineY);

  return clamp(
    clamp(breakProgress / 11, 0, 1) * 0.4 +
      clamp(ballProgress / 22, 0, 1) * 0.32 +
      clamp((18 - lineGap) / 18, 0, 1) * 0.28,
    0,
    1,
  );
}

function evaluateOffside(input: {
  receiver: InternalLineupPlayer;
  receiverPosition: TrajectoryPoint;
  ball: TrajectoryPoint;
  defending: InternalLineupPlayer[];
  possession: Side;
  previousPositionState: PositionState;
}): {
  isOffside: boolean;
  warning: boolean;
  lineY: number;
  safeLineY: number;
  distanceToLine: number;
  lineInfo: OffsideLineInfo;
} {
  const direction = attackDirection(input.possession);
  const receiverRole = normalizeRole(input.receiver.role);
  const lineInfo = getOffsideLine(
    input.possession,
    input.defending,
    input.ball,
    input.previousPositionState,
  );
  if (receiverRole === "GK" || receiverRole === "CB" || receiverRole === "FB") {
    return {
      isOffside: false,
      warning: false,
      lineY: lineInfo.effectiveOffsideLineY,
      safeLineY: lineInfo.safeLineY,
      distanceToLine: getDistanceToOffsideLine(input.receiverPosition, lineInfo),
      lineInfo,
    };
  }

  const isOffside = isInOffsidePosition({
    attacker: input.receiver,
    attackerPosition: input.receiverPosition,
    attackingSide: input.possession,
    defenders: input.defending,
    ball: input.ball,
    previousPositionState: input.previousPositionState,
  });
  const distanceToLine = getDistanceToOffsideLine(input.receiverPosition, lineInfo);
  const warning =
    !isOffside &&
    distanceToLine <= 3.2 &&
    isInOpponentHalf(input.receiverPosition, input.possession);

  return {
    isOffside,
    warning,
    lineY: lineInfo.effectiveOffsideLineY,
    safeLineY: lineInfo.safeLineY,
    distanceToLine,
    lineInfo,
  };
}

function getOffsideLine(
  attackingSide: Side,
  defenders: InternalLineupPlayer[],
  ball: TrajectoryPoint,
  previousPositionState: PositionState,
): OffsideLineInfo {
  const direction = attackDirection(attackingSide);
  const defendingGoalY = attackingSide === "home" ? 0 : 100;
  const defenderYs = defenders
    .map((defender) => previousPositionState.players.get(defender.userPlayerId) ?? defender.anchors)
    .map((position) => position.y)
    .sort((left, right) => (attackingSide === "home" ? left - right : right - left));
  const fallback = attackingSide === "home" ? 18 : 82;
  const secondLastDefenderY = defenderYs[1] ?? defenderYs[0] ?? fallback;
  const effectiveOffsideLineY =
    attackingSide === "home"
      ? Math.max(secondLastDefenderY, ball.y)
      : Math.min(secondLastDefenderY, ball.y);
  const offsideBuffer = 1.6;
  const safeLineY =
    attackingSide === "home"
      ? effectiveOffsideLineY + offsideBuffer
      : effectiveOffsideLineY - offsideBuffer;

  return {
    secondLastDefenderY,
    ballY: ball.y,
    effectiveOffsideLineY,
    safeLineY: clamp(safeLineY, 4, 96),
    direction,
    defendingGoalY,
  };
}

function isInOffsidePosition(input: {
  attacker: InternalLineupPlayer;
  attackerPosition: TrajectoryPoint;
  attackingSide: Side;
  defenders: InternalLineupPlayer[];
  ball: TrajectoryPoint;
  previousPositionState: PositionState;
}) {
  const role = normalizeRole(input.attacker.role);
  if (role === "GK" || role === "CB" || role === "FB") return false;

  const line = getOffsideLine(
    input.attackingSide,
    input.defenders,
    input.ball,
    input.previousPositionState,
  );
  const attackingHalf = isInOpponentHalf(input.attackerPosition, input.attackingSide);
  const aheadOfBall =
    input.attackingSide === "home"
      ? input.attackerPosition.y < input.ball.y - 0.1
      : input.attackerPosition.y > input.ball.y + 0.1;
  const beyondSecondLast =
    input.attackingSide === "home"
      ? input.attackerPosition.y < line.secondLastDefenderY - 0.1
      : input.attackerPosition.y > line.secondLastDefenderY + 0.1;

  return attackingHalf && aheadOfBall && beyondSecondLast;
}

function captureOffsideSnapshot(input: {
  passer: InternalLineupPlayer;
  receiver: InternalLineupPlayer;
  receiverPosition: TrajectoryPoint;
  passStartTick: number;
  ball: TrajectoryPoint;
  defending: InternalLineupPlayer[];
  possession: Side;
  previousPositionState: PositionState;
}): OffsideSnapshot {
  const offsideLineAtPass = getOffsideLine(
    input.possession,
    input.defending,
    input.ball,
    input.previousPositionState,
  );
  const wasReceiverOffsideAtPass = isInOffsidePosition({
    attacker: input.receiver,
    attackerPosition: input.receiverPosition,
    attackingSide: input.possession,
    defenders: input.defending,
    ball: input.ball,
    previousPositionState: input.previousPositionState,
  });

  return {
    passerId: input.passer.userPlayerId,
    receiverId: input.receiver.userPlayerId,
    passStartTick: input.passStartTick,
    ballStartPosition: { x: input.ball.x, y: input.ball.y },
    receiverPositionAtPass: { x: input.receiverPosition.x, y: input.receiverPosition.y },
    offsideLineAtPass,
    wasReceiverOffsideAtPass,
    involvedPlayers: [input.passer.userPlayerId, input.receiver.userPlayerId],
  };
}

function checkOffsideOnReceive(receiver: InternalLineupPlayer, snapshot: OffsideSnapshot | null) {
  const receiverWasOffsideAtPass = Boolean(
    snapshot?.receiverId === receiver.userPlayerId && snapshot.wasReceiverOffsideAtPass,
  );

  return {
    receiverWasOffsideAtPass,
    offsideCalledOnReceive: receiverWasOffsideAtPass,
  };
}

function getDistanceToOffsideLine(position: TrajectoryPoint, line: OffsideLineInfo) {
  return line.direction < 0
    ? position.y - line.effectiveOffsideLineY
    : line.effectiveOffsideLineY - position.y;
}

function isInOpponentHalf(position: TrajectoryPoint, attackingSide: Side) {
  return attackingSide === "home" ? position.y < 50 : position.y > 50;
}

function getReceiverReachForTick(receiver: InternalLineupPlayer) {
  const role = normalizeRole(receiver.role);
  const athletic = clamp(
    (receiver.raw.stats.speed + receiver.raw.stats.acceleration) / 160,
    0.85,
    1.35,
  );
  const roleReach =
    role === "W" || role === "ST" ? 6.4 : role === "CM" ? 5.8 : role === "FB" ? 5.5 : 4.8;

  return roleReach * athletic;
}

function resolveDebugDefensiveAction(input: {
  defender: InternalLineupPlayer;
  actor: InternalLineupPlayer;
  ball: TrajectoryPoint;
  ballTarget: TrajectoryPoint;
  previousPositionState: PositionState;
  nextTick: number;
}): {
  event: EMatchEvent;
  label: string;
  target: TrajectoryPoint;
  isFoul?: boolean;
  isDeflection?: boolean;
  skill?: EPlayerSkill | null;
  skillLabel?: string | null;
} | null {
  const defenderPosition =
    input.previousPositionState.players.get(input.defender.userPlayerId) ?? input.defender.anchors;
  const distanceToLane = distance(defenderPosition, input.ballTarget);
  const distanceToBall = distance(defenderPosition, input.ball);
  const challengeDistance = Math.min(distanceToLane, distanceToBall);
  const canChallenge = challengeDistance <= 30;

  if (!canChallenge) {
    return null;
  }

  const tackleQuality =
    input.defender.raw.stats.tackle * 0.5 +
    input.defender.raw.stats.speed * 0.22 +
    input.defender.raw.stats.acceleration * 0.18 +
    input.defender.raw.stats.balance * 0.1;
  const carrierQuality =
    input.actor.raw.stats.dribbling * 0.48 +
    input.actor.raw.stats.balance * 0.24 +
    input.actor.raw.stats.speed * 0.18 +
    input.actor.raw.stats.acceleration * 0.1;
  const timingRoll =
    ((input.nextTick * 37 + input.defender.userPlayerId * 17 + input.actor.userPlayerId * 11) %
      100) /
    100;
  const skillRandom = createDeterministicSkillRandom(input.nextTick, input.defender.userPlayerId);
  addSkillCharge(input.defender, EPlayerSkill.TANK_TACKLE, 25);
  const skill = getChargedSkill(input.defender, "tackle");
  const activation = skill
    ? resolveSkillActivation(
        skill,
        createSkillContext(input.actor, input.defender, input.defender, skillRandom),
      )
    : null;
  const challengeDistancePenalty = clamp((challengeDistance - 5) / 18, 0, 0.32);
  const successChance = clamp(
    0.34 +
      (tackleQuality - carrierQuality + (activation?.defensePenalty ?? 0)) / 180 -
      challengeDistancePenalty +
      (skill === EPlayerSkill.TANK_TACKLE ? 0.18 : 0),
    0.12,
    skill === EPlayerSkill.TANK_TACKLE ? 0.9 : 0.74,
  );

  if (
    (input.nextTick % TACKLE_CADENCE_TICKS === 0 || challengeDistance <= 8.5) &&
    challengeDistance <= 16
  ) {
    const isClean = timingRoll < successChance;
    const deflectionWindow = clamp(0.24 + challengeDistancePenalty * 0.55, 0.18, 0.54);
    const target = {
      x: clamp(lerp(input.ball.x, defenderPosition.x, isClean ? 0.78 : 0.34), 6, 94),
      y: clamp(lerp(input.ball.y, defenderPosition.y, isClean ? 0.78 : 0.34), 6, 94),
    };

    if (!isClean) {
      return {
        event: EMatchEvent.FOUL,
        label: "xoac sai va pham loi",
        target: moveToward(input.ball, input.ballTarget, PASS_SPEED_UNITS_PER_TICK * 0.45),
        isFoul: true,
      };
    }

    if (timingRoll > successChance * (1 - deflectionWindow)) {
      return {
        event: EMatchEvent.SLIDE_TACKLE,
        label: "xoac trung lam bong vang ra",
        target: getTackleDeflectionTarget({
          ball: input.ball,
          ballTarget: input.ballTarget,
          defenderPosition,
          nextTick: input.nextTick,
        }),
        isDeflection: true,
      };
    }

    return {
      event: skill === EPlayerSkill.TANK_TACKLE ? EMatchEvent.SKILL_USED : EMatchEvent.SLIDE_TACKLE,
      label:
        skill === EPlayerSkill.TANK_TACKLE ? `dung ${getSkillLabel(skill)} cuop bong` : "xoac bong",
      target: moveToward(input.ball, target, PASS_SPEED_UNITS_PER_TICK * 0.8),
      skill,
      skillLabel: skill ? getSkillLabel(skill) : null,
    };
  }

  if (
    input.nextTick % Math.max(6, Math.round(TACKLE_CADENCE_TICKS * 0.7)) === 0 &&
    Math.min(distanceToLane, distanceToBall) <= 11 &&
    timingRoll < successChance + 0.08
  ) {
    const target = {
      x: clamp(lerp(input.ballTarget.x, defenderPosition.x, 0.55), 6, 94),
      y: clamp(lerp(input.ballTarget.y, defenderPosition.y, 0.55), 6, 94),
    };
    return {
      event: skill === EPlayerSkill.TANK_TACKLE ? EMatchEvent.SKILL_USED : EMatchEvent.TACKLE,
      label:
        skill === EPlayerSkill.TANK_TACKLE
          ? `dung ${getSkillLabel(skill)} huc vang bong`
          : "tac bong",
      target: moveToward(input.ballTarget, target, PASS_SPEED_UNITS_PER_TICK * 0.7),
      skill,
      skillLabel: skill ? getSkillLabel(skill) : null,
    };
  }

  return null;
}

function getTackleDeflectionTarget(input: {
  ball: TrajectoryPoint;
  ballTarget: TrajectoryPoint;
  defenderPosition: TrajectoryPoint;
  nextTick: number;
}) {
  const travel = {
    x: input.ballTarget.x - input.ball.x,
    y: input.ballTarget.y - input.ball.y,
  };
  const travelLength = Math.hypot(travel.x, travel.y) || 1;
  const side = input.nextTick % 2 === 0 ? -1 : 1;
  const deflect = {
    x: (travel.x / travelLength) * 4 + (-travel.y / travelLength) * side * 8,
    y: (travel.y / travelLength) * 4 + (travel.x / travelLength) * side * 8,
  };

  return {
    x: clamp(lerp(input.ball.x, input.defenderPosition.x, 0.42) + deflect.x, 5, 95),
    y: clamp(lerp(input.ball.y, input.defenderPosition.y, 0.42) + deflect.y, 5, 95),
  };
}

function resolveDebugShotAction(
  input: {
    shooter: InternalLineupPlayer;
    attacking: InternalLineupPlayer[];
    defending: InternalLineupPlayer[];
    possession: Side;
    ball: TrajectoryPoint;
    previousPositionState: PositionState;
    nextTick: number;
    latestEvent: EMatchEvent | null;
  },
  canReleaseBall = true,
): {
  event: EMatchEvent;
  label: string;
  target: TrajectoryPoint;
  ballPath: TrajectoryPoint[];
  shotQuality: number;
  distanceToGoal: number;
  isGoal: boolean;
  keeper: InternalLineupPlayer;
  skill: EPlayerSkill | null;
  skillLabel: string | null;
  shotMetadata: ShotMetadata;
} | null {
  if (!canReleaseBall) {
    return null;
  }

  if (normalizeRole(input.shooter.role) === "GK") {
    return null;
  }

  const keeper = input.defending.find((player) => player.role === "GK") ?? input.defending[0];
  const attackDirectionValue = attackDirection(input.possession);
  const goalY = input.possession === "home" ? 4 : 96;
  const role = normalizeRole(input.shooter.role);
  const goalCenter = { x: 50, y: goalY };
  const distanceToGoal = distance(input.ball, goalCenter);
  const keeperPosition = getPlayerPosition(input.previousPositionState, keeper);
  const pressure = evaluateBallPressure({
    actor: input.shooter,
    defending: input.defending,
    ball: input.ball,
    previousPositionState: input.previousPositionState,
  });
  const angleScore = evaluateShotAngle(input.ball, input.possession);
  const baseMaxShotDistance = getRoleMaxShotDistance(role, false);
  const distanceScore = clamp(
    (baseMaxShotDistance + 8 - distanceToGoal) / (baseMaxShotDistance + 4),
    0,
    1,
  );
  const centralPenalty = clamp(Math.abs(input.ball.x - goalCenter.x) / 40, 0, 0.22);
  const composurePenalty = pressure.distance <= 2.5 ? 0.18 : pressure.score * 0.08;
  const pressureUrgency = pressure.distance <= 3.2 && distanceToGoal <= 24 ? 0.08 : 0;
  const roleConfidence = role === "ST" ? 0.16 : role === "W" ? 0.1 : role === "CM" ? 0.05 : 0;
  const closeRangeBonus = distanceToGoal <= 18 ? 0.22 : distanceToGoal <= 26 ? 0.14 : 0;
  const decisionRoll =
    ((input.nextTick * 23 + input.shooter.userPlayerId * 17 + Math.round(input.ball.x * 3)) % 100) /
    100;
  const skillRandom = createDeterministicSkillRandom(input.nextTick, input.shooter.userPlayerId);
  addSkillCharge(input.shooter, EPlayerSkill.SHOOT_THUNDER, 25);
  const skill = getChargedSkill(input.shooter, "shoot");
  const hasThunderShot = skill === EPlayerSkill.SHOOT_THUNDER;
  const maxShotDistance = getRoleMaxShotDistance(role, hasThunderShot);
  const shotType = chooseShotType({
    shooter: input.shooter,
    role,
    ball: input.ball,
    possession: input.possession,
    keeperPosition,
    pressure,
    distanceToGoal,
    angleScore,
    latestEvent: input.latestEvent,
    hasThunderShot,
    random: skillRandom,
  });
  const targetSelection = chooseShotTargetPlan({
    shooter: input.shooter,
    defending: input.defending,
    possession: input.possession,
    ball: input.ball,
    previousPositionState: input.previousPositionState,
    keeperPosition,
    shotType,
    pressure,
    distanceToGoal,
    angleScore,
    random: skillRandom,
  });
  const lane = targetSelection.lane;
  const targetScoreBonus = clamp((targetSelection.score - 0.45) * 0.16, -0.04, 0.08);
  const shotQuality = clamp(
    distanceScore * 0.38 +
      angleScore * 0.28 +
      lane.score * 0.22 +
      targetScoreBonus +
      roleConfidence +
      closeRangeBonus -
      centralPenalty -
      composurePenalty +
      pressureUrgency,
    0,
    1,
  );
  const betterChance = evaluateBetterShotPass({
    shooter: input.shooter,
    attacking: input.attacking,
    defending: input.defending,
    ball: input.ball,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
    currentShotQuality: shotQuality,
  });
  const betterPassAvailable = betterChance.score > shotQuality + 0.2;
  const blockedLane =
    lane.distance < (hasThunderShot ? 3.1 : 4.1) &&
    lane.blockerDistanceToBall < (hasThunderShot ? 13 : 17);
  const emergencyShot =
    pressure.distance <= 2.6 && distanceToGoal <= 23 && lane.score >= 0.2 && angleScore >= 0.24;
  const shouldShoot =
    distanceToGoal <= maxShotDistance &&
    (input.nextTick % SHOT_CADENCE_TICKS === 0 || distanceToGoal <= 30 || hasThunderShot) &&
    (!blockedLane || hasThunderShot) &&
    (!betterPassAvailable || emergencyShot || shotQuality >= betterChance.score + 0.08) &&
    (distanceToGoal <= 24 ||
      emergencyShot ||
      (distanceToGoal <= maxShotDistance - 2 && lane.score >= 0.24) ||
      shotQuality >= (hasThunderShot ? 0.24 : 0.34) ||
      ((role === "ST" || role === "W") && shotQuality >= 0.26) ||
      decisionRoll < shotQuality * (hasThunderShot ? 1.05 : 0.84));

  if (!shouldShoot) {
    return null;
  }

  const shooterQuality =
    input.shooter.raw.stats.shoot * 0.5 +
    input.shooter.raw.stats.dribbling * 0.16 +
    input.shooter.raw.stats.vision * 0.08;
  const keeperQuality =
    keeper.raw.stats.gkKeeping * 0.44 +
    keeper.raw.stats.gkReflex * 0.34 +
    keeper.raw.stats.gkDiving * 0.22;
  const activation = skill
    ? resolveSkillActivation(skill, createSkillContext(input.shooter, keeper, keeper, skillRandom))
    : null;
  const longShotPenalty = clamp((distanceToGoal - baseMaxShotDistance + 4) / 18, 0, 0.42);
  const blockedPenalty = clamp((8 - lane.distance) / 14, 0, 0.18);
  const qualityEdge = clamp(
    (shooterQuality + (activation?.attackBonus ?? 0) - keeperQuality + 20) / 140,
    0,
    skill === EPlayerSkill.SHOOT_THUNDER ? 0.38 : 0.24,
  );
  const goalChance = clamp(
    targetSelection.metadata.expectedGoalValue +
      shotQuality * 0.18 +
      qualityEdge +
      (skill === EPlayerSkill.SHOOT_THUNDER ? 0.12 : 0) -
      composurePenalty * 0.42 -
      longShotPenalty * (skill === EPlayerSkill.SHOOT_THUNDER ? 0.5 : 0.9) -
      blockedPenalty,
    targetSelection.metadata.isOnTarget ? 0.02 : 0,
    skill === EPlayerSkill.SHOOT_THUNDER
      ? distanceToGoal > 38
        ? 0.18
        : distanceToGoal > 28
          ? 0.36
          : 0.62
      : distanceToGoal > 30
        ? 0.08
        : distanceToGoal > 24
          ? 0.16
          : 0.42,
  );
  const goalRoll =
    ((input.nextTick * 31 + input.shooter.userPlayerId * 29 + keeper.userPlayerId * 13) % 100) /
    100;
  const effectiveGoalChance = targetSelection.metadata.isOnTarget ? goalChance : 0;
  const isGoal = goalRoll < effectiveGoalChance;

  if (isGoal) {
    return {
      event: EMatchEvent.GOAL,
      label: getShotLabel(shotType, "goal", distanceToGoal),
      target: targetSelection.metadata.finalTargetAfterError,
      ballPath: buildShotBallPath({
        from: input.ball,
        aimTarget: targetSelection.metadata.finalTargetAfterError,
        endTarget: targetSelection.metadata.finalTargetAfterError,
        possession: input.possession,
        outcome: "goal",
        shotType,
        skill,
        random: skillRandom,
      }),
      shotQuality,
      distanceToGoal,
      isGoal: true,
      keeper,
      skill,
      skillLabel: skill ? getSkillLabel(skill) : null,
      shotMetadata: {
        ...targetSelection.metadata,
        expectedGoalValue: effectiveGoalChance,
        difficulty: clamp(targetSelection.metadata.difficulty + qualityEdge * 0.35, 0, 1),
      },
    };
  }

  const savePoint = {
    x: clamp(
      lerp(targetSelection.metadata.finalTargetAfterError.x, keeperPosition.x, 0.22),
      36,
      64,
    ),
    y: clamp(goalY - attackDirectionValue * 4.8, 5, 95),
  };
  const parryPoint = getKeeperParryTarget({
    savePoint,
    ball: input.ball,
    possession: input.possession,
    nextTick: input.nextTick,
  });
  const isKeeperSave = targetSelection.metadata.isOnTarget;
  const target = isKeeperSave ? parryPoint : targetSelection.metadata.finalTargetAfterError;

  return {
    event: isKeeperSave ? EMatchEvent.GOALKEEPER_SAVE : EMatchEvent.SHOOT,
    label: getShotLabel(shotType, isKeeperSave ? "save" : "miss", distanceToGoal),
    target,
    ballPath: buildShotBallPath({
      from: input.ball,
      aimTarget: targetSelection.metadata.finalTargetAfterError,
      endTarget: target,
      possession: input.possession,
      outcome: isKeeperSave ? "save" : "miss",
      shotType,
      skill,
      random: skillRandom,
    }),
    shotQuality,
    distanceToGoal,
    isGoal: false,
    keeper,
    skill,
    skillLabel: skill ? getSkillLabel(skill) : null,
    shotMetadata: {
      ...targetSelection.metadata,
      expectedGoalValue: effectiveGoalChance,
      isSaveable: isKeeperSave,
    },
  };
}

function getRoleMaxShotDistance(role: ReturnType<typeof normalizeRole>, hasThunderShot: boolean) {
  const normal =
    role === "ST"
      ? 28
      : role === "W"
        ? 24
        : role === "CM"
          ? 22
          : role === "DM" || role === "FB"
            ? 18
            : role === "CB"
              ? 12
              : 10;

  return hasThunderShot ? Math.min(34, normal + 7) : normal;
}

function evaluateBetterShotPass(input: {
  shooter: InternalLineupPlayer;
  attacking: InternalLineupPlayer[];
  defending: InternalLineupPlayer[];
  ball: TrajectoryPoint;
  possession: Side;
  previousPositionState: PositionState;
  currentShotQuality: number;
}) {
  const goalY = input.possession === "home" ? 4 : 96;
  const goalCenter = { x: 50, y: goalY };
  const candidates = input.attacking.filter(
    (player) =>
      player.userPlayerId !== input.shooter.userPlayerId && normalizeRole(player.role) !== "GK",
  );

  return candidates.reduce(
    (best, teammate) => {
      const teammatePosition =
        input.previousPositionState.players.get(teammate.userPlayerId) ?? teammate.anchors;
      const role = normalizeRole(teammate.role);
      const teammateDistance = distance(teammatePosition, goalCenter);
      const maxDistance = getRoleMaxShotDistance(role, false) + 4;
      if (teammateDistance > maxDistance) return best;

      const passLane = evaluatePassLane({
        from: input.ball,
        to: teammatePosition,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const shotLane = evaluateShotLane({
        from: teammatePosition,
        to: goalCenter,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const availability = evaluateTeammateAvailability({
        receiver: teammate,
        target: teammatePosition,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const angle = evaluateShotAngle(teammatePosition, input.possession);
      const distanceValue = clamp((maxDistance + 4 - teammateDistance) / maxDistance, 0, 1);
      const centralBonus = clamp((18 - Math.abs(teammatePosition.x - 50)) / 18, 0, 0.16);
      const value = clamp(
        distanceValue * 0.34 +
          angle * 0.24 +
          shotLane.score * 0.18 +
          passLane.score * 0.14 +
          availability * 0.16 +
          centralBonus,
        0,
        1,
      );

      return value > best.score ? { score: value, receiver: teammate } : best;
    },
    { score: 0, receiver: null as InternalLineupPlayer | null },
  );
}

function createDeterministicSkillRandom(tick: number, playerId: number) {
  let seed = Math.max(1, Math.floor(tick * 1103515245 + playerId * 12345));
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function resolveFreeKickAction(input: {
  taker: InternalLineupPlayer;
  attacking: InternalLineupPlayer[];
  defending: InternalLineupPlayer[];
  ball: TrajectoryPoint;
  possession: Side;
  previousPositionState: PositionState;
  nextTick: number;
}): {
  event: EMatchEvent;
  label: string;
  decision: "shoot" | "pass";
  target: TrajectoryPoint;
  ballPath: TrajectoryPoint[];
  nextOwner: InternalLineupPlayer;
  nextPossession: Side;
  secondaryPlayerId: number | null;
  wallPlayerIds: number[];
  distanceToGoal: number;
  isGoal: boolean;
} {
  const goalY = input.possession === "home" ? 4 : 96;
  const distanceToGoal = Math.abs(input.ball.y - goalY);
  const keeper = input.defending.find((player) => player.role === "GK") ?? input.defending[0];
  const wall = selectFreeKickWall({
    defending: input.defending,
    ball: input.ball,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });
  const shotLane = evaluateShotLane({
    from: input.ball,
    to: { x: 50, y: goalY },
    defending: input.defending.filter(
      (player) => !wall.wallPlayerIds.includes(player.userPlayerId),
    ),
    previousPositionState: input.previousPositionState,
  });
  const canShoot = distanceToGoal <= 34 && distanceToGoal >= 10;
  const shotScore = clamp(
    (34 - distanceToGoal) / 30 +
      input.taker.raw.stats.shoot / 260 +
      input.taker.raw.stats.vision / 360 +
      shotLane.score * 0.18 -
      wall.wallPlayerIds.length * 0.035,
    0,
    1,
  );
  const roll =
    ((input.nextTick * 41 + input.taker.userPlayerId * 23 + wall.wallPlayerIds.length * 7) % 100) /
    100;
  const shouldShoot = canShoot && (distanceToGoal <= 22 || roll < shotScore * 0.72);

  if (shouldShoot) {
    const goalTarget = chooseShotTarget(input.ball, input.possession, input.nextTick);
    const goalChance = clamp(
      0.04 + shotScore * 0.26 - wall.wallPlayerIds.length * 0.025,
      0.02,
      distanceToGoal <= 22 ? 0.32 : 0.18,
    );
    const isGoal = roll < goalChance;
    const saveTarget = {
      x: clamp(lerp(goalTarget.x, keeper.anchors.x, 0.2), 38, 62),
      y: clamp(goalY - attackDirection(input.possession) * 4.5, 5, 95),
    };
    const target = isGoal ? goalTarget : saveTarget;

    return {
      event: isGoal ? EMatchEvent.GOAL : EMatchEvent.FREE_KICK,
      label: isGoal ? "sut phat ghi ban" : "sut phat qua hang rao",
      decision: "shoot",
      target,
      ballPath: buildCurvedShotPath(input.ball, target, input.possession, isGoal ? "goal" : "save"),
      nextOwner: isGoal ? input.taker : keeper,
      nextPossession: isGoal ? input.possession : input.possession === "home" ? "away" : "home",
      secondaryPlayerId: keeper.userPlayerId,
      wallPlayerIds: wall.wallPlayerIds,
      distanceToGoal,
      isGoal,
    };
  }

  const receiver =
    input.attacking
      .filter((player) => player.userPlayerId !== input.taker.userPlayerId && player.role !== "GK")
      .map((player) => ({
        player,
        score:
          evaluateTacticalAdvantage({
            receiver: player,
            from: input.ball,
            to: player.anchors,
            possession: input.possession,
          }) + clamp((35 - distance(player.anchors, input.ball)) / 40, 0, 0.4),
      }))
      .sort((left, right) => right.score - left.score)[0]?.player ?? input.taker;
  const passTarget = getDebugPassTarget({
    receiver,
    receiverPreviousPosition:
      input.previousPositionState.players.get(receiver.userPlayerId) ?? receiver.anchors,
    ball: input.ball,
    tick: input.nextTick,
    possession: input.possession,
    defending: input.defending,
    previousPositionState: input.previousPositionState,
  });

  return {
    event: EMatchEvent.FREE_KICK,
    label: "da phat phoi hop",
    decision: "pass",
    target: passTarget,
    ballPath: pathBetween(input.ball, passTarget),
    nextOwner: receiver,
    nextPossession: input.possession,
    secondaryPlayerId: receiver.userPlayerId,
    wallPlayerIds: wall.wallPlayerIds,
    distanceToGoal,
    isGoal: false,
  };
}

function getKeeperParryTarget(input: {
  savePoint: TrajectoryPoint;
  ball: TrajectoryPoint;
  possession: Side;
  nextTick: number;
}) {
  const goalY = input.possession === "home" ? 4 : 96;
  const directionFromGoal = input.possession === "home" ? 1 : -1;
  const variant = (input.nextTick + Math.round(input.ball.x * 2)) % 4;

  if (variant === 0) {
    return {
      x: clamp(input.savePoint.x + (input.ball.x < 50 ? -15 : 15), 2, 98),
      y: clamp(goalY + directionFromGoal * 8, 2, 98),
    };
  }

  if (variant === 1) {
    return {
      x: clamp(input.savePoint.x + (input.ball.x < 50 ? -24 : 24), 2, 98),
      y: clamp(input.savePoint.y + directionFromGoal * 3, 2, 98),
    };
  }

  if (variant === 2) {
    return {
      x: clamp(input.savePoint.x + (input.ball.x < 50 ? -10 : 10), 2, 98),
      y: clamp(goalY - directionFromGoal * 2.2, 2, 98),
    };
  }

  return {
    x: clamp(lerp(input.savePoint.x, 50, 0.35), 2, 98),
    y: clamp(goalY + directionFromGoal * 15, 2, 98),
  };
}

function selectFreeKickWall(input: {
  defending: InternalLineupPlayer[];
  ball: TrajectoryPoint;
  possession: Side;
  previousPositionState: PositionState;
}) {
  const goalY = input.possession === "home" ? 4 : 96;
  const distanceToGoal = Math.abs(input.ball.y - goalY);
  const wallCount =
    distanceToGoal <= 18 ? 5 : distanceToGoal <= 25 ? 4 : distanceToGoal <= 34 ? 3 : 0;

  if (wallCount <= 0) return { wallPlayerIds: [] };

  const wallPlayerIds = input.defending
    .filter((player) => player.role !== "GK")
    .map((player) => ({
      player,
      distance: distance(
        input.previousPositionState.players.get(player.userPlayerId) ?? player.anchors,
        input.ball,
      ),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, wallCount)
    .map((item) => item.player.userPlayerId);

  return { wallPlayerIds };
}

function getFreeKickWallTargets(input: {
  defending: InternalLineupPlayer[];
  ball: TrajectoryPoint;
  possession: Side;
  positionState: PositionState;
}) {
  const selected = selectFreeKickWall({
    defending: input.defending,
    ball: input.ball,
    possession: input.possession,
    previousPositionState: input.positionState,
  }).wallPlayerIds;
  const targets = new Map<number, TrajectoryPoint>();
  if (!selected.length) return targets;

  const goalY = input.possession === "home" ? 4 : 96;
  const directionToGoal = goalY < input.ball.y ? -1 : 1;
  const wallY = clamp(input.ball.y + directionToGoal * 7.5, 8, 92);
  const centerX = clamp(lerp(input.ball.x, 50, 0.42), 24, 76);
  const spacing = 2.5;
  const start = -((selected.length - 1) * spacing) / 2;

  selected.forEach((playerId, index) => {
    targets.set(playerId, {
      x: clamp(centerX + start + index * spacing, 12, 88),
      y: wallY,
    });
  });

  return targets;
}

function chooseShotTarget(ball: TrajectoryPoint, possession: Side, nextTick: number) {
  const random = createDeterministicSkillRandom(nextTick, Math.round(ball.x * 100 + ball.y));
  const goalY = possession === "home" ? 4 : 96;
  const isLeft = ball.x < 50;
  const zones = getShotTargetZones(ball, possession, isLeft ? "FAR_POST_SHOT" : "PLACED_SHOT");
  const picked = weightedPickTopTargets(
    zones.map((zone) => ({
      ...zone,
      score:
        (zone.zone.includes("corner") ? 0.72 : 0.48) +
        (zone.zone === "far post" || zone.zone === "across-goal finish" ? 0.24 : 0) +
        random() * 0.08,
    })),
    random,
  );

  return {
    x: clamp(picked.point.x + (random() - 0.5) * 1.8, 36, 64),
    y: goalY,
  };
}

function chooseShotType(input: {
  shooter: InternalLineupPlayer;
  role: ReturnType<typeof normalizeRole>;
  ball: TrajectoryPoint;
  possession: Side;
  keeperPosition: TrajectoryPoint;
  pressure: { distance: number; score: number };
  distanceToGoal: number;
  angleScore: number;
  latestEvent: EMatchEvent | null;
  hasThunderShot: boolean;
  random: () => number;
}): ShotType {
  if (input.hasThunderShot) return "POWER_SHOT";

  const goalY = input.possession === "home" ? 4 : 96;
  const wide = Math.abs(input.ball.x - 50) > 18;
  const veryWide = Math.abs(input.ball.x - 50) > 28;
  const close = input.distanceToGoal <= 14;
  const keeperAdvanced = Math.abs(input.keeperPosition.y - goalY) > 12;
  const firstTimeWindow =
    input.latestEvent === EMatchEvent.PASS || input.latestEvent === EMatchEvent.CORNER_KICK;
  const scores: Array<{ type: ShotType; score: number }> = [
    {
      type: "POWER_SHOT",
      score:
        0.28 +
        clamp((input.distanceToGoal - 16) / 18, 0, 0.28) +
        (input.role === "CM" || input.role === "ST" ? 0.1 : 0),
    },
    {
      type: "PLACED_SHOT",
      score:
        0.42 +
        input.angleScore * 0.24 +
        clamp((24 - input.distanceToGoal) / 22, 0, 0.18) +
        (input.role === "ST" || input.role === "W" ? 0.06 : 0),
    },
    {
      type: "LOW_DRIVEN_SHOT",
      score: 0.22 + (close ? 0.34 : 0) + input.angleScore * 0.12 - input.pressure.score * 0.04,
    },
    {
      type: "CHIP_SHOT",
      score:
        (keeperAdvanced && input.distanceToGoal <= 22 ? 0.5 : 0.04) -
        (input.pressure.score > 0.65 ? 0.16 : 0),
    },
    {
      type: "NEAR_POST_SHOT",
      score: 0.18 + (wide ? 0.18 : 0) + (veryWide ? 0.08 : 0) + input.pressure.score * 0.05,
    },
    {
      type: "FAR_POST_SHOT",
      score: 0.26 + (wide ? 0.34 : 0) + input.angleScore * 0.08,
    },
    {
      type: "FIRST_TIME_SHOT",
      score: (firstTimeWindow ? 0.34 : 0.06) + (close ? 0.16 : 0) + input.pressure.score * 0.08,
    },
    {
      type: "DESPERATE_SHOT",
      score:
        0.08 +
        input.pressure.score * 0.26 +
        clamp((0.42 - input.angleScore) * 0.45, 0, 0.18) +
        clamp((input.distanceToGoal - 24) / 16, 0, 0.14),
    },
  ];

  return weightedPickTopTargets(scores, input.random, 3).type;
}

function chooseShotTargetPlan(input: {
  shooter: InternalLineupPlayer;
  defending: InternalLineupPlayer[];
  possession: Side;
  ball: TrajectoryPoint;
  previousPositionState: PositionState;
  keeperPosition: TrajectoryPoint;
  shotType: ShotType;
  pressure: { distance: number; score: number };
  distanceToGoal: number;
  angleScore: number;
  random: () => number;
}): {
  zone: ShotTargetZone;
  score: number;
  lane: ReturnType<typeof evaluateShotLane>;
  metadata: ShotMetadata;
} {
  const candidates = getShotTargetZones(input.ball, input.possession, input.shotType).map(
    (candidate) => {
      const lane = evaluateShotLane({
        from: input.ball,
        to: candidate.point,
        defending: input.defending,
        previousPositionState: input.previousPositionState,
      });
      const score =
        candidate.baseScore +
        scoreTargetForShooterPosition(candidate.zone, input.ball) +
        scoreTargetForShotType(candidate.zone, input.shotType) +
        scoreTargetAgainstKeeper(candidate.point, input.keeperPosition) +
        lane.score * 0.22 +
        input.angleScore * candidate.angleWeight -
        input.pressure.score * candidate.pressurePenalty -
        clamp((input.distanceToGoal - 24) / 22, 0, 0.2) * candidate.longRangePenalty;

      return { ...candidate, lane, score: clamp(score, 0.01, 1.5) };
    },
  );
  const selected = weightedPickTopTargets(candidates, input.random, 3);
  const accuracy = calculateShotAccuracy({
    shooter: input.shooter,
    ball: input.ball,
    possession: input.possession,
    distanceToGoal: input.distanceToGoal,
    pressure: input.pressure,
    shotType: input.shotType,
    angleScore: input.angleScore,
  });
  const finalTarget = applyShotError({
    originalTarget: selected.point,
    ball: input.ball,
    possession: input.possession,
    distanceToGoal: input.distanceToGoal,
    pressure: input.pressure,
    shotType: input.shotType,
    accuracy,
    random: input.random,
  });
  const shotSpeed = calculateShotSpeed(input.shotType, input.distanceToGoal);
  const saveDifficulty = calculateSaveDifficulty({
    finalTarget,
    ball: input.ball,
    possession: input.possession,
    keeperPosition: input.keeperPosition,
    shotType: input.shotType,
    shotSpeed,
    distanceToGoal: input.distanceToGoal,
    keeper: input.defending.find((player) => player.role === "GK") ?? input.defending[0],
  });
  const isOnTarget = isShotOnTarget(finalTarget, input.possession);
  const expectedGoalValue = calculateExpectedGoalValue({
    isOnTarget,
    saveDifficulty,
    shotType: input.shotType,
    distanceToGoal: input.distanceToGoal,
    angleScore: input.angleScore,
    pressure: input.pressure,
  });

  return {
    zone: selected.zone,
    score: selected.score,
    lane: selected.lane,
    metadata: {
      shooterId: input.shooter.userPlayerId,
      shotType: input.shotType,
      targetZone: selected.zone,
      originalTarget: selected.point,
      finalTargetAfterError: finalTarget,
      shotSpeed,
      accuracy,
      difficulty: clamp(saveDifficulty * 0.72 + (1 - accuracy) * 0.28, 0, 1),
      expectedGoalValue,
      isOnTarget,
      isSaveable: isOnTarget,
      saveDifficulty,
      missReason: isOnTarget ? null : getShotMissReason(finalTarget, input.possession),
      goalkeeperPosition: input.keeperPosition,
      goalkeeperReactionDifficulty: saveDifficulty,
    },
  };
}

function getShotTargetZones(
  ball: TrajectoryPoint,
  possession: Side,
  shotType: ShotType,
): Array<{
  zone: ShotTargetZone;
  point: TrajectoryPoint;
  height: ShotHeightProfile;
  baseScore: number;
  angleWeight: number;
  pressurePenalty: number;
  longRangePenalty: number;
}> {
  const goalY = possession === "home" ? 4 : 96;
  const leftPostX = 41.5;
  const rightPostX = 58.5;
  const nearPostX = ball.x < 50 ? leftPostX : rightPostX;
  const farPostX = ball.x < 50 ? rightPostX : leftPostX;
  const farCornerX = ball.x < 50 ? 57.8 : 42.2;
  const nearCornerX = ball.x < 50 ? 42.2 : 57.8;
  const highY = clamp(goalY - attackDirection(possession) * 0.9, 2, 98);
  const lowY = clamp(goalY + attackDirection(possession) * 0.4, 2, 98);
  const chipY = clamp(goalY - attackDirection(possession) * 1.5, 1, 99);
  const zones: Array<{
    zone: ShotTargetZone;
    point: TrajectoryPoint;
    height: ShotHeightProfile;
    baseScore: number;
    angleWeight: number;
    pressurePenalty: number;
    longRangePenalty: number;
  }> = [
    {
      zone: "top-left corner",
      point: { x: leftPostX + 1.2, y: highY },
      height: "high",
      baseScore: 0.42,
      angleWeight: 0.16,
      pressurePenalty: 0.18,
      longRangePenalty: 0.35,
    },
    {
      zone: "top-right corner",
      point: { x: rightPostX - 1.2, y: highY },
      height: "high",
      baseScore: 0.42,
      angleWeight: 0.16,
      pressurePenalty: 0.18,
      longRangePenalty: 0.35,
    },
    {
      zone: "bottom-left corner",
      point: { x: leftPostX + 0.9, y: lowY },
      height: "low",
      baseScore: 0.48,
      angleWeight: 0.18,
      pressurePenalty: 0.12,
      longRangePenalty: 0.24,
    },
    {
      zone: "bottom-right corner",
      point: { x: rightPostX - 0.9, y: lowY },
      height: "low",
      baseScore: 0.48,
      angleWeight: 0.18,
      pressurePenalty: 0.12,
      longRangePenalty: 0.24,
    },
    {
      zone: "center-low",
      point: { x: 50, y: lowY },
      height: "low",
      baseScore: 0.16,
      angleWeight: 0.08,
      pressurePenalty: -0.04,
      longRangePenalty: 0.08,
    },
    {
      zone: "center-high",
      point: { x: 50, y: highY },
      height: "high",
      baseScore: 0.12,
      angleWeight: 0.06,
      pressurePenalty: -0.02,
      longRangePenalty: 0.18,
    },
    {
      zone: "near post",
      point: { x: nearPostX, y: lowY },
      height: "mid",
      baseScore: 0.24,
      angleWeight: 0.1,
      pressurePenalty: 0.06,
      longRangePenalty: 0.22,
    },
    {
      zone: "far post",
      point: { x: farPostX, y: lowY },
      height: "mid",
      baseScore: 0.36,
      angleWeight: 0.12,
      pressurePenalty: 0.08,
      longRangePenalty: 0.18,
    },
    {
      zone: "across-goal finish",
      point: { x: farCornerX, y: lowY },
      height: "low",
      baseScore: 0.34,
      angleWeight: 0.14,
      pressurePenalty: 0.08,
      longRangePenalty: 0.22,
    },
    {
      zone: "low driven shot",
      point: { x: farCornerX, y: lowY },
      height: "low",
      baseScore: shotType === "LOW_DRIVEN_SHOT" ? 0.52 : 0.22,
      angleWeight: 0.12,
      pressurePenalty: 0.06,
      longRangePenalty: 0.32,
    },
    {
      zone: "high powerful shot",
      point: { x: Math.abs(ball.x - 50) > 12 ? nearCornerX : farCornerX, y: chipY },
      height: shotType === "CHIP_SHOT" ? "chip" : "high",
      baseScore: shotType === "POWER_SHOT" || shotType === "CHIP_SHOT" ? 0.5 : 0.2,
      angleWeight: 0.08,
      pressurePenalty: 0.2,
      longRangePenalty: shotType === "POWER_SHOT" ? 0.12 : 0.3,
    },
  ];

  return zones;
}

function weightedPickTopTargets<T extends { score: number }>(
  candidates: T[],
  random: () => number,
  topCount = 3,
): T {
  const ranked = [...candidates]
    .filter((candidate) => Number.isFinite(candidate.score) && candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, topCount));
  const total = ranked.reduce((sum, candidate) => sum + candidate.score, 0);
  let roll = random() * total;

  for (const candidate of ranked) {
    roll -= candidate.score;
    if (roll <= 0) return candidate;
  }

  return ranked[0] ?? candidates[0];
}

function scoreTargetForShooterPosition(zone: ShotTargetZone, ball: TrajectoryPoint) {
  const lateral = Math.abs(ball.x - 50);
  const wide = lateral > 18;
  const central = lateral <= 12;

  if (wide && (zone === "far post" || zone === "across-goal finish")) return 0.3;
  if (wide && zone === "near post") return 0.14;
  if (wide && zone === "low driven shot") return 0.12;
  if (central && zone.includes("corner")) return 0.26;
  if (central && (zone === "center-low" || zone === "center-high")) return -0.12;
  if (lateral > 28 && zone.includes("top")) return -0.08;
  return 0;
}

function scoreTargetForShotType(zone: ShotTargetZone, shotType: ShotType) {
  if (shotType === "POWER_SHOT") {
    return zone === "high powerful shot" ? 0.34 : zone.includes("top") ? 0.12 : -0.02;
  }
  if (shotType === "PLACED_SHOT") {
    return zone.includes("corner") ? 0.22 : zone.includes("center") ? -0.18 : 0.04;
  }
  if (shotType === "LOW_DRIVEN_SHOT") {
    return zone === "low driven shot" || zone.includes("bottom")
      ? 0.28
      : zone.includes("top")
        ? -0.2
        : 0;
  }
  if (shotType === "CHIP_SHOT") {
    return zone === "high powerful shot" || zone === "center-high" ? 0.28 : -0.16;
  }
  if (shotType === "NEAR_POST_SHOT") {
    return zone === "near post" ? 0.32 : zone === "far post" ? -0.08 : 0;
  }
  if (shotType === "FAR_POST_SHOT") {
    return zone === "far post" || zone === "across-goal finish"
      ? 0.34
      : zone === "near post"
        ? -0.04
        : 0;
  }
  if (shotType === "FIRST_TIME_SHOT") {
    return zone.includes("bottom") || zone === "center-low"
      ? 0.12
      : zone.includes("top")
        ? -0.08
        : 0;
  }
  return zone.includes("center") || zone === "near post" ? 0.12 : -0.06;
}

function scoreTargetAgainstKeeper(target: TrajectoryPoint, keeperPosition: TrajectoryPoint) {
  const openSide = clamp(Math.abs(target.x - keeperPosition.x) / 18, 0, 0.28);
  const centralSaveBonus = Math.abs(target.x - 50) < 4 ? -0.18 : 0;
  return openSide + centralSaveBonus;
}

function calculateShotAccuracy(input: {
  shooter: InternalLineupPlayer;
  ball: TrajectoryPoint;
  possession: Side;
  distanceToGoal: number;
  pressure: { distance: number; score: number };
  shotType: ShotType;
  angleScore: number;
}) {
  const stat = clamp(input.shooter.raw.stats.shoot / 100, 0.35, 1.15);
  const widePenalty = clamp(Math.abs(input.ball.x - 50) / 42, 0, 0.32);
  const distancePenalty = clamp((input.distanceToGoal - 16) / 30, 0, 0.38);
  const typeModifier =
    input.shotType === "PLACED_SHOT"
      ? 0.14
      : input.shotType === "LOW_DRIVEN_SHOT"
        ? 0.08
        : input.shotType === "POWER_SHOT"
          ? -0.12
          : input.shotType === "FIRST_TIME_SHOT"
            ? -0.16
            : input.shotType === "DESPERATE_SHOT"
              ? -0.22
              : input.shotType === "CHIP_SHOT"
                ? -0.1
                : 0;

  return clamp(
    0.54 +
      stat * 0.34 +
      input.angleScore * 0.12 +
      typeModifier -
      input.pressure.score * 0.24 -
      widePenalty -
      distancePenalty,
    0.18,
    0.96,
  );
}

function applyShotError(input: {
  originalTarget: TrajectoryPoint;
  ball: TrajectoryPoint;
  possession: Side;
  distanceToGoal: number;
  pressure: { distance: number; score: number };
  shotType: ShotType;
  accuracy: number;
  random: () => number;
}) {
  const goalY = input.possession === "home" ? 4 : 96;
  const direction = attackDirection(input.possession);
  const wideFactor = clamp(Math.abs(input.ball.x - 50) / 42, 0, 1);
  const typeError =
    input.shotType === "PLACED_SHOT"
      ? 0.72
      : input.shotType === "LOW_DRIVEN_SHOT"
        ? 0.82
        : input.shotType === "POWER_SHOT"
          ? 1.22
          : input.shotType === "FIRST_TIME_SHOT"
            ? 1.35
            : input.shotType === "DESPERATE_SHOT"
              ? 1.55
              : input.shotType === "CHIP_SHOT"
                ? 1.18
                : 1;
  const errorRadius =
    (0.8 +
      input.distanceToGoal * 0.045 +
      wideFactor * 1.6 +
      input.pressure.score * 2.2 +
      (1 - input.accuracy) * 4.2) *
    typeError;
  const lateralSign = input.ball.x < 50 ? -1 : 1;
  const xError = (input.random() - 0.5) * errorRadius * 2.1 + lateralSign * wideFactor * 0.45;
  const yError = (input.random() - 0.5) * errorRadius * 0.9;
  const overHit =
    input.shotType === "POWER_SHOT" || input.shotType === "DESPERATE_SHOT"
      ? input.random() < clamp((1 - input.accuracy) * 0.45, 0, 0.28)
      : false;

  return {
    x: clamp(input.originalTarget.x + xError, 28, 72),
    y: clamp(
      input.originalTarget.y + yError + (overHit ? direction * -3 : 0),
      goalY - 8,
      goalY + 8,
    ),
  };
}

function calculateShotSpeed(shotType: ShotType, distanceToGoal: number) {
  const base =
    shotType === "POWER_SHOT"
      ? 1.28
      : shotType === "LOW_DRIVEN_SHOT"
        ? 1.22
        : shotType === "NEAR_POST_SHOT"
          ? 1.12
          : shotType === "FAR_POST_SHOT"
            ? 1.06
            : shotType === "FIRST_TIME_SHOT"
              ? 1.14
              : shotType === "CHIP_SHOT"
                ? 0.72
                : shotType === "DESPERATE_SHOT"
                  ? 1.05
                  : 0.96;
  const rangeBoost = clamp(distanceToGoal / 34, 0, 0.16);
  return Number((SHOT_SPEED_UNITS_PER_TICK * (base + rangeBoost)).toFixed(2));
}

function calculateSaveDifficulty(input: {
  finalTarget: TrajectoryPoint;
  ball: TrajectoryPoint;
  possession: Side;
  keeperPosition: TrajectoryPoint;
  shotType: ShotType;
  shotSpeed: number;
  distanceToGoal: number;
  keeper: InternalLineupPlayer;
}) {
  const keeperStat =
    input.keeper.raw.stats.gkKeeping * 0.36 +
    input.keeper.raw.stats.gkReflex * 0.34 +
    input.keeper.raw.stats.gkDiving * 0.2 +
    input.keeper.raw.stats.gkReach * 0.1;
  const cornerDistance = clamp(Math.abs(input.finalTarget.x - 50) / 9, 0, 1);
  const keeperTravel = clamp(distance(input.keeperPosition, input.finalTarget) / 18, 0, 1);
  const closeReaction = clamp((20 - input.distanceToGoal) / 18, 0, 1);
  const speedFactor = clamp(input.shotSpeed / (SHOT_SPEED_UNITS_PER_TICK * 1.45), 0, 1);
  const typeDifficulty =
    input.shotType === "LOW_DRIVEN_SHOT"
      ? 0.14
      : input.shotType === "POWER_SHOT"
        ? 0.12
        : input.shotType === "CHIP_SHOT"
          ? Math.abs(input.keeperPosition.y - (input.possession === "home" ? 4 : 96)) > 12
            ? 0.18
            : -0.18
          : input.shotType === "PLACED_SHOT"
            ? 0.08
            : 0;

  return clamp(
    0.18 +
      cornerDistance * 0.26 +
      keeperTravel * 0.22 +
      closeReaction * 0.2 +
      speedFactor * 0.18 +
      typeDifficulty -
      clamp((keeperStat - 58) / 220, -0.08, 0.18),
    0.04,
    0.96,
  );
}

function calculateExpectedGoalValue(input: {
  isOnTarget: boolean;
  saveDifficulty: number;
  shotType: ShotType;
  distanceToGoal: number;
  angleScore: number;
  pressure: { distance: number; score: number };
}) {
  if (!input.isOnTarget) return 0;

  const closeBonus = clamp((22 - input.distanceToGoal) / 24, 0, 0.22);
  const typeBonus =
    input.shotType === "LOW_DRIVEN_SHOT"
      ? 0.06
      : input.shotType === "PLACED_SHOT"
        ? 0.04
        : input.shotType === "CHIP_SHOT"
          ? 0.03
          : input.shotType === "DESPERATE_SHOT"
            ? -0.08
            : 0;
  return clamp(
    0.04 +
      input.saveDifficulty * 0.36 +
      input.angleScore * 0.08 +
      closeBonus +
      typeBonus -
      input.pressure.score * 0.08,
    0.01,
    input.distanceToGoal <= 12 ? 0.52 : input.distanceToGoal <= 22 ? 0.38 : 0.2,
  );
}

function isShotOnTarget(target: TrajectoryPoint, possession: Side) {
  const goalY = possession === "home" ? 4 : 96;
  const reachesGoalLine = possession === "home" ? target.y <= goalY + 3.6 : target.y >= goalY - 3.6;
  return target.x >= 40.5 && target.x <= 59.5 && reachesGoalLine;
}

function getShotMissReason(target: TrajectoryPoint, possession: Side) {
  if (target.x < 40.5) return "wide-left";
  if (target.x > 59.5) return "wide-right";
  const goalY = possession === "home" ? 4 : 96;
  if (possession === "home" ? target.y > goalY + 3.6 : target.y < goalY - 3.6) return "under-hit";
  return "off-target";
}

function buildShotBallPath(input: {
  from: TrajectoryPoint;
  aimTarget: TrajectoryPoint;
  endTarget: TrajectoryPoint;
  possession: Side;
  outcome: "goal" | "save" | "miss";
  shotType: ShotType;
  skill: EPlayerSkill | null;
  random: () => number;
}): TrajectoryPoint[] {
  const direction = attackDirection(input.possession);
  const curveSide = input.from.x <= 50 ? -1 : 1;
  const isThunder = input.skill === EPlayerSkill.SHOOT_THUNDER;
  const curveStrength =
    input.shotType === "PLACED_SHOT" || input.shotType === "FAR_POST_SHOT"
      ? 4.8
      : input.shotType === "POWER_SHOT" || isThunder
        ? 2.2
        : input.shotType === "CHIP_SHOT"
          ? 7.2
          : 3.4;
  const lift =
    input.shotType === "CHIP_SHOT"
      ? 9
      : input.shotType === "LOW_DRIVEN_SHOT"
        ? 0.8
        : input.outcome === "save"
          ? 2.4
          : 1.8;

  return Array.from({ length: FRAMES_PER_ACTION }, (_, index) => {
    const t = (index + 1) / FRAMES_PER_ACTION;
    const eased = easeOut(t);
    const arc = Math.sin(Math.PI * t);
    const target = input.outcome === "save" && t > 0.72 ? input.endTarget : input.aimTarget;
    const thunderShake = isThunder ? Math.sin(t * Math.PI * 7 + input.random()) * (1 - t) * 3.6 : 0;
    return {
      x: clamp(
        lerp(input.from.x, target.x, eased) + curveSide * arc * curveStrength + thunderShake,
        0.5,
        99.5,
      ),
      y: clamp(lerp(input.from.y, target.y, eased) - direction * arc * lift, 0.5, 99.5),
    };
  });
}

function getShotLabel(
  shotType: ShotType,
  outcome: "goal" | "save" | "miss",
  distanceToGoal: number,
) {
  const prefix =
    shotType === "POWER_SHOT"
      ? "sut cang"
      : shotType === "PLACED_SHOT"
        ? "sut dat long"
        : shotType === "LOW_DRIVEN_SHOT"
          ? "sut sam"
          : shotType === "CHIP_SHOT"
            ? "lob bong"
            : shotType === "NEAR_POST_SHOT"
              ? "sut goc gan"
              : shotType === "FAR_POST_SHOT"
                ? "sut cheo goc xa"
                : shotType === "FIRST_TIME_SHOT"
                  ? "dut diem mot cham"
                  : "sut voi";

  if (outcome === "goal")
    return distanceToGoal > 28 ? `${prefix} tu xa ghi ban` : `${prefix} ghi ban`;
  if (outcome === "save") return `${prefix}, thu mon cuu thua`;
  return `${prefix} ra ngoai`;
}

function evaluateShotLane(input: {
  from: TrajectoryPoint;
  to: TrajectoryPoint;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
}) {
  const blockers = input.defending
    .filter((player) => player.role !== "GK")
    .map((defender) => {
      const position =
        input.previousPositionState.players.get(defender.userPlayerId) ?? defender.anchors;
      return {
        distance: distanceToSegment(position, input.from, input.to),
        blockerDistanceToBall: distance(position, input.from),
      };
    })
    .sort(
      (left, right) =>
        left.distance - right.distance || left.blockerDistanceToBall - right.blockerDistanceToBall,
    );
  const closest = blockers[0];

  if (!closest) {
    return { score: 1, distance: Number.POSITIVE_INFINITY, blockerDistanceToBall: 99 };
  }

  return {
    score: clamp((closest.distance - 3) / 15, 0, 1),
    distance: closest.distance,
    blockerDistanceToBall: closest.blockerDistanceToBall,
  };
}

function getPlayerPosition(
  positionState: PositionState,
  player: InternalLineupPlayer,
): TrajectoryPoint {
  const position = positionState.players.get(player.userPlayerId);
  return position ? { x: position.x, y: position.y } : player.anchors;
}

function evaluateShotAngle(ball: TrajectoryPoint, possession: Side) {
  const goalY = possession === "home" ? 4 : 96;
  const distanceY = Math.max(1, Math.abs(ball.y - goalY));
  const lateral = Math.abs(ball.x - 50);
  return clamp(1 - lateral / (distanceY * 0.9 + 18), 0, 1);
}

function buildCurvedShotPath(
  from: TrajectoryPoint,
  to: TrajectoryPoint,
  possession: Side,
  outcome: "goal" | "save" | "miss",
): TrajectoryPoint[] {
  const direction = attackDirection(possession);
  const curveSide = from.x <= 50 ? -1 : 1;
  const curveStrength = outcome === "save" ? 5.2 : outcome === "goal" ? 4.4 : 6.4;
  const lift = outcome === "save" ? 3.6 : 2.4;

  return Array.from({ length: FRAMES_PER_ACTION }, (_, index) => {
    const t = (index + 1) / FRAMES_PER_ACTION;
    const eased = easeOut(t);
    const arc = Math.sin(Math.PI * t);
    return {
      x: clamp(lerp(from.x, to.x, eased) + curveSide * arc * curveStrength, 4, 96),
      y: clamp(lerp(from.y, to.y, eased) - direction * arc * lift, 4, 96),
    };
  });
}

function getNextMatchClockSecond(latestTick: MatchSnapshot) {
  if (shouldFreezeMatchClock(latestTick.highlight?.event ?? null)) {
    return Math.min(MATCH_CLOCK_SECONDS, Number(latestTick.second ?? 0));
  }

  return Math.min(
    MATCH_CLOCK_SECONDS,
    Number(latestTick.second ?? 0) + Math.floor(DEBUG_TICK_STEP / TICKS_PER_SECOND),
  );
}

function shouldFreezeMatchClock(event: EMatchEvent | null) {
  return (
    event === EMatchEvent.GOAL ||
    event === EMatchEvent.GOAL_RESET ||
    event === EMatchEvent.OFFSIDE ||
    event === EMatchEvent.FOUL ||
    event === EMatchEvent.THROW_IN ||
    event === EMatchEvent.CORNER_KICK ||
    event === EMatchEvent.GOAL_KICK
  );
}

function resolveMatchLifecycleAction(
  latestTick: MatchSnapshot,
  nextTick: number,
  nextSecond: number,
): {
  event: EMatchEvent;
  label: string;
  matchStep: MatchStep;
  phase: MatchSnapshot["phase"];
  possession?: Side;
} | null {
  const latestEvent = latestTick.highlight?.event;
  const halfTimeSecond = MATCH_CLOCK_SECONDS / 2;

  if (latestEvent === EMatchEvent.FIRST_HALF_END) {
    return {
      event: EMatchEvent.SECOND_HALF_START,
      label: "Bat dau hiep 2",
      matchStep: "second_half_start",
      phase: "second_half",
      possession: "away",
    };
  }

  if (latestTick.phase === "first_half" && nextSecond >= halfTimeSecond) {
    return {
      event: EMatchEvent.FIRST_HALF_END,
      label: "Ket thuc hiep 1",
      matchStep: "half_time",
      phase: "half_time",
    };
  }

  if (latestTick.phase === "second_half" && nextSecond >= MATCH_CLOCK_SECONDS) {
    return {
      event: EMatchEvent.MATCH_END,
      label: "Het gio",
      matchStep: "full_time",
      phase: "full_time",
    };
  }

  return null;
}

function findNearestPlayer(
  lineup: InternalLineupPlayer[],
  point: TrajectoryPoint,
  predicate: (player: InternalLineupPlayer) => boolean = () => true,
) {
  return (
    lineup
      .filter(predicate)
      .map((player) => ({
        player,
        value: distance(player.anchors, point),
      }))
      .sort((left, right) => left.value - right.value)[0]?.player ?? null
  );
}

function distance(left: TrajectoryPoint, right: TrajectoryPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function distanceToSegment(point: TrajectoryPoint, start: TrajectoryPoint, end: TrajectoryPoint) {
  return distance(point, closestPointOnSegment(point, start, end));
}

function closestPointOnSegment(
  point: TrajectoryPoint,
  start: TrajectoryPoint,
  end: TrajectoryPoint,
): TrajectoryPoint {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared <= 0) {
    return { x: start.x, y: start.y };
  }

  const t = clamp(
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared,
    0,
    1,
  );
  return {
    x: clamp(start.x + segmentX * t, 0, 100),
    y: clamp(start.y + segmentY * t, 0, 100),
  };
}

function moveToward(
  from: TrajectoryPoint,
  to: TrajectoryPoint,
  maxDistance: number,
): TrajectoryPoint {
  const totalDistance = distance(from, to);
  if (totalDistance <= maxDistance || totalDistance <= 0) {
    return { x: clamp(to.x, 0, 100), y: clamp(to.y, 0, 100) };
  }

  const ratio = maxDistance / totalDistance;
  return {
    x: clamp(lerp(from.x, to.x, ratio), 0, 100),
    y: clamp(lerp(from.y, to.y, ratio), 0, 100),
  };
}

function movePlayerForTick(input: {
  current: TrajectoryPoint;
  target: TrajectoryPoint;
  maxDistance: number;
  intent: PlayerMoveIntent;
}): { x: number; y: number; move: PlayerMotion } {
  const target = {
    x: clamp(input.target.x, 0, 100),
    y: clamp(input.target.y, 0, 100),
  };
  const current = {
    x: clamp(input.current.x, 0, 100),
    y: clamp(input.current.y, 0, 100),
  };
  const next = moveToward(current, target, Math.max(0, input.maxDistance));
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const length = Math.hypot(dx, dy);
  const directionX = length > 0 ? Number((dx / length).toFixed(4)) : 0;
  const directionY = length > 0 ? Number((dy / length).toFixed(4)) : 0;

  return {
    x: next.x,
    y: next.y,
    move: {
      fromX: current.x,
      fromY: current.y,
      toX: next.x,
      toY: next.y,
      intent: input.intent,
      directionX,
      directionY,
      targetX: target.x,
      targetY: target.y,
    },
  };
}

function createPlayerMotion(input: {
  current: TrajectoryPoint;
  next: TrajectoryPoint;
  target: TrajectoryPoint;
  intent: PlayerMoveIntent;
}): PlayerMotion {
  const dx = input.target.x - input.current.x;
  const dy = input.target.y - input.current.y;
  const length = Math.hypot(dx, dy);

  return {
    fromX: clamp(input.current.x, 0, 100),
    fromY: clamp(input.current.y, 0, 100),
    toX: clamp(input.next.x, 0, 100),
    toY: clamp(input.next.y, 0, 100),
    intent: input.intent,
    directionX: length > 0 ? Number((dx / length).toFixed(4)) : 0,
    directionY: length > 0 ? Number((dy / length).toFixed(4)) : 0,
    targetX: clamp(input.target.x, 0, 100),
    targetY: clamp(input.target.y, 0, 100),
  };
}

function evaluateBallPressure(input: {
  actor: InternalLineupPlayer;
  defending: InternalLineupPlayer[];
  ball: TrajectoryPoint;
  previousPositionState: PositionState;
}) {
  const nearestDistance =
    input.defending
      .filter((player) => player.role !== "GK")
      .map((defender) => {
        const position =
          input.previousPositionState.players.get(defender.userPlayerId) ?? defender.anchors;
        return Math.min(distance(position, input.ball), distance(position, input.actor.anchors));
      })
      .sort((left, right) => left - right)[0] ?? 30;

  return {
    distance: nearestDistance,
    score: clamp((12 - nearestDistance) / 10, 0, 1),
  };
}

function evaluateForwardCarrySpace(input: {
  actor: InternalLineupPlayer;
  defending: InternalLineupPlayer[];
  ball: TrajectoryPoint;
  possession: Side;
  previousPositionState: PositionState;
}) {
  const direction = attackDirection(input.possession);
  const probe = {
    x: clamp(input.ball.x + (input.actor.anchors.x < 50 ? -2 : 2), 5, 95),
    y: clamp(input.ball.y + direction * 12, 5, 95),
  };
  const nearestAhead =
    input.defending
      .filter((player) => player.role !== "GK")
      .map((defender) => {
        const position =
          input.previousPositionState.players.get(defender.userPlayerId) ?? defender.anchors;
        const isAhead = (position.y - input.ball.y) * direction > -2;
        return isAhead ? distance(position, probe) : 28;
      })
      .sort((left, right) => left - right)[0] ?? 28;
  const role = normalizeRole(input.actor.role);
  const roleBonus = role === "W" || role === "ST" ? 0.12 : role === "CM" ? 0.08 : 0;

  return clamp((nearestAhead - 4) / 22 + roleBonus, 0, 1);
}

function distanceToAttackingGoal(possession: Side, point: TrajectoryPoint) {
  const goalY = possession === "home" ? 4 : 96;
  return distance(point, { x: 50, y: goalY });
}

function isFinalThird(possession: Side, y: number) {
  return possession === "home" ? y <= 35 : y >= 65;
}

function resolveLooseBallContest(input: {
  latestTick: MatchSnapshot;
  homeLineup: InternalLineupPlayer[];
  awayLineup: InternalLineupPlayer[];
  previousPositionState: PositionState;
}): {
  event:
    | EMatchEvent.PASS
    | EMatchEvent.FREE_KICK
    | EMatchEvent.THROW_IN
    | EMatchEvent.CORNER_KICK
    | EMatchEvent.GOAL_KICK
    | EMatchEvent.GOALKEEPER_SAVE
    | EMatchEvent.TACKLE
    | EMatchEvent.SLIDE_TACKLE;
  receiver: InternalLineupPlayer;
  challenger: InternalLineupPlayer | null;
  winner: InternalLineupPlayer | null;
  actorId: number;
  ball: TrajectoryPoint;
  receiverDistanceToBall: number;
  challengerDistanceToBall: number | null;
} | null {
  const event = input.latestTick.highlight?.event;
  if (
    event !== EMatchEvent.PASS &&
    event !== EMatchEvent.FREE_KICK &&
    event !== EMatchEvent.THROW_IN &&
    event !== EMatchEvent.CORNER_KICK &&
    event !== EMatchEvent.GOAL_KICK &&
    event !== EMatchEvent.GOALKEEPER_SAVE &&
    event !== EMatchEvent.TACKLE &&
    event !== EMatchEvent.SLIDE_TACKLE
  ) {
    return null;
  }
  if (input.latestTick.ball.ownerPlayerId != null) return null;

  const allPlayers = [...input.homeLineup, ...input.awayLineup];
  const receiverId = input.latestTick.highlight?.secondaryPlayerId;
  const isTackleLooseBall = event === EMatchEvent.TACKLE || event === EMatchEvent.SLIDE_TACKLE;
  const receiver =
    (event === EMatchEvent.GOALKEEPER_SAVE || isTackleLooseBall
      ? allPlayers
          .map((player) => {
            const position =
              input.previousPositionState.players.get(player.userPlayerId) ?? player.anchors;
            return { player, distance: distance(position, input.latestTick.ball) };
          })
          .sort((left, right) => left.distance - right.distance)[0]?.player
      : allPlayers.find((player) => player.userPlayerId === receiverId)) ?? null;
  if (!receiver) return null;

  const possession = input.latestTick.possession ?? receiver.side;
  const challengingLineup = receiver.side === "home" ? input.awayLineup : input.homeLineup;
  const ball = advanceLooseBall(input.latestTick);
  const receiverPosition =
    input.previousPositionState.players.get(receiver.userPlayerId) ?? receiver.anchors;
  const receiverDistanceToBall = distance(receiverPosition, ball);
  const challenger =
    challengingLineup
      .filter((player) => player.role !== "GK" || distance(player.anchors, ball) <= 24)
      .map((player) => {
        const position =
          input.previousPositionState.players.get(player.userPlayerId) ?? player.anchors;
        return { player, distance: distance(position, ball) };
      })
      .sort((left, right) => left.distance - right.distance)[0] ?? null;
  const teammateSupport =
    allPlayers
      .filter(
        (player) =>
          player.side === possession &&
          player.userPlayerId !== receiver.userPlayerId &&
          player.role !== "GK",
      )
      .map((player) => {
        const position =
          input.previousPositionState.players.get(player.userPlayerId) ?? player.anchors;
        return { player, distance: distance(position, ball) };
      })
      .sort((left, right) => left.distance - right.distance)[0] ?? null;
  const challengerDistanceToBall = challenger?.distance ?? null;

  let winner: InternalLineupPlayer | null = null;
  if (
    challenger &&
    challenger.distance <= BALL_CONTROL_DISTANCE &&
    challenger.distance + 0.35 < receiverDistanceToBall
  ) {
    winner = challenger.player;
  } else if (receiverDistanceToBall <= BALL_CONTROL_DISTANCE) {
    winner = receiver;
  } else if (
    teammateSupport &&
    teammateSupport.distance <= BALL_CONTROL_DISTANCE &&
    teammateSupport.distance + 0.2 < receiverDistanceToBall
  ) {
    winner = teammateSupport.player;
  }

  if (winner) {
    return {
      event,
      receiver,
      challenger: challenger?.player ?? null,
      winner,
      actorId: input.latestTick.highlight?.actorPlayerId ?? receiver.userPlayerId,
      ball,
      receiverDistanceToBall,
      challengerDistanceToBall,
    };
  }

  if (receiverDistanceToBall <= BALL_CONTROL_DISTANCE && !challenger) {
    return null;
  }

  return {
    event,
    receiver,
    challenger: challenger?.player ?? null,
    winner: null,
    actorId: input.latestTick.highlight?.actorPlayerId ?? receiver.userPlayerId,
    ball,
    receiverDistanceToBall,
    challengerDistanceToBall,
  };
}

function isOutOfPlayRestartEvent(event: EMatchEvent | null) {
  return (
    event === EMatchEvent.THROW_IN ||
    event === EMatchEvent.CORNER_KICK ||
    event === EMatchEvent.GOAL_KICK
  );
}

function resolveOutOfPlayEvent(input: {
  latestTick: MatchSnapshot;
  homeLineup: InternalLineupPlayer[];
  awayLineup: InternalLineupPlayer[];
}): {
  event: EMatchEvent.THROW_IN | EMatchEvent.CORNER_KICK | EMatchEvent.GOAL_KICK;
  label: string;
  restartSide: Side;
  taker: InternalLineupPlayer;
  spot: TrajectoryPoint;
} | null {
  const ball = input.latestTick.ball;
  const lastTouchSide =
    input.latestTick.highlight?.teamSide ?? input.latestTick.possession ?? "home";
  const allLineups = { home: input.homeLineup, away: input.awayLineup };

  if (ball.x <= 4.2 || ball.x >= 95.8) {
    const restartSide: Side = lastTouchSide === "home" ? "away" : "home";
    const spot = { x: ball.x <= 4.2 ? 4 : 96, y: clamp(ball.y, 6, 94) };
    const taker =
      findNearestPlayer(allLineups[restartSide], spot, (player) => player.role !== "GK") ??
      allLineups[restartSide][0];
    return {
      event: EMatchEvent.THROW_IN,
      label: `${restartSide === "home" ? "Home" : "Away"} duoc nem bien`,
      restartSide,
      taker,
      spot,
    };
  }

  if (ball.y <= 4.2 || ball.y >= 95.8) {
    const defendingGoalSide: Side = ball.y <= 4.2 ? "away" : "home";
    const attackingSide: Side = defendingGoalSide === "home" ? "away" : "home";
    const isKeeperParry = input.latestTick.highlight?.event === EMatchEvent.GOALKEEPER_SAVE;
    const isCorner = isKeeperParry || lastTouchSide === defendingGoalSide;
    const restartSide = isCorner ? attackingSide : defendingGoalSide;
    const spot = isCorner
      ? { x: ball.x < 50 ? 4 : 96, y: defendingGoalSide === "away" ? 4 : 96 }
      : { x: 50, y: defendingGoalSide === "away" ? 9 : 91 };
    const taker = isCorner
      ? (findNearestPlayer(allLineups[restartSide], spot, (player) => player.role !== "GK") ??
        allLineups[restartSide][0])
      : (allLineups[restartSide].find((player) => player.role === "GK") ??
        allLineups[restartSide][0]);

    return {
      event: isCorner ? EMatchEvent.CORNER_KICK : EMatchEvent.GOAL_KICK,
      label: isCorner
        ? `${restartSide === "home" ? "Home" : "Away"} duoc phat goc`
        : `${restartSide === "home" ? "Home" : "Away"} phat bong len`,
      restartSide,
      taker,
      spot,
    };
  }

  return null;
}

function resolveOutOfPlayRestart(input: {
  latestTick: MatchSnapshot;
  homeLineup: InternalLineupPlayer[];
  awayLineup: InternalLineupPlayer[];
  previousPositionState: PositionState;
  nextTick: number;
}) {
  const event = input.latestTick.highlight?.event ?? EMatchEvent.THROW_IN;
  const possession = input.latestTick.possession ?? "home";
  const lineup = possession === "home" ? input.homeLineup : input.awayLineup;
  const opponentLineup = possession === "home" ? input.awayLineup : input.homeLineup;
  const taker =
    lineup.find((player) => player.userPlayerId === input.latestTick.highlight?.actorPlayerId) ??
    findNearestPlayer(
      lineup,
      input.latestTick.ball,
      (player) => event === EMatchEvent.GOAL_KICK || player.role !== "GK",
    ) ??
    lineup[0];
  const direction = attackDirection(possession);

  if (event === EMatchEvent.CORNER_KICK) {
    const boxTarget = {
      x: clamp(50 + ((input.nextTick % 3) - 1) * 9, 32, 68),
      y: clamp(input.latestTick.ball.y + direction * 18, 8, 92),
    };
    const receiver =
      lineup
        .filter((player) => player.userPlayerId !== taker.userPlayerId && player.role !== "GK")
        .map((player) => ({
          player,
          score: normalizeRole(player.role) === "ST" ? 0 : distance(player.anchors, boxTarget),
        }))
        .sort((left, right) => left.score - right.score)[0]?.player ?? taker;

    return {
      event: EMatchEvent.CORNER_KICK,
      label: `${taker.shortName} treo bong phat goc`,
      possession,
      taker,
      receiver,
      target: moveToward(input.latestTick.ball, boxTarget, PASS_SPEED_UNITS_PER_TICK),
    };
  }

  if (event === EMatchEvent.GOAL_KICK) {
    const receiver =
      lineup
        .filter((player) => player.userPlayerId !== taker.userPlayerId && player.role !== "GK")
        .map((player) => ({
          player,
          score:
            Math.abs(player.anchors.y - (possession === "home" ? 58 : 42)) +
            Math.abs(player.anchors.x - 50) * 0.3,
        }))
        .sort((left, right) => left.score - right.score)[0]?.player ?? taker;
    const target = moveToward(
      input.latestTick.ball,
      { x: receiver.anchors.x, y: clamp(receiver.anchors.y + direction * 10, 8, 92) },
      PASS_SPEED_UNITS_PER_TICK,
    );

    return {
      event: EMatchEvent.GOAL_KICK,
      label: `${taker.shortName} phat bong len`,
      possession,
      taker,
      receiver,
      target,
    };
  }

  const receiver =
    lineup
      .filter((player) => player.userPlayerId !== taker.userPlayerId && player.role !== "GK")
      .map((player) => {
        const marker =
          findNearestPlayer(opponentLineup, player.anchors, (opponent) => opponent.role !== "GK") ??
          opponentLineup[0];
        return {
          player,
          score:
            distance(player.anchors, input.latestTick.ball) +
            (marker ? Math.max(0, 10 - distance(marker.anchors, player.anchors)) : 0),
        };
      })
      .sort((left, right) => left.score - right.score)[0]?.player ?? taker;
  const target = moveToward(
    input.latestTick.ball,
    receiver.anchors,
    PASS_SPEED_UNITS_PER_TICK * 0.75,
  );

  return {
    event: EMatchEvent.THROW_IN,
    label: `${taker.shortName} nem bien cho ${receiver.shortName}`,
    possession,
    taker,
    receiver,
    target,
  };
}

function advanceLooseBall(snapshot: MatchSnapshot): TrajectoryPoint {
  const current = { x: snapshot.ball.x, y: snapshot.ball.y };
  const from = {
    x: Number(snapshot.ball.fromX ?? current.x),
    y: Number(snapshot.ball.fromY ?? current.y),
  };
  const vx = current.x - from.x;
  const vy = current.y - from.y;
  const speed = Math.hypot(vx, vy);

  if (speed < 0.08) return current;

  const rollDistance = clamp(speed * 0.32, 0.15, 2.6);
  return {
    x: clamp(current.x + (vx / speed) * rollDistance, 4, 96),
    y: clamp(current.y + (vy / speed) * rollDistance, 4, 96),
  };
}

function shouldAttachBallToOwner(event: EMatchEvent | null) {
  return ![
    EMatchEvent.PASS,
    EMatchEvent.FREE_KICK,
    EMatchEvent.THROW_IN,
    EMatchEvent.CORNER_KICK,
    EMatchEvent.GOAL_KICK,
    EMatchEvent.SHOOT,
    EMatchEvent.GOAL,
  ].includes(event as EMatchEvent);
}

function getBallCarryPosition(player: MatchRenderPlayer): TrajectoryPoint {
  const vx = Number(player.vx ?? player.move?.directionX ?? 0);
  const vy = Number(player.vy ?? player.move?.directionY ?? 0);
  const speed = Math.hypot(vx, vy);
  const direction =
    speed > 0.02
      ? { x: vx / speed, y: vy / speed }
      : {
          x: Number(player.move?.directionX ?? 0),
          y: Number(player.move?.directionY ?? (player.side === "home" ? -1 : 1)),
        };

  return {
    x: clamp(player.x + direction.x * 0.65, 0, 100),
    y: clamp(player.y + direction.y * 0.65, 0, 100),
  };
}

function getIntentForState(state: PlayerAIState): PlayerMoveIntent {
  switch (state) {
    case "PRESS_BALL":
      return "press";
    case "SUPPORT_ATTACK":
      return "support";
    case "PASS_SUPPORT":
      return "pass_support";
    case "ATTACK_SPACE":
    case "ATTACK_SPACE_BEHIND":
    case "RUN_ON_SHOULDER":
    case "DIAGONAL_RUN":
    case "THIRD_MAN_RUN":
    case "BACK_POST_RUN":
      return "attack_space";
    case "CHECK_BACK_ONSIDE":
    case "CURVED_RUN":
    case "DELAY_RUN":
    case "STAY_ONSIDE":
    case "DROP_SHORT":
      return "support";
    case "MARK_OPPONENT":
    case "MARK_MAN":
      return "mark";
    case "TRACK_RUNNER":
      return "track";
    case "RECEIVE_PASS":
    case "MOVE_TO_SPACE":
    case "DRIBBLE":
      return "run";
    case "OVERLAP":
      return "overlap";
    case "UNDERLAP":
      return "underlap";
    case "CUT_INSIDE":
      return "cut_inside";
    case "HOLD_WIDTH":
      return "hold_width";
    case "HOLD_DEPTH":
      return "hold_depth";
    case "HOLD_LINE":
      return "hold_line";
    case "COVER_SPACE":
      return "cover_space";
    case "RECOVER_SHAPE":
      return "recover";
    case "RECOVER_DEFENSE":
      return "cover";
    case "IDLE":
    case "HOLD_POSITION":
    default:
      return "anchor";
  }
}

function createSkillContext(
  actor: InternalLineupPlayer,
  defender: InternalLineupPlayer,
  keeper: InternalLineupPlayer,
  random: () => number,
) {
  return {
    actorShoot: actor.raw.stats.shoot,
    actorDribbling: actor.raw.stats.dribbling,
    actorSpeed: actor.raw.stats.speed,
    keeperReflex: keeper.raw.stats.gkReflex,
    keeperDiving: keeper.raw.stats.gkDiving,
    keeperReach: keeper.raw.stats.gkReach,
    defenderTackle: defender.raw.stats.tackle,
    attackScore: actor.raw.stats.shoot + actor.raw.stats.dribbling,
    defenseScore: defender.raw.stats.tackle + keeper.raw.stats.gkKeeping,
    random,
  };
}

function buildBallPath(action: ResolvedAction, random: () => number): TrajectoryPoint[] {
  const actorPos = { x: action.actor.anchors.x, y: action.actor.anchors.y };
  const goalY = action.possession === "home" ? 14 : 86;

  if (action.skill === EPlayerSkill.SHOOT_THUNDER) {
    return buildThunderShotTrajectory(
      actorPos.x,
      actorPos.y,
      goalY,
      action.possession,
      FRAMES_PER_ACTION,
      random,
    ).slice(1);
  }
  if (action.skill === EPlayerSkill.DRIBBLE_MAGIC) {
    const target = action.partner?.anchors ?? {
      x: clamp(actorPos.x + (random() > 0.5 ? 12 : -12), 8, 92),
      y: clamp(actorPos.y + (action.possession === "home" ? -12 : 12), 8, 92),
    };
    return buildMagicDribbleTrajectory(
      actorPos.x,
      actorPos.y,
      target.x,
      target.y,
      FRAMES_PER_ACTION,
      random,
    ).slice(1);
  }
  if (action.type === "pass" && action.partner) {
    return pathBetween(actorPos, action.partner.anchors);
  }
  if (
    action.type === "goal" ||
    action.type === "save" ||
    action.type === "block" ||
    action.type === "shoot"
  ) {
    const stopY = action.type === "goal" ? goalY : lerp(actorPos.y, goalY, 0.72);
    const stopX =
      action.type === "block"
        ? lerp(actorPos.x, action.defender.anchors.x, 0.75)
        : action.type === "save"
          ? lerp(actorPos.x, 50, 0.7)
          : lerp(actorPos.x, 50, 0.88);
    return pathBetween(actorPos, { x: stopX, y: stopY });
  }
  return pathBetween(actorPos, {
    x: actorPos.x,
    y: actorPos.y + (action.possession === "home" ? -7 : 7),
  });
}

function pathBetween(from: TrajectoryPoint, to: TrajectoryPoint): TrajectoryPoint[] {
  return Array.from({ length: FRAMES_PER_ACTION }, (_, index) => {
    const t = easeOut((index + 1) / FRAMES_PER_ACTION);
    return { x: clamp(lerp(from.x, to.x, t), 4, 96), y: clamp(lerp(from.y, to.y, t), 4, 96) };
  });
}

function buildKickoffPath(player: InternalLineupPlayer): TrajectoryPoint[] {
  return pathBetween({ x: 50, y: 50 }, { x: player.anchors.x, y: player.anchors.y });
}

function fixedBallPath(x: number, y: number): TrajectoryPoint[] {
  return Array.from({ length: FRAMES_PER_ACTION }, () => ({ x, y }));
}

function normalizeSkillCharges(
  skills: EPlayerSkill[],
  charges: Array<{ skill: EPlayerSkill; charge: number }> | undefined,
) {
  const chargeMap = new Map(
    (charges ?? []).map((item) => [Number(item.skill) as EPlayerSkill, Number(item.charge ?? 0)]),
  );

  return skills.map((skill) => ({
    skill,
    charge: clamp(chargeMap.get(skill) ?? 0, 0, 100),
  }));
}

function addSkillCharge(player: InternalLineupPlayer, skill: EPlayerSkill, amount: number) {
  if (!player.raw.skills.includes(skill)) {
    return;
  }

  const charges = normalizeSkillCharges(player.raw.skills, player.skillCharges);
  const current = charges.find((item) => item.skill === skill);
  if (!current) {
    charges.push({ skill, charge: clamp(amount, 0, 100) });
  } else {
    current.charge = clamp(current.charge + amount, 0, 100);
  }
  player.skillCharges = charges;
}

function addTickSkillCharge(lineups: InternalLineupPlayer[]) {
  lineups.forEach((player) => {
    addSkillCharge(player, EPlayerSkill.DRIBBLE_MAGIC, 10);
  });
}

function isSkillReady(player: InternalLineupPlayer, skill: EPlayerSkill) {
  return normalizeSkillCharges(player.raw.skills, player.skillCharges).some(
    (item) => item.skill === skill && item.charge >= 100,
  );
}

function consumeSkillCharge(player: InternalLineupPlayer, skill: EPlayerSkill | null) {
  if (!skill) {
    return;
  }

  player.skillCharges = normalizeSkillCharges(player.raw.skills, player.skillCharges).map((item) =>
    item.skill === skill ? { ...item, charge: 0 } : item,
  );
}

function resetUsedSkillChargeForSnapshot(
  lineups: InternalLineupPlayer[],
  userPlayerId: number,
  skill: EPlayerSkill | null,
) {
  if (!skill) {
    return;
  }

  const player = lineups.find((item) => item.userPlayerId === userPlayerId);
  if (player) {
    consumeSkillCharge(player, skill);
  }
}

function getChargedSkill(
  player: InternalLineupPlayer,
  phase: "shoot" | "dribble" | "tackle" | "build_up",
) {
  if (phase === "shoot" && isSkillReady(player, EPlayerSkill.SHOOT_THUNDER)) {
    return player.raw.skills.includes(EPlayerSkill.SHOOT_THUNDER)
      ? EPlayerSkill.SHOOT_THUNDER
      : null;
  }

  if (phase === "dribble" && isSkillReady(player, EPlayerSkill.DRIBBLE_MAGIC)) {
    return player.raw.skills.includes(EPlayerSkill.DRIBBLE_MAGIC)
      ? EPlayerSkill.DRIBBLE_MAGIC
      : null;
  }

  if (phase === "tackle" && isSkillReady(player, EPlayerSkill.TANK_TACKLE)) {
    return player.raw.skills.includes(EPlayerSkill.TANK_TACKLE) ? EPlayerSkill.TANK_TACKLE : null;
  }

  return null;
}

function buildSnapshot(input: {
  frameId: number;
  minute: number;
  second: number;
  tick: number;
  matchStep: MatchStep;
  phase: MatchSnapshot["phase"];
  homeScore: number;
  awayScore: number;
  possession: Side;
  homeLineup: InternalLineupPlayer[];
  awayLineup: InternalLineupPlayer[];
  ballOwner: InternalLineupPlayer;
  ball: TrajectoryPoint;
  ballPath: TrajectoryPoint[];
  highlight: MatchSnapshot["highlight"];
  activeSkill: EPlayerSkill | null;
  focusId: number;
  pressId: number | null;
  forceLooseBall?: boolean;
  positionState: PositionState;
}): MatchSnapshot {
  const prevBall = input.positionState.ball;
  const ball = { x: clamp(input.ball.x, 0, 100), y: clamp(input.ball.y, 0, 100) };
  const ballVelocity = {
    x: (ball.x - prevBall.x) / SIM_TICK_SECONDS,
    y: (ball.y - prevBall.y) / SIM_TICK_SECONDS,
  };
  const previousPossession = input.positionState.possession ?? input.possession;
  const possessionTicks =
    previousPossession === input.possession
      ? Math.max(1, Number(input.positionState.possessionTicks ?? 0) + 1)
      : 1;
  const tacticalPhase = resolveSnapshotTacticalPhase({
    possession: input.possession,
    previousPossession,
    possessionTicks,
    ball,
    owner: input.ballOwner,
  });
  resetUsedSkillChargeForSnapshot(
    [...input.homeLineup, ...input.awayLineup],
    input.focusId,
    input.activeSkill,
  );
  const ownerId = input.ballOwner.userPlayerId;
  const ballIsControlled = !input.forceLooseBall && shouldAttachBallToOwner(input.highlight.event);
  const controlledOwnerId = ballIsControlled ? ownerId : null;
  const secondaryPlayer =
    input.highlight.secondaryPlayerId == null
      ? null
      : ([...input.homeLineup, ...input.awayLineup].find(
          (player) => player.userPlayerId === input.highlight.secondaryPlayerId,
        ) ?? null);
  const intendedReceiverId =
    input.highlight.event === EMatchEvent.PASS ||
    ((input.highlight.event === EMatchEvent.FREE_KICK ||
      input.highlight.event === EMatchEvent.THROW_IN ||
      input.highlight.event === EMatchEvent.CORNER_KICK ||
      input.highlight.event === EMatchEvent.GOAL_KICK) &&
      secondaryPlayer?.side === input.possession)
      ? (input.highlight.secondaryPlayerId ?? null)
      : null;
  const freeKickWallTargets =
    input.highlight.event === EMatchEvent.FREE_KICK
      ? getFreeKickWallTargets({
          defending: input.possession === "home" ? input.awayLineup : input.homeLineup,
          ball,
          possession: input.possession,
          positionState: input.positionState,
        })
      : new Map<number, TrajectoryPoint>();
  const homePlayers = projectPlayers({
    lineup: input.homeLineup,
    teammateLineup: input.homeLineup,
    opponentLineup: input.awayLineup,
    possession: input.possession,
    ball,
    ballVelocity,
    ballOwnerId: controlledOwnerId,
    intendedReceiverId,
    focusId: input.focusId,
    pressId: input.pressId,
    freeKickWallTargets,
    matchStep: input.matchStep,
    tick: input.tick,
    previousPossession,
    possessionTicks,
    tacticalPhase,
    positionState: input.positionState,
  });
  const awayPlayers = projectPlayers({
    lineup: input.awayLineup,
    teammateLineup: input.awayLineup,
    opponentLineup: input.homeLineup,
    possession: input.possession,
    ball,
    ballVelocity,
    ballOwnerId: controlledOwnerId,
    intendedReceiverId,
    focusId: input.focusId,
    pressId: input.pressId,
    freeKickWallTargets,
    matchStep: input.matchStep,
    tick: input.tick,
    previousPossession,
    possessionTicks,
    tacticalPhase,
    positionState: input.positionState,
  });

  const allRenderPlayers = [...homePlayers, ...awayPlayers];
  allRenderPlayers.forEach((player) => {
    player.hasBall = controlledOwnerId != null && player.userPlayerId === controlledOwnerId;
    if (player.hasBall && input.activeSkill) player.activeSkill = input.activeSkill;
  });
  const ownerRenderPlayer =
    controlledOwnerId == null
      ? null
      : allRenderPlayers.find((player) => player.userPlayerId === controlledOwnerId);
  const finalBall = ownerRenderPlayer ? getBallCarryPosition(ownerRenderPlayer) : ball;

  return {
    frameId: input.frameId,
    tick: input.tick,
    durationMs: getSnapshotFrameDuration(input.highlight.event, input.activeSkill),
    matchStep: input.matchStep,
    minute: input.minute,
    second: input.second,
    clockLabel: `${String(Math.min(input.minute, 90)).padStart(2, "0")}:${String(input.second % 60).padStart(2, "0")}`,
    phase: input.phase,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    possession: input.possession,
    ball: {
      x: finalBall.x,
      y: finalBall.y,
      fromX: clamp(prevBall.x, 0, 100),
      fromY: clamp(prevBall.y, 0, 100),
      ownerPlayerId: controlledOwnerId,
      speed: getBallVisualSpeed(input.highlight.event, input.activeSkill),
      trajectory: input.ballPath,
      skillTrajectory: input.activeSkill,
    },
    homePlayers,
    awayPlayers,
    tactical: {
      phase: tacticalPhase,
      possessionTicks,
    },
    highlight: input.highlight,
  };
}

function getSnapshotFrameDuration(event: EMatchEvent | null, activeSkill: EPlayerSkill | null) {
  if (activeSkill) return SKILL_FRAME_DURATION_MS;

  if (event === EMatchEvent.PASS) return PASS_FRAME_DURATION_MS;

  if (
    event === EMatchEvent.FREE_KICK ||
    event === EMatchEvent.THROW_IN ||
    event === EMatchEvent.CORNER_KICK ||
    event === EMatchEvent.GOAL_KICK ||
    event === EMatchEvent.GOAL_RESET ||
    event === EMatchEvent.OFFSIDE ||
    event === EMatchEvent.FOUL
  ) {
    return DEAD_BALL_FRAME_DURATION_MS;
  }

  return FRAME_DURATION_MS;
}

function getBallVisualSpeed(event: EMatchEvent | null, activeSkill: EPlayerSkill | null) {
  if (activeSkill === EPlayerSkill.SHOOT_THUNDER) return 14;
  if (
    event === EMatchEvent.SHOOT ||
    event === EMatchEvent.GOAL ||
    event === EMatchEvent.GOALKEEPER_SAVE
  ) {
    return 12;
  }

  if (event === EMatchEvent.PASS) return 6;
  if (activeSkill) return 9;
  return 5;
}

function resolveSnapshotTacticalPhase(input: {
  possession: Side;
  previousPossession: Side;
  possessionTicks: number;
  ball: TrajectoryPoint;
  owner: InternalLineupPlayer;
}): TacticalPhase {
  if (input.previousPossession !== input.possession && input.possessionTicks <= 5) {
    return "TRANSITION_WON_BALL";
  }

  const direction = attackDirection(input.possession);
  const ownerRole = normalizeRole(input.owner.role);
  const ballAdvance = direction < 0 ? 50 - input.ball.y : input.ball.y - 50;
  if (ballAdvance >= 6 && ownerRole !== "GK" && ownerRole !== "CB") {
    return "IN_POSSESSION_ATTACK";
  }

  return "IN_POSSESSION_BUILDUP";
}

function projectPlayers(input: {
  lineup: InternalLineupPlayer[];
  teammateLineup: InternalLineupPlayer[];
  opponentLineup: InternalLineupPlayer[];
  possession: Side;
  ball: TrajectoryPoint;
  ballVelocity: TrajectoryPoint;
  ballOwnerId: number | null;
  intendedReceiverId: number | null;
  focusId: number;
  pressId: number | null;
  freeKickWallTargets: Map<number, TrajectoryPoint>;
  matchStep: MatchStep;
  tick: number;
  previousPossession: Side;
  possessionTicks: number;
  tacticalPhase: TacticalPhase;
  positionState: PositionState;
}): MatchRenderPlayer[] {
  const createMovementPlayer = (player: InternalLineupPlayer): MovementPlayer => {
    const prev = input.positionState.players.get(player.userPlayerId);
    const hasBall = player.userPlayerId === input.ballOwnerId;
    return {
      id: player.userPlayerId,
      teamId: player.teamId,
      side: player.side,
      role: player.role,
      position: {
        x: prev?.x ?? player.x ?? player.anchors.x,
        y: prev?.y ?? player.y ?? player.anchors.y,
      },
      velocity: { x: prev?.vx ?? 0, y: prev?.vy ?? 0 },
      targetPosition: {
        x: prev?.targetX ?? player.anchors.x,
        y: prev?.targetY ?? player.anchors.y,
      },
      homePosition: player.anchors,
      state: prev?.aiState ?? "HOLD_POSITION",
      stamina: player.stamina,
      hasBall,
      receivingPass: input.intendedReceiverId === player.userPlayerId,
      stats: {
        speed: player.raw.stats.speed,
        acceleration: player.raw.stats.acceleration,
        stamina: player.raw.stats.stamina,
        dribbling: player.raw.stats.dribbling,
      },
    };
  };

  const teammateMovement = input.teammateLineup.map(createMovementPlayer);
  const opponentMovement = input.opponentLineup.map(createMovementPlayer);
  const gameState = {
    tick: input.tick,
    deltaTime: SIM_TICK_SECONDS,
    possession: input.possession,
    previousPossession: input.previousPossession,
    possessionTicks: input.possessionTicks,
    homePlayers: input.lineup[0]?.side === "home" ? teammateMovement : opponentMovement,
    awayPlayers: input.lineup[0]?.side === "away" ? teammateMovement : opponentMovement,
    ball: {
      position: input.ball,
      velocity: input.ballVelocity,
      ownerPlayerId: input.ballOwnerId,
      intendedReceiverId: input.intendedReceiverId,
      targetPosition: input.ball,
      isLoose: input.intendedReceiverId != null && input.intendedReceiverId !== input.ballOwnerId,
    },
  };

  return input.lineup.map((player, index) => {
    const movementPlayer = teammateMovement.find((item) => item.id === player.userPlayerId)!;
    const prev = input.positionState.players.get(player.userPlayerId) ?? {
      x: player.anchors.x,
      y: player.anchors.y,
      vx: 0,
      vy: 0,
      targetX: player.anchors.x,
      targetY: player.anchors.y,
      aiState: "HOLD_POSITION" as PlayerAIState,
    };
    const hasBall = player.userPlayerId === input.ballOwnerId;
    const isPress = input.pressId != null && player.userPlayerId === input.pressId;
    const onAttack = player.side === input.possession;
    let target = player.anchors;
    let intent: PlayerMoveIntent = "anchor";
    let aiState: PlayerAIState = "HOLD_POSITION";

    if (input.matchStep === "first_half_start" || input.matchStep === "second_half_start") {
      target = hasBall ? { x: input.ball.x, y: input.ball.y } : player.anchors;
      intent = hasBall ? "kickoff" : "anchor";
      aiState = hasBall ? "DRIBBLE" : "HOLD_POSITION";
    } else if (input.matchStep === "half_time" || input.matchStep === "full_time") {
      target = { x: 47 + (index % 4) * 2, y: 50 + Math.floor(index / 4) * 1.5 };
      aiState = "IDLE";
    } else if (hasBall) {
      const tactical = getTacticalTarget(movementPlayer, gameState);
      target = tactical.targetPosition;
      intent = "run";
      aiState = tactical.state;
    } else if (input.intendedReceiverId === player.userPlayerId) {
      target = predictBallIntercept(movementPlayer, gameState.ball);
      intent = "run";
      aiState = "RECEIVE_PASS";
    } else if (input.freeKickWallTargets.has(player.userPlayerId)) {
      target = input.freeKickWallTargets.get(player.userPlayerId)!;
      intent = "cover";
      aiState = "HOLD_POSITION";
    } else if (isPress) {
      if (normalizeRole(player.role) === "GK") {
        target = {
          x: clamp(input.ball.x, 35, 65),
          y: clamp(input.ball.y, player.side === "home" ? 84 : 6, player.side === "home" ? 96 : 16),
        };
        intent = "press";
        aiState = "PRESS_BALL";
      } else {
        const tactical = getTacticalTarget(movementPlayer, gameState);
        target = tactical.targetPosition;
        intent = "press";
        aiState = "PRESS_BALL";
      }
    } else if (onAttack) {
      const tactical = getTacticalTarget(movementPlayer, gameState);
      target = tactical.targetPosition;
      intent = getIntentForState(tactical.state);
      aiState = tactical.state;
      if (normalizeRole(player.role) !== "CB" && normalizeRole(player.role) !== "GK") {
        const offsideAware = getOffsideAwareTarget({
          player,
          playerPosition: { x: prev.x, y: prev.y },
          desiredTarget: target,
          possession: input.possession,
          ball: input.ball,
          defending: input.opponentLineup,
          previousPositionState: input.positionState,
          isIntendedReceiver: input.intendedReceiverId === player.userPlayerId,
          tick: input.tick,
        });
        target = offsideAware.target;
        aiState = offsideAware.aiState;
        intent = getIntentForState(aiState);
      }
    } else {
      const tactical = getTacticalTarget(movementPlayer, gameState);
      target = tactical.targetPosition;
      intent = getIntentForState(tactical.state);
      aiState = tactical.state;
    }

    movementPlayer.position = { x: prev.x, y: prev.y };
    movementPlayer.velocity = { x: prev.vx, y: prev.vy };
    movementPlayer.targetPosition = target;
    movementPlayer.state = aiState;
    applySeparation(movementPlayer, teammateMovement);
    updatePlayerMovement(movementPlayer, SIM_TICK_SECONDS);

    const movement = createPlayerMotion({
      current: { x: prev.x, y: prev.y },
      next: movementPlayer.position,
      target: movementPlayer.targetPosition,
      intent,
    });

    return {
      userPlayerId: player.userPlayerId,
      playerId: player.playerId,
      teamId: player.teamId,
      side: player.side,
      role: player.role,
      displayRole: player.displayRole,
      name: player.name,
      shortName: player.shortName,
      slug: player.slug,
      skills: player.raw.skills,
      skillSlugs: player.skillSlugs,
      skillCharges: normalizeSkillCharges(player.raw.skills, player.skillCharges),
      x: clamp(movementPlayer.position.x, 0, 100),
      y: clamp(movementPlayer.position.y, 0, 100),
      homeX: player.anchors.x,
      homeY: player.anchors.y,
      vx: Number(movementPlayer.velocity.x.toFixed(4)),
      vy: Number(movementPlayer.velocity.y.toFixed(4)),
      targetX: clamp(movementPlayer.targetPosition.x, 0, 100),
      targetY: clamp(movementPlayer.targetPosition.y, 0, 100),
      aiState,
      stamina: player.stamina,
      activeSkill: null,
      hasBall: false,
      offside: buildOffsideDebug({
        player,
        playerPosition: movementPlayer.position,
        possession: input.possession,
        ball: input.ball,
        defending: input.opponentLineup,
        previousPositionState: input.positionState,
        runTimingState: aiState,
        isIntendedReceiver: input.intendedReceiverId === player.userPlayerId,
      }),
      move: movement,
    };
  });
}

function getOffsideAwareTarget(input: {
  player: InternalLineupPlayer;
  playerPosition: TrajectoryPoint;
  desiredTarget: TrajectoryPoint;
  possession: Side;
  ball: TrajectoryPoint;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
  isIntendedReceiver: boolean;
  tick: number;
}): { target: TrajectoryPoint; aiState: PlayerAIState } {
  const role = normalizeRole(input.player.role);
  if (role === "GK" || role === "CB" || input.player.side !== input.possession) {
    return { target: input.desiredTarget, aiState: "HOLD_POSITION" };
  }

  const currentOffside = evaluateOffside({
    receiver: input.player,
    receiverPosition: input.playerPosition,
    ball: input.ball,
    defending: input.defending,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });
  const targetOffside = evaluateOffside({
    receiver: input.player,
    receiverPosition: input.desiredTarget,
    ball: input.ball,
    defending: input.defending,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });
  const direction = attackDirection(input.possession);
  const runTimingBuffer = role === "ST" ? 2.4 : role === "W" ? 3 : 3.6;
  const safeY = clamp(
    currentOffside.lineInfo.effectiveOffsideLineY - direction * runTimingBuffer,
    6,
    94,
  );
  const lateralMicro = Math.sin((input.tick + input.player.userPlayerId * 5) * 0.55) * 3.2;
  const passReady =
    input.isIntendedReceiver &&
    !currentOffside.isOffside &&
    distance(input.playerPosition, input.ball) <= 42;

  if (currentOffside.isOffside) {
    return {
      target: {
        x: clamp(input.playerPosition.x + lateralMicro * 0.6, 8, 92),
        y: safeY,
      },
      aiState: role === "ST" || role === "W" ? "CHECK_BACK_ONSIDE" : "DROP_SHORT",
    };
  }

  if (targetOffside.isOffside && !passReady) {
    const state: PlayerAIState =
      role === "ST"
        ? "RUN_ON_SHOULDER"
        : role === "W"
          ? "CURVED_RUN"
          : role === "CM"
            ? "THIRD_MAN_RUN"
            : "STAY_ONSIDE";

    return {
      target: {
        x: clamp(input.desiredTarget.x + lateralMicro, 8, 92),
        y: safeY,
      },
      aiState: state,
    };
  }

  if (currentOffside.warning && !passReady) {
    const state: PlayerAIState =
      role === "ST" ? "DELAY_RUN" : role === "W" ? "DIAGONAL_RUN" : "STAY_ONSIDE";
    return {
      target: {
        x: clamp(input.desiredTarget.x + lateralMicro, 8, 92),
        y: lerp(input.desiredTarget.y, safeY, 0.58),
      },
      aiState: state,
    };
  }

  if (passReady && (role === "ST" || role === "W")) {
    return {
      target: input.desiredTarget,
      aiState: role === "W" ? "DIAGONAL_RUN" : "ATTACK_SPACE_BEHIND",
    };
  }

  return {
    target: input.desiredTarget,
    aiState: role === "FB" ? "OVERLAP" : role === "CM" ? "THIRD_MAN_RUN" : "ATTACK_SPACE",
  };
}

function buildOffsideDebug(input: {
  player: InternalLineupPlayer;
  playerPosition: TrajectoryPoint;
  possession: Side;
  ball: TrajectoryPoint;
  defending: InternalLineupPlayer[];
  previousPositionState: PositionState;
  runTimingState: PlayerAIState;
  isIntendedReceiver: boolean;
}): OffsideDebug {
  if (input.player.side !== input.possession) {
    return {
      isOffsidePosition: false,
      offsideLineY: 50,
      safeLineY: 50,
      distanceToOffsideLine: 99,
      runTimingState: "STAY_ONSIDE",
      isRequestingThroughBall: false,
      isCheckingBack: false,
      isLegalReceiver: false,
    };
  }

  const offside = evaluateOffside({
    receiver: input.player,
    receiverPosition: input.playerPosition,
    ball: input.ball,
    defending: input.defending,
    possession: input.possession,
    previousPositionState: input.previousPositionState,
  });

  return {
    isOffsidePosition: offside.isOffside,
    offsideLineY: Number(offside.lineY.toFixed(2)),
    safeLineY: Number(offside.safeLineY.toFixed(2)),
    distanceToOffsideLine: Number(offside.distanceToLine.toFixed(2)),
    runTimingState: normalizeRunTimingState(input.runTimingState),
    isRequestingThroughBall:
      input.isIntendedReceiver &&
      (input.runTimingState === "ATTACK_SPACE_BEHIND" ||
        input.runTimingState === "DIAGONAL_RUN" ||
        input.runTimingState === "RUN_ON_SHOULDER"),
    isCheckingBack:
      input.runTimingState === "CHECK_BACK_ONSIDE" || input.runTimingState === "DROP_SHORT",
    isLegalReceiver: !offside.isOffside,
  };
}

function normalizeRunTimingState(state: PlayerAIState): RunTimingState {
  if (
    state === "STAY_ONSIDE" ||
    state === "CHECK_BACK_ONSIDE" ||
    state === "CURVED_RUN" ||
    state === "DELAY_RUN" ||
    state === "ATTACK_SPACE_BEHIND" ||
    state === "RUN_ON_SHOULDER" ||
    state === "DIAGONAL_RUN" ||
    state === "THIRD_MAN_RUN" ||
    state === "BACK_POST_RUN" ||
    state === "DROP_SHORT"
  ) {
    return state;
  }

  if (state === "OVERLAP" || state === "UNDERLAP") return "DELAY_RUN";
  if (state === "ATTACK_SPACE") return "ATTACK_SPACE_BEHIND";
  if (state === "PASS_SUPPORT" || state === "SUPPORT_ATTACK") return "STAY_ONSIDE";
  return "STAY_ONSIDE";
}

function getAttackingTarget(
  player: InternalLineupPlayer,
  ball: TrajectoryPoint,
): { target: TrajectoryPoint; intent: PlayerMoveIntent } {
  const role = normalizeRole(player.role);
  const direction = attackDirection(player.side);
  const sameFlank = isSameFlank(player.anchors.x, ball.x);

  if (role === "GK") {
    return {
      target: {
        x: clamp(lerp(player.anchors.x, ball.x, 0.1), 42, 58),
        y: ownGoalY(player.side) - direction * 4,
      },
      intent: "anchor",
    };
  }

  if (role === "CB") {
    return {
      target: {
        x: clamp(lerp(player.anchors.x, ball.x, 0.12), player.anchors.x - 8, player.anchors.x + 8),
        y: clamp(player.anchors.y + direction * 8, 18, 82),
      },
      intent: "cover",
    };
  }

  if (role === "FB") {
    return {
      target: {
        x: clamp(
          player.anchors.x +
            (sameFlank ? (player.anchors.x < 50 ? -2 : 2) : (50 - player.anchors.x) * 0.16),
          8,
          92,
        ),
        y: clamp(player.anchors.y + direction * (sameFlank ? 18 : 8), 14, 86),
      },
      intent: sameFlank ? "overlap" : "support",
    };
  }

  if (role === "CM") {
    return {
      target: {
        x: clamp(lerp(player.anchors.x, ball.x, 0.34), 24, 76),
        y: clamp(lerp(player.anchors.y, ball.y - direction * 8, 0.34), 22, 78),
      },
      intent: "support",
    };
  }

  if (role === "W") {
    const wideX = getWideLaneX(player);
    return {
      target: {
        x: clamp(sameFlank ? wideX : lerp(wideX, 50, 0.18), 8, 92),
        y: clamp(sameFlank ? ball.y + direction * 13 : ball.y + direction * 18, 8, 92),
      },
      intent: sameFlank ? "run" : "support",
    };
  }

  return {
    target: {
      x: clamp(lerp(player.anchors.x, ball.x, 0.28), 34, 66),
      y: clamp(
        direction < 0
          ? Math.min(player.anchors.y, ball.y + direction * 16)
          : Math.max(player.anchors.y, ball.y + direction * 16),
        7,
        93,
      ),
    },
    intent: "run",
  };
}

function getDefensiveTarget(
  player: InternalLineupPlayer,
  ball: TrajectoryPoint,
): { target: TrajectoryPoint; intent: PlayerMoveIntent } {
  const role = normalizeRole(player.role);
  const direction = attackDirection(player.side);
  const ownY = ownGoalY(player.side);
  const danger = dangerLevel(player.side, ball.y);
  const sameFlank = isSameFlank(player.anchors.x, ball.x);

  if (role === "GK") {
    return {
      target: {
        x: clamp(lerp(50, ball.x, danger > 0.55 ? 0.28 : 0.16), 37, 63),
        y: clamp(ownY - direction * (danger > 0.62 ? 4 : 2), 8, 92),
      },
      intent: "chase",
    };
  }

  if (role === "CB") {
    return {
      target: {
        x: clamp(lerp(player.anchors.x, ball.x, sameFlank ? 0.32 : 0.18), 25, 75),
        y: clamp(
          lerp(player.anchors.y, ball.y + direction * 13, danger > 0.55 ? 0.42 : 0.24),
          14,
          86,
        ),
      },
      intent: "cover",
    };
  }

  if (role === "FB") {
    return {
      target: {
        x: clamp(
          sameFlank
            ? lerp(player.anchors.x, ball.x, 0.42)
            : player.anchors.x + (50 - player.anchors.x) * 0.16,
          7,
          93,
        ),
        y: clamp(lerp(player.anchors.y, ball.y + direction * 10, sameFlank ? 0.36 : 0.18), 12, 88),
      },
      intent: sameFlank ? "mark" : "cover",
    };
  }

  if (role === "CM") {
    return {
      target: {
        x: clamp(lerp(player.anchors.x, ball.x, 0.36), 22, 78),
        y: clamp(lerp(player.anchors.y, ball.y + direction * 8, 0.34), 18, 82),
      },
      intent: "mark",
    };
  }

  if (role === "W") {
    const wideX = getWideLaneX(player);
    return {
      target: {
        x: clamp(sameFlank ? lerp(wideX, ball.x, 0.28) : lerp(wideX, 50, 0.2), 8, 92),
        y: clamp(player.anchors.y - direction * 10, 16, 84),
      },
      intent: sameFlank ? "mark" : "cover",
    };
  }

  return {
    target: {
      x: clamp(lerp(player.anchors.x, ball.x, 0.22), 32, 68),
      y: clamp(player.anchors.y - direction * 7, 16, 84),
    },
    intent: "cover",
  };
}

function getPressTarget(player: InternalLineupPlayer, ball: TrajectoryPoint): TrajectoryPoint {
  const role = normalizeRole(player.role);
  if (role === "GK") {
    return {
      x: clamp(lerp(player.anchors.x, ball.x, 0.24), 35, 65),
      y: ownGoalY(player.side) - attackDirection(player.side) * 4,
    };
  }

  const maxStep = role === "CB" ? 18 : role === "FB" ? 22 : 26;
  return {
    x: clamp(ball.x, player.anchors.x - maxStep, player.anchors.x + maxStep),
    y: clamp(ball.y, player.anchors.y - maxStep, player.anchors.y + maxStep),
  };
}

function getRoleMoveFactor(player: InternalLineupPlayer, intent: PlayerMoveIntent): number {
  const role = normalizeRole(player.role);
  const athletic = clamp(
    (player.raw.stats.speed + player.raw.stats.acceleration) / 220,
    0.45,
    1.05,
  );
  const roleMultiplier =
    role === "GK"
      ? 0.52
      : role === "CB"
        ? 0.78
        : role === "FB"
          ? 0.96
          : role === "CM"
            ? 0.92
            : role === "W"
              ? 1.08
              : 1;
  const intentSpeed = PLAYER_SPEED_UNITS_PER_TICK[intent] ?? PLAYER_SPEED_UNITS_PER_TICK.anchor;
  return clamp(intentSpeed * roleMultiplier * athletic, 0.4, 7);
}

function normalizeRole(role: string): "GK" | "CB" | "FB" | "DM" | "CM" | "W" | "ST" {
  if (role === "GK") return "GK";
  if (role.includes("CB")) return "CB";
  if (role === "LB" || role === "RB") return "FB";
  if (role === "CDM" || role === "DM" || role.includes("DM")) return "DM";
  if (role === "LW" || role === "RW" || role === "LM" || role === "RM") return "W";
  if (role.includes("CM") || role === "CM") return "CM";
  return "ST";
}

function attackDirection(side: Side) {
  return side === "home" ? -1 : 1;
}

function ownGoalY(side: Side) {
  return side === "home" ? 92 : 8;
}

function dangerLevel(side: Side, ballY: number) {
  return side === "home" ? clamp((ballY - 50) / 42, 0, 1) : clamp((50 - ballY) / 42, 0, 1);
}

function isSameFlank(playerX: number, ballX: number) {
  if (playerX < 35) return ballX < 50;
  if (playerX > 65) return ballX > 50;
  return ballX >= 35 && ballX <= 65;
}

function getWideLaneX(player: { role: string; anchors: TrajectoryPoint }) {
  const role = player.role.toUpperCase();
  if (role === "LW" || role === "LM" || role === "LB" || role === "LWB") return 10;
  if (role === "RW" || role === "RM" || role === "RB" || role === "RWB") return 90;
  return player.anchors.x < 50 ? 10 : 90;
}

function getWideLaneDirection(player: { role: string; anchors: TrajectoryPoint }) {
  return getWideLaneX(player) < 50 ? -1 : 1;
}

function createInitialPositionState(
  home: InternalLineupPlayer[],
  away: InternalLineupPlayer[],
  possession: Side = "home",
): PositionState {
  const players = new Map<
    number,
    {
      x: number;
      y: number;
      vx: number;
      vy: number;
      targetX: number;
      targetY: number;
      aiState: PlayerAIState;
    }
  >();
  [...home, ...away].forEach((player) =>
    players.set(player.userPlayerId, {
      x: player.anchors.x,
      y: player.anchors.y,
      vx: 0,
      vy: 0,
      targetX: player.anchors.x,
      targetY: player.anchors.y,
      aiState: "HOLD_POSITION",
    }),
  );
  return {
    players,
    ball: { x: 50, y: 50 },
    possession,
    possessionTicks: 0,
    tacticalPhase: "IN_POSSESSION_BUILDUP",
  };
}

function extractPositionState(snapshot: MatchSnapshot): PositionState {
  const players = new Map<
    number,
    {
      x: number;
      y: number;
      vx: number;
      vy: number;
      targetX: number;
      targetY: number;
      aiState: PlayerAIState;
    }
  >();
  [...snapshot.homePlayers, ...snapshot.awayPlayers].forEach((player) =>
    players.set(player.userPlayerId, {
      x: player.x,
      y: player.y,
      vx: player.vx ?? 0,
      vy: player.vy ?? 0,
      targetX: player.targetX ?? player.x,
      targetY: player.targetY ?? player.y,
      aiState: player.aiState ?? "HOLD_POSITION",
    }),
  );
  return {
    players,
    ball: { x: snapshot.ball.x, y: snapshot.ball.y },
    possession: snapshot.possession,
    possessionTicks: Number(snapshot.tactical?.possessionTicks ?? 1),
    tacticalPhase: snapshot.tactical?.phase,
  };
}

function applyKickoffShape(homeLineup: InternalLineupPlayer[], awayLineup: InternalLineupPlayer[]) {
  homeLineup.forEach((player) => {
    const next = {
      x: player.anchors.x,
      y: clamp(52 + player.anchors.y * 0.43, 52, 94),
    };
    player.anchors = next;
    player.x = next.x;
    player.y = next.y;
    player.homeX = next.x;
    player.homeY = next.y;
  });

  awayLineup.forEach((player) => {
    const next = {
      x: player.anchors.x,
      y: clamp(5 + player.anchors.y * 0.43, 6, 48),
    };
    player.anchors = next;
    player.x = next.x;
    player.y = next.y;
    player.homeX = next.x;
    player.homeY = next.y;
  });
}

function resetLineupsToOwnHalf(
  homeLineup: InternalLineupPlayer[],
  awayLineup: InternalLineupPlayer[],
) {
  homeLineup.forEach((player) => resetPlayerToOwnHalf(player));
  awayLineup.forEach((player) => resetPlayerToOwnHalf(player));
}

function resetPlayerToOwnHalf(player: InternalLineupPlayer) {
  const role = normalizeRole(player.role);
  const x = getResetLaneX(player);
  const homeYByRole: Record<ReturnType<typeof normalizeRole>, number> = {
    GK: 92,
    CB: 78,
    FB: 76,
    DM: 62,
    CM: 59,
    W: 56,
    ST: 52,
  };
  const homeY = homeYByRole[role] ?? 58;
  const next = {
    x,
    y: player.side === "home" ? homeY : 100 - homeY,
  };

  player.anchors = next;
  player.x = next.x;
  player.y = next.y;
  player.homeX = next.x;
  player.homeY = next.y;
}

function getResetLaneX(player: InternalLineupPlayer) {
  const role = player.role.toUpperCase();
  if (role === "GK" || role === "CM" || role === "CDM" || role === "CAM" || role === "ST") {
    return role === "ST" ? 50 : 50;
  }
  if (role === "CB") return player.anchors.x < 50 ? 36 : 64;
  if (role === "LST" || role === "LCM") return role === "LST" ? 42 : 36;
  if (role === "RST" || role === "RCM") return role === "RST" ? 58 : 64;
  if (role === "LB" || role === "LWB" || role === "LM" || role === "LW") return 18;
  if (role === "RB" || role === "RWB" || role === "RM" || role === "RW") return 82;
  return clamp(player.anchors.x, 14, 86);
}

function applyHomeKickoffPair(homeLineup: InternalLineupPlayer[]) {
  const { kickoff: homeKickoff, partner: homeKickoffPartner } = selectKickoffPair(
    homeLineup,
    "home",
  );

  homeKickoff.anchors = { x: 50, y: 51 };
  homeKickoff.x = 50;
  homeKickoff.y = 51;
  homeKickoff.homeX = 50;
  homeKickoff.homeY = 51;
  homeKickoffPartner.anchors = { x: 54, y: 54 };
  homeKickoffPartner.x = 54;
  homeKickoffPartner.y = 54;
  homeKickoffPartner.homeX = 54;
  homeKickoffPartner.homeY = 54;

  return {
    homeKickoff,
    homeKickoffPartner,
    kickoff: homeKickoff,
    partner: homeKickoffPartner,
  };
}

function applyAwayKickoffPair(awayLineup: InternalLineupPlayer[]) {
  const { kickoff: awayKickoff, partner: awayKickoffPartner } = selectKickoffPair(
    awayLineup,
    "away",
  );

  awayKickoff.anchors = { x: 50, y: 49 };
  awayKickoff.x = 50;
  awayKickoff.y = 49;
  awayKickoff.homeX = 50;
  awayKickoff.homeY = 49;
  awayKickoffPartner.anchors = { x: 46, y: 46 };
  awayKickoffPartner.x = 46;
  awayKickoffPartner.y = 46;
  awayKickoffPartner.homeX = 46;
  awayKickoffPartner.homeY = 46;

  return {
    awayKickoff,
    awayKickoffPartner,
    kickoff: awayKickoff,
    partner: awayKickoffPartner,
  };
}

function selectKickoffPair(lineup: InternalLineupPlayer[], side: Side) {
  const candidates = lineup.filter((player) => !isGoalkeeperRole(player.role));
  const sorted = (candidates.length ? candidates : lineup).sort(
    (left, right) =>
      getKickoffRolePriority(left.role) - getKickoffRolePriority(right.role) ||
      distance(left.anchors, getKickoffSpot(side)) - distance(right.anchors, getKickoffSpot(side)),
  );
  const kickoff = sorted[0] ?? lineup[0];
  const partner =
    sorted.find(
      (player) =>
        player.userPlayerId !== kickoff.userPlayerId && getKickoffRolePriority(player.role) <= 30,
    ) ??
    sorted.find((player) => player.userPlayerId !== kickoff.userPlayerId) ??
    kickoff;

  return { kickoff, partner };
}

function getKickoffRolePriority(role: string) {
  const upperRole = role.toUpperCase();
  if (upperRole === "GK") return 999;
  if (upperRole === "ST" || upperRole === "CF" || upperRole === "SS") return 0;
  if (upperRole === "CAM") return 8;
  if (upperRole === "CM" || upperRole === "CDM" || upperRole === "DM") return 12;
  if (upperRole === "LM" || upperRole === "RM" || upperRole === "LW" || upperRole === "RW") {
    return 18;
  }
  if (upperRole === "LB" || upperRole === "RB" || upperRole.includes("WB")) return 32;
  if (upperRole.includes("CB")) return 45;
  return 24;
}

function isGoalkeeperRole(role: string) {
  return role.toUpperCase() === "GK";
}

function getKickoffSpot(side: Side) {
  return side === "home" ? { x: 50, y: 51 } : { x: 50, y: 49 };
}

function stripInternalLineup(lineup: InternalLineupPlayer[]): MatchRenderPlayer[] {
  return lineup.map(({ anchors: _a, raw: _r, ...player }) => ({
    ...player,
    hasBall: false,
    activeSkill: null,
  }));
}

function selectLineup(team: SimulationTeamInput, side: Side): InternalLineupPlayer[] {
  const formation =
    FORMATION_LAYOUTS[team.formation ?? ETeamFormation.F433] ??
    FORMATION_LAYOUTS[ETeamFormation.F433];
  const pool = [...team.players];
  return formation.map((slot, index) => {
    const bestIndex = pool.reduce(
      (best, player, playerIndex) => {
        const score = playerFitScore(player, slot);
        return score > best.score ? { index: playerIndex, score } : best;
      },
      { index: 0, score: Number.NEGATIVE_INFINITY },
    ).index;
    const picked = pool.splice(bestIndex, 1)[0] ?? team.players[index];
    const anchors = side === "home" ? { x: slot.x, y: slot.y } : { x: slot.x, y: 100 - slot.y };
    return {
      userPlayerId: picked.userPlayerId,
      playerId: picked.playerId,
      teamId: team.id,
      side,
      role: slot.role,
      displayRole: slot.label,
      name: picked.name,
      shortName: shortenName(picked.name),
      slug: picked.slug,
      skills: picked.skills,
      skillSlugs: picked.skillSlugs,
      skillCharges: normalizeSkillCharges(picked.skills, undefined),
      x: anchors.x,
      y: anchors.y,
      homeX: anchors.x,
      homeY: anchors.y,
      stamina: picked.stats.stamina,
      activeSkill: null,
      hasBall: false,
      anchors,
      raw: picked,
    };
  });
}

function playerFitScore(player: SimulationRosterPlayer, slot: FormationSlot): number {
  const preferred = SLOT_POSITION_MAP[slot.role] ?? [slot.label];
  const positionScore = player.positions.reduce((best, item) => {
    const normalized = String(item.position || "").toUpperCase();
    return preferred.includes(normalized) ? Math.max(best, Number(item.effect ?? 0)) : best;
  }, 0);
  if (slot.role === "GK")
    return positionScore * 100 + player.stats.gkKeeping + player.stats.gkReflex;
  return (
    positionScore * 100 +
    player.stats.shoot * 0.55 +
    player.stats.pass * 0.35 +
    player.stats.speed * 0.1
  );
}

function pickAttacker(lineup: InternalLineupPlayer[], random: () => number) {
  const pool = lineup.filter((player) => player.role !== "GK");
  const weighted = pool.flatMap((player) => {
    const weight =
      player.role.includes("ST") || player.role.includes("W")
        ? 3
        : player.role.includes("M")
          ? 2
          : 1;
    return Array.from({ length: weight }, () => player);
  });
  return weighted[Math.floor(random() * weighted.length)] ?? pool[0] ?? lineup[0];
}

function pickPartner(lineup: InternalLineupPlayer[], excludeId: number, random: () => number) {
  const pool = lineup.filter((player) => player.userPlayerId !== excludeId && player.role !== "GK");
  return pool[Math.floor(random() * pool.length)] ?? null;
}

function pickDefender(lineup: InternalLineupPlayer[], random: () => number) {
  const pool = lineup.filter((player) => player.role !== "GK");
  const weighted = pool.flatMap((player) =>
    Array.from(
      { length: player.role.includes("B") || player.role.includes("CB") ? 3 : 1 },
      () => player,
    ),
  );
  return weighted[Math.floor(random() * weighted.length)] ?? lineup[0];
}

function createEmptyStats(playerId: number): SimulationPlayerStatsDraft {
  return {
    playerId,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    passes: 0,
    passAccuracy: 0,
    tackles: 0,
    tackleAccuracy: 0,
    interceptions: 0,
    minutesPlayed: 0,
    shots: 0,
    shotAccuracy: 0,
    dribbles: 0,
    dribbleAccuracy: 0,
    foulsCommitted: 0,
    foulsSuffered: 0,
    offsides: 0,
    rating: 6,
  };
}

function addPass(stats: Map<number, SimulationPlayerStatsDraft>, id: number, ok: boolean) {
  const row = stats.get(id);
  if (row) {
    row.passes += 1;
    row.passAccuracy += ok ? 1 : 0;
  }
}

function addShot(stats: Map<number, SimulationPlayerStatsDraft>, id: number, ok: boolean) {
  const row = stats.get(id);
  if (row) {
    row.shots += 1;
    row.shotAccuracy += ok ? 1 : 0;
  }
}

function addGoal(
  stats: Map<number, SimulationPlayerStatsDraft>,
  scorerId: number,
  assistId: number | null,
) {
  const scorer = stats.get(scorerId);
  if (scorer) scorer.goals += 1;
  if (assistId) {
    const assist = stats.get(assistId);
    if (assist) assist.assists += 1;
  }
}

function addTackle(stats: Map<number, SimulationPlayerStatsDraft>, id: number) {
  const row = stats.get(id);
  if (row) {
    row.tackles += 1;
    row.tackleAccuracy += 1;
  }
}

function addInterception(stats: Map<number, SimulationPlayerStatsDraft>, id: number) {
  const row = stats.get(id);
  if (row) row.interceptions += 1;
}

function addDribble(stats: Map<number, SimulationPlayerStatsDraft>, id: number, ok: boolean) {
  const row = stats.get(id);
  if (row) {
    row.dribbles += 1;
    row.dribbleAccuracy += ok ? 1 : 0;
  }
}

function finalizeRatings(stats: Map<number, SimulationPlayerStatsDraft>) {
  stats.forEach((row) => {
    row.minutesPlayed = Math.min(90, row.minutesPlayed);
    row.rating = Number(
      Math.max(
        5.8,
        Math.min(
          10,
          6 +
            row.goals * 1.4 +
            row.assists * 0.8 +
            row.passAccuracy * 0.04 +
            row.shotAccuracy * 0.12 +
            row.dribbleAccuracy * 0.08 +
            row.tackleAccuracy * 0.07 +
            row.interceptions * 0.06,
        ),
      ).toFixed(2),
    );
  });
}

function createHighlight(
  event: EMatchEvent | null,
  label: string,
  teamSide: Side | null,
  actorPlayerId: number | null,
  secondaryPlayerId: number | null,
  skill: EPlayerSkill | null,
): MatchSnapshot["highlight"] {
  return {
    event,
    label,
    teamSide,
    actorPlayerId,
    secondaryPlayerId,
    skill,
    skillSlug: getPlayerSkillSlug(skill),
  };
}

function pushSkillEvent(
  events: SimulationEventDraft[],
  minute: number,
  teamId: number,
  actorPlayerId: number,
  secondaryPlayerId: number | null,
  action: ResolvedAction,
) {
  pushEvent(events, EMatchEvent.SKILL_USED, minute, teamId, actorPlayerId, secondaryPlayerId, {
    label: action.label,
    skill: action.skill,
    skillLabel: action.skillLabel,
  });
}

function pushEvent(
  events: SimulationEventDraft[],
  event: EMatchEvent,
  minute: number,
  teamId: number | null,
  actorPlayerId: number | null,
  secondaryPlayerId: number | null,
  payload: Record<string, unknown> | null,
) {
  events.push({ event, minute, teamId, actorPlayerId, secondaryPlayerId, payload });
}

function shortenName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[0].slice(0, 1)}. ${parts[parts.length - 1]}`;
}

function easeOut(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

function createSeededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
