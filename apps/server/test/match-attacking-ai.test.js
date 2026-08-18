const path = require("node:path");
process.env.NODE_PATH = path.resolve(__dirname, "..");
require("node:module").Module._initPaths();
require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ATTACKING_AI_BALANCE,
  collectAttackingSituation,
  createAttackingIntentions,
  generateAttackingOptions,
  runAttackingUtilityAi,
  scoreAttackingOptions,
  selectAttackingAction,
} = require("../src/modules/match/match-attacking-ai.util.ts");
const {
  generateNextMatchTick,
  prepareMatchKickoffLineups,
} = require("../src/modules/match/match-simulation.util.ts");

function player(id, role, x, y, overrides = {}) {
  return {
    id,
    teamId: overrides.teamId ?? 1,
    role,
    position: { x, y },
    velocity: overrides.velocity ?? { x: 0, y: 0 },
    preferredFoot: overrides.preferredFoot ?? "right",
    stamina: overrides.stamina ?? 0.9,
    stats: {
      pass: 78,
      longPass: 76,
      vision: 80,
      shoot: 75,
      balance: 76,
      dribbling: 77,
      acceleration: 78,
      speed: 78,
      stamina: 80,
      ...overrides.stats,
    },
  };
}

function situation(overrides = {}) {
  const carrier = overrides.carrier ?? player(1, "CM", 50, 55);
  return collectAttackingSituation({
    carrier,
    teammates: overrides.teammates ?? [
      carrier,
      player(2, "ST", 50, 38, { velocity: { x: 1, y: -5 } }),
      player(3, "LW", 18, 46, { velocity: { x: -1, y: -3 } }),
      player(4, "RB", 82, 58),
    ],
    opponents: overrides.opponents ?? [
      player(20, "CB", 43, 26, { teamId: 2 }),
      player(21, "CB", 59, 27, { teamId: 2 }),
      player(22, "GK", 50, 5, { teamId: 2 }),
    ],
    ball: overrides.ball ?? carrier.position,
    side: "home",
    tick: overrides.tick ?? 40,
    possessionTicks: overrides.possessionTicks ?? 5,
    latestEvent: overrides.latestEvent ?? null,
    lastPassStyle: overrides.lastPassStyle ?? null,
    tactics: overrides.tactics ?? {
      risk: 0.5,
      tempo: 0.6,
      directness: 0.6,
      compactness: 0.5,
      shootingPriority: 0.5,
    },
    activeCombination: overrides.activeCombination ?? null,
    actionMemory: overrides.actionMemory ?? null,
  });
}

test("through balls lead the receiver instead of targeting the current position", () => {
  const context = situation();
  const through = generateAttackingOptions(context).find(
    (option) => option.passStyle === "through" && option.receiverId === 2,
  );

  assert.ok(through);
  assert.ok(through.target.y < context.teammates.find((item) => item.id === 2).position.y);
  assert.ok(through.pass.travelSeconds > 0);
});

test("a defender inside the passing corridor raises interception risk and removes unsafe passes", () => {
  const carrier = player(1, "CM", 50, 55);
  const blockedReceiver = player(2, "ST", 50, 28, { velocity: { x: 0, y: -2 } });
  const openReceiver = player(3, "LW", 17, 43, { velocity: { x: -1, y: -2 } });
  const context = situation({
    carrier,
    teammates: [carrier, blockedReceiver, openReceiver],
    opponents: [
      player(20, "CB", 50, 42, { teamId: 2, stats: { speed: 88, acceleration: 88 } }),
      player(22, "GK", 50, 5, { teamId: 2 }),
    ],
  });
  const passes = generateAttackingOptions(context).filter((option) => option.kind === "pass");
  const blocked = passes.filter((option) => option.receiverId === blockedReceiver.id);
  const open = passes.filter((option) => option.receiverId === openReceiver.id);

  assert.ok(open.length > 0);
  assert.ok(
    blocked.length === 0 ||
      Math.max(...blocked.map((option) => option.pass.laneSafety)) <
        Math.max(...open.map((option) => option.pass.laneSafety)),
  );
});

test("an open high-quality close chance beats pass and dribble utility", () => {
  const carrier = player(1, "ST", 50, 12, {
    stats: { shoot: 96, vision: 76, dribbling: 84, balance: 88 },
  });
  const decision = runAttackingUtilityAi(
    {
      ...situation({
        carrier,
        ball: carrier.position,
        teammates: [carrier, player(2, "RW", 70, 20)],
        opponents: [player(22, "GK", 43, 4, { teamId: 2 })],
        tactics: {
          risk: 0.6,
          tempo: 0.8,
          directness: 0.7,
          compactness: 0.4,
          shootingPriority: 1,
        },
      }),
    },
    () => 0.5,
  );

  assert.equal(decision.selected.kind, "shoot");
  assert.ok(decision.selected.shot.expectedGoalValue > 0.45);
});

