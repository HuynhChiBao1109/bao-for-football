const path = require("node:path");
process.env.NODE_PATH = path.resolve(__dirname, "..");
require("node:module").Module._initPaths();
require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MATCH_ACTIVE_DURATION_MS,
  applyMatchAttackingFlow,
  applyMatchDefensiveFlow,
  buildMatchPassTrajectory,
  getDifficultPassDistancePenalty,
  getMatchActionDurationMs,
  getMatchClockAdvanceSeconds,
  getMatchMovementDeltaSeconds,
  getMatchPassPresentation,
  getShotMovementAccuracyPenalty,
  resolveMatchFlow,
  retargetMatchTrajectory,
  updateMatchStamina,
} = require("../src/modules/match/match-flow.util.ts");
const {
  MATCH_REAL_DURATION_MS,
  POST_CHALLENGE_CONTROL_MS,
  generateNextMatchTick,
  hasPostChallengeControlProtection,
  prepareMatchKickoffLineups,
  resolveMatchPossessionCreditSide,
  shouldAttachBallToOwner,
  shouldFreezeMatchClock,
} = require("../src/modules/match/match-simulation.util.ts");
const { EMatchEvent } = require("../src/modules/match/enums");
const { updatePlayerMovement } = require("../src/modules/match/match-movement.util.ts");

test("shared match pacing reserves six minutes for active play", () => {
  assert.equal(MATCH_ACTIVE_DURATION_MS, 360_000);
  assert.equal(MATCH_REAL_DURATION_MS, MATCH_ACTIVE_DURATION_MS);
  assert.equal(getMatchClockAdvanceSeconds(720, false), 0.72);
  assert.equal(getMatchClockAdvanceSeconds(2_800, true), 0);
});

test("a trailing team attacks and presses harder late while a leader protects its shape", () => {
  const trailing = resolveMatchFlow({
    side: "home",
    minute: 84,
    homeScore: 0,
    awayScore: 2,
    possessionTicks: 12,
    ball: { x: 50, y: 52 },
  });
  const leading = resolveMatchFlow({
    side: "away",
    minute: 84,
    homeScore: 0,
    awayScore: 2,
    possessionTicks: 12,
    ball: { x: 50, y: 52 },
  });

  assert.equal(trailing.phase, "all_out_attack");
  assert.equal(leading.phase, "protect_lead");
  assert.ok(trailing.tempoDelta > 0.15);
  assert.ok(trailing.pressingDelta > 0.15);
  assert.ok(leading.compactnessDelta > 0.1);
  assert.ok(leading.riskDelta < 0);
});

test("shared match flow changes tactics without exceeding normalized limits", () => {
  const flow = resolveMatchFlow({
    side: "home",
    minute: 89,
    homeScore: 1,
    awayScore: 3,
    possessionTicks: 2,
    ball: { x: 50, y: 18 },
  });
  const attack = applyMatchAttackingFlow(
    {
      risk: 0.94,
      tempo: 0.96,
      directness: 0.9,
      compactness: 0.42,
      shootingPriority: 0.92,
      dribbleFrequency: 0.74,
      carryDirectness: 0.8,
      riskTolerance: 0.9,
    },
    flow,
  );
  const defense = applyMatchDefensiveFlow(
    {
      defensiveLine: 0.82,
      pressingIntensity: 0.9,
      compactness: 0.54,
      markingStyle: "hybrid",
      riskTolerance: 0.82,
      counterPress: 0.88,
    },
    flow,
  );

  assert.ok(attack.tempo <= 1 && attack.shootingPriority <= 1);
  assert.ok(attack.compactness >= 0 && attack.compactness < 0.42);
  assert.ok(defense.pressingIntensity <= 1 && defense.counterPress <= 1);
  assert.ok(defense.defensiveLine >= 0.82);
});

