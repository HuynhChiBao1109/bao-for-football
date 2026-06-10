import { EPlayerSkill } from "src/modules/player/enum/player-skill.enum";
import { ETeamFormation } from "src/modules/team/enums/team-formation.enum";
import { EMatchEvent } from "./enums";
import {
  buildMagicDribbleTrajectory,
  buildThunderShotTrajectory,
  getSkillLabel,
  resolveSkillActivation,
  TrajectoryPoint,
  tryActivateSkill,
} from "./match-skills.util";

export const MATCH_REAL_DURATION_MS = 180_000;
export const MATCH_CLOCK_SECONDS = 180;
export const MATCH_TICK_MS = 650;
export const TICKS_PER_SECOND = 1000 / MATCH_TICK_MS;
export const TICKS_PER_MINUTE = 60 * TICKS_PER_SECOND;
export const MATCH_DURATION_TICKS = MATCH_CLOCK_SECONDS * TICKS_PER_SECOND;
export const DEBUG_TICK_STEP = 1;
export const FRAME_DURATION_MS = MATCH_TICK_MS;
const PLAYER_SPEED_UNITS_PER_TICK: Record<PlayerMoveIntent, number> = {
  anchor: 1.2,
  kickoff: 2.2,
  cover: 2.8,
  mark: 3.2,
  support: 3.8,
  chase: 4.4,
  run: 5.2,
  overlap: 5.6,
  press: 6,
};
const PASS_SPEED_UNITS_PER_TICK = 35;
const SHOT_SPEED_UNITS_PER_TICK = 62;
export const FRAMES_PER_ACTION = 5;
export const ACTIONS_PER_HALF = 14;

type Side = "home" | "away";
type MatchStep = "first_half_start" | "play" | "half_time" | "second_half_start" | "full_time";
type PlayActionType = "pass" | "shoot" | "block" | "goal" | "save";
type PossessionTempoKind = "pass" | "hold" | "carry" | "reposition";