test("outside shooting range the AI keeps pass, carry, hold and wait alternatives", () => {
  const context = situation({ carrier: player(1, "CB", 50, 78), ball: { x: 50, y: 78 } });
  const options = generateAttackingOptions(context);

  assert.equal(
    options.some((option) => option.kind === "shoot"),
    false,
  );
  assert.equal(
    options.some((option) => option.kind === "pass"),
    true,
  );
  assert.deepEqual(
    ["hold", "wait", "carry_ball"].map((kind) => options.some((option) => option.kind === kind)),
    [true, true, true],
  );
});

test("pass generator supports one-touch, one-two, switch, cross, cut-back and back pass", () => {
  const carrier = player(1, "RW", 88, 10);
  const context = situation({
    carrier,
    ball: carrier.position,
    latestEvent: "PASS",
    teammates: [
      carrier,
      player(2, "ST", 52, 15, { velocity: { x: 0, y: -2 } }),
      player(3, "LW", 12, 25),
      player(4, "CM", 55, 24),
      player(5, "RB", 82, 28),
      player(6, "RW", 84, 4),
    ],
    opponents: [player(22, "GK", 50, 4, { teamId: 2 })],
  });
  const styles = new Set(generateAttackingOptions(context).map((option) => option.passStyle));

  assert.ok(styles.has("one_touch"));
  assert.ok(styles.has("one_two"));
  assert.ok(styles.has("switch"));
  assert.ok(styles.has("cross"));
  assert.ok(styles.has("cut_back"));
  assert.ok(styles.has("back"));
});

test("a difficult long cross is less accurate than a short pass to the same receiver", () => {
  const carrier = player(1, "RW", 80, 18, {
    stats: { pass: 82, longPass: 82, vision: 82 },
  });
  const receiver = player(2, "ST", 52, 15, { velocity: { x: 0, y: -2 } });
  const context = situation({
    carrier,
    ball: carrier.position,
    teammates: [carrier, receiver, player(3, "CM", 62, 28)],
    opponents: [player(22, "GK", 50, 5, { teamId: 2 })],
  });
  const passes = generateAttackingOptions(context).filter(
    (option) => option.kind === "pass" && option.receiverId === receiver.id,
  );
  const cross = passes.find((option) => option.passStyle === "cross");
  const short = passes.find((option) => option.passStyle === "short");

  assert.ok(cross);
  assert.ok(short);
  assert.ok(cross.executionError > short.executionError);
  assert.ok(cross.pass.completionProbability <= short.pass.completionProbability + 0.08);
});

test("off-ball communication creates distinct overlap, third-man and support targets", () => {
  const context = situation({
    carrier: player(1, "RW", 82, 55),
    ball: { x: 82, y: 55 },
    teammates: [
      player(1, "RW", 82, 55),
      player(2, "ST", 54, 40),
      player(3, "CM", 52, 60),
      player(4, "RB", 86, 64),
      player(5, "CB", 45, 72),
    ],
  });
  const options = scoreAttackingOptions(context, generateAttackingOptions(context));
  const selected = selectAttackingAction(options, () => 0.5);
  const intentions = createAttackingIntentions(context, selected);
  const runTypes = new Set(intentions.map((intent) => intent.runType));

  assert.ok(runTypes.has("OVERLAP"));
  assert.ok(runTypes.has("THIRD_MAN_RUN"));
  for (let left = 0; left < intentions.length; left += 1) {
    for (let right = left + 1; right < intentions.length; right += 1) {
      const gap = Math.hypot(
        intentions[left].target.x - intentions[right].target.x,
        intentions[left].target.y - intentions[right].target.y,
      );
      assert.ok(gap >= ATTACKING_AI_BALANCE.minimumIntentSpacing - 0.01);
    }
  }
});

test("pressure and fatigue increase controlled execution error", () => {
  const calm = situation({ opponents: [player(22, "GK", 50, 5, { teamId: 2 })] });
  const tiredCarrier = player(1, "CM", 50, 55, { stamina: 0.25, stats: { pass: 62 } });
  const pressured = situation({
    carrier: tiredCarrier,
    ball: tiredCarrier.position,
    teammates: [tiredCarrier, player(2, "ST", 50, 60)],
    opponents: [
      player(20, "CB", 52, 55, { teamId: 2 }),
      player(21, "CM", 48, 56, { teamId: 2 }),
      player(22, "GK", 50, 5, { teamId: 2 }),
    ],
  });
  const calmPass = generateAttackingOptions(calm).find((option) => option.kind === "pass");
  const pressuredPass = generateAttackingOptions(pressured).find(
    (option) => option.kind === "pass",
  );

  assert.ok(calmPass);
  assert.ok(pressuredPass);
  assert.ok(pressuredPass.executionError > calmPass.executionError);
});