test("pass and shot presentation duration follows distance and action style", () => {
  const oneTouch = getMatchActionDurationMs({ kind: "pass", distance: 10, style: "one_touch" });
  const shortPass = getMatchActionDurationMs({ kind: "pass", distance: 10, style: "short" });
  const switchPass = getMatchActionDurationMs({ kind: "pass", distance: 52, style: "switch" });
  const closeShot = getMatchActionDurationMs({ kind: "shot", distance: 12, outcome: "goal" });
  const parriedShot = getMatchActionDurationMs({ kind: "shot", distance: 25, outcome: "save" });

  assert.ok(oneTouch < shortPass);
  assert.ok(shortPass < switchPass);
  assert.ok(closeShot < parriedShot);
  assert.ok(oneTouch >= 420 && switchPass <= 1_350);
  assert.ok(shortPass >= 520 && closeShot >= 560);
});

test("lofted pass trajectories curve but always finish exactly at the target", () => {
  const from = { x: 12, y: 68 };
  const to = { x: 86, y: 31 };
  const short = buildMatchPassTrajectory({ from, to, style: "short", frames: 7, curveSign: 1 });
  const cross = buildMatchPassTrajectory({ from, to, style: "cross", frames: 7, curveSign: 1 });
  const lineLength = Math.hypot(to.x - from.x, to.y - from.y);
  const distanceFromPassLine = (point) =>
    Math.abs(
      (to.y - from.y) * point.x - (to.x - from.x) * point.y + to.x * from.y - to.y * from.x,
    ) / lineLength;
  const shortBend = distanceFromPassLine(short[3]);
  const crossBend = distanceFromPassLine(cross[3]);

  assert.deepEqual(cross.at(-1), to);
  assert.deepEqual(short.at(-1), to);
  assert.ok(crossBend > shortBend);
  assert.ok(
    cross.every((point) => point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100),
  );
});

test("completed, intercepted and offside long passes share release duration and base trajectory", () => {
  const input = {
    from: { x: 14, y: 76 },
    intendedTarget: { x: 82, y: 24 },
    style: "long",
    frames: 7,
    curveSign: -1,
  };
  const completed = getMatchPassPresentation(input);
  const intercepted = getMatchPassPresentation(input);
  const offside = getMatchPassPresentation(input);
  const interceptionPoint = { x: 49, y: 51 };
  const offsideSpot = { x: 78, y: 31 };
  const interceptedPath = retargetMatchTrajectory(intercepted.trajectory, interceptionPoint);
  const offsidePath = retargetMatchTrajectory(offside.trajectory, offsideSpot);

  assert.equal(intercepted.durationMs, completed.durationMs);
  assert.equal(offside.durationMs, completed.durationMs);
  assert.deepEqual(intercepted.trajectory, completed.trajectory);
  assert.deepEqual(offside.trajectory, completed.trajectory);
  assert.deepEqual(interceptedPath[0], completed.trajectory[0]);
  assert.deepEqual(offsidePath[0], completed.trajectory[0]);
  assert.deepEqual(interceptedPath.at(-1), interceptionPoint);
  assert.deepEqual(offsidePath.at(-1), offsideSpot);
  assert.ok(completed.durationMs > 700);
});

test("offside pass flight advances time and keeps the restart ball detached", () => {
  const longPass = getMatchPassPresentation({
    from: { x: 18, y: 74 },
    intendedTarget: { x: 76, y: 21 },
    style: "long",
    frames: 7,
  });

  assert.equal(shouldFreezeMatchClock(EMatchEvent.OFFSIDE), false);
  assert.equal(shouldFreezeMatchClock(EMatchEvent.FREE_KICK), true);
  assert.equal(shouldAttachBallToOwner(EMatchEvent.OFFSIDE), false);
  assert.equal(resolveMatchPossessionCreditSide(EMatchEvent.OFFSIDE, "away", "away"), "home");
  assert.equal(resolveMatchPossessionCreditSide(EMatchEvent.PASS, "home", "home"), "home");
  assert.equal(
    getMatchClockAdvanceSeconds(longPass.durationMs, shouldFreezeMatchClock(EMatchEvent.OFFSIDE)),
    longPass.durationMs / 1000,
  );
});

test("cross and long-pass distance penalties normalize before applying their caps", () => {
  assert.equal(getDifficultPassDistancePenalty("cross", 20), 0);
  assert.equal(getDifficultPassDistancePenalty("cross", 42.5), 0.05);
  assert.equal(getDifficultPassDistancePenalty("cross", 65), 0.1);
  assert.equal(getDifficultPassDistancePenalty("long", 32), 0);
  assert.equal(getDifficultPassDistancePenalty("long", 59.5), 0.0275);
  assert.equal(getDifficultPassDistancePenalty("switch", 87), 0.055);
  assert.equal(getDifficultPassDistancePenalty("short", 90), 0);
});

