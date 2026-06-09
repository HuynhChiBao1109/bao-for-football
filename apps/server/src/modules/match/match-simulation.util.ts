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

export const TICKS_PER_MINUTE = 4;
export const FRAME_DURATION_MS = 420;
export const FRAMES_PER_ACTION = 5;
export const ACTIONS_PER_HALF = 14;

type Side = "home" | "away";
type MatchStep =
  | "first_half_start"
  | "play"
  | "half_time"
  | "second_half_start"
  | "full_time";
type PlayActionType = "pass" | "shoot" | "block" | "goal" | "save";

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

export function simulateMatch(
  homeTeam: SimulationTeamInput,
  awayTeam: SimulationTeamInput,
  seedValue: number,
): MatchSimulationResult {
  const random = createSeededRandom(seedValue);
  const homeLineup = selectLineup(homeTeam, "home");
  const awayLineup = selectLineup(awayTeam, "away");
  const statsMap = new Map<number, SimulationPlayerStatsDraft>();

  [...homeLineup, ...awayLineup].forEach((player) => {
    statsMap.set(player.userPlayerId, createEmptyStats(player.userPlayerId));
  });

  const timeline: MatchSnapshot[] = [];
  const events: SimulationEventDraft[] = [];
  let homeScore = 0;
  let awayScore = 0;
  let frameId = 0;
  let positionState = createInitialPositionState(homeLineup, awayLineup);

  const pushFrames = (input: {
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
  }) => {
    for (let tick = 0; tick < input.count; tick += 1) {
      const ball = input.ballPath[Math.min(tick, input.ballPath.length - 1)] ?? {
        x: input.ballOwner.anchors.x,
        y: input.ballOwner.anchors.y,
      };
      const snapshot = buildSnapshot({
        frameId,
        minute: input.minute,
        second: input.minute * 60 + tick * 12,
        tick,
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

  const homeKickoff = homeLineup.find((p) => p.role === "ST") ?? homeLineup[0];
  const awayKickoff = awayLineup.find((p) => p.role === "ST") ?? awayLineup[0];

  pushEvent(events, EMatchEvent.FIRST_HALF_START, 0, homeTeam.id, homeKickoff.userPlayerId, null, {
    label: "Bat dau hiep 1",
  });
  pushFrames({
    count: FRAMES_PER_ACTION,
    minute: 0,
    matchStep: "first_half_start",
    phase: "first_half",
    possession: "home",
    ballOwner: homeKickoff,
    ballPath: buildKickoffPath(homeKickoff),
    highlight: createHighlight(EMatchEvent.FIRST_HALF_START, "Bat dau hiep 1", "home", homeKickoff.userPlayerId, null, null),
  });

  for (let index = 0; index < ACTIONS_PER_HALF; index += 1) {
    const result = playSimpleAction({
      minute: 1 + index * 3,
      homeTeam,
      awayTeam,
      homeLineup,
      awayLineup,
      homeScore,
      awayScore,
      statsMap,
      events,
      random,
    });
    homeScore = result.homeScore;
    awayScore = result.awayScore;
    pushActionFrames(pushFrames, result, "first_half", 1 + index * 3);
  }

  pushEvent(events, EMatchEvent.FIRST_HALF_END, 45, null, null, null, { label: "Het hiep 1" });
  pushFrames({
    count: FRAMES_PER_ACTION,
    minute: 45,
    matchStep: "half_time",
    phase: "half_time",
    possession: "home",
    ballOwner: homeKickoff,
    ballPath: fixedBallPath(50, 50),
    highlight: createHighlight(EMatchEvent.FIRST_HALF_END, "Het hiep 1", null, null, null, null),
  });

  pushEvent(events, EMatchEvent.SECOND_HALF_START, 46, awayTeam.id, awayKickoff.userPlayerId, null, {
    label: "Bat dau hiep 2",
  });
  pushFrames({
    count: FRAMES_PER_ACTION,
    minute: 46,
    matchStep: "second_half_start",
    phase: "second_half",
    possession: "away",
    ballOwner: awayKickoff,
    ballPath: buildKickoffPath(awayKickoff),
    highlight: createHighlight(EMatchEvent.SECOND_HALF_START, "Bat dau hiep 2", "away", awayKickoff.userPlayerId, null, null),
  });

  for (let index = 0; index < ACTIONS_PER_HALF; index += 1) {
    const minute = 47 + index * 3;
    const result = playSimpleAction({
      minute,
      homeTeam,
      awayTeam,
      homeLineup,
      awayLineup,
      homeScore,
      awayScore,
      statsMap,
      events,
      random,
    });
    homeScore = result.homeScore;
    awayScore = result.awayScore;
    pushActionFrames(pushFrames, result, "second_half", minute);
  }

  pushEvent(events, EMatchEvent.MATCH_END, 90, null, null, null, {
    label: "Het tran",
    homeScore,
    awayScore,
  });
  pushFrames({
    count: FRAMES_PER_ACTION,
    minute: 90,
    matchStep: "full_time",
    phase: "full_time",
    possession: "home",
    ballOwner: homeKickoff,
    ballPath: fixedBallPath(50, 50),
    highlight: createHighlight(EMatchEvent.MATCH_END, "Het tran", null, null, null, null),
  });

  finalizeRatings(statsMap);
  const strip = (lineup: InternalLineupPlayer[]): MatchRenderPlayer[] =>
    lineup.map(({ anchors: _a, raw: _r, ...player }) => ({
      ...player,
      hasBall: false,
      activeSkill: null,
    }));

  return {
    timeline,
    events,
    playerStats: Array.from(statsMap.values()),
    homeLineup: strip(homeLineup),
    awayLineup: strip(awayLineup),
    homeScore,
    awayScore,
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
      action = makeAction("block", EMatchEvent.INTERCEPTION, `${defender.shortName} cat duong chuyen`, possession, actor, receiver, defender, keeper, null);
      pushEvent(input.events, EMatchEvent.INTERCEPTION, input.minute, defendingTeam.id, defender.userPlayerId, actor.userPlayerId, { label: action.label });
      return finishAction(input, action, homeScore, awayScore);
    }
    action = makeAction("pass", EMatchEvent.PASS, `${actor.shortName} chuyen bong`, possession, actor, receiver, defender, keeper, null);
    pushEvent(input.events, EMatchEvent.PASS, input.minute, attackingTeam.id, actor.userPlayerId, receiver.userPlayerId, { label: action.label });
  } else if (roll < 0.62) {
    const skill = tryActivateSkill(actor.raw.skills, actor.role, "dribble", input.random);
    const activation = skill ? resolveSkillActivation(skill, createSkillContext(actor, defender, keeper, input.random)) : null;
    const success =
      activation?.dribbleSuccess ??
      actor.raw.stats.dribbling + actor.raw.stats.balance * 0.25 + (activation?.attackBonus ?? 0) + input.random() * 24 >
        defender.raw.stats.tackle + defender.raw.stats.speed * 0.2 - (activation?.defensePenalty ?? 0) + 4;

    addDribble(input.statsMap, actor.userPlayerId, success);
    if (!success) addTackle(input.statsMap, defender.userPlayerId);
    action = makeAction(success ? "pass" : "block", EMatchEvent.DRIBBLE, skill ? `${actor.shortName} dung ${getSkillLabel(skill)}` : `${actor.shortName} qua nguoi`, possession, actor, success ? partner : null, defender, keeper, skill);
    if (skill) pushSkillEvent(input.events, input.minute, attackingTeam.id, actor.userPlayerId, defender.userPlayerId, action);
    pushEvent(input.events, EMatchEvent.DRIBBLE, input.minute, attackingTeam.id, actor.userPlayerId, defender.userPlayerId, {
      label: action.label,
      success,
      skill,
      skillLabel: action.skillLabel,
    });
  } else if (roll < 0.76 + shotBias * 0.18) {
    const skill = tryActivateSkill(actor.raw.skills, actor.role, "shoot", input.random);
    const activation = skill ? resolveSkillActivation(skill, createSkillContext(actor, defender, keeper, input.random)) : null;
    const shotSuccess =
      actor.raw.stats.shoot + actor.raw.stats.dribbling * 0.3 + (activation?.attackBonus ?? 0) + input.random() * 30 >
      defender.raw.stats.tackle * 0.45 + keeper.raw.stats.gkKeeping + keeper.raw.stats.gkReflex * 0.35 - (activation?.defensePenalty ?? 0) + 10;

    addShot(input.statsMap, actor.userPlayerId, shotSuccess);
    if (skill) pushSkillEvent(input.events, input.minute, attackingTeam.id, actor.userPlayerId, keeper.userPlayerId, makeAction("shoot", EMatchEvent.SKILL_USED, `${actor.shortName} dung ${getSkillLabel(skill)}`, possession, actor, partner, defender, keeper, skill));

    if (shotSuccess && input.random() > (skill === EPlayerSkill.SHOOT_THUNDER ? 0.42 : 0.55)) {
      if (possession === "home") homeScore += 1;
      else awayScore += 1;
      addGoal(input.statsMap, actor.userPlayerId, partner?.userPlayerId ?? null);
      action = makeAction("goal", EMatchEvent.GOAL, `${actor.shortName} ghi ban!`, possession, actor, partner, defender, keeper, skill);
      pushEvent(input.events, EMatchEvent.GOAL, input.minute, attackingTeam.id, actor.userPlayerId, partner?.userPlayerId ?? null, {
        label: action.label,
        homeScore,
        awayScore,
        skill,
        skillLabel: action.skillLabel,
      });
    } else if (input.random() > 0.5) {
      action = makeAction("save", EMatchEvent.GOALKEEPER_SAVE, `${keeper.shortName} cuu thua`, possession, actor, partner, defender, keeper, skill);
      pushEvent(input.events, EMatchEvent.GOALKEEPER_SAVE, input.minute, defendingTeam.id, keeper.userPlayerId, actor.userPlayerId, {
        label: action.label,
        skill,
        skillLabel: action.skillLabel,
      });
    } else {
      addTackle(input.statsMap, defender.userPlayerId);
      action = makeAction("block", EMatchEvent.BLOCK, `${defender.shortName} chan bong`, possession, actor, partner, defender, keeper, skill);
      pushEvent(input.events, EMatchEvent.BLOCK, input.minute, defendingTeam.id, defender.userPlayerId, actor.userPlayerId, {
        label: action.label,
        skill,
        skillLabel: action.skillLabel,
      });
    }
    pushEvent(input.events, EMatchEvent.SHOOT, input.minute, attackingTeam.id, actor.userPlayerId, null, {
      label: `${actor.shortName} sut`,
      skill,
      skillLabel: action.skillLabel,
    });
  } else {
    const receiver = partner ?? actor;
    addPass(input.statsMap, actor.userPlayerId, true);
    action = makeAction("pass", EMatchEvent.PASS, `${actor.shortName} giu nhip va chuyen bong`, possession, actor, receiver, defender, keeper, null);
    pushEvent(input.events, EMatchEvent.PASS, input.minute, attackingTeam.id, actor.userPlayerId, receiver.userPlayerId, { label: action.label });
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
    return buildThunderShotTrajectory(actorPos.x, actorPos.y, goalY, action.possession, FRAMES_PER_ACTION, random).slice(1);
  }
  if (action.skill === EPlayerSkill.DRIBBLE_MAGIC) {
    const target = action.partner?.anchors ?? {
      x: clamp(actorPos.x + (random() > 0.5 ? 12 : -12), 8, 92),
      y: clamp(actorPos.y + (action.possession === "home" ? -12 : 12), 8, 92),
    };
    return buildMagicDribbleTrajectory(actorPos.x, actorPos.y, target.x, target.y, FRAMES_PER_ACTION, random).slice(1);
  }
  if (action.type === "pass" && action.partner) {
    return pathBetween(actorPos, action.partner.anchors);
  }
  if (action.type === "goal" || action.type === "save" || action.type === "block" || action.type === "shoot") {
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
  const ownerId = input.ballOwner.userPlayerId;
  const homePlayers = projectPlayers({
    lineup: input.homeLineup,
    possession: input.possession,
    ball: input.ball,
    ballOwnerId: ownerId,
    focusId: input.focusId,
    pressId: input.pressId,
    matchStep: input.matchStep,
    positionState: input.positionState,
  });
  const awayPlayers = projectPlayers({
    lineup: input.awayLineup,
    possession: input.possession,
    ball: input.ball,
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
      x: input.ball.x,
      y: input.ball.y,
      fromX: prevBall.x,
      fromY: prevBall.y,
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

    if (input.matchStep === "half_time" || input.matchStep === "full_time") {
      target = { x: 47 + (index % 4) * 2, y: 50 + Math.floor(index / 4) * 1.5 };
    } else if (hasBall) {
      target = { x: input.ball.x, y: input.ball.y };
      intent = input.matchStep.includes("start") ? "kickoff" : "run";
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

    const speedFactor = getRoleMoveFactor(player, intent);
    const toX = clamp(lerp(prev.x, target.x, speedFactor), 5, 95);
    const toY = clamp(lerp(prev.y, target.y, speedFactor), 5, 95);
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
      x: toX,
      y: toY,
      stamina: player.stamina,
      activeSkill: null,
      hasBall: false,
      move: { fromX: prev.x, fromY: prev.y, toX, toY, intent },
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
        x: clamp(player.anchors.x + (sameFlank ? (player.anchors.x < 50 ? -2 : 2) : (50 - player.anchors.x) * 0.16), 8, 92),
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
      y: clamp(direction < 0 ? Math.min(player.anchors.y, ball.y + direction * 16) : Math.max(player.anchors.y, ball.y + direction * 16), 7, 93),
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
        y: clamp(lerp(player.anchors.y, ball.y + direction * 13, danger > 0.55 ? 0.42 : 0.24), 14, 86),
      },
      intent: "cover",
    };
  }

  if (role === "FB") {
    return {
      target: {
        x: clamp(sameFlank ? lerp(player.anchors.x, ball.x, 0.42) : player.anchors.x + (50 - player.anchors.x) * 0.16, 7, 93),
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
        x: clamp(sameFlank ? lerp(player.anchors.x, ball.x, 0.28) : lerp(player.anchors.x, 50, 0.24), 8, 92),
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
  const athletic = clamp((player.raw.stats.speed + player.raw.stats.acceleration) / 220, 0.28, 0.7);
  const roleBase =
    role === "GK" ? 0.24 :
    role === "CB" ? 0.34 :
    role === "FB" ? 0.42 :
    role === "CM" ? 0.4 :
    role === "W" ? 0.48 :
    0.46;
  const intentBoost = intent === "press" || intent === "run" || intent === "overlap" ? 0.1 : 0;
  return clamp(roleBase + athletic * 0.28 + intentBoost, 0.24, 0.76);
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

function createInitialPositionState(home: InternalLineupPlayer[], away: InternalLineupPlayer[]): PositionState {
  const players = new Map<number, { x: number; y: number }>();
  [...home, ...away].forEach((player) => players.set(player.userPlayerId, { x: player.anchors.x, y: player.anchors.y }));
  return { players, ball: { x: 50, y: 50 } };
}

function extractPositionState(snapshot: MatchSnapshot): PositionState {
  const players = new Map<number, { x: number; y: number }>();
  [...snapshot.homePlayers, ...snapshot.awayPlayers].forEach((player) => players.set(player.userPlayerId, { x: player.x, y: player.y }));
  return { players, ball: { x: snapshot.ball.x, y: snapshot.ball.y } };
}

function selectLineup(team: SimulationTeamInput, side: Side): InternalLineupPlayer[] {
  const formation = FORMATION_LAYOUTS[team.formation ?? ETeamFormation.F433] ?? FORMATION_LAYOUTS[ETeamFormation.F433];
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
    const anchors = side === "home" ? { x: slot.x, y: slot.y } : { x: 100 - slot.x, y: 100 - slot.y };
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
  if (slot.role === "GK") return positionScore * 100 + player.stats.gkKeeping + player.stats.gkReflex;
  return positionScore * 100 + player.stats.shoot * 0.55 + player.stats.pass * 0.35 + player.stats.speed * 0.1;
}

function pickAttacker(lineup: InternalLineupPlayer[], random: () => number) {
  const pool = lineup.filter((player) => player.role !== "GK");
  const weighted = pool.flatMap((player) => {
    const weight = player.role.includes("ST") || player.role.includes("W") ? 3 : player.role.includes("M") ? 2 : 1;
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
  const weighted = pool.flatMap((player) => Array.from({ length: player.role.includes("B") || player.role.includes("CB") ? 3 : 1 }, () => player));
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

function addGoal(stats: Map<number, SimulationPlayerStatsDraft>, scorerId: number, assistId: number | null) {
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