test("team directness and shooting priority alter utility without hard-coded actions", () => {
  const conservative = situation({
    tactics: {
      risk: 0.2,
      tempo: 0.35,
      directness: 0.15,
      compactness: 0.75,
      shootingPriority: 0.1,
    },
  });
  const aggressive = situation({
    tactics: {
      risk: 0.8,
      tempo: 0.9,
      directness: 0.95,
      compactness: 0.3,
      shootingPriority: 0.95,
    },
  });
  const conservativeOptions = scoreAttackingOptions(
    conservative,
    generateAttackingOptions(conservative),
  );
  const aggressiveOptions = scoreAttackingOptions(aggressive, generateAttackingOptions(aggressive));
  const conservativeForwardPass = conservativeOptions.find(
    (option) => option.kind === "pass" && option.receiverId === 2 && option.passStyle === "through",
  );
  const aggressiveForwardPass = aggressiveOptions.find(
    (option) => option.kind === "pass" && option.receiverId === 2 && option.passStyle === "through",
  );

  assert.ok(conservativeForwardPass);
  assert.ok(aggressiveForwardPass);
  assert.ok(aggressiveForwardPass.baseScore > conservativeForwardPass.baseScore);
});

test("an unpressured central midfielder carries through a safe forward corridor", () => {
  const carrier = player(1, "CM", 50, 58, {
    stats: { dribbling: 84, acceleration: 83, balance: 82 },
  });
  const decision = runAttackingUtilityAi(
    {
      ...situation({
        carrier,
        ball: carrier.position,
        teammates: [carrier, player(2, "LM", 20, 56), player(3, "CB", 43, 73)],
        opponents: [
          player(20, "CB", 38, 25, { teamId: 2 }),
          player(21, "CB", 64, 24, { teamId: 2 }),
          player(22, "GK", 50, 5, { teamId: 2 }),
        ],
      }),
    },
    () => 0.5,
  );

  assert.equal(decision.selected.kind, "carry_ball");
  assert.ok(decision.selected.carry.forwardSpace > 0.75);
  assert.ok(decision.selected.target.y < carrier.position.y);
  assert.ok(decision.scoreLog.carryBall > decision.scoreLog.pass);
});

test("CarryBall remains available without a nearby opponent while Dribble requires a duel", () => {
  const openContext = situation({
    opponents: [player(22, "GK", 50, 5, { teamId: 2 })],
  });
  const duelContext = situation({
    opponents: [player(20, "CB", 52, 50, { teamId: 2 }), player(22, "GK", 50, 5, { teamId: 2 })],
  });

  assert.ok(generateAttackingOptions(openContext).some((option) => option.kind === "carry_ball"));
  assert.equal(
    generateAttackingOptions(openContext).some((option) => option.kind === "dribble"),
    false,
  );
  assert.ok(generateAttackingOptions(duelContext).some((option) => option.kind === "dribble"));
});

test("every outfield role can carry with role-specific willingness", () => {
  const roles = ["CB", "CDM", "CM", "CAM", "SS", "RW"];
  const biases = new Map();
  for (const role of roles) {
    const carrier = player(1, role, 50, 60);
    const context = situation({
      carrier,
      ball: carrier.position,
      teammates: [carrier],
      opponents: [player(22, "GK", 50, 5, { teamId: 2 })],
    });
    const carry = generateAttackingOptions(context).find((option) => option.kind === "carry_ball");
    assert.ok(carry);
    biases.set(role, carry.carry.roleCarryBias);
  }

  assert.ok(biases.get("RW") > biases.get("CM"));
  assert.ok(biases.get("CM") > biases.get("CB"));
  assert.ok(biases.get("CB") > 0);
});

test("dribble cooldown blocks another take-on but never blocks normal CarryBall", () => {
  const context = situation({
    actionMemory: {
      currentAction: "carry_ball",
      actionStartedTick: 35,
      lastEvaluationTick: 39,
      lastEvaluationPosition: { x: 49, y: 57 },
      minimumCommitUntilTick: 39,
      dribbleCooldownUntilTick: 44,
    },
    opponents: [player(20, "CB", 52, 52, { teamId: 2 }), player(22, "GK", 50, 5, { teamId: 2 })],
  });
  const options = generateAttackingOptions(context);

  assert.ok(options.some((option) => option.kind === "carry_ball"));
  assert.equal(
    options.some((option) => option.kind === "dribble"),
    false,
  );
});

