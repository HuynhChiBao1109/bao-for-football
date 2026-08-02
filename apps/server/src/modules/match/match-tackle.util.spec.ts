import {
  advanceTackleState,
  createCommittedTackleState,
  createIdleTackleState,
  evaluateTackleDecision,
  resolveTackleOutcome,
  type TackleEvaluationInput,
} from "./match-tackle.util";

function createEvaluationInput(
  overrides: Partial<TackleEvaluationInput> = {},
): TackleEvaluationInput {
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

describe("tackle state machine", () => {
  it("holds shape when the defender is too far away", () => {
    const result = evaluateTackleDecision(
      createEvaluationInput({ defenderPosition: { x: 50, y: 68 } }),
    );

    expect(result.action).toBe("hold");
    expect(result.reason).toBe("too_far");
  });

  it("contains the carrier before entering tackle range", () => {
    const result = evaluateTackleDecision(
      createEvaluationInput({ defenderPosition: { x: 50, y: 57 } }),
    );

    expect(result.action).toBe("approach");
    expect(result.reason).toBe("contain");
    expect(result.approachTarget.y).toBeLessThan(50);
  });

  it("avoids a tackle from behind for a balanced AI", () => {
    const result = evaluateTackleDecision(createEvaluationInput());

    expect(result.fromBehind).toBe(true);
    expect(result.action).toBe("approach");
    expect(result.reason).toBe("bad_angle");
  });

  it("selects a standing tackle at close range from the front", () => {
    const result = evaluateTackleDecision(
      createEvaluationInput({
        defenderPosition: { x: 50, y: 48.7 },
        defenderVelocity: { x: 0, y: 3 },
      }),
    );

    expect(result.action).toBe("commit");
    expect(result.style).toBe("standing");
  });

  it("uses a sliding tackle only in its extended reach", () => {
    const result = evaluateTackleDecision(
      createEvaluationInput({
        defenderPosition: { x: 50, y: 46.6 },
        defenderVelocity: { x: 0, y: 4 },
      }),
    );

    expect(result.action).toBe("commit");
    expect(result.style).toBe("sliding");
  });

  it("resolves a clean challenge mainly from quality and timing", () => {
    const evaluation = evaluateTackleDecision(
      createEvaluationInput({
        defenderPosition: { x: 50, y: 48.7 },
        defenderVelocity: { x: 0, y: 3 },
      }),
    );
    if (evaluation.action !== "commit" || !evaluation.style) {
      throw new Error("Expected a committed tackle");
    }

    const resolution = resolveTackleOutcome({
      evaluation: { ...evaluation, action: "commit", style: evaluation.style },
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

    expect(resolution.outcome).toBe("won");
    expect(committed.phase).toBe("commit");
    expect(committed.cooldownUntilTick).toBeGreaterThan(committed.recoveryUntilTick);
    expect(advanceTackleState(committed, 21, 2).phase).toBe("recovery");
  });

  it("can punish a high-risk sliding tackle from behind with a card", () => {
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
    if (evaluation.action !== "commit" || !evaluation.style) {
      throw new Error("Expected a committed high-risk tackle");
    }

    const resolution = resolveTackleOutcome({
      evaluation: { ...evaluation, action: "commit", style: "sliding" },
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

    expect(resolution.outcome).toBe("foul");
    expect(["yellow", "red"]).toContain(resolution.card);
  });

  it("blocks another tackle during recovery and cooldown", () => {
    const recoveryState = {
      ...createIdleTackleState(),
      phase: "recovery" as const,
      recoveryUntilTick: 25,
      cooldownUntilTick: 30,
    };

    const recovering = evaluateTackleDecision(
      createEvaluationInput({ state: recoveryState, tick: 22 }),
    );
    const coolingDown = evaluateTackleDecision(
      createEvaluationInput({ state: recoveryState, tick: 27 }),
    );

    expect(recovering.reason).toBe("recovering");
    expect(coolingDown.reason).toBe("cooldown");
  });
});
