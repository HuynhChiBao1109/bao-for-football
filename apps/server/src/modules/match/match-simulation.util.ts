import { EPlayerSkill } from "src/modules/player/enum/player-skill.enum";
import { ETeamFormation } from "src/modules/team/enums/team-formation.enum";
import { EMatchEvent } from "./enums";

type Side = "home" | "away";

export type SimulationRosterPlayer = {
  userPlayerId: bigint;
  playerId: bigint;
  teamId: bigint;
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
  id: bigint;
  name: string;
  formation: ETeamFormation | null;
  passRatio: number;
  shotRatio: number;
  pressure: number;
  players: SimulationRosterPlayer[];
};

export type MatchRenderPlayer = {
  userPlayerId: string;
  playerId: string;
  teamId: string;
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
};

export type MatchSnapshot = {
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
    ownerPlayerId: string | null;
    speed: number;
  };
  homePlayers: MatchRenderPlayer[];
  awayPlayers: MatchRenderPlayer[];
  highlight: {
    event: EMatchEvent | null;
    label: string;
    teamSide: Side | null;
    actorPlayerId: string | null;
    secondaryPlayerId: string | null;
    skill: EPlayerSkill | null;
  };
};

export type SimulationEventDraft = {
  event: EMatchEvent;
  minute: number;
  teamId: bigint | null;
  actorPlayerId: bigint | null;
  secondaryPlayerId: bigint | null;
  payload: Record<string, unknown> | null;
};