test("sprinting drains more stamina and half-time restores a bounded amount", () => {
  const sprint = updateMatchStamina({
    current: 82,
    natural: 82,
    intensity: "sprint",
    elapsedSeconds: 1,
    fatigueLoad: 1.15,
  });
  const walk = updateMatchStamina({
    current: 82,
    natural: 82,
    intensity: "walk",
    elapsedSeconds: 1,
    fatigueLoad: 1,
  });
  const recovered = updateMatchStamina({
    current: 63,
    natural: 82,
    intensity: "rest",
    elapsedSeconds: 0,
    halfTimeRecovery: true,
  });

  assert.ok(sprint < walk);
  assert.ok(recovered > 63 && recovered <= 82);
});

test("shooting while sprinting has a bounded accuracy penalty mitigated by balance", () => {
  const standing = getShotMovementAccuracyPenalty({
    velocity: { x: 0.4, y: 0.2 },
    balance: 70,
    shotType: "NORMAL_SHOT",
  });
  const sprinting = getShotMovementAccuracyPenalty({
    velocity: { x: 7, y: -7 },
    balance: 62,
    shotType: "NORMAL_SHOT",
  });
  const balanced = getShotMovementAccuracyPenalty({
    velocity: { x: 7, y: -7 },
    balance: 94,
    shotType: "NORMAL_SHOT",
  });
  const firstTime = getShotMovementAccuracyPenalty({
    velocity: { x: 7, y: -7 },
    balance: 62,
    shotType: "FIRST_TIME_SHOT",
  });

  assert.equal(standing, 0);
  assert.ok(sprinting > balanced);
  assert.ok(sprinting <= 0.12);
  assert.ok(firstTime < sprinting);
});

test("a sharp change of direction brakes before accelerating into the new run", () => {
  const player = {
    id: 1,
    teamId: 1,
    side: "home",
    role: "ST",
    position: { x: 50, y: 50 },
    velocity: { x: 8, y: 0 },
    targetPosition: { x: 30, y: 50 },
    homePosition: { x: 50, y: 50 },
    state: "ATTACK_SPACE",
    stamina: 82,
    hasBall: false,
    stats: { speed: 82, acceleration: 82, stamina: 82, dribbling: 80 },
  };

  updatePlayerMovement(player, 0.4);
  const firstTurnSpeed = Math.hypot(player.velocity.x, player.velocity.y);
  const firstPosition = player.position.x;
  updatePlayerMovement(player, 0.4);

  assert.ok(firstTurnSpeed < 8);
  assert.ok(firstPosition > 47 && firstPosition < 51);
  assert.ok(player.velocity.x < 0);
  assert.ok(player.position.x < firstPosition);
});

test("movement integration follows current snapshot duration with safe bounds", () => {
  const shortDelta = getMatchMovementDeltaSeconds({
    durationMs: 300,
    isOpenPlay: true,
    baseTickSeconds: 0.4,
  });
  const longDelta = getMatchMovementDeltaSeconds({
    durationMs: 900,
    isOpenPlay: true,
    baseTickSeconds: 0.4,
  });
  const boundedDelta = getMatchMovementDeltaSeconds({
    durationMs: 3_000,
    isOpenPlay: true,
    baseTickSeconds: 0.4,
  });
  const lifecycleDelta = getMatchMovementDeltaSeconds({
    durationMs: 3_000,
    isOpenPlay: false,
    baseTickSeconds: 0.4,
  });
  const createRunner = () => ({
    id: 2,
    teamId: 1,
    side: "home",
    role: "W",
    position: { x: 10, y: 80 },
    velocity: { x: 0, y: 0 },
    targetPosition: { x: 90, y: 10 },
    homePosition: { x: 10, y: 80 },
    state: "ATTACK_SPACE",
    stamina: 84,
    hasBall: false,
    stats: { speed: 86, acceleration: 84, stamina: 84, dribbling: 82 },
  });
  const shortRunner = createRunner();
  const longRunner = createRunner();

  updatePlayerMovement(shortRunner, shortDelta, 1.3);
  updatePlayerMovement(longRunner, longDelta, 1.3);
  const shortDistance = Math.hypot(shortRunner.position.x - 10, shortRunner.position.y - 80);
  const longDistance = Math.hypot(longRunner.position.x - 10, longRunner.position.y - 80);

  assert.equal(shortDelta, 0.24);
  assert.equal(longDelta, 0.648);
  assert.equal(boundedDelta, 0.9);
  assert.equal(lifecycleDelta, 0.4);
  assert.ok(longDistance > shortDistance);
  assert.ok(longDistance < 15);
});

