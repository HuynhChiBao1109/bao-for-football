require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  advanceTackleState,
  createCommittedTackleState,
  createIdleTackleState,
  evaluateTackleDecision,
  resolveTackleOutcome,
} = require("../src/modules/match/match-tackle.util.ts");

function createEvaluationInput(overrides = {}) {
  return {
    tick: 20,
    defenderId: 1,
    carrierId: 2,
    defenderSide: "home",
    defenderPosition: { x: 50, y: 51.4 },
    defenderVelocity: { x: 0, y: -4 },
    carrierPosition: { x: 50, y: 50 },
    carrierVelocity: { x: 0, y: -3 },
    ballPosition: { x: 50, y: 49.5 },
    ballTarget: { x: 50, y: 43 },
    defenderStats: { tackle: 82, balance: 78, speed: 76, acceleration: 75, stamina: 80 },
    carrierStats: { dribbling: 76, balance: 74, speed: 77, acceleration: 78 },
    riskTaking: 0.5,
    hasTankTackle: false,
    state: createIdleTackleState(),
    decisionRoll: 0,
    ...overrides,
  };
}

test("defender holds shape when too far away", () => {
  const result = evaluateTackleDecision(
    createEvaluationInput({ defenderPosition: { x: 50, y: 68 } }),
  );

  assert.equal(result.action, "hold");
  assert.equal(result.reason, "too_far");
});

test("defender contains the carrier before entering tackle range", () => {
  const result = evaluateTackleDecision(
    createEvaluationInput({ defenderPosition: { x: 50, y: 57 } }),
  );

  assert.equal(result.action, "approach");
  assert.equal(result.reason, "contain");
  assert.ok(result.approachTarget.y < 50);
});

test("balanced AI avoids a tackle from behind", () => {
  const result = evaluateTackleDecision(createEvaluationInput());

  assert.equal(result.fromBehind, true);
  assert.equal(result.action, "approach");
  assert.equal(result.reason, "bad_angle");
});

test("close front challenge uses a standing tackle", () => {
  const result = evaluateTackleDecision(
    createEvaluationInput({
      defenderPosition: { x: 50, y: 48.7 },
      defenderVelocity: { x: 0, y: 3 },
    }),
  );

  assert.equal(result.action, "commit");
  assert.equal(result.style, "standing");
});

test("extended challenge range uses a sliding tackle", () => {
  const result = evaluateTackleDecision(
    createEvaluationInput({
      defenderPosition: { x: 50, y: 46.6 },
      defenderVelocity: { x: 0, y: 4 },
    }),
  );

  assert.equal(result.action, "commit");
  assert.equal(result.style, "sliding");
});

test("clean tackle wins possession then enters recovery and cooldown", () => {
  const evaluation = evaluateTackleDecision(
    createEvaluationInput({
      defenderPosition: { x: 50, y: 48.7 },
      defenderVelocity: { x: 0, y: 3 },
    }),
  );
  assert.equal(evaluation.action, "commit");

  const resolution = resolveTackleOutcome({
    evaluation,
    tick: 20,
    ballPosition: { x: 50, y: 49.5 },
    ballTarget: { x: 50, y: 43 },
    defenderPosition: { x: 50, y: 48.7 },
    carrierPosition: { x: 50, y: 50 },
    defenderTackle: 82,
    riskTaking: 0.5,
    hasTankTackle: false,
    foulRoll: 0.99,
    successRoll: 0,
    controlRoll: 0,
    cardRoll: 0.99,
    deflectionSideRoll: 0.5,
  });
  const committed = createCommittedTackleState(undefined, resolution, 2, 20);

  assert.equal(resolution.outcome, "won");
  assert.equal(committed.phase, "commit");
  assert.ok(committed.cooldownUntilTick > committed.recoveryUntilTick);
  assert.equal(advanceTackleState(committed, 21, 2).phase, "recovery");
});

test("high-risk sliding tackle from behind can produce a card", () => {
  const evaluation = evaluateTackleDecision(
    createEvaluationInput({
      defenderPosition: { x: 50, y: 77 },
      carrierPosition: { x: 50, y: 80 },
      ballPosition: { x: 50, y: 80.4 },
      ballTarget: { x: 50, y: 90 },
      defenderVelocity: { x: 0, y: 8 },
      carrierVelocity: { x: 0, y: 4 },
      riskTaking: 0.95,
    }),
  );
  assert.equal(evaluation.action, "commit");

  const resolution = resolveTackleOutcome({
    evaluation: { ...evaluation, style: "sliding" },
    tick: 20,
    ballPosition: { x: 50, y: 80.4 },
    ballTarget: { x: 50, y: 90 },
    defenderPosition: { x: 50, y: 77 },
    carrierPosition: { x: 50, y: 80 },
    defenderTackle: 60,
    riskTaking: 0.95,
    hasTankTackle: false,
    foulRoll: 0,
    successRoll: 0.99,
    controlRoll: 0.99,
    cardRoll: 0,
    deflectionSideRoll: 0.5,
  });

  assert.equal(resolution.outcome, "foul");
  assert.ok(resolution.card === "yellow" || resolution.card === "red");
});

test("recovery and cooldown prevent tackle spam", () => {
  const recoveryState = {
    ...createIdleTackleState(),
    phase: "recovery",
    recoveryUntilTick: 25,
    cooldownUntilTick: 30,
  };

  assert.equal(
    evaluateTackleDecision(createEvaluationInput({ state: recoveryState, tick: 22 })).reason,
    "recovering",
  );
  assert.equal(
    evaluateTackleDecision(createEvaluationInput({ state: recoveryState, tick: 27 })).reason,
    "cooldown",
  );
});