export type SimulationPlayerStatsDraft = {
  playerId: bigint;
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

type FormationSlot = {
  role: string;
  label: string;
  x: number;
  y: number;
};

type InternalLineupPlayer = MatchRenderPlayer & {
  anchors: { x: number; y: number };
  raw: SimulationRosterPlayer;
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

const FIELD_WIDTH = 100;
const FIELD_HEIGHT = 100;

export function simulateMatch(
  homeTeam: SimulationTeamInput,
  awayTeam: SimulationTeamInput,
  seedValue: number,
): MatchSimulationResult {
  const random = createSeededRandom(seedValue);
  const homeLineup = selectLineup(homeTeam, "home");
  const awayLineup = selectLineup(awayTeam, "away");

  const statsMap = new Map<string, SimulationPlayerStatsDraft>();
  [...homeLineup, ...awayLineup].forEach((player) => {
    statsMap.set(player.userPlayerId, {
      playerId: BigInt(player.userPlayerId),
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
    });
  });

  const timeline: MatchSnapshot[] = [];
  const events: SimulationEventDraft[] = [];

  let homeScore = 0;
  let awayScore = 0;

  const homeStrength = buildTeamStrength(homeLineup, homeTeam);
  const awayStrength = buildTeamStrength(awayLineup, awayTeam);

  pushEvent(events, EMatchEvent.MATCH_START, 0, null, null, null, {
    homeTeamId: String(homeTeam.id),
    awayTeamId: String(awayTeam.id),
  });
  pushEvent(events, EMatchEvent.FIRST_HALF_START, 0, homeTeam.id, null, null, null);

  timeline.push(
    buildSnapshot({
      minute: 0,
      second: 0,
      phase: "first_half",
      homeScore,
      awayScore,
      possession: "home",
      homeLineup,
      awayLineup,
      ballOwner: homeLineup.find((player) => player.role === "ST") ?? homeLineup[0],
      highlight: {
        event: EMatchEvent.MATCH_START,
        label: "Kick-off",
        teamSide: null,
        actorPlayerId: null,
        secondaryPlayerId: null,
        skill: null,
      },
      random,
    }),
  );

  for (let minute = 1; minute <= 90; minute += 1) {
    const phase =
      minute < 46
        ? "first_half"
        : minute === 46
          ? "second_half"
          : minute < 90
            ? "second_half"
            : "full_time";
    const possession = decidePossession(homeStrength.midfield, awayStrength.midfield, random);
    const attackingTeam = possession === "home" ? homeTeam : awayTeam;
    const defendingTeam = possession === "home" ? awayTeam : homeTeam;
    const attackingLineup = possession === "home" ? homeLineup : awayLineup;
    const defendingLineup = possession === "home" ? awayLineup : homeLineup;

    const ballOwner = pickAttackingPlayer(attackingLineup, random);
    const supportPlayer = pickSupportPlayer(attackingLineup, ballOwner.userPlayerId, random);
    const defender = pickDefender(defendingLineup, random);
    const keeper = defendingLineup.find((player) => player.role === "GK") ?? defendingLineup[0];

    let highlight: MatchSnapshot["highlight"] = {
      event: null,
      label: "Build-up",
      teamSide: possession,
      actorPlayerId: ballOwner.userPlayerId,
      secondaryPlayerId: supportPlayer?.userPlayerId ?? null,
      skill: null,
    };

    incrementMinutes(statsMap, attackingLineup, defendingLineup);
    incrementPossessionStats(statsMap, attackingLineup, random);

    if (minute === 45) {
      pushEvent(events, EMatchEvent.FIRST_HALF_END, minute, null, null, null, null);
      highlight = {
        ...highlight,
        event: EMatchEvent.FIRST_HALF_END,
        label: "Half-time",
        teamSide: null,
      };
    } else if (minute === 46) {
      pushEvent(events, EMatchEvent.SECOND_HALF_START, minute, attackingTeam.id, null, null, null);
      highlight = {
        ...highlight,
        event: EMatchEvent.SECOND_HALF_START,
        label: "Second half",
        teamSide: null,
      };
    } else {
      const actionRoll = random();
      if (actionRoll > 0.62) {
        const skillActivated =
          ballOwner.raw.skills.includes(EPlayerSkill.SHOOT_THUNDER) && random() > 0.76;
        const chanceScore =
          computeAttackScore(
            ballOwner.raw,
            supportPlayer?.raw ?? null,
            attackingTeam,
            defendingTeam,
          ) +
          (skillActivated ? 14 : 0) -
          computeDefenseScore(defender.raw, keeper.raw);

        const scorer = ballOwner;
        const isGoal = chanceScore + random() * 30 > 28;
        addShot(statsMap, scorer.userPlayerId, isGoal);

        if (skillActivated) {
          highlight = {
            ...highlight,
            label: "Thunder Shot",
            skill: EPlayerSkill.SHOOT_THUNDER,
          };
        }

        if (isGoal) {
          if (possession === "home") {
            homeScore += 1;
          } else {
            awayScore += 1;
          }

          addGoal(statsMap, scorer.userPlayerId, supportPlayer?.userPlayerId ?? null);
          pushEvent(
            events,
            EMatchEvent.GOAL,
            minute,
            attackingTeam.id,
            BigInt(scorer.userPlayerId),
            supportPlayer ? BigInt(supportPlayer.userPlayerId) : null,
            {
              skill: skillActivated ? EPlayerSkill.SHOOT_THUNDER : null,
              homeScore,
              awayScore,
            },
          );
          highlight = {
            event: EMatchEvent.GOAL,
            label: `${scorer.shortName} goal`,
            teamSide: possession,
            actorPlayerId: scorer.userPlayerId,
            secondaryPlayerId: supportPlayer?.userPlayerId ?? null,
            skill: skillActivated ? EPlayerSkill.SHOOT_THUNDER : null,
          };
        } else if (random() > 0.5) {
          pushEvent(
            events,
            EMatchEvent.CORNER_AWARDED,
            minute,
            attackingTeam.id,
            BigInt(scorer.userPlayerId),
            null,
            null,
          );
          highlight = {
            event: EMatchEvent.CORNER_AWARDED,
            label: "Corner",
            teamSide: possession,
            actorPlayerId: scorer.userPlayerId,
            secondaryPlayerId: null,
            skill: skillActivated ? EPlayerSkill.SHOOT_THUNDER : null,
          };
        }
      } else if (actionRoll < 0.14) {
        addFoul(statsMap, defender.userPlayerId, ballOwner.userPlayerId);
        const cardRoll = random();
        const event = cardRoll > 0.82 ? EMatchEvent.YELLOW_CARD : EMatchEvent.FOUL;
        if (event === EMatchEvent.YELLOW_CARD) {
          addYellow(statsMap, defender.userPlayerId);
        }

        pushEvent(
          events,
          event,
          minute,
          defendingTeam.id,
          BigInt(defender.userPlayerId),
          BigInt(ballOwner.userPlayerId),
          null,
        );

        highlight = {
          event,
          label: event === EMatchEvent.YELLOW_CARD ? "Yellow card" : "Foul",
          teamSide: possession === "home" ? "away" : "home",
          actorPlayerId: defender.userPlayerId,
          secondaryPlayerId: ballOwner.userPlayerId,
          skill: null,
        };
      } else if (actionRoll < 0.22) {
        addOffside(statsMap, ballOwner.userPlayerId);
        pushEvent(
          events,
          EMatchEvent.OFFSIDE,
          minute,
          attackingTeam.id,
          BigInt(ballOwner.userPlayerId),
          null,
          null,
        );
        highlight = {
          event: EMatchEvent.OFFSIDE,
          label: "Offside",
          teamSide: possession,
          actorPlayerId: ballOwner.userPlayerId,
          secondaryPlayerId: null,
          skill: null,
        };
      }
    }

    timeline.push(
      buildSnapshot({
        minute,
        second: minute * 20,
        phase,
        homeScore,
        awayScore,
        possession,
        homeLineup,
        awayLineup,
        ballOwner,
        highlight,
        random,
      }),
    );
  }

  pushEvent(events, EMatchEvent.MATCH_END, 90, null, null, null, {
    homeScore,
    awayScore,
  });

  finalizeRatings(statsMap);

  return {
    timeline,
    events,
    playerStats: Array.from(statsMap.values()),
    homeLineup,
    awayLineup,
    homeScore,
    awayScore,
  };
}

function selectLineup(team: SimulationTeamInput, side: Side): InternalLineupPlayer[] {
  const formation =
    FORMATION_LAYOUTS[team.formation ?? ETeamFormation.F433] ??
    FORMATION_LAYOUTS[ETeamFormation.F433];
  const pool = [...team.players];
  const lineup: InternalLineupPlayer[] = [];

  for (const slot of formation) {
    const bestIndex = pool.reduce(
      (best, player, index) => {
        const score = playerFitScore(player, slot);
        return score > best.score ? { index, score } : best;
      },
      { index: 0, score: Number.NEGATIVE_INFINITY },
    ).index;

    const picked = pool.splice(bestIndex, 1)[0] ?? team.players[lineup.length];
    const anchors = slotAnchors(slot, side);
    lineup.push({
      userPlayerId: String(picked.userPlayerId),
      playerId: String(picked.playerId),
      teamId: String(team.id),
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
      anchors,
      raw: picked,
    });
  }

  return lineup;
}

function playerFitScore(player: SimulationRosterPlayer, slot: FormationSlot): number {
  const preferred = SLOT_POSITION_MAP[slot.role] ?? [slot.label];
  const positionScore = player.positions.reduce((best, item) => {
    const normalized = String(item.position || "").toUpperCase();
    if (!preferred.includes(normalized)) {
      return best;
    }
    return Math.max(best, Number(item.effect ?? 0));
  }, 0);

  const attack = player.stats.shoot + player.stats.dribbling + player.stats.speed;
  const defend = player.stats.tackle + player.stats.balance + player.stats.stamina;
  const playmaking = player.stats.pass + player.stats.longPass + player.stats.vision;
  const keeping = player.stats.gkKeeping + player.stats.gkReflex + player.stats.gkReach;

  if (slot.role === "GK") {
    return positionScore * 100 + keeping;
  }
  if (["LB", "RB", "LCB", "RCB"].includes(slot.role)) {
    return positionScore * 100 + defend * 0.8 + player.stats.speed * 0.3;
  }
  if (["LCM", "CM", "RCM", "LM", "RM"].includes(slot.role)) {
    return positionScore * 100 + playmaking * 0.7 + defend * 0.3 + player.stats.dribbling * 0.2;
  }
  return positionScore * 100 + attack * 0.8 + playmaking * 0.2;
}

function slotAnchors(slot: FormationSlot, side: Side) {
  if (side === "home") {
    return { x: slot.x, y: slot.y };
  }
  return { x: FIELD_WIDTH - slot.x, y: FIELD_HEIGHT - slot.y };
}

function shortenName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) {
    return name;
  }
  return `${parts[0].slice(0, 1)}. ${parts[parts.length - 1]}`;
}

