const path = require("node:path");
process.env.NODE_PATH = path.resolve(__dirname, "..");
require("node:module").Module._initPaths();
require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ATTACKING_RUN_BALANCE,
  calculateOffsideLine,
  evaluateAttackingRunTiming,
  evaluateOffsidePosition,
  markRunAsReceiving,
} = require("../src/modules/match/match-attacking-runs.util.ts");
const {
  collectAttackingSituation,
  generateAttackingOptions,
} = require("../src/modules/match/match-attacking-ai.util.ts");

function runner(id, role, x, y, quality = 82, overrides = {}) {
  return {
    id,
    teamId: overrides.teamId ?? (id >= 20 ? 2 : 1),
    role,
    position: { x, y },
    velocity: overrides.velocity ?? { x: 0, y: 0 },
    facing: overrides.facing ?? { x: 0, y: -1 },
    preferredFoot: overrides.preferredFoot ?? "right",
    stamina: overrides.stamina ?? 0.9,
    stats: {
      pass: quality,
      longPass: quality,
      dribbling: quality,
      shoot: quality,
      acceleration: quality,
      speed: quality,
      vision: quality,
      balance: quality,
      stamina: quality,
      composure: quality,
      anticipation: quality,
      offTheBall: quality,
      ...overrides.stats,
    },
    runMemory: overrides.runMemory ?? null,
  };
}

function runSituation(overrides = {}) {
  const carrier = overrides.carrier ?? runner(1, "CM", 50, 55, 85);
  return {
    tick: overrides.tick ?? 10,
    side: "home",
    ball: overrides.ball ?? { x: 50, y: 55 },
    ballVelocity: overrides.ballVelocity ?? { x: 0, y: 0 },
    carrier,
    runners: overrides.runners ?? [carrier, runner(2, "ST", 50, 37, 85)],
    defenders: overrides.defenders ?? [
      runner(20, "GK", 50, 3, 75),
      runner(21, "CB", 43, 32, 75),
      runner(22, "CB", 57, 34, 75),
    ],
    pressure: overrides.pressure ?? 0.2,
    possessionTicks: overrides.possessionTicks ?? 4,
    tactics: overrides.tactics ?? {
      tempo: 0.7,
      directness: 0.75,
      compactness: 0.5,
      riskTolerance: 0.6,
    },
  };
}

test("offside line uses the second-last defender and the ball, with level and own-half positions legal", () => {
  const defenders = [
    runner(20, "GK", 50, 8),
    runner(21, "CB", 40, 30),
    runner(22, "CB", 60, 42),
  ];
  const line = calculateOffsideLine({ side: "home", defenders, ball: { x: 50, y: 55 } });

  assert.equal(line.secondLastDefenderY, 30);
  assert.equal(line.effectiveLineY, 30);
  assert.equal(
    evaluateOffsidePosition({ side: "home", position: { x: 50, y: 30 }, ball: { x: 50, y: 55 }, line }).status,
    "near_line",
  );
  assert.equal(
    evaluateOffsidePosition({ side: "home", position: { x: 50, y: 29 }, ball: { x: 50, y: 55 }, line }).status,
    "offside",
  );
  assert.equal(
    evaluateOffsidePosition({ side: "home", position: { x: 50, y: 62 }, ball: { x: 50, y: 55 }, line }).status,
    "onside",
  );

  const ballLine = calculateOffsideLine({ side: "home", defenders, ball: { x: 50, y: 24 } });
  assert.equal(ballLine.effectiveLineY, 24);
  assert.equal(
    evaluateOffsidePosition({ side: "home", position: { x: 50, y: 26 }, ball: { x: 50, y: 24 }, line: ballLine }).status,
    "onside",
  );
});

test("prediction moves both the second-last defender line and controlled ball to pass release", () => {
  const defenders = [
    runner(20, "GK", 50, 8, 70, { velocity: { x: 0, y: 2 } }),
    runner(21, "CB", 40, 30, 70, { velocity: { x: 0, y: 4 } }),
    runner(22, "CB", 60, 34, 70, { velocity: { x: 0, y: 4 } }),
  ];
  const line = calculateOffsideLine({
    side: "home",
    defenders,
    ball: { x: 50, y: 55 },
    ballVelocity: { x: 0, y: -3 },
    predictionSeconds: 0.5,
  });

  assert.equal(line.secondLastDefenderY, 32);
  assert.equal(line.ballY, 53.5);
  assert.equal(line.effectiveLineY, 32);
  assert.ok(line.trapVelocity > 0);
});

test("a high line creates at most three lane-separated deep runners and underneath support", () => {
  const carrier = runner(1, "CM", 50, 55, 88);
  const evaluation = evaluateAttackingRunTiming(runSituation({
    carrier,
    runners: [
      carrier,
      runner(2, "ST", 50, 37, 90),
      runner(3, "LW", 15, 42, 86),
      runner(4, "RW", 85, 43, 84),
      runner(5, "CM", 35, 55, 80),
    ],
  }));
  const deepRuns = evaluation.decisions.filter((decision) => decision.state === "TriggerRun");

  assert.equal(evaluation.defenseDepth, "high");
  assert.ok(deepRuns.length > 0 && deepRuns.length <= ATTACKING_RUN_BALANCE.maximumDeepRunners);
  assert.equal(new Set(deepRuns.map((decision) => decision.lane)).size, deepRuns.length);
  assert.ok(evaluation.decisions.some((decision) => !["TriggerRun", "CurveRun"].includes(decision.state)));
  assert.ok(evaluation.decisions.every((decision) => decision.path.length === 3));
});

