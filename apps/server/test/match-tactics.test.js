const path = require("node:path");
process.env.NODE_PATH = path.resolve(__dirname, "..");
require("node:module").Module._initPaths();
require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeTeamTactics } = require("../src/modules/team/team-tactics.ts");
const {
  applyTeamTacticsToLineup,
  getSimulationTeamAttackingTactics,
  getSimulationTeamDefensiveTactics,
} = require("../src/modules/match/match-simulation.util.ts");
const { MatchService } = require("../src/modules/match/match.service.ts");

function tactics(overrides = {}) {
  return {
    passRatio: 50,
    shotRatio: 50,
    pressure: 50,
    mentality: "balanced",
    defensiveWidth: 5,
    defensiveDepth: 5,
    buildUpPlay: "balanced",
    chanceCreation: "balanced",
    attackingWidth: 5,
    playersInBox: 5,
    corners: 3,
    freeKicks: 3,
    ...overrides,
  };
}

test("tactics normalization clamps every level and rejects unknown select values", () => {
  const normalized = normalizeTeamTactics({
    mentality: "unknown",
    defensiveWidth: 99,
    defensiveDepth: -4,
    buildUpPlay: "invalid",
    chanceCreation: "counter_attack",
    attackingWidth: 7.6,
    playersInBox: 0,
    corners: 12,
    freeKicks: 2.2,
  });

  assert.deepEqual(normalized, {
    mentality: "balanced",
    defensiveWidth: 10,
    defensiveDepth: 1,
    buildUpPlay: "balanced",
    chanceCreation: "counter_attack",
    attackingWidth: 8,
    playersInBox: 1,
    corners: 5,
    freeKicks: 2,
  });
});

test("attacking and high-line profiles materially change both attacking and defensive AI", () => {
  const cautious = tactics({
    mentality: "park_the_bus",
    defensiveDepth: 1,
    buildUpPlay: "short_passing",
    chanceCreation: "short_passing",
    playersInBox: 1,
  });
  const aggressive = tactics({
    mentality: "high_line",
    defensiveDepth: 10,
    buildUpPlay: "counter_attack",
    chanceCreation: "counter_attack",
    playersInBox: 10,
  });

  const cautiousAttack = getSimulationTeamAttackingTactics(cautious);
  const aggressiveAttack = getSimulationTeamAttackingTactics(aggressive);
  const cautiousDefense = getSimulationTeamDefensiveTactics(cautious);
  const aggressiveDefense = getSimulationTeamDefensiveTactics(aggressive);

  assert.ok(aggressiveAttack.risk > cautiousAttack.risk);
  assert.ok(aggressiveAttack.tempo > cautiousAttack.tempo);
  assert.ok(aggressiveAttack.directness > cautiousAttack.directness);
  assert.ok(aggressiveAttack.shootingPriority > cautiousAttack.shootingPriority);
  assert.ok(aggressiveDefense.defensiveLine > cautiousDefense.defensiveLine);
  assert.ok(aggressiveDefense.pressingIntensity > cautiousDefense.pressingIntensity);
});

test("defensive and attacking width alter compactness in the expected direction", () => {
  const narrowDefense = getSimulationTeamDefensiveTactics(tactics({ defensiveWidth: 1 }));
  const wideDefense = getSimulationTeamDefensiveTactics(tactics({ defensiveWidth: 10 }));
  const narrowAttack = getSimulationTeamAttackingTactics(tactics({ attackingWidth: 1 }));
  const wideAttack = getSimulationTeamAttackingTactics(tactics({ attackingWidth: 10 }));

  assert.ok(narrowDefense.compactness > wideDefense.compactness);
  assert.ok(narrowAttack.compactness > wideAttack.compactness);
});

test("live tactic replacement preserves player state while replacing both AI profiles", () => {
  const player = {
    userPlayerId: 7,
    x: 48,
    y: 63,
    stamina: 77,
    hasBall: true,
    teamTactics: { risk: 0.1 },
    defensiveTactics: { defensiveLine: 0.1 },
  };
  const updated = applyTeamTacticsToLineup([player], tactics({ mentality: "attacking" }))[0];

  assert.equal(updated.userPlayerId, player.userPlayerId);
  assert.equal(updated.x, player.x);
  assert.equal(updated.y, player.y);
  assert.equal(updated.stamina, player.stamina);
  assert.equal(updated.hasBall, true);
  assert.notEqual(updated.teamTactics.risk, player.teamTactics.risk);
  assert.notEqual(updated.defensiveTactics.defensiveLine, player.defensiveTactics.defensiveLine);
});

test("updating tactics during a match persists the team and replaces the runtime lineup", async () => {
  const teamWrites = [];
  const matchWrites = [];
  const runtimeWrites = [];
  const runtime = {
    matchId: 42,
    simulationRunId: "42:run",
    status: "in_progress",
    homeLineup: [{ userPlayerId: 1, x: 50, y: 70, stamina: 80 }],
    awayLineup: [{ userPlayerId: 2, x: 50, y: 30, stamina: 80 }],
    timeline: [],
  };
  const repository = {
    findMatchById: async () => ({
      id: 42,
      status: "in_progress",
      homeTeamId: 1,
      awayTeamId: 2,
      homeTeam: { id: 1, userId: 9, ...tactics() },
      awayTeam: { id: 2, userId: null, ...tactics() },
    }),
    updateTeamTactics: async (teamId, payload) => teamWrites.push({ teamId, payload }),
    update: async (matchId, payload) => matchWrites.push({ matchId, payload }),
  };
  const redis = {
    getJson: async () => runtime,
    setJson: async (_key, payload) => runtimeWrites.push(payload),
  };
  const service = new MatchService(repository, {}, redis, {});

  const result = await service.updateTactics(
    42,
    { id: 9 },
    { mentality: "ultra_attacking", defensiveDepth: 9, corners: 5 },
  );

  assert.equal(result.side, "home");
  assert.equal(result.mentality, "ultra_attacking");
  assert.equal(teamWrites.length, 1);
  assert.equal(teamWrites[0].teamId, 1);
  assert.equal(matchWrites.length, 1);
  assert.equal(runtimeWrites.length, 1);
  assert.equal(runtimeWrites[0].homeLineup[0].x, 50);
  assert.ok(runtimeWrites[0].homeLineup[0].teamTactics.risk > 0.5);
  assert.equal(runtimeWrites[0].awayLineup[0].teamTactics, undefined);
});
