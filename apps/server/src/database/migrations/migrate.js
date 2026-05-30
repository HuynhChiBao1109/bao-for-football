/* eslint-disable no-console */
const path = require("path");
const { createRequire } = require("module");

const requireFromServer = createRequire(
  path.resolve(__dirname, "../apps/server/package.json"),
);
const mysql = requireFromServer("mysql2/promise");
const dotenv = requireFromServer("dotenv");

const DEFAULT_MYSQL_DSN =
  "root:1234@tcp(localhost:3306)/fifam_dev?parseTime=true";
const DEFAULT_API_HOST = "v3.football.api-sports.io";
const DEFAULT_RAPID_API_KEY = "bb2298594195e93d3891a738150db6a1";
const DEFAULT_COUNTRY = "england";
const DEFAULT_LEAGUE = "39";
const DEFAULT_SEASON = "2024";
const DEFAULT_PLAYER_STAT = 60;
const DEFAULT_PLAYER_HEIGHT = 170;
const UNKNOWN_COUNTRY_ID = 168;

const REQUEST_TIMEOUT_MS = 30_000;

loadEnv();

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../.env"),
  ];

  for (const file of candidates) {
    const result = dotenv.config({ path: file });
    if (!result.error) {
      return;
    }
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (String(value || "").trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function parseGoStyleDSN(dsn) {
  // Example: root:1234@tcp(localhost:3306)/fifam_dev?parseTime=true
  const match = String(dsn || "").match(
    /^([^:]+):([^@]+)@tcp\(([^:()]+)(?::(\d+))?\)\/([^?]+)(?:\?.*)?$/,
  );

  if (!match) {
    return null;
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: Number(match[4] || 3306),
    database: match[5],
  };
}

function loadConfig() {
  const apiKey = firstNonEmpty(
    process.env.API_FOOTBALL_KEY,
    process.env.APISPORTS_KEY,
    process.env.X_APISPORTS_KEY,
    process.env["X-APISPORTS-KEY"],
  );

  const mysqlDSN = firstNonEmpty(process.env.MYSQL_DSN, DEFAULT_MYSQL_DSN);
  const parsedDSN = parseGoStyleDSN(mysqlDSN);

  return {
    mysql: {
      host: firstNonEmpty(
        process.env.MYSQL_HOST,
        parsedDSN && parsedDSN.host,
        "localhost",
      ),
      port: Number(
        firstNonEmpty(
          process.env.MYSQL_PORT,
          parsedDSN && parsedDSN.port,
          3306,
        ),
      ),
      user: firstNonEmpty(
        process.env.MYSQL_USER,
        parsedDSN && parsedDSN.user,
        "root",
      ),
      password: firstNonEmpty(
        process.env.MYSQL_PASSWORD,
        parsedDSN && parsedDSN.password,
        "",
      ),
      database: firstNonEmpty(
        process.env.MYSQL_DATABASE,
        parsedDSN && parsedDSN.database,
        "fifam_dev",
      ),
      connectionLimit: 5,
      timezone: "Z",
    },
    apiKey,
    rapidAPIKey: firstNonEmpty(
      process.env.API_FOOTBALL_KEY,
      DEFAULT_RAPID_API_KEY,
    ),
    apiHost: firstNonEmpty(process.env.API_FOOTBALL_HOST, DEFAULT_API_HOST),
    country: firstNonEmpty(process.env.API_FOOTBALL_COUNTRY, DEFAULT_COUNTRY),
    league: firstNonEmpty(process.env.API_FOOTBALL_LEAGUE, DEFAULT_LEAGUE),
    season: firstNonEmpty(process.env.API_FOOTBALL_SEASON, DEFAULT_SEASON),
  };
}

async function requestJSON(config, endpoint) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "X-RAPIDAPI-KEY": config.rapidAPIKey,
        },
        signal: controller.signal,
      });

      const bodyText = await response.text();
      clearTimeout(timeout);

      if (response.ok) {
        return JSON.parse(bodyText || "{}");
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`status=${response.status} body=${bodyText}`);
        await sleep(attempt * 500);
        continue;
      }

      throw new Error(`status=${response.status} body=${bodyText}`);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      await sleep(attempt * 400);
    }
  }

  throw lastError || new Error("request failed");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPremierLeagueClubs(config) {
  const query = new URLSearchParams({
    country: config.country,
    league: config.league,
    season: config.season,
  });

  const endpoint = `https://${config.apiHost}/teams?${query.toString()}`;
  const payload = await requestJSON(config, endpoint);
  const responseItems = Array.isArray(payload.response) ? payload.response : [];

  const seen = new Set();
  const clubs = [];

  for (const item of responseItems) {
    const team = item && item.team ? item.team : null;
    const id = Number(team && team.id);
    const name = String((team && team.name) || "").trim();

    if (!id || !name || seen.has(id)) {
      continue;
    }

    seen.add(id);
    clubs.push({
      id,
      name,
      logo: String((team && team.logo) || "").trim(),
      country: String((team && team.country) || "").trim(),
      leagueName: "Premier League",
    });
  }

  return clubs;
}

