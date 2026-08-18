const path = require("node:path");
process.env.NODE_PATH = path.resolve(__dirname, "..");
require("node:module").Module._initPaths();
require("ts-node/register");

const test = require("node:test");
const assert = require("node:assert/strict");
const { MatchRepository } = require("../src/modules/match/match.repository.ts");

test("match details load one-to-many collections without a cartesian join", async () => {
  let matchFindOptions;
  let eventFindOptions;
  let statsFindOptions;
  const match = { id: 42 };
  const events = [{ id: 1, matchId: 42, minute: 3 }];
  const stats = [{ id: 2, matchId: 42, playerId: 9 }];
  const repository = new MatchRepository(
    {
      findOne: async (options) => {
        matchFindOptions = options;
        return match;
      },
    },
    {},
    {
      find: async (options) => {
        eventFindOptions = options;
        return events;
      },
    },
    {
      find: async (options) => {
        statsFindOptions = options;
        return stats;
      },
    },
    {},
    {},
    {},
    {},
    {},
  );

  const result = await repository.findMatchById(42);

  assert.equal(matchFindOptions.relations.matchEvents, undefined);
  assert.equal(matchFindOptions.relations.matchPlayerStats, undefined);
  assert.equal(matchFindOptions.order, undefined);
  assert.deepEqual(eventFindOptions, {
    where: { matchId: 42 },
    order: { minute: "ASC", id: "ASC" },
  });
  assert.deepEqual(statsFindOptions, {
    where: { matchId: 42 },
    order: { id: "ASC" },
  });
  assert.deepEqual(result.matchEvents, events);
  assert.deepEqual(result.matchPlayerStats, stats);
});

test("missing match does not query event or player-stat collections", async () => {
  let collectionQueries = 0;
  const collectionRepository = {
    find: async () => {
      collectionQueries += 1;
      return [];
    },
  };
  const repository = new MatchRepository(
    { findOne: async () => null },
    {},
    collectionRepository,
    collectionRepository,
    {},
    {},
    {},
    {},
    {},
  );

  assert.equal(await repository.findMatchById(404), null);
  assert.equal(collectionQueries, 0);
});
