const path = require("node:path");
process.env.NODE_PATH = path.resolve(__dirname, "..");
require("node:module").Module._initPaths();
require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ATTACKING_STRUCTURE_BALANCE,
  evaluateAttackingStructure,
} = require("../src/modules/match/match-attacking-structure.util.ts");
const {
  collectAttackingSituation,
  generateAttackingOptions,
  runAttackingUtilityAi,
  scoreAttackingOptions,
} = require("../src/modules/match/match-attacking-ai.util.ts");
const {
  generateNextMatchTick,
  prepareMatchKickoffLineups,
} = require("../src/modules/match/match-simulation.util.ts");

function player(id, role, x, y, overrides = {}) {
  return {
    id,
    teamId: overrides.teamId ?? (id >= 20 ? 2 : 1),
    role,
    position: { x, y },
    formationAnchor: overrides.formationAnchor ?? { x, y },
    velocity: overrides.velocity ?? { x: 0, y: 0 },
    facing: overrides.facing ?? { x: 0, y: -1 },
    preferredFoot: overrides.preferredFoot ?? "right",
    stamina: overrides.stamina ?? 0.9,
    stats: {
      pass: 80,
      longPass: 78,
      vision: 82,
      shoot: 74,
      balance: 78,
      dribbling: 76,
      acceleration: 78,
      speed: 79,
      stamina: 82,
      longShots: 68,
      shotPower: 76,
      technique: 78,
      composure: 80,
      ...overrides.stats,
    },
  };
}

function fullTeam() {
  return [
    player(1, "GK", 50, 92),
    player(2, "LB", 12, 74),
    player(3, "CB", 38, 80),
    player(4, "CB", 62, 80),
    player(5, "RB", 88, 74),
    player(6, "CDM", 50, 66),
    player(7, "CM", 38, 55),
    player(8, "CAM", 62, 48),
    player(9, "LW", 10, 38),
    player(10, "RW", 90, 38),
    player(11, "ST", 50, 27),
  ];
}

function situation(overrides = {}) {
  const teammates = overrides.teammates ?? fullTeam();
  const carrier = overrides.carrier ?? teammates.find((item) => item.id === 7);
  return collectAttackingSituation({
    carrier,
    teammates,
    opponents: overrides.opponents ?? [
      player(20, "GK", 50, 4, { teamId: 2 }),
      player(21, "CB", 42, 25, { teamId: 2 }),
      player(22, "CB", 58, 27, { teamId: 2 }),
    ],
    ball: overrides.ball ?? carrier.position,
    side: "home",
    tick: overrides.tick ?? 30,
    possessionTicks: overrides.possessionTicks ?? 12,
    latestEvent: overrides.latestEvent ?? null,
    lastPassStyle: overrides.lastPassStyle ?? null,
    tactics: overrides.tactics ?? {
      risk: 0.45,
      tempo: 0.55,
      directness: 0.45,
      compactness: 0.5,
      shootingPriority: 0.45,
    },
    activeCombination: null,
    actionMemory: overrides.actionMemory ?? null,
  });
}

test("the team keeps width, depth, support and rest defense instead of collapsing on the ball", () => {
  const players = fullTeam();
  const structure = evaluateAttackingStructure({
    side: "home",
    ball: { x: 30, y: 58 },
    carrierId: 3,
    players,
    pressure: 0.35,
    compactness: 0.5,
    directness: 0.45,
    isTransition: false,
  });

  assert.equal(structure.assignments.length, 10);
  assert.ok(structure.shape.ballSupportCount >= 1);
  assert.ok(structure.shape.ballSupportCount <= ATTACKING_STRUCTURE_BALANCE.maximumBallSupports);
  assert.ok(structure.shape.forwardOptionCount >= 1);
  assert.equal(structure.shape.leftWidthCount, 1);
  assert.equal(structure.shape.rightWidthCount, 1);
  assert.ok(structure.shape.depthThreatCount >= 1 && structure.shape.depthThreatCount <= 2);
  assert.ok(structure.shape.restDefenseCount >= 2 && structure.shape.restDefenseCount <= 3);
  assert.ok(
    structure.assignments.every(
      (assignment) =>
        assignment.nearestTeammateDistance >=
        ATTACKING_STRUCTURE_BALANCE.minimumTeammateSpacing - 0.01,
    ),
  );
  assert.ok(structure.assignments.every((assignment) => assignment.formationInfluence > assignment.ballShiftInfluence));
});

test("only the nearest one or two players become direct ball support under pressure", () => {
  const players = fullTeam();
  const structure = evaluateAttackingStructure({
    side: "home",
    ball: { x: 12, y: 52 },
    carrierId: 9,
    players,
    pressure: 0.82,
    compactness: 0.55,
    directness: 0.5,
    isTransition: false,
  });
  const support = structure.assignments.filter((item) => item.supportRole === "BallSupport");

  assert.equal(support.length, 2);
  assert.ok(structure.assignments.filter((item) => item.supportRole === "RestDefense").length >= 2);
  assert.ok(structure.assignments.some((item) => item.supportRole === "WidthProvider"));
  assert.equal(structure.warnings.some((warning) => warning.startsWith("TEAMMATE_SPACING")), false);
});