export type PlayerMoveIntent =
  | "run"
  | "press"
  | "support"
  | "anchor"
  | "chase"
  | "kickoff"
  | "cover"
  | "mark"
  | "overlap";

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
  avatarUrl: string | null;
  positions: Array<{ position: string; effect: number }>;
  skills: EPlayerSkill[];
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
  avatarUrl: string | null;
  x: number;
  y: number;
  stamina: number;
  activeSkill: EPlayerSkill | null;
  hasBall: boolean;
  move?: PlayerMotion;
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
  highlight: {
    event: EMatchEvent | null;
    label: string;
    teamSide: Side | null;
    actorPlayerId: number | null;
    secondaryPlayerId: number | null;
    skill: EPlayerSkill | null;
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
  players: Map<number, { x: number; y: number }>;
  ball: { x: number; y: number };
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
    { role: "LCB", label: "CB", x: 38, y: 79 },
    { role: "RCB", label: "CB", x: 62, y: 79 },
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
    { role: "LCB", label: "CB", x: 38, y: 79 },
    { role: "RCB", label: "CB", x: 62, y: 79 },
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
  LCB: ["CB"],
  RCB: ["CB"],
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
}): MatchNextTickResult | null {
  const previousTicks = [...input.previousTicks].sort(
    (left, right) => left.frameId - right.frameId,
  );
  const frameId = previousTicks.length;
  const latestTick = previousTicks.at(-1);
  const homeLineup = input.homeLineup.map(toInternalLineupPlayer);
  const awayLineup = input.awayLineup.map(toInternalLineupPlayer);

  if (!homeLineup.length || !awayLineup.length) {
    return null;
  }

  const homeKickoff =
    homeLineup.find((player) => player.role === "ST") ??
    homeLineup.find((player) => player.role !== "GK") ??
    homeLineup[0];
  const homeKickoffPartner =
    homeLineup.find(
      (player) => player.userPlayerId !== homeKickoff.userPlayerId && player.role !== "GK",
    ) ??
    homeLineup[1] ??
    homeKickoff;
  const previousPositionState = latestTick
    ? extractPositionState(latestTick)
    : createInitialPositionState(homeLineup, awayLineup);

  if (!latestTick) {
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
  const second = getNextMatchClockSecond(latestTick);
  const minute = Math.floor(second / 60);
  const lifecycleAction = resolveMatchLifecycleAction(latestTick, nextTickValue, second);
  if (lifecycleAction) {
    if (lifecycleAction.event === EMatchEvent.SECOND_HALF_START) {
      applyAwayKickoffPair(awayLineup);
    }

    const allPlayers = [...homeLineup, ...awayLineup];
    const currentOwnerId = Number(latestTick.ball.ownerPlayerId ?? latestTick.highlight?.actorPlayerId);
    const currentOwner =
      allPlayers.find((player) => player.userPlayerId === currentOwnerId) ??
      (lifecycleAction.event === EMatchEvent.SECOND_HALF_START
        ? awayLineup.find((player) => player.role !== "GK") ?? awayLineup[0]
        : homeKickoff);
    const ball = lifecycleAction.event === EMatchEvent.SECOND_HALF_START
      ? { x: currentOwner.anchors.x, y: currentOwner.anchors.y }
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
      ballOwner: currentOwner,
      ball,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, ball),
      highlight: createHighlight(
        lifecycleAction.event,
        lifecycleAction.label,
        lifecycleAction.possession ?? latestTick.possession ?? "home",
        currentOwner.userPlayerId,
        null,
        null,
      ),
      activeSkill: null,
      focusId: currentOwner.userPlayerId,
      pressId: null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: lifecycleAction.event,
        minute,
        teamId: currentOwner.teamId,
        actorPlayerId: currentOwner.userPlayerId,
        secondaryPlayerId: null,
        payload: { label: snapshot.highlight.label },
      },
    };
  }

  if (latestTick.highlight?.event === EMatchEvent.GOAL) {
    const losingSide: Side = latestTick.highlight.teamSide === "home" ? "away" : "home";
    const kickoffLineup = losingSide === "home" ? homeLineup : awayLineup;
    const kickoffPair =
      losingSide === "home"
        ? applyHomeKickoffPair(kickoffLineup)
        : applyAwayKickoffPair(kickoffLineup);
    const kickoffPlayer =
      "homeKickoff" in kickoffPair ? kickoffPair.homeKickoff : kickoffPair.awayKickoff;
    const kickoffPartner =
      "homeKickoffPartner" in kickoffPair
        ? kickoffPair.homeKickoffPartner
        : kickoffPair.awayKickoffPartner;
    const ball = { x: kickoffPlayer.anchors.x, y: kickoffPlayer.anchors.y };
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
      ballOwner: kickoffPlayer,
      ball,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, ball),
      highlight: createHighlight(
        EMatchEvent.PASS,
        `Tick ${nextTickValue}: ${losingSide === "home" ? "Home" : "Away"} giao bong lai`,
        losingSide,
        kickoffPlayer.userPlayerId,
        kickoffPartner.userPlayerId,
        null,
      ),
      activeSkill: null,
      focusId: kickoffPlayer.userPlayerId,
      pressId: null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: EMatchEvent.PASS,
        minute,
        teamId: kickoffPlayer.teamId,
        actorPlayerId: kickoffPlayer.userPlayerId,
        secondaryPlayerId: kickoffPartner.userPlayerId,
        payload: { label: snapshot.highlight.label, kickoffAfterGoal: true },
      },
    };
  }

  const latestOwnerId = Number(latestTick.ball.ownerPlayerId ?? latestTick.highlight?.secondaryPlayerId);
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
    nextTick: nextTickValue,
    possession,
  });
  const shotAction = resolveDebugShotAction({
    shooter: actor,
    defending,
    possession,
    ball: latestTick.ball,
    nextTick: nextTickValue,
  }, tempoDecision.kind === "pass");

  if (shotAction) {
    const homeScore = Number(latestTick.homeScore ?? 0) + (shotAction.isGoal && possession === "home" ? 1 : 0);
    const awayScore = Number(latestTick.awayScore ?? 0) + (shotAction.isGoal && possession === "away" ? 1 : 0);
    const keeper = shotAction.keeper;
    const nextOwner = shotAction.isGoal ? actor : keeper;
    const snapshot = buildSnapshot({
      frameId,
      minute,
      second,
      tick: nextTickValue,
      matchStep: "play",
      phase,
      homeScore,
      awayScore,
      possession: shotAction.isGoal ? possession : (possession === "home" ? "away" : "home"),
      homeLineup,
      awayLineup,
      ballOwner: nextOwner,
      ball: shotAction.target,
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, shotAction.target),
      highlight: createHighlight(
        shotAction.event,
        `Tick ${nextTickValue}: ${actor.shortName} ${shotAction.label}`,
        possession,
        actor.userPlayerId,
        keeper.userPlayerId,
        null,
      ),
      activeSkill: null,
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
          isGoal: shotAction.isGoal,
          homeScore,
          awayScore,
        },
      },
    };
  }

  if (tempoDecision.kind !== "pass") {
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
      ballPath: pathBetween({ x: latestTick.ball.x, y: latestTick.ball.y }, tempoDecision.ballTarget),
      highlight: createHighlight(
        EMatchEvent.DRIBBLE,
        `Tick ${nextTickValue}: ${actor.shortName} ${tempoDecision.label}`,
        possession,
        actor.userPlayerId,
        null,
        null,
      ),
      activeSkill: null,
      focusId: actor.userPlayerId,
      pressId: tempoDecision.pressDefender?.userPlayerId ?? null,
      positionState: previousPositionState,
    });

    return {
      snapshot,
      event: {
        event: EMatchEvent.DRIBBLE,
        minute,
        teamId: actor.teamId,
        actorPlayerId: actor.userPlayerId,
        secondaryPlayerId: null,
        payload: {
          label: snapshot.highlight.label,
          action: tempoDecision.kind,
          from: { x: latestTick.ball.x, y: latestTick.ball.y },
          to: tempoDecision.ballTarget,
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
    nextTick: nextTickValue,
    possession,
  });
  const { receiver, ballTarget, pressDefender } = passDecision;
  const defensiveAction = passDecision.interception;

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
      `Tick ${nextTickValue}: ${actor.shortName} chuyen cho ${receiver.shortName}`,
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

  if (roll < 0.34 + passBias * 0.18) {
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
  } else if (roll < 0.62) {
    const skill = tryActivateSkill(actor.raw.skills, actor.role, "dribble", input.random);
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
      EMatchEvent.DRIBBLE,
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
  } else if (roll < 0.76 + shotBias * 0.18) {
    const skill = tryActivateSkill(actor.raw.skills, actor.role, "shoot", input.random);
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
  return {
    ...player,
    anchors: { x: Number(player.x ?? 50), y: Number(player.y ?? 50) },
    raw: {
      userPlayerId: player.userPlayerId,
      playerId: player.playerId,
      teamId: player.teamId,
      name: player.name,
      avatarUrl: player.avatarUrl,
      positions: [{ position: player.displayRole || player.role, effect: 1 }],
      skills: [],
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
  const mustSettle =
    !restartPass &&
    (input.latestEvent === EMatchEvent.PASS || teamTicks < 2 || ownerTicks < 2);
  const passCadenceReady = input.nextTick % 3 === 0 || ownerTicks >= 4;

  if (restartPass || (!mustSettle && passCadenceReady)) {
    return {
      kind: "pass",
      label: "chuyen bong",
      ballTarget: input.ball,
      pressDefender: null,
    };
  }

  const pressDefender =
    findNearestPlayer(input.defending, input.ball, (player) => player.role !== "GK") ??
    input.defending[0] ??
    null;
  const roll = (input.nextTick + input.actor.userPlayerId + teamTicks + ownerTicks) % 3;

  if (roll === 0) {
    return {
      kind: "hold",
      label: "giu bong cho doi hinh len",
      ballTarget: settleBallNearOwner(input.actor, input.ball, 0.18),
      pressDefender,
    };
  }

  if (roll === 1) {
    return {
      kind: "carry",
      label: "keo bong giu nhip",
      ballTarget: carryBallTarget({
        actor: input.actor,
        ball: input.ball,
        possession: input.possession,
        nextTick: input.nextTick,
      }),
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
  const lateral = input.actor.anchors.x < 50 ? -1 : 1;
  const wobble = ((input.nextTick % 5) - 2) * 0.7;
  const desired = {
    x: clamp(input.ball.x + lateral * 2.5 + wobble, 6, 94),
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
      const role = normalizeRole(player.role);
      const roleWeight =
        role === "ST" ? 0.1 : role === "W" ? 0.08 : role === "CM" ? 0.06 : role === "FB" ? 0.03 : 0.01;
      const laneRotation = ((input.tick / 2 + index) % candidates.length) * 0.72;
      const distanceScore = clamp(1 - Math.abs(distanceToBall - 26) / 48, 0, 1);

      return {
        player,
        ballTarget,
        lane,
        score:
          lane.score * 0.34 +
          availability * 0.24 +
          tacticalAdvantage * 0.24 +
          distanceScore * 0.14 +
          roleWeight +
          laneRotation * 0.01,
      };
    })
    .sort((left, right) => right.score - left.score);

  const selected = ranked[0] ?? {
    player: candidates[0],
    ballTarget: moveToward(input.ball, candidates[0].anchors, PASS_SPEED_UNITS_PER_TICK),
    lane: evaluatePassLane({
      from: input.ball,
      to: candidates[0].anchors,
      defending: input.defending,
      previousPositionState: input.previousPositionState,
    }),
    score: 0,
  };
  const pressDefender = selected.lane.defender ?? input.defending[0];

  return {
    receiver: selected.player,
    ballTarget: selected.ballTarget,
    pressDefender,
    interception: resolveDebugPassInterception({
      defender: pressDefender,
      actor: input.actor,
      receiver: selected.player,
      ball: input.ball,
      ballTarget: selected.ballTarget,
      laneDistance: selected.lane.distance,
      laneScore: selected.lane.score,
      nextTick: input.nextTick,
    }),
  };
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
      const position = input.previousPositionState.players.get(defender.userPlayerId) ?? defender.anchors;
      return {
        defender,
        distance: distanceToSegment(position, input.from, input.to),
        ballDistance: distance(position, input.from),
      };
    })
    .sort((left, right) => left.distance - right.distance || left.ballDistance - right.ballDistance);
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
      return Math.min(distance(defenderPosition, receiverPosition), distance(defenderPosition, input.target));
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

function resolveDebugPassInterception(input: {
  defender: InternalLineupPlayer | null;
  actor: InternalLineupPlayer;
  receiver: InternalLineupPlayer;
  ball: TrajectoryPoint;
  ballTarget: TrajectoryPoint;
  laneDistance: number;
  laneScore: number;
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
  const qualityRisk = clamp((defenderQuality - passerQuality + 30) / 90, 0, 0.42);
  const immediateLaneThreat = input.laneDistance <= 5 ? 0.24 : 0;
  const risk = clamp(laneRisk * 0.54 + qualityRisk + immediateLaneThreat, 0, 0.92);
  const deterministicRoll =
    ((input.nextTick * 17 + input.defender.userPlayerId * 13 + input.receiver.userPlayerId * 7) %
      100) /
    100;

  if (risk < 0.52 || deterministicRoll > risk) {
    return null;
  }

  const interceptionPoint = closestPointOnSegment(input.defender.anchors, input.ball, input.ballTarget);
  const contestedPoint = {
    x: clamp(lerp(interceptionPoint.x, input.defender.anchors.x, 0.45), 5, 95),
    y: clamp(lerp(interceptionPoint.y, input.defender.anchors.y, 0.45), 5, 95),
  };

  return {
    label: "cat duong chuyen",
    target: moveToward(input.ball, contestedPoint, PASS_SPEED_UNITS_PER_TICK),
  };
}

function getDebugPassTarget(input: {
  receiver: InternalLineupPlayer;
  receiverPreviousPosition: TrajectoryPoint;
  ball: TrajectoryPoint;
  tick: number;
  possession: Side;
}): TrajectoryPoint {
  const direction = attackDirection(input.possession);
  const role = normalizeRole(input.receiver.role);
  const widthPull =
    role === "W" || role === "FB"
      ? input.receiver.anchors.x < 50
        ? -5
        : 5
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

  return moveToward(input.ball, desired, PASS_SPEED_UNITS_PER_TICK);
}

function resolveDebugDefensiveAction(input: {
  defender: InternalLineupPlayer;
  actor: InternalLineupPlayer;
  ball: TrajectoryPoint;
  ballTarget: TrajectoryPoint;
  nextTick: number;
}): { event: EMatchEvent; label: string; target: TrajectoryPoint } | null {
  const distanceToLane = distance(input.defender.anchors, input.ballTarget);
  const distanceToBall = distance(input.defender.anchors, input.ball);
  const canChallenge = Math.min(distanceToLane, distanceToBall) <= 28;

  if (!canChallenge) {
    return null;
  }

  if (input.nextTick % 10 === 0) {
    const target = {
      x: clamp(lerp(input.ball.x, input.defender.anchors.x, 0.78), 6, 94),
      y: clamp(lerp(input.ball.y, input.defender.anchors.y, 0.78), 6, 94),
    };
    return {
      event: EMatchEvent.SLIDE_TACKLE,
      label: "xoac bong",
      target: moveToward(input.ball, target, PASS_SPEED_UNITS_PER_TICK * 0.8),
    };
  }

  if (input.nextTick % 6 === 0) {
    const target = {
      x: clamp(lerp(input.ballTarget.x, input.defender.anchors.x, 0.55), 6, 94),
      y: clamp(lerp(input.ballTarget.y, input.defender.anchors.y, 0.55), 6, 94),
    };
    return {
      event: EMatchEvent.TACKLE,
      label: "tac bong",
      target: moveToward(input.ballTarget, target, PASS_SPEED_UNITS_PER_TICK * 0.7),
    };
  }

  return null;
}

function resolveDebugShotAction(input: {
  shooter: InternalLineupPlayer;
  defending: InternalLineupPlayer[];
  possession: Side;
  ball: TrajectoryPoint;
  nextTick: number;
}, canReleaseBall = true): {
  event: EMatchEvent;
  label: string;
  target: TrajectoryPoint;
  isGoal: boolean;
  keeper: InternalLineupPlayer;
} | null {
  if (!canReleaseBall) {
    return null;
  }

  const keeper = input.defending.find((player) => player.role === "GK") ?? input.defending[0];
  const attackDirectionValue = attackDirection(input.possession);
  const goalY = input.possession === "home" ? 4 : 96;
  const distanceToGoal = Math.abs(input.ball.y - goalY);
  const role = normalizeRole(input.shooter.role);
  const shotWindow = distanceToGoal <= 34 || role === "ST" || role === "W";
  const shouldShoot = shotWindow && input.nextTick % 8 === 0;

  if (!shouldShoot) {
    return null;
  }

  const aimedX = clamp(50 + (((input.nextTick / 2) % 5) - 2) * 7, 28, 72);
  const goalTarget = {
    x: aimedX,
    y: goalY,
  };
  const isGoal =
    distance(input.ball, goalTarget) <= SHOT_SPEED_UNITS_PER_TICK &&
    (input.nextTick % 16 === 0 || (role === "ST" && input.nextTick % 24 === 8));

  if (isGoal) {
    return {
      event: EMatchEvent.GOAL,
      label: "ghi ban",
      target: goalTarget,
      isGoal: true,
      keeper,
    };
  }

  const saveTarget = {
    x: clamp(lerp(goalTarget.x, keeper.anchors.x, 0.42), 8, 92),
    y: clamp(goalY - attackDirectionValue * 7, 6, 94),
  };
  const target = moveToward(input.ball, saveTarget, SHOT_SPEED_UNITS_PER_TICK);

  return {
    event: input.nextTick % 16 === 8 ? EMatchEvent.GOALKEEPER_SAVE : EMatchEvent.SHOOT,
    label: input.nextTick % 16 === 8 ? "sut, thu mon cuu thua" : "sut bong",
    target,
    isGoal: false,
    keeper,
  };
}

function getNextMatchClockSecond(latestTick: MatchSnapshot) {
  return Math.min(MATCH_CLOCK_SECONDS, Math.floor((latestTick.tick + DEBUG_TICK_STEP) / TICKS_PER_SECOND));
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

  if (latestEvent === EMatchEvent.FIRST_HALF_STOPPAGE) {
    return {
      event: EMatchEvent.FIRST_HALF_END,
      label: "Ket thuc hiep 1",
      matchStep: "half_time",
      phase: "half_time",
    };
  }

  if (latestEvent === EMatchEvent.FIRST_HALF_END) {
    return {
      event: EMatchEvent.HALF_TIME_TUNNEL,
      label: "Cau thu vao duong ham",
      matchStep: "half_time",
      phase: "half_time",
    };
  }

  if (latestEvent === EMatchEvent.HALF_TIME_TUNNEL) {
    return {
      event: EMatchEvent.SECOND_HALF_START,
      label: "Bat dau hiep 2",
      matchStep: "second_half_start",
      phase: "second_half",
      possession: "away",
    };
  }

  if (latestEvent === EMatchEvent.SECOND_HALF_STOPPAGE) {
    return {
      event: EMatchEvent.MATCH_END,
      label: "Het gio",
      matchStep: "full_time",
      phase: "full_time",
    };
  }

  if (
    latestTick.phase === "first_half" &&
    nextSecond >= halfTimeSecond
  ) {
    return {
      event: EMatchEvent.FIRST_HALF_STOPPAGE,
      label: "Bu gio hiep 1",
      matchStep: "play",
      phase: "first_half",
    };
  }

  if (
    latestTick.phase === "second_half" &&
    nextSecond >= MATCH_CLOCK_SECONDS
  ) {
    return {
      event: EMatchEvent.SECOND_HALF_STOPPAGE,
      label: "Bu gio hiep 2",
      matchStep: "play",
      phase: "second_half",
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

function moveToward(from: TrajectoryPoint, to: TrajectoryPoint, maxDistance: number): TrajectoryPoint {
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
  positionState: PositionState;
}): MatchSnapshot {
  const prevBall = input.positionState.ball;
  const ball = { x: clamp(input.ball.x, 0, 100), y: clamp(input.ball.y, 0, 100) };
  const ownerId = input.ballOwner.userPlayerId;
  const homePlayers = projectPlayers({
    lineup: input.homeLineup,
    possession: input.possession,
    ball,
    ballOwnerId: ownerId,
    focusId: input.focusId,
    pressId: input.pressId,
    matchStep: input.matchStep,
    positionState: input.positionState,
  });
  const awayPlayers = projectPlayers({
    lineup: input.awayLineup,
    possession: input.possession,
    ball,
    ballOwnerId: ownerId,
    focusId: input.focusId,
    pressId: input.pressId,
    matchStep: input.matchStep,
    positionState: input.positionState,
  });

  [...homePlayers, ...awayPlayers].forEach((player) => {
    player.hasBall = player.userPlayerId === ownerId;
    if (player.hasBall && input.activeSkill) player.activeSkill = input.activeSkill;
  });

  return {
    frameId: input.frameId,
    tick: input.tick,
    durationMs: FRAME_DURATION_MS,
    matchStep: input.matchStep,
    minute: input.minute,
    second: input.second,
    clockLabel: `${String(Math.min(input.minute, 90)).padStart(2, "0")}:${String(input.second % 60).padStart(2, "0")}`,
    phase: input.phase,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    possession: input.possession,
    ball: {
      x: ball.x,
      y: ball.y,
      fromX: clamp(prevBall.x, 0, 100),
      fromY: clamp(prevBall.y, 0, 100),
      ownerPlayerId: ownerId,
      speed: input.activeSkill ? 9 : 5,
      trajectory: input.ballPath,
      skillTrajectory: input.activeSkill,
    },
    homePlayers,
    awayPlayers,
    highlight: input.highlight,
  };
}

function projectPlayers(input: {
  lineup: InternalLineupPlayer[];
  possession: Side;
  ball: TrajectoryPoint;
  ballOwnerId: number;
  focusId: number;
  pressId: number | null;
  matchStep: MatchStep;
  positionState: PositionState;
}): MatchRenderPlayer[] {
  return input.lineup.map((player, index) => {
    const prev = input.positionState.players.get(player.userPlayerId) ?? player.anchors;
    const hasBall = player.userPlayerId === input.ballOwnerId;
    const isPress = input.pressId != null && player.userPlayerId === input.pressId;
    const onAttack = player.side === input.possession;
    let target = player.anchors;
    let intent: PlayerMoveIntent = "anchor";

    if (input.matchStep === "first_half_start" || input.matchStep === "second_half_start") {
      target = hasBall ? { x: input.ball.x, y: input.ball.y } : player.anchors;
      intent = hasBall ? "kickoff" : "anchor";
    } else if (input.matchStep === "half_time" || input.matchStep === "full_time") {
      target = { x: 47 + (index % 4) * 2, y: 50 + Math.floor(index / 4) * 1.5 };
    } else if (hasBall) {
      target = { x: input.ball.x, y: input.ball.y };
      intent = "run";
    } else if (isPress) {
      target = getPressTarget(player, input.ball);
      intent = "press";
    } else if (onAttack) {
      const movement = getAttackingTarget(player, input.ball);
      target = movement.target;
      intent = movement.intent;
    } else {
      const movement = getDefensiveTarget(player, input.ball);
      target = movement.target;
      intent = movement.intent;
    }

    const movement = movePlayerForTick({
      current: prev,
      target,
      maxDistance: getRoleMoveFactor(player, intent),
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
      avatarUrl: player.avatarUrl,
      x: movement.x,
      y: movement.y,
      stamina: player.stamina,
      activeSkill: null,
      hasBall: false,
      move: movement.move,
    };
  });
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
    return {
      target: {
        x: clamp(sameFlank ? player.anchors.x : lerp(player.anchors.x, 50, 0.35), 8, 92),
        y: clamp(sameFlank ? ball.y + direction * 13 : player.anchors.y + direction * 8, 8, 92),
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
    return {
      target: {
        x: clamp(
          sameFlank ? lerp(player.anchors.x, ball.x, 0.28) : lerp(player.anchors.x, 50, 0.24),
          8,
          92,
        ),
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
  const athletic = clamp((player.raw.stats.speed + player.raw.stats.acceleration) / 220, 0.45, 1.05);
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

function normalizeRole(role: string): "GK" | "CB" | "FB" | "CM" | "W" | "ST" {
  if (role === "GK") return "GK";
  if (role.includes("CB")) return "CB";
  if (role === "LB" || role === "RB") return "FB";
  if (role.includes("CM") || role === "CM" || role === "LM" || role === "RM") return "CM";
  if (role === "LW" || role === "RW") return "W";
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

function createInitialPositionState(
  home: InternalLineupPlayer[],
  away: InternalLineupPlayer[],
): PositionState {
  const players = new Map<number, { x: number; y: number }>();
  [...home, ...away].forEach((player) =>
    players.set(player.userPlayerId, { x: player.anchors.x, y: player.anchors.y }),
  );
  return { players, ball: { x: 50, y: 50 } };
}

function extractPositionState(snapshot: MatchSnapshot): PositionState {
  const players = new Map<number, { x: number; y: number }>();
  [...snapshot.homePlayers, ...snapshot.awayPlayers].forEach((player) =>
    players.set(player.userPlayerId, { x: player.x, y: player.y }),
  );
  return { players, ball: { x: snapshot.ball.x, y: snapshot.ball.y } };
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
  });

  awayLineup.forEach((player) => {
    const next = {
      x: player.anchors.x,
      y: clamp(5 + player.anchors.y * 0.43, 6, 48),
    };
    player.anchors = next;
    player.x = next.x;
    player.y = next.y;
  });
}

function applyHomeKickoffPair(homeLineup: InternalLineupPlayer[]) {
  const homeKickoff = homeLineup.find((p) => p.role === "ST") ?? homeLineup[0];
  const homeKickoffPartner =
    homeLineup.find((p) => p.userPlayerId !== homeKickoff.userPlayerId && p.role !== "GK") ??
    homeLineup[1] ??
    homeKickoff;

  homeKickoff.anchors = { x: 50, y: 51 };
  homeKickoff.x = 50;
  homeKickoff.y = 51;
  homeKickoffPartner.anchors = { x: 54, y: 54 };
  homeKickoffPartner.x = 54;
  homeKickoffPartner.y = 54;

  return { homeKickoff, homeKickoffPartner };
}

function applyAwayKickoffPair(awayLineup: InternalLineupPlayer[]) {
  const awayKickoff = awayLineup.find((p) => p.role === "ST") ?? awayLineup[0];
  const awayKickoffPartner =
    awayLineup.find((p) => p.userPlayerId !== awayKickoff.userPlayerId && p.role !== "GK") ??
    awayLineup[1] ??
    awayKickoff;

  awayKickoff.anchors = { x: 50, y: 49 };
  awayKickoff.x = 50;
  awayKickoff.y = 49;
  awayKickoffPartner.anchors = { x: 46, y: 46 };
  awayKickoffPartner.x = 46;
  awayKickoffPartner.y = 46;

  return { awayKickoff, awayKickoffPartner };
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
    const anchors =
      side === "home" ? { x: slot.x, y: slot.y } : { x: 100 - slot.x, y: 100 - slot.y };
    return {
      userPlayerId: picked.userPlayerId,
      playerId: picked.playerId,
      teamId: team.id,
      side,
      role: slot.role,
      displayRole: slot.label,
      name: picked.name,
      shortName: shortenName(picked.name),
      avatarUrl: picked.avatarUrl,
      x: anchors.x,
      y: anchors.y,
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
  return { event, label, teamSide, actorPlayerId, secondaryPlayerId, skill };
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
