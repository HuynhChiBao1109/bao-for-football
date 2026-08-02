require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assignDefensiveResponsibilities,
  collectDefensiveSituation,
  evaluateDefensiveThreats,
  runDefensiveUtilityAi,
  scoreDefensiveActions,
} = require("../src/modules/match/match-defensive-ai.util.ts");

const balancedTactics = {
  defensiveLine: 0.52,
  pressingIntensity: 0.58,
  compactness: 0.68,
  markingStyle: "hybrid",
  riskTolerance: 0.45,
  counterPress: 0.58,
};

function defender(id, role, x, y, overrides = {}) {
  return {
    id,
    side: "home",
    role,
    position: { x, y },
    velocity: overrides.velocity ?? { x: 0, y: 0 },
    homePosition: overrides.homePosition ?? { x, y },
    stamina: overrides.stamina ?? 82,
    currentState: overrides.currentState ?? null,
    stats: {
      awareness: 78,
      positioning: 79,
      marking: 77,
      tackling: 78,
      aggression: 72,
      stamina: 82,
      teamwork: 80,
      speed: 76,
      acceleration: 75,
      ...overrides.stats,
    },
  };
}

function attacker(id, role, x, y, overrides = {}) {
  return {
    id,
    side: "away",
    role,
    position: { x, y },
    velocity: overrides.velocity ?? { x: 0, y: 2 },
    speed: overrides.speed ?? 78,
    ballControl: overrides.ballControl ?? 78,
    vision: overrides.vision ?? 76,
  };
}

function baseInput(overrides = {}) {
  const carrier = overrides.carrier ?? attacker(101, "RW", 70, 58, { velocity: { x: 0, y: 2 } });
  return {
    tick: overrides.tick ?? 30,
    defendingSide: "home",
    previousPossession: overrides.previousPossession ?? "away",
    possessionSide: "away",
    possessionTicks: overrides.possessionTicks ?? 8,
    ball: overrides.ball ?? {
      position: carrier?.position ?? { x: 50, y: 55 },
      velocity: { x: 0, y: 0 },
      ownerPlayerId: carrier?.id ?? null,
      intendedReceiverId: null,
      isLoose: false,
    },
    carrier,
    defenders: overrides.defenders ?? [
      defender(1, "GK", 50, 94),
      defender(2, "LB", 20, 75),
      defender(3, "CB", 42, 77),
      defender(4, "CB", 58, 77),
      defender(5, "RB", 78, 72),
      defender(6, "CDM", 53, 66),
      defender(7, "CM", 42, 61),
      defender(8, "LW", 18, 55),
    ],
    attackers:
      overrides.attackers ??
      [
        carrier,
        attacker(102, "ST", 50, 70, { velocity: { x: 0, y: 5 } }),
        attacker(103, "LW", 20, 61, { velocity: { x: 0, y: 3 } }),
        attacker(104, "CAM", 51, 57),
      ].filter(Boolean),
    tactics: overrides.tactics ?? balancedTactics,
    latestEvent: overrides.latestEvent ?? null,
  };
}

test("normal defending designates only one ball presser and one separate cover player", () => {
  const plan = runDefensiveUtilityAi(baseInput(), () => 0.5);
  const committedPressers = plan.assignments.filter(
    (assignment) => assignment.state === "PressBall" || assignment.state === "Tackle",
  );

  assert.ok(plan.primaryPresserId != null);
  assert.equal(plan.primaryPresserId, 5);
  assert.equal(plan.secondaryPresserIds.length, 0);
  assert.ok(committedPressers.length <= 1);
  assert.ok(plan.coverPlayerId != null);
  assert.notEqual(plan.coverPlayerId, plan.primaryPresserId);
});

test("a distant block holds its structure instead of sending a defender across the pitch", () => {
  const distantCarrier = attacker(101, "CB", 50, 8, { velocity: { x: 0, y: 1 } });
  const input = baseInput({ carrier: distantCarrier });
  input.ball.position = distantCarrier.position;
  input.ball.ownerPlayerId = distantCarrier.id;
  const plan = runDefensiveUtilityAi(input, () => 0.5);

  assert.equal(plan.primaryPresserId, null);
  assert.equal(
    plan.assignments.filter(
      (assignment) => assignment.state === "PressBall" || assignment.state === "Tackle",
    ).length,
    0,
  );
});