test("a defender prefers a safe midfield connection over a direct pass that skips lines", () => {
  const carrier = player(1, "CB", 50, 76);
  const dm = player(2, "CDM", 45, 64);
  const cm = player(3, "CM", 58, 54);
  const striker = player(4, "ST", 50, 31, { velocity: { x: 0, y: -3 } });
  const context = situation({
    carrier,
    ball: carrier.position,
    teammates: [carrier, dm, cm, striker, player(5, "LB", 15, 70), player(6, "RB", 85, 70)],
    tactics: { risk: 0.4, tempo: 0.55, directness: 0.35, compactness: 0.5, shootingPriority: 0.4 },
  });
  const decision = runAttackingUtilityAi({ ...context }, () => 0.5);
  const direct = decision.options.find(
    (option) => option.kind === "pass" && option.receiverId === striker.id && option.passStyle === "long",
  );

  assert.ok(direct.pass.skippedLines >= 2);
  assert.equal(direct.pass.directPassAllowed, false);
  assert.match(direct.rejectedReason, /short build-up/);
  assert.equal(decision.selected.kind, "pass");
  assert.ok([dm.id, cm.id].includes(decision.selected.receiverId));
});

test("direct play remains available against a high line when no safe midfield outlet exists", () => {
  const carrier = player(1, "CB", 50, 76, { stats: { longPass: 92, vision: 90 } });
  const striker = player(4, "ST", 50, 48, {
    velocity: { x: 0, y: -4 },
    stats: { acceleration: 91, speed: 92 },
  });
  const context = situation({
    carrier,
    ball: carrier.position,
    teammates: [carrier, striker, player(5, "LB", 12, 72), player(6, "RB", 88, 72)],
    opponents: [
      player(20, "GK", 50, 4, { teamId: 2 }),
      player(21, "CB", 28, 43, { teamId: 2 }),
      player(22, "CB", 72, 45, { teamId: 2 }),
    ],
    tactics: { risk: 0.8, tempo: 0.85, directness: 0.92, compactness: 0.4, shootingPriority: 0.4 },
  });
  const options = scoreAttackingOptions(context, generateAttackingOptions(context));
  const direct = options.find(
    (option) => option.kind === "pass" && option.receiverId === striker.id && option.pass?.directPass,
  );

  assert.ok(direct);
  assert.equal(direct.pass.directPassAllowed, true);
  assert.equal(direct.rejectedReason, undefined);
});

test("Shoot is absent outside the role/attribute range and records explicit penalties inside it", () => {
  const carrier = player(7, "CM", 50, 56, {
    stats: { shoot: 66, longShots: 48, shotPower: 60, technique: 68, composure: 70 },
  });
  const far = situation({ carrier, ball: carrier.position, teammates: [carrier, player(8, "CM", 35, 58)] });
  assert.equal(generateAttackingOptions(far).some((option) => option.kind === "shoot"), false);

  const closer = player(11, "ST", 54, 20, {
    stats: { shoot: 88, longShots: 82, shotPower: 87, technique: 85, composure: 86 },
  });
  const closeSituation = situation({
    carrier: closer,
    ball: closer.position,
    teammates: [closer, player(8, "CAM", 40, 24)],
    opponents: [player(20, "GK", 45, 4, { teamId: 2 })],
  });
  const shot = generateAttackingOptions(closeSituation).find((option) => option.kind === "shoot");

  assert.ok(shot);
  assert.ok(shot.shot.maximumDistance > shot.shot.distanceToGoal);
  assert.ok(shot.shot.distancePenalty >= 0);
  assert.ok(shot.shot.blockedShotPenalty >= 0);
  assert.ok(shot.shot.lowExpectedGoalPenalty >= 0);
});

test("a newly received ball rejects a routine shot during control-and-scan time", () => {
  const carrier = player(11, "ST", 50, 21, {
    stats: { shoot: 82, longShots: 74, shotPower: 82, technique: 80, composure: 80 },
  });
  const context = situation({
    carrier,
    ball: carrier.position,
    teammates: [carrier, player(8, "CAM", 36, 25)],
    opponents: [player(20, "GK", 50, 4, { teamId: 2 })],
    latestEvent: "PASS",
  });
  const options = scoreAttackingOptions(context, generateAttackingOptions(context));
  const routineShots = options.filter(
    (option) => option.kind === "shoot" && option.shot.expectedGoalValue < 0.4,
  );

  assert.ok(routineShots.length > 0);
  assert.ok(routineShots.every((option) => /control and scan/.test(option.rejectedReason)));
});

