const path = require("node:path");
process.env.NODE_PATH = path.resolve(__dirname, "..");
require("node:module").Module._initPaths();
require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { MatchService } = require("../src/modules/match/match.service.ts");

function createMatch() {
  return {
    id: 42,
    homeTeamId: 1,
    awayTeamId: 2,
    status: "in_progress",
    currentMinute: 0,
    clockSeconds: 0,
    homeScore: 0,
    awayScore: 0,
    homeLineup: [],
    awayLineup: [],
    timeline: [],
    latestSnapshot: null,
  };
}

test("reset creates a new simulation run shared by HTTP state and runtime cache", async () => {
  const cachedRuns = [];
  const repository = {
    findMatchById: async () => createMatch(),
    findTeamById: async (id) => ({ id, userId: id, teamName: `Team ${id}` }),
    resetMatchProgress: async () => undefined,
  };
  const redis = {
    del: async () => undefined,
    setJson: async (_key, value) => cachedRuns.push(value),
  };
  const service = new MatchService(repository, {}, redis, {});
  service.buildKickoffLineups = async () => ({
    homeLineup: [{ id: "home" }],
    awayLineup: [{ id: "away" }],
  });

  const firstReset = await service.resetMatch(42);
  const secondReset = await service.resetMatch(42);

  assert.equal(typeof firstReset.simulationRunId, "string");
  assert.equal(cachedRuns[0].simulationRunId, firstReset.simulationRunId);
  assert.equal(cachedRuns[1].simulationRunId, secondReset.simulationRunId);
  assert.notEqual(firstReset.simulationRunId, secondReset.simulationRunId);
});

test("concurrent resets share one lifecycle operation and block auto-start", async () => {
  let releaseTeamLookup;
  const teamLookupGate = new Promise((resolve) => {
    releaseTeamLookup = resolve;
  });
  let resetWrites = 0;
  const repository = {
    findMatchById: async () => createMatch(),
    findTeamById: async (id) => {
      await teamLookupGate;
      return { id, userId: id, teamName: `Team ${id}` };
    },
    resetMatchProgress: async () => {
      resetWrites += 1;
    },
  };
  const redis = {
    del: async () => undefined,
    setJson: async () => undefined,
  };
  const service = new MatchService(repository, {}, redis, {});
  service.buildKickoffLineups = async () => ({
    homeLineup: [{ id: "home" }],
    awayLineup: [{ id: "away" }],
  });

  const firstReset = service.resetMatch(42);
  const secondReset = service.resetMatch(42);
  await assert.rejects(service.startAutoTick(42), /Match is resetting/);

  releaseTeamLookup();
  const [firstResult, secondResult] = await Promise.all([firstReset, secondReset]);

  assert.equal(firstResult.simulationRunId, secondResult.simulationRunId);
  assert.equal(resetWrites, 1);
  assert.equal(service.matchResetOperations.has(42), false);
  assert.equal(service.autoTickTimers.has(42), false);
});

test("GET uses one authoritative runtime generation for all mutable match state", async () => {
  const persistedMatch = {
    ...createMatch(),
    currentMinute: 78,
    homeScore: 3,
    latestSnapshot: {
      simulationRunId: "42:old-run",
      frameId: 91,
    },
  };
  const runtimeSnapshot = {
    simulationRunId: "42:new-run",
    frameId: -1,
    minute: 0,
    second: 0,
    homeScore: 0,
    awayScore: 0,
  };
  const runtimeState = {
    matchId: 42,
    simulationRunId: "42:new-run",
    status: "in_progress",
    currentMinute: 0,
    clockSeconds: 0,
    homeScore: 0,
    awayScore: 0,
    homeLineup: [{ id: "new-home" }],
    awayLineup: [{ id: "new-away" }],
    timeline: [runtimeSnapshot],
    latestSnapshot: runtimeSnapshot,
    simulationSeed: 123,
  };
  const service = new MatchService(
    { findMatchById: async () => persistedMatch },
    {},
    { getJson: async () => runtimeState },
    {},
  );

  const result = await service.getById(42);

  assert.equal(result.simulationRunId, "42:new-run");
  assert.equal(result.currentMinute, 0);
  assert.equal(result.homeScore, 0);
  assert.equal(result.latestSnapshot.simulationRunId, "42:new-run");
  assert.deepEqual(result.homeLineup, [{ id: "new-home" }]);
  assert.deepEqual(result.timeline, [runtimeSnapshot]);
});

test("snapshot, event and completed socket packets carry the snapshot simulation run", () => {
  const packets = [];
  const service = new MatchService({}, { emitToRoom: (packet) => packets.push(packet) }, {}, {});
  const snapshot = {
    simulationRunId: "42:test-run",
    frameId: 5,
    tick: 5,
    minute: 12,
    homeScore: 1,
    awayScore: 0,
    highlight: { event: 7, skill: null },
  };

  service.emitTickResult(42, snapshot, true, null);

  assert.equal(packets.length, 3);
  assert.deepEqual(
    packets.map((packet) => packet.data.simulationRunId),
    ["42:test-run", "42:test-run", "42:test-run"],
  );
  assert.equal(packets[0].data.snapshot.simulationRunId, "42:test-run");
});