function buildTeamStrength(lineup: InternalLineupPlayer[], team: SimulationTeamInput) {
  const attackers = lineup.filter((player) =>
    ["LW", "RW", "ST", "LST", "RST"].includes(player.role),
  );
  const midfielders = lineup.filter((player) =>
    ["LM", "RM", "LCM", "CM", "RCM"].includes(player.role),
  );
  const defenders = lineup.filter((player) => ["LB", "RB", "LCB", "RCB"].includes(player.role));
  const keeper = lineup.find((player) => player.role === "GK") ?? lineup[0];

  return {
    attack:
      average(
        attackers.map(
          (player) => player.raw.stats.shoot + player.raw.stats.dribbling + player.raw.stats.speed,
        ),
      ) +
      team.shotRatio * 0.2,
    midfield:
      average(
        midfielders.map(
          (player) => player.raw.stats.pass + player.raw.stats.vision + player.raw.stats.stamina,
        ),
      ) +
      team.passRatio * 0.18,
    defense:
      average(
        defenders.map(
          (player) => player.raw.stats.tackle + player.raw.stats.balance + player.raw.stats.stamina,
        ),
      ) +
      team.pressure * 0.25 +
      keeper.raw.stats.gkKeeping,
  };
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function decidePossession(homeMidfield: number, awayMidfield: number, random: () => number): Side {
  const total = homeMidfield + awayMidfield || 1;
  return random() < homeMidfield / total ? "home" : "away";
}

function pickAttackingPlayer(lineup: InternalLineupPlayer[], random: () => number) {
  const weighted = lineup
    .filter((player) => player.role !== "GK")
    .map((player) => ({
      player,
      weight: player.raw.stats.shoot + player.raw.stats.dribbling + player.raw.stats.speed,
    }));
  return pickWeighted(weighted, random) ?? lineup[0];
}

function pickSupportPlayer(
  lineup: InternalLineupPlayer[],
  excludeId: string,
  random: () => number,
) {
  const weighted = lineup
    .filter((player) => player.userPlayerId !== excludeId)
    .map((player) => ({
      player,
      weight: player.raw.stats.pass + player.raw.stats.vision + player.raw.stats.dribbling,
    }));
  return pickWeighted(weighted, random) ?? null;
}

function pickDefender(lineup: InternalLineupPlayer[], random: () => number) {
  const weighted = lineup.map((player) => ({
    player,
    weight: player.raw.stats.tackle + player.raw.stats.balance + player.raw.stats.stamina,
  }));
  return pickWeighted(weighted, random) ?? lineup[0];
}

function pickWeighted<T>(
  weighted: Array<{ player: T; weight: number }>,
  random: () => number,
): T | null {
  const total = weighted.reduce((sum, item) => sum + Math.max(item.weight, 1), 0);
  if (!total) {
    return null;
  }

  let cursor = random() * total;
  for (const item of weighted) {
    cursor -= Math.max(item.weight, 1);
    if (cursor <= 0) {
      return item.player;
    }
  }
  return weighted[weighted.length - 1]?.player ?? null;
}

function computeAttackScore(
  actor: SimulationRosterPlayer,
  support: SimulationRosterPlayer | null,
  attackingTeam: SimulationTeamInput,
  defendingTeam: SimulationTeamInput,
) {
  return (
    actor.stats.shoot * 0.56 +
    actor.stats.dribbling * 0.24 +
    actor.stats.speed * 0.14 +
    (support ? support.stats.pass * 0.12 + support.stats.vision * 0.08 : 0) +
    attackingTeam.shotRatio * 0.28 +
    attackingTeam.passRatio * 0.12 -
    defendingTeam.pressure * 0.12
  );
}

function computeDefenseScore(defender: SimulationRosterPlayer, keeper: SimulationRosterPlayer) {
  return (
    defender.stats.tackle * 0.32 +
    defender.stats.balance * 0.18 +
    defender.stats.speed * 0.12 +
    keeper.stats.gkKeeping * 0.28 +
    keeper.stats.gkReflex * 0.2
  );
}

function incrementMinutes(
  statsMap: Map<string, SimulationPlayerStatsDraft>,
  homeLineup: InternalLineupPlayer[],
  awayLineup: InternalLineupPlayer[],
) {
  [...homeLineup, ...awayLineup].forEach((player) => {
    const current = statsMap.get(player.userPlayerId);
    if (current) {
      current.minutesPlayed += 1;
    }
  });
}

function incrementPossessionStats(
  statsMap: Map<string, SimulationPlayerStatsDraft>,
  attackingLineup: InternalLineupPlayer[],
  random: () => number,
) {
  attackingLineup.forEach((player) => {
    const row = statsMap.get(player.userPlayerId);
    if (!row) {
      return;
    }
    const passDelta = random() > 0.42 ? 1 : 0;
    const dribbleDelta = player.role !== "GK" && random() > 0.86 ? 1 : 0;
    const tackleDelta =
      ["LB", "RB", "LCB", "RCB", "CM", "LCM", "RCM"].includes(player.role) && random() > 0.9
        ? 1
        : 0;
    row.passes += passDelta;
    row.dribbles += dribbleDelta;
    row.tackles += tackleDelta;
    row.passAccuracy += passDelta;
    row.dribbleAccuracy += dribbleDelta;
    row.tackleAccuracy += tackleDelta;
  });
}

function addShot(
  statsMap: Map<string, SimulationPlayerStatsDraft>,
  playerId: string,
  onTarget: boolean,
) {
  const row = statsMap.get(playerId);
  if (!row) {
    return;
  }
  row.shots += 1;
  row.shotAccuracy += onTarget ? 1 : 0;
}

function addGoal(
  statsMap: Map<string, SimulationPlayerStatsDraft>,
  scorerId: string,
  assistId: string | null,
) {
  const scorer = statsMap.get(scorerId);
  if (scorer) {
    scorer.goals += 1;
  }
  if (assistId) {
    const assister = statsMap.get(assistId);
    if (assister) {
      assister.assists += 1;
    }
  }
}

function addFoul(
  statsMap: Map<string, SimulationPlayerStatsDraft>,
  defenderId: string,
  attackerId: string,
) {
  const defender = statsMap.get(defenderId);
  const attacker = statsMap.get(attackerId);
  if (defender) {
    defender.foulsCommitted += 1;
  }
  if (attacker) {
    attacker.foulsSuffered += 1;
  }
}

function addYellow(statsMap: Map<string, SimulationPlayerStatsDraft>, playerId: string) {
  const row = statsMap.get(playerId);
  if (row) {
    row.yellowCards += 1;
  }
}

function addOffside(statsMap: Map<string, SimulationPlayerStatsDraft>, playerId: string) {
  const row = statsMap.get(playerId);
  if (row) {
    row.offsides += 1;
  }
}

function finalizeRatings(statsMap: Map<string, SimulationPlayerStatsDraft>) {
  statsMap.forEach((row) => {
    row.rating = Number(
      Math.max(
        5.8,
        Math.min(
          10,
          6 +
            row.goals * 1.35 +
            row.assists * 0.85 +
            row.shotAccuracy * 0.12 +
            row.passAccuracy * 0.02 +
            row.tackleAccuracy * 0.06 +
            row.interceptions * 0.04 -
            row.yellowCards * 0.35 -
            row.redCards * 1.1,
        ),
      ).toFixed(2),
    );
  });
}

function buildSnapshot(input: {
  minute: number;
  second: number;
  phase: MatchSnapshot["phase"];
  homeScore: number;
  awayScore: number;
  possession: Side;
  homeLineup: InternalLineupPlayer[];
  awayLineup: InternalLineupPlayer[];
  ballOwner: InternalLineupPlayer;
  highlight: MatchSnapshot["highlight"];
  random: () => number;
}): MatchSnapshot {
  const {
    minute,
    second,
    phase,
    homeScore,
    awayScore,
    possession,
    homeLineup,
    awayLineup,
    ballOwner,
    highlight,
    random,
  } = input;

  const homePlayers = projectLineup(
    homeLineup,
    minute,
    possession,
    highlight.actorPlayerId,
    random,
  );
  const awayPlayers = projectLineup(
    awayLineup,
    minute,
    possession,
    highlight.actorPlayerId,
    random,
  );
  const owner =
    possession === "home"
      ? (homePlayers.find((player) => player.userPlayerId === ballOwner.userPlayerId) ??
        homePlayers[0])
      : (awayPlayers.find((player) => player.userPlayerId === ballOwner.userPlayerId) ??
        awayPlayers[0]);

  if (highlight.skill) {
    const targetPlayers = possession === "home" ? homePlayers : awayPlayers;
    const skillPlayer = targetPlayers.find(
      (player) => player.userPlayerId === ballOwner.userPlayerId,
    );
    if (skillPlayer) {
      skillPlayer.activeSkill = highlight.skill;
    }
  }

  return {
    minute,
    second,
    clockLabel: `${String(Math.min(minute, 90)).padStart(2, "0")}:${String(second % 60).padStart(2, "0")}`,
    phase,
    homeScore,
    awayScore,
    possession,
    ball: {
      x: clamp(owner.x + (possession === "home" ? 2 : -2), 5, 95),
      y: clamp(owner.y + (possession === "home" ? -2 : 2), 5, 95),
      ownerPlayerId: owner.userPlayerId,
      speed: 4 + Math.floor(random() * 6),
    },
    homePlayers,
    awayPlayers,
    highlight,
  };
}

function projectLineup(
  lineup: InternalLineupPlayer[],
  minute: number,
  possession: Side,
  focusPlayerId: string | null,
  random: () => number,
): MatchRenderPlayer[] {
  return lineup.map((player, index) => {
    const pulse = Math.sin((minute + index) / 5) * 2.2;
    const sway = Math.cos((minute + index) / 4) * 1.7;
    const attackShift = possession === player.side ? -7 : 5;
    const yDirection = player.side === "home" ? 1 : -1;
    const focused = player.userPlayerId === focusPlayerId;
    return {
      ...player,
      x: clamp(
        player.anchors.x + sway + (focused ? (player.side === possession ? 2 : -2) : 0),
        6,
        94,
      ),
      y: clamp(
        player.anchors.y + pulse + attackShift * yDirection + (focused ? -4 * yDirection : 0),
        6,
        94,
      ),
      stamina: Math.max(38, player.stamina - Math.floor(minute / 4) - Math.floor(random() * 2)),
      activeSkill: null,
    };
  });
}

function pushEvent(
  events: SimulationEventDraft[],
  event: EMatchEvent,
  minute: number,
  teamId: bigint | null,
  actorPlayerId: bigint | null,
  secondaryPlayerId: bigint | null,
  payload: Record<string, unknown> | null,
) {
  events.push({ event, minute, teamId, actorPlayerId, secondaryPlayerId, payload });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

function createSeededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