test("sideways and backward circulation are valued for retention and pressure relief", () => {
  const carrier = player(7, "CM", 50, 55);
  const context = situation({
    carrier,
    ball: carrier.position,
    teammates: [
      carrier,
      player(8, "CM", 24, 55),
      player(6, "CDM", 45, 68),
      player(10, "RW", 86, 52),
    ],
    opponents: [
      player(20, "GK", 50, 4, { teamId: 2 }),
      player(21, "CM", 52, 57, { teamId: 2 }),
      player(22, "CB", 58, 28, { teamId: 2 }),
    ],
  });
  const options = scoreAttackingOptions(context, generateAttackingOptions(context));
  const circulation = options.filter(
    (option) => option.kind === "pass" && ["short", "back", "switch"].includes(option.passStyle),
  );

  assert.ok(circulation.length >= 3);
  assert.ok(circulation.some((option) => option.pass.possessionRetention >= 0.65));
  assert.ok(circulation.some((option) => option.pass.pressureRelief >= 0.5));
  assert.ok(circulation.some((option) => option.baseScore >= 45));
});

test("decision output exposes support roles, zones, scores, rejection reasons and structure logs", () => {
  const context = situation();
  const decision = runAttackingUtilityAi({ ...context }, () => 0.5);

  assert.equal(decision.intentions.length, context.teammates.length - 1);
  assert.ok(decision.intentions.every((intent) => intent.supportRole && intent.targetZone));
  assert.ok(decision.intentions.every((intent) => intent.occupiedZoneCount >= 1));
  assert.ok(decision.intentions.every((intent) => intent.nearestTeammateDistance > 0));
  assert.equal(decision.scoreLog.selectedReceiverId, decision.selected.receiverId ?? null);
  assert.ok(Array.isArray(decision.scoreLog.rejectedPasses));
  assert.ok(Array.isArray(decision.scoreLog.rejectedShots));
  assert.ok(Array.isArray(decision.debugLog));
});

test("an extended live simulation circulates frequently and uses midfield receivers", () => {
  const roles = ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];
  const roster = (teamId, startId) =>
    roles.map((role, index) => ({
      userPlayerId: startId + index,
      playerId: startId + index,
      teamId,
      name: `${role}-${startId + index}`,
      slug: null,
      aiProfile: undefined,
      savedSlotId: null,
      savedPosition: role,
      savedX: null,
      savedY: null,
      positions: [{ position: role, effect: 1 }],
      skills: [],
      skillSlugs: [],
      stats: {
        pass: 78,
        longPass: 76,
        vision: 79,
        shoot: role === "ST" ? 88 : 72,
        tackle: role === "CB" ? 84 : 72,
        balance: 78,
        dribbling: 76,
        acceleration: 78,
        speed: 79,
        stamina: 82,
        gkKeeping: role === "GK" ? 86 : 20,
        gkReflex: role === "GK" ? 86 : 20,
        gkDiving: role === "GK" ? 84 : 20,
        gkReach: role === "GK" ? 84 : 20,
      },
    }));
  let { homeLineup, awayLineup } = prepareMatchKickoffLineups(
    {
      id: 1,
      name: "Home",
      formation: null,
      passRatio: 64,
      shotRatio: 58,
      pressure: 62,
      players: roster(1, 100),
    },
    {
      id: 2,
      name: "Away",
      formation: null,
      passRatio: 58,
      shotRatio: 62,
      pressure: 66,
      players: roster(2, 200),
    },
  );
  const timeline = [];
  let passCount = 0;
  let midfieldReceivers = 0;
  let defenderToStriker = 0;

  for (let index = 0; index < 80; index += 1) {
    const result = generateNextMatchTick({
      previousTicks: timeline,
      homeLineup,
      awayLineup,
      homeTeamId: 1,
      simulationSeed: 24680,
    });
    assert.ok(result);
    timeline.push(result.snapshot);
    homeLineup = result.snapshot.homePlayers;
    awayLineup = result.snapshot.awayPlayers;
    const decision = result.snapshot.tactical?.attackingDecision;
    if (!decision) continue;
    defenderToStriker += decision.debugLog.filter((entry) =>
      entry.startsWith("DEFENDER_DIRECT_TO_STRIKER"),
    ).length;
    if (decision.kind !== "pass") continue;
    passCount += 1;
    const receiver = [...result.snapshot.homePlayers, ...result.snapshot.awayPlayers].find(
      (item) => item.userPlayerId === decision.receiverId,
    );
    if (receiver && ["CDM", "CM", "CAM"].includes(receiver.role)) midfieldReceivers += 1;
  }

  assert.ok(passCount >= 20);
  assert.ok(midfieldReceivers >= 4);
  assert.ok(defenderToStriker <= 1);
  assert.ok(
    timeline
      .filter((snapshot) => snapshot.tactical?.attackingDecision)
      .every((snapshot) => snapshot.tactical.attackingDecision.attackingStructure.assignments.length >= 8),
  );
});