test("a pass must beat CarryBall by PASS_REQUIRED_ADVANTAGE when there is no emergency", () => {
  const context = situation({ opponents: [player(22, "GK", 50, 5, { teamId: 2 })] });
  const carry = {
    id: "carry_ball",
    kind: "carry_ball",
    target: { x: 50, y: 48 },
    baseScore: 60,
    executionError: 0.1,
    reasons: [],
  };
  const pass = {
    id: "pass:short:2",
    kind: "pass",
    target: { x: 42, y: 54 },
    receiverId: 2,
    passStyle: "short",
    baseScore: 66,
    executionError: 0.1,
    reasons: [],
    pass: {
      distance: 9,
      progression: 0.05,
      laneSafety: 0.9,
      interceptionRisk: 0.1,
      receiverSpace: 0.9,
      receptionQuality: 0.8,
      movementValue: 0.4,
      completionProbability: 0.9,
      travelSeconds: 0.4,
      receiverAdvantage: 0.62,
      lineBreakValue: 0.12,
      chanceCreationValue: 0.18,
    },
  };

  const selected = selectAttackingAction([pass, carry], () => 0.5, context);
  assert.equal(selected.kind, "carry_ball");
  assert.equal(ATTACKING_AI_BALANCE.passRequiredAdvantage, 8);
});

test("action hysteresis keeps CarryBall when a new action is only marginally better", () => {
  const context = situation({
    actionMemory: {
      currentAction: "carry_ball",
      actionStartedTick: 35,
      lastEvaluationTick: 39,
      lastEvaluationPosition: { x: 50, y: 57 },
      minimumCommitUntilTick: 39,
      dribbleCooldownUntilTick: 0,
    },
  });
  const selected = selectAttackingAction(
    [
      {
        id: "shoot:normal",
        kind: "shoot",
        target: context.goal,
        baseScore: 64,
        executionError: 0.1,
        reasons: [],
      },
      {
        id: "carry_ball",
        kind: "carry_ball",
        target: { x: 50, y: 48 },
        baseScore: 61,
        executionError: 0.1,
        reasons: [],
      },
    ],
    () => 0.5,
    context,
  );

  assert.equal(selected.kind, "carry_ball");
});

test("minimum commit time holds the initial carry for one more simulation interval", () => {
  const context = situation({
    tick: 41,
    actionMemory: {
      currentAction: "carry_ball",
      actionStartedTick: 40,
      lastEvaluationTick: 40,
      lastEvaluationPosition: { x: 50, y: 55 },
      minimumCommitUntilTick: 42,
      dribbleCooldownUntilTick: 0,
    },
  });
  const selected = selectAttackingAction(
    [
      {
        id: "shoot:normal",
        kind: "shoot",
        target: context.goal,
        baseScore: 92,
        executionError: 0.1,
        reasons: [],
      },
      {
        id: "carry_ball",
        kind: "carry_ball",
        target: { x: 50, y: 48 },
        baseScore: 58,
        executionError: 0.1,
        reasons: [],
      },
    ],
    () => 0.5,
    context,
  );

  assert.equal(selected.kind, "carry_ball");
});

test("receiving under low pressure gives control-and-scan time before a routine pass", () => {
  const carrier = player(1, "CM", 50, 55);
  const teammates = [carrier, player(5, "CM", 42, 57)];
  const opponents = [player(22, "GK", 50, 5, { teamId: 2 })];
  const normal = situation({ carrier, teammates, opponents, latestEvent: null });
  const justReceived = situation({ carrier, teammates, opponents, latestEvent: "PASS" });
  const normalPass = scoreAttackingOptions(normal, generateAttackingOptions(normal)).find(
    (option) => option.kind === "pass" && option.receiverId === 5 && option.passStyle === "short",
  );
  const receivedPass = scoreAttackingOptions(
    justReceived,
    generateAttackingOptions(justReceived),
  ).find(
    (option) => option.kind === "pass" && option.receiverId === 5 && option.passStyle === "short",
  );

  assert.ok(normalPass);
  assert.ok(receivedPass);
  assert.ok(receivedPass.baseScore < normalPass.baseScore);
});