async function fetchSquadPlayers(config, teamID) {
  const query = new URLSearchParams({ team: String(teamID) });
  const endpoint = `https://${config.apiHost}/players/squads?${query.toString()}`;
  const payload = await requestJSON(config, endpoint);

  const first = Array.isArray(payload.response) ? payload.response[0] : null;
  const players = Array.isArray(first && first.players) ? first.players : [];

  const seen = new Set();
  const out = [];

  for (const p of players) {
    const name = String((p && p.name) || "").trim();
    if (!name) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push({
      name,
      position: String((p && p.position) || "").trim(),
      photo: String((p && p.photo) || "").trim(),
    });
  }

  return out;
}

async function ensureCountryID(db, id) {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS count FROM countries WHERE id = ?",
    [id],
  );
  const count = Number(rows && rows[0] && rows[0].count);
  if (count > 0) {
    return;
  }

  await db.execute(
    `
INSERT INTO countries (id, name, code, flag, created_at, updated_at)
VALUES (?, ?, ?, '', NOW(), NOW())`,
    [id, `Unknown (${id})`, `UNK-${id}`],
  );
}

function inferCountryCode(name) {
  const normalized = String(name || "")
    .trim()
    .toLowerCase();
  if (normalized === "england") {
    return "GB-ENG";
  }
  if (normalized.length < 2) {
    return "";
  }
  return normalized.slice(0, 2).toUpperCase();
}

async function resolveOrCreateCountry(db, countryName) {
  const name = String(countryName || "").trim();
  if (!name) {
    return null;
  }

  const [rows] = await db.query(
    "SELECT id FROM countries WHERE name = ? LIMIT 1",
    [name],
  );
  if (rows.length > 0) {
    return Number(rows[0].id);
  }

  const code = inferCountryCode(name);
  const [result] = await db.execute(
    `
INSERT INTO countries (name, code, flag, created_at, updated_at)
VALUES (?, ?, '', NOW(), NOW())`,
    [name, code],
  );

  return Number(result.insertId);
}

async function resolveOrCreateLeague(db, leagueName, countryID) {
  const name = String(leagueName || "").trim();
  if (!name) {
    return null;
  }

  const [rows] = await db.query(
    `
SELECT id
FROM leagues
WHERE name = ?
  AND ((country_id IS NULL AND ? IS NULL) OR country_id = ?)
LIMIT 1`,
    [name, countryID, countryID],
  );

  if (rows.length > 0) {
    return Number(rows[0].id);
  }

  const [result] = await db.execute(
    `
INSERT INTO leagues (name, country_id, logo, created_at, updated_at)
VALUES (?, ?, '', NOW(), NOW())`,
    [name, countryID],
  );

  return Number(result.insertId);
}

async function upsertClub(db, club) {
  const countryID = await resolveOrCreateCountry(db, club.country);
  const leagueID = await resolveOrCreateLeague(db, club.leagueName, countryID);

  await db.execute(
    `
INSERT INTO clubs (id, name, logo, country_id, league_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  logo = VALUES(logo),
  country_id = VALUES(country_id),
  league_id = VALUES(league_id),
  updated_at = NOW()`,
    [club.id, club.name, club.logo, countryID, leagueID],
  );
}

function mapPosition(apiPosition) {
  switch (
    String(apiPosition || "")
      .trim()
      .toLowerCase()
  ) {
    case "goalkeeper":
      return "GK";
    case "defender":
      return "CB";
    case "midfielder":
      return "CM";
    case "attacker":
    case "forward":
    case "striker":
      return "CF";
    default:
      return "";
  }
}