test("active press can add one helper on a trigger but never creates a swarm", () => {
  const input = baseInput({
    carrier: attacker(101, "RW", 94, 60),
    tactics: { ...balancedTactics, pressingIntensity: 0.94, riskTolerance: 0.8 },
  });
  input.ball.position = input.carrier.position;
  const plan = runDefensiveUtilityAi(input, () => 0.5);

  assert.ok(plan.pressTriggers.includes("touchline_trap"));
  assert.ok(plan.secondaryPresserIds.length <= 1);
  assert.ok(
    plan.assignments.filter(
      (assignment) => assignment.state === "PressBall" || assignment.state === "Tackle",
    ).length <= 2,
  );
});

test("danger evaluation prioritizes a central runner close to goal", () => {
  const input = baseInput({
    attackers: [
      attacker(101, "RW", 8, 48),
      attacker(102, "ST", 50, 82, { velocity: { x: 0, y: 4 } }),
      attacker(103, "CM", 50, 42),
    ],
  });
  input.carrier = input.attackers[0];
  input.ball.position = input.carrier.position;
  input.ball.ownerPlayerId = input.carrier.id;
  const situation = collectDefensiveSituation(input);
  const threats = evaluateDefensiveThreats(situation);

  assert.equal(threats[0].attackerId, 102);
  assert.ok(threats[0].score > threats.find((threat) => threat.attackerId === 103).score);
});

test("dynamic marking does not assign two markers to the same non-carrier", () => {
  const plan = runDefensiveUtilityAi(baseInput(), () => 0.5);
  const markedOpponentIds = plan.assignments
    .filter((assignment) => ["MarkOpponent", "TrackRunner"].includes(assignment.state))
    .map((assignment) => assignment.opponentId)
    .filter((id) => id != null);

  assert.equal(new Set(markedOpponentIds).size, markedOpponentIds.length);
});

test("man marking follows more opponents while zonal marking protects the shape", () => {
  const deepCarrier = attacker(101, "CB", 50, 8, { velocity: { x: 0, y: 0 } });
  const attackers = [
    deepCarrier,
    attacker(102, "CM", 8, 24, { velocity: { x: 0, y: 0 } }),
    attacker(103, "CM", 92, 26, { velocity: { x: 0, y: 0 } }),
  ];
  const createPlan = (markingStyle) => {
    const input = baseInput({
      carrier: deepCarrier,
      attackers,
      tactics: { ...balancedTactics, markingStyle },
    });
    input.ball.position = deepCarrier.position;
    input.ball.ownerPlayerId = deepCarrier.id;
    const situation = collectDefensiveSituation(input);
    return assignDefensiveResponsibilities(situation, evaluateDefensiveThreats(situation));
  };
  const countMarkers = (plan) =>
    [...plan.responsibilities.values()].filter((assignment) =>
      ["MarkOpponent", "TrackRunner"].includes(assignment.preferredState),
    ).length;

  assert.ok(countMarkers(createPlan("man")) > countMarkers(createPlan("zonal")));
});

test("the back line shifts with a switch of play while keeping a shared line height", () => {
  const planAt = (x) => {
    const deepCarrier = attacker(101, "CB", x, 8, { velocity: { x: 0, y: 0 } });
    const input = baseInput({ carrier: deepCarrier, attackers: [deepCarrier] });
    input.ball.position = deepCarrier.position;
    input.ball.ownerPlayerId = deepCarrier.id;
    return runDefensiveUtilityAi(input, () => 0.5);
  };
  const leftPlan = planAt(10);
  const rightPlan = planAt(90);
  const leftCenterBacks = leftPlan.assignments.filter((assignment) =>
    [3, 4].includes(assignment.defenderId),
  );
  const rightCenterBacks = rightPlan.assignments.filter((assignment) =>
    [3, 4].includes(assignment.defenderId),
  );

  assert.ok(rightCenterBacks[0].target.x > leftCenterBacks[0].target.x);
  assert.ok(Math.abs(leftCenterBacks[0].target.y - leftCenterBacks[1].target.y) < 0.8);
  assert.ok(Math.abs(rightCenterBacks[0].target.y - rightCenterBacks[1].target.y) < 0.8);
});

