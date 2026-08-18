const path = require("node:path");
process.env.NODE_PATH = path.resolve(__dirname, "..");
require("node:module").Module._initPaths();
require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { MatchService } = require("../src/modules/match/match.service.ts");

function createDeferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

test(
  "stopping auto tick waits for the active tick to emit and prevents future scheduling",
  { timeout: 2_000 },
  async () => {
    const tickResult = createDeferred();
    const tickEntered = createDeferred();
    const order = [];
    let tickCalls = 0;

    const service = new MatchService(
      {},
      {
        emitToRoom: () => order.push("snapshot-emitted"),
      },
      {},
      {},
    );
    service.getNextTick = async () => {
      tickCalls += 1;
      tickEntered.resolve();
      return tickResult.promise;
    };

    await service.startAutoTick(42);
    await tickEntered.promise;

    let stopResolved = false;
    const stopPromise = service.stopAutoTick(42).then((result) => {
      stopResolved = true;
      order.push("stop-resolved");
      return result;
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(stopResolved, false);

    tickResult.resolve({
      snapshot: {
        frameId: 1,
        tick: 1,
        minute: 1,
        durationMs: 500,
        highlight: null,
      },
      campaignCompletion: null,
    });

    assert.deepEqual(await stopPromise, { matchId: "42", autoTicking: false });
    assert.deepEqual(order, ["snapshot-emitted", "stop-resolved"]);
    assert.equal(tickCalls, 1);
    assert.equal(service.autoTickTimers.has(42), false);
    assert.equal(service.autoTickInFlight.has(42), false);
  },
);

test(
  "a concurrent start cannot create a timer while stop is settling an active tick",
  { timeout: 2_000 },
  async () => {
    const tickResult = createDeferred();
    const tickEntered = createDeferred();
    const service = new MatchService({}, { emitToRoom: () => undefined }, {}, {});
    service.getNextTick = async () => {
      tickEntered.resolve();
      return tickResult.promise;
    };

    await service.startAutoTick(42);
    await tickEntered.promise;

    const stopPromise = service.stopAutoTick(42);
    await assert.rejects(service.startAutoTick(42), /Match auto tick is stopping/);

    tickResult.resolve({
      snapshot: {
        frameId: 1,
        tick: 1,
        minute: 1,
        durationMs: 500,
        highlight: null,
      },
      campaignCompletion: null,
    });

    await stopPromise;
    assert.equal(service.autoTickTimers.has(42), false);
    assert.equal(service.autoTickInFlight.has(42), false);
    assert.equal(service.autoTickStopOperations.has(42), false);
  },
);