test("a deep block suppresses straight runs behind and requests delayed or underneath play", () => {
  const carrier = runner(1, "CM", 50, 55, 85);
  const evaluation = evaluateAttackingRunTiming(runSituation({
    carrier,
    runners: [carrier, runner(2, "ST", 50, 25), runner(3, "LW", 15, 34), runner(4, "CM", 35, 55)],
    defenders: [runner(20, "GK", 50, 3), runner(21, "CB", 43, 15), runner(22, "CB", 57, 17)],
  }));

  assert.equal(evaluation.defenseDepth, "deep");
  assert.equal(evaluation.decisions.some((decision) => decision.state === "TriggerRun"), false);
  assert.ok(evaluation.decisions.some((decision) => ["OfferSupport", "CheckBack", "PrepareRun"].includes(decision.state)));
  assert.ok(evaluation.decisions.some((decision) => decision.signals.includes("DelayPass")));
});

test("an offside runner is logged and never offered as a pass target", () => {
  const carrier = runner(1, "CM", 50, 55, 85);
  const offside = runner(2, "ST", 50, 25, 86, { velocity: { x: 0, y: -2 } });
  const legal = runner(3, "LW", 20, 42, 82, { velocity: { x: -1, y: -1 } });
  const opponents = [runner(20, "GK", 50, 3), runner(21, "CB", 43, 30), runner(22, "CB", 57, 32)];
  const situation = collectAttackingSituation({
    carrier,
    teammates: [carrier, offside, legal],
    opponents,
    ball: carrier.position,
    side: "home",
    tick: 10,
    possessionTicks: 4,
    latestEvent: null,
    lastPassStyle: null,
    tactics: { risk: 0.5, tempo: 0.7, directness: 0.7, compactness: 0.5, shootingPriority: 0.5 },
    activeCombination: null,
    actionMemory: null,
  });
  const passes = generateAttackingOptions(situation).filter((option) => option.kind === "pass");

  assert.equal(passes.some((option) => option.receiverId === offside.id), false);
  assert.ok(passes.some((option) => option.receiverId === legal.id));
  assert.ok(situation.runTiming.rejectedPasses.some((entry) => entry.playerId === offside.id));
});

test("prolonged offside overrides run commitment and forces a check-back before involvement", () => {
  const carrier = runner(1, "CM", 50, 55, 85);
  const committedOffside = runner(2, "ST", 50, 25, 86, {
    velocity: { x: 0, y: -2 },
    runMemory: {
      state: "TriggerRun",
      stateStartedTick: 4,
      minimumCommitUntilTick: 20,
      offsideSinceTick: 4,
      lastTarget: { x: 50, y: 20 },
    },
  });
  const decision = evaluateAttackingRunTiming(runSituation({
    tick: 10,
    carrier,
    runners: [carrier, committedOffside],
    defenders: [runner(20, "GK", 50, 3), runner(21, "CB", 43, 30), runner(22, "CB", 57, 32)],
  })).decisions[0];

  assert.equal(decision.currentStatus, "offside");
  assert.equal(decision.state, "CheckBack");
  assert.ok(decision.target.y > decision.currentPosition.y);
  assert.ok(decision.signals.includes("DelayPass"));
  assert.match(decision.rejectedPassReason, /offside/);
});

test("minimum commit time and hysteresis keep a non-emergency run stable", () => {
  const carrier = runner(1, "CM", 50, 55, 85);
  const supportingRunner = runner(2, "CM", 35, 53, 80, {
    runMemory: {
      state: "OfferSupport",
      stateStartedTick: 9,
      minimumCommitUntilTick: 13,
      offsideSinceTick: null,
      lastTarget: { x: 40, y: 64 },
    },
  });
  const decision = evaluateAttackingRunTiming(runSituation({
    tick: 10,
    carrier,
    runners: [carrier, supportingRunner],
  })).decisions[0];

  assert.equal(decision.state, "OfferSupport");
  assert.equal(decision.nextMemory.stateStartedTick, 9);
  assert.equal(decision.nextMemory.minimumCommitUntilTick, 13);
});

test("an opponent offside-trap step changes the runner to a curved timing adjustment", () => {
  const carrier = runner(1, "CM", 50, 55, 88);
  const evaluation = evaluateAttackingRunTiming(runSituation({
    carrier,
    runners: [carrier, runner(2, "ST", 50, 34, 58, { velocity: { x: 0, y: -2 } })],
    defenders: [
      runner(20, "GK", 50, 3, 72, { velocity: { x: 0, y: 3 } }),
      runner(21, "CB", 43, 30, 72, { velocity: { x: 0, y: 3 } }),
      runner(22, "CB", 57, 32, 72, { velocity: { x: 0, y: 3 } }),
    ],
  }));
  const decision = evaluation.decisions[0];

  assert.equal(evaluation.offsideTrapActive, true);
  assert.ok(["CurveRun", "HoldPosition", "CheckBack"].includes(decision.state));
  assert.ok(decision.path.length === 3);
});

test("selecting a legal receiver publishes ReceivePass and the communicated target", () => {
  const evaluation = evaluateAttackingRunTiming(runSituation());
  const target = { x: 48, y: 24 };
  const updated = markRunAsReceiving(evaluation, 2, target);
  const decision = updated.decisions.find((item) => item.playerId === 2);

  assert.equal(decision.state, "ReceivePass");
  assert.deepEqual(decision.target, target);
  assert.ok(decision.signals.includes("RequestRun"));
  assert.ok(decision.signals.includes("TriggerRun"));
});