test("strong pressure can break carry commitment and trigger an early safe pass", () => {
  const carrier = player(1, "CM", 50, 55);
  const context = situation({
    carrier,
    ball: carrier.position,
    teammates: [carrier, player(2, "LW", 30, 52, { velocity: { x: -1, y: -2 } })],
    opponents: [
      player(20, "CM", 51.5, 57, { teamId: 2 }),
      player(21, "CB", 48.5, 50, { teamId: 2 }),
      player(22, "GK", 50, 5, { teamId: 2 }),
    ],
    actionMemory: {
      currentAction: "carry_ball",
      actionStartedTick: 39,
      lastEvaluationTick: 39,
      lastEvaluationPosition: { x: 50, y: 57 },
      minimumCommitUntilTick: 43,
      dribbleCooldownUntilTick: 0,
    },
  });
  const decision = runAttackingUtilityAi({ ...context }, () => 0.5);

  assert.ok(context.pressure >= ATTACKING_AI_BALANCE.strongPressureThreshold);
  assert.equal(decision.selected.kind, "pass");
});

test("live match ticks publish attacking intentions and coordinated defensive assignments", () => {
  const roles = ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "RW", "ST"];
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
        shoot: role === "ST" ? 88 : 73,
        tackle: role === "CB" ? 84 : 72,
        balance: 78,
        dribbling: 77,
        acceleration: 78,
        speed: 79,
        stamina: 82,
        gkKeeping: role === "GK" ? 86 : 20,
        gkReflex: role === "GK" ? 86 : 20,
        gkDiving: role === "GK" ? 84 : 20,
        gkReach: role === "GK" ? 84 : 20,
      },
    }));
  const lineups = prepareMatchKickoffLineups(
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
      passRatio: 48,
      shotRatio: 70,
      pressure: 72,
      players: roster(2, 200),
    },
  );
  let homeLineup = lineups.homeLineup;
  let awayLineup = lineups.awayLineup;
  const timeline = [];

  for (let index = 0; index < 14; index += 1) {
    const result = generateNextMatchTick({
      previousTicks: timeline,
      homeLineup,
      awayLineup,
      homeTeamId: 1,
      simulationSeed: 9876,
    });
    assert.ok(result);
    timeline.push(result.snapshot);
    homeLineup = result.snapshot.homePlayers;
    awayLineup = result.snapshot.awayPlayers;
  }

  const openPlaySnapshots = timeline.filter((snapshot) => snapshot.tactical?.attackingDecision);
  assert.ok(openPlaySnapshots.length > 0);
  assert.ok(
    openPlaySnapshots.some((snapshot) => snapshot.tactical.attackingDecision.kind === "carry_ball"),
  );
  assert.ok(
    openPlaySnapshots.every(
      (snapshot) => snapshot.tactical.attackingDecision.scores.carryBall != null,
    ),
  );
  assert.ok(
    openPlaySnapshots.some((snapshot) =>
      [...snapshot.homePlayers, ...snapshot.awayPlayers].some(
        (matchPlayer) => matchPlayer.attackingIntent?.communication,
      ),
    ),
  );
  assert.ok(
    openPlaySnapshots.every(
      (snapshot) => snapshot.tactical.attackingDecision.runTiming?.currentLine,
    ),
  );
  assert.ok(
    openPlaySnapshots.some((snapshot) =>
      [...snapshot.homePlayers, ...snapshot.awayPlayers].some(
        (matchPlayer) => matchPlayer.runTiming?.path?.length === 3,
      ),
    ),
  );
  assert.ok(
    openPlaySnapshots.every((snapshot) => {
      const attackingPlayers =
        snapshot.possession === "home" ? snapshot.homePlayers : snapshot.awayPlayers;
      return attackingPlayers.every((matchPlayer) => matchPlayer.offside?.status);
    }),
  );
  assert.ok(homeLineup.every((matchPlayer) => matchPlayer.teamTactics));
  assert.ok(awayLineup.every((matchPlayer) => matchPlayer.teamTactics));
  assert.ok(openPlaySnapshots.every((snapshot) => snapshot.tactical.defensiveDecision));
  assert.ok(
    openPlaySnapshots.every((snapshot) => {
      const defendingPlayers =
        snapshot.possession === "home" ? snapshot.awayPlayers : snapshot.homePlayers;
      return defendingPlayers.every((matchPlayer) => matchPlayer.defensiveAssignment);
    }),
  );
  assert.ok(
    openPlaySnapshots.every(
      (snapshot) =>
        snapshot.tactical.defensiveDecision.assignments.filter((assignment) =>
          ["PressBall", "Tackle"].includes(assignment.state),
        ).length <= 2,
    ),
  );
  assert.ok(homeLineup.every((matchPlayer) => matchPlayer.defensiveTactics));
  assert.ok(awayLineup.every((matchPlayer) => matchPlayer.defensiveTactics));
});