test("transition chooses counter-press when supported and retreat when tactics are cautious", () => {
  const turnoverCarrier = attacker(101, "CAM", 50, 65);
  const counterPress = runDefensiveUtilityAi(
    {
      ...baseInput({
        carrier: turnoverCarrier,
        previousPossession: "home",
        possessionTicks: 1,
      }),
      ball: {
        position: turnoverCarrier.position,
        velocity: { x: 0, y: 0 },
        ownerPlayerId: turnoverCarrier.id,
        intendedReceiverId: null,
        isLoose: false,
      },
    },
    () => 0.5,
  );
  const retreat = runDefensiveUtilityAi(
    baseInput({
      previousPossession: "home",
      possessionTicks: 1,
      tactics: { ...balancedTactics, pressingIntensity: 0.25, counterPress: 0.12 },
    }),
    () => 0.5,
  );

  assert.equal(counterPress.phase, "counter_press");
  assert.ok(counterPress.pressTriggers.includes("turnover"));
  assert.equal(retreat.phase, "retreat");
  assert.ok(retreat.assignments.some((assignment) => assignment.state === "Retreat"));
});

test("only the designated interceptor attacks a loose or travelling ball", () => {
  const input = baseInput();
  input.carrier = null;
  input.ball = {
    position: { x: 51, y: 58 },
    velocity: { x: 2, y: 12 },
    ownerPlayerId: null,
    intendedReceiverId: 102,
    isLoose: true,
  };
  const plan = runDefensiveUtilityAi(input, () => 0.5);

  assert.equal(plan.assignments.filter((assignment) => assignment.state === "Intercept").length, 1);
});

test("tackle utility is disabled outside range and unlocked only above the success threshold", () => {
  const closeInput = baseInput({
    carrier: attacker(101, "ST", 50, 68, { ballControl: 58 }),
    defenders: [
      defender(1, "GK", 50, 94),
      defender(2, "CDM", 50, 69.1, {
        stats: { tackling: 92, positioning: 90, awareness: 90, aggression: 82 },
      }),
      defender(3, "CB", 45, 77),
    ],
  });
  closeInput.ball.position = closeInput.carrier.position;
  closeInput.ball.ownerPlayerId = closeInput.carrier.id;
  const closeSituation = collectDefensiveSituation(closeInput);
  const closeThreats = evaluateDefensiveThreats(closeSituation);
  const closeAssignments = assignDefensiveResponsibilities(closeSituation, closeThreats);
  const closeScores = scoreDefensiveActions({
    situation: closeSituation,
    threats: closeThreats,
    assignment: closeAssignments,
    defender: closeInput.defenders[1],
    random: () => 0.5,
  });
  const farInput = baseInput({
    carrier: closeInput.carrier,
    defenders: [defender(1, "GK", 50, 94), defender(2, "CDM", 50, 48), defender(3, "CB", 45, 77)],
  });
  farInput.ball.position = farInput.carrier.position;
  farInput.ball.ownerPlayerId = farInput.carrier.id;
  const farSituation = collectDefensiveSituation(farInput);
  const farThreats = evaluateDefensiveThreats(farSituation);
  const farAssignments = assignDefensiveResponsibilities(farSituation, farThreats);
  const farScores = scoreDefensiveActions({
    situation: farSituation,
    threats: farThreats,
    assignment: farAssignments,
    defender: farInput.defenders[1],
    random: () => 0.5,
  });

  assert.ok(closeScores.find((score) => score.state === "Tackle").score > 0);
  assert.ok(farScores.find((score) => score.state === "Tackle").score < 0);
});

test("fullback on the ball side protects the crossing lane while the far side stays compact", () => {
  const input = baseInput({ carrier: attacker(101, "RW", 91, 66) });
  input.ball.position = input.carrier.position;
  input.ball.ownerPlayerId = input.carrier.id;
  const situation = collectDefensiveSituation(input);
  const threats = evaluateDefensiveThreats(situation);
  const assignment = assignDefensiveResponsibilities(situation, threats);
  const rightBack = assignment.responsibilities.get(5);
  const leftBack = assignment.responsibilities.get(2);

  assert.ok(
    ["PressBall", "BlockLane", "MarkOpponent", "TrackRunner"].includes(rightBack.preferredState),
  );
  assert.notEqual(leftBack.preferredState, "PressBall");
});