async function upsertPrimaryPosition(db, playerTemplateID, apiPosition) {
  const position = mapPosition(apiPosition);
  if (!position) {
    return;
  }

  await db.execute(
    `
INSERT INTO player_positions (player_template_id, position, effect, created_at, updated_at)
VALUES (?, ?, 1.00, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  effect = VALUES(effect),
  updated_at = NOW()`,
    [playerTemplateID, position],
  );
}

async function upsertPlayerTemplate(db, club, player) {
  const [rows] = await db.query(
    `
SELECT id
FROM player_templates
WHERE club_id = ?
  AND season = 'normal'
  AND LOWER(name) = LOWER(?)
LIMIT 1`,
    [club.id, player.name],
  );

  let existingID = rows.length > 0 ? Number(rows[0].id) : 0;

  if (!existingID) {
    const [result] = await db.execute(
      `
INSERT INTO player_templates (
  name,
  height_cm,
  country_id,
  club_id,
  base_club,
  season,
  image_url,
  base_shooting,
  base_passing,
  base_long_pass,
  base_vision,
  base_gk_reach,
  base_counter_attack_awareness,
  base_defending,
  base_gk_parrying,
  base_gk_reflex,
  base_duels,
  base_pace,
  base_stamina,
  base_balance,
  base_technique,
  base_determination,
  base_physical,
  base_standing_tackle,
  base_sliding_tackle,
  base_dribbling,
  base_curve,
  created_at,
  updated_at
) VALUES (?, ?, ?, ?, ?, 'normal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        player.name,
        DEFAULT_PLAYER_HEIGHT,
        UNKNOWN_COUNTRY_ID,
        club.id,
        club.name,
        player.photo,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
      ],
    );
    existingID = Number(result.insertId || 0);
  } else {
    await db.execute(
      `
UPDATE player_templates
SET
  name = ?,
  height_cm = ?,
  country_id = ?,
  club_id = ?,
  base_club = ?,
  season = 'normal',
  image_url = ?,
  base_shooting = ?,
  base_passing = ?,
  base_long_pass = ?,
  base_vision = ?,
  base_gk_reach = ?,
  base_counter_attack_awareness = ?,
  base_defending = ?,
  base_gk_parrying = ?,
  base_gk_reflex = ?,
  base_duels = ?,
  base_pace = ?,
  base_stamina = ?,
  base_balance = ?,
  base_technique = ?,
  base_determination = ?,
  base_physical = ?,
  base_standing_tackle = ?,
  base_sliding_tackle = ?,
  base_dribbling = ?,
  base_curve = ?,
  updated_at = NOW()
WHERE id = ?`,
      [
        player.name,
        DEFAULT_PLAYER_HEIGHT,
        UNKNOWN_COUNTRY_ID,
        club.id,
        club.name,
        player.photo,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        DEFAULT_PLAYER_STAT,
        existingID,
      ],
    );
  }

  if (existingID > 0) {
    await upsertPrimaryPosition(db, existingID, player.position);
  }
}

async function main() {
  const config = loadConfig();

  if (!config.apiKey && !config.rapidAPIKey) {
    throw new Error(
      "missing API key: set API_FOOTBALL_KEY/APISPORTS_KEY or RAPIDAPI_KEY",
    );
  }

  const db = await mysql.createPool(config.mysql);

  try {
    await db.query("SELECT 1");
    await ensureCountryID(db, UNKNOWN_COUNTRY_ID);

    const clubs = await fetchPremierLeagueClubs(config);
    if (!clubs.length) {
      throw new Error("no clubs returned from API");
    }

    let clubCount = 0;
    let playerCount = 0;

    for (const club of clubs) {
      await upsertClub(db, club);
      clubCount += 1;

      const players = await fetchSquadPlayers(config, club.id);
      for (const player of players) {
        await upsertPlayerTemplate(db, club, player);
        playerCount += 1;
      }

      console.log(
        `seeded team=${club.id} club="${club.name}" players=${players.length}`,
      );
    }

    console.log(`done: clubs=${clubCount} player_templates=${playerCount}`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("migration failed:", error);
  process.exitCode = 1;
});