test("a won tackle or loose-ball recovery gets a short protected control window", () => {
  const snapshot = (ownerPlayerId, event, durationMs = 680) => ({
    ball: { ownerPlayerId },
    durationMs,
    highlight: { event },
  });
  const directWin = [snapshot(9, EMatchEvent.TACKLE)];
  const looseRecovery = [
    snapshot(null, EMatchEvent.SLIDE_TACKLE),
    snapshot(9, EMatchEvent.DRIBBLE),
  ];
  const settledControl = [
    snapshot(9, EMatchEvent.TACKLE),
    snapshot(9, EMatchEvent.DRIBBLE, POST_CHALLENGE_CONTROL_MS),
  ];

  assert.equal(hasPostChallengeControlProtection(directWin, 9), true);
  assert.equal(hasPostChallengeControlProtection(looseRecovery, 9), true);
  assert.equal(hasPostChallengeControlProtection(settledControl, 9), false);
  assert.equal(hasPostChallengeControlProtection([snapshot(9, EMatchEvent.PASS)], 9), false);
});

test("a deterministic match reaches half-time and full-time on the 360-second clock", () => {
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
      passRatio: 60,
      shotRatio: 58,
      pressure: 62,
      players: roster(1, 100),
    },
    {
      id: 2,
      name: "Away",
      formation: null,
      passRatio: 56,
      shotRatio: 64,
      pressure: 68,
      players: roster(2, 200),
    },
  );
  let homeLineup = lineups.homeLineup;
  let awayLineup = lineups.awayLineup;
  const timeline = [];

  for (let index = 0; index < 1_600; index += 1) {
    const result = generateNextMatchTick({
      previousTicks: timeline,
      homeLineup,
      awayLineup,
      homeTeamId: 1,
      simulationSeed: 41_337,
    });
    assert.ok(result);
    timeline.push(result.snapshot);
    homeLineup = result.snapshot.homePlayers;
    awayLineup = result.snapshot.awayPlayers;
    if (result.event.event === EMatchEvent.MATCH_END) break;
  }

  const last = timeline.at(-1);
  const events = new Set(timeline.map((snapshot) => snapshot.highlight.event));
  const presentationMs = timeline.reduce((total, snapshot) => total + snapshot.durationMs, 0);
  const durationVariants = new Set(timeline.map((snapshot) => snapshot.durationMs));
  const halfTimeWhistle = timeline.find(
    (snapshot) => snapshot.highlight.event === EMatchEvent.FIRST_HALF_END,
  );
  const secondHalfKickoff = timeline.find(
    (snapshot) => snapshot.highlight.event === EMatchEvent.SECOND_HALF_START,
  );

  assert.equal(last.highlight.event, EMatchEvent.MATCH_END);
  assert.equal(last.second, 360);
  assert.equal(last.clockLabel, "90:00");
  assert.ok(events.has(EMatchEvent.FIRST_HALF_END));
  assert.ok(events.has(EMatchEvent.SECOND_HALF_START));
  assert.equal(halfTimeWhistle.second, 180);
  assert.equal(secondHalfKickoff.second, 180);
  assert.ok(events.has(EMatchEvent.PASS));
  assert.ok(presentationMs >= MATCH_ACTIVE_DURATION_MS);
  assert.ok(presentationMs <= 600_000);
  assert.ok(durationVariants.size >= 4);
  assert.ok(homeLineup.some((player) => player.stamina < player.stats.stamina));
});
