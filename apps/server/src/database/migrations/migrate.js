const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const { config } = require("dotenv");

const PLAYER_SEASONS = new Set(["normal", "icon", "legend", "big_match", "CURRENT"]);
const PLAYER_BODIES = new Set(["normal", "fat", "thin", "NORMAL", "LEAN", "STOCKY"]);

function loadEnv() {
  const envCandidates = [
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];

  const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
  if (envPath) {
    config({ path: envPath });
    console.log(`Loaded env from: ${envPath}`);
    return;
  }

  config();
  console.warn("No explicit .env file found, fallback to process environment variables.");
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function createSlug(value, fallback) {
  const slug = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function getPlayerSkillSlug(skill) {
  if (Number(skill) === 1) return "shoot-thunder";
  if (Number(skill) === 2) return "dribble-magic";
  return `skill-${String(skill)}`;
}

function normalizeCountry(item) {
  const name = String(item?.name || "").trim();
  const imgUrl = item?.flag ? String(item.flag).trim() : null;

  if (!name) {
    return null;
  }

  return {
    name,
    slug: createSlug(name, "country"),
    img_url: imgUrl || null,
  };
}

function flattenPlayers(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const result = [];
  for (const item of value) {
    if (Array.isArray(item)) {
      result.push(...flattenPlayers(item));
      continue;
    }

    if (item && typeof item === "object") {
      result.push(item);
    }
  }

  return result;
}

function toInt(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

function normalizePositions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      position: String(item.position || "").trim(),
      rating: Number(item.rating),
    }))
    .filter((item) => item.position && Number.isFinite(item.rating));
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => toInt(item, null)).filter((item) => item === 1 || item === 2);
}

function normalizeJsonValue(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function serializeQueryValue(value) {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value);
  }

  return value;
}

function normalizePlayer(item, leagueCountryName) {
  const name = String(item?.name || "").trim();
  if (!name) {
    return null;
  }

  const season = String(item?.season || "").trim();
  const bodyType = String(item?.bodyType || "").trim();

  if (!season || !PLAYER_SEASONS.has(season)) {
    throw new Error(
      `Unsupported player season '${season}' for ${name}. Add it to EPlayerSeason first.`,
    );
  }

  if (!bodyType || !PLAYER_BODIES.has(bodyType)) {
    throw new Error(
      `Unsupported player bodyType '${bodyType}' for ${name}. Add it to EPlayerBody first.`,
    );
  }

  return {
    name,
    season,
    slug: createSlug(name, "player"),
    countryName: String(item?.country || leagueCountryName || "").trim() || null,
    height: toInt(item?.height, 180),
    body_type: bodyType,
    pass: toInt(item?.pass, 75),
    long_pass: toInt(item?.longPass, 75),
    vision: toInt(item?.vision, 75),
    shoot: toInt(item?.shoot, 75),
    tackle: toInt(item?.tackle, 75),
    balance: toInt(item?.balance, 75),
    dribbling: toInt(item?.dribbling, 75),
    acceleration: toInt(item?.acceleration, 75),
    speed: toInt(item?.speed, 75),
    stamina: toInt(item?.stamina, 75),
    positions: normalizePositions(item?.positions),
    skills: normalizeSkills(item?.skills),
  };
}

function normalizeLeague(item) {
  const name = String(item?.name || "").trim();
  const imgUrl = item?.logo ? String(item.logo).trim() : null;
  const countryName = String(item?.country || "").trim();

  if (!name || !countryName) {
    return null;
  }

  const clubs = Array.isArray(item?.clubs)
    ? item.clubs
        .map((club) => {
          const clubName = String(club?.name || "").trim();
          const clubImgUrl = club?.img_url ? String(club.img_url).trim() : null;

          if (!clubName) {
            return null;
          }

          const players = flattenPlayers(club?.players)
            .map((player) => normalizePlayer(player, countryName))
            .filter(Boolean);

          return {
            name: clubName,
            slug: createSlug(clubName, "club"),
            img_url: clubImgUrl || null,
            players,
          };
        })
        .filter(Boolean)
    : [];

  return {
    name,
    countryName,
    img_url: imgUrl || null,
    clubs,
  };
}

function buildDbConfig() {
  const host = process.env.MYSQL_HOST;
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !database) {
    throw new Error(
      "Missing DB config. Required: MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE (and optional MYSQL_PASSWORD, MYSQL_PORT).",
    );
  }

  return {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false,
  };
}

async function insertBatch(connection, table, columns, rows) {
  if (rows.length === 0) {
    return;
  }

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows
      .slice(i, i + chunkSize)
      .map((row) => row.map((value) => serializeQueryValue(value)));
    await connection.query(`INSERT INTO ${table} (${columns}) VALUES ?`, [chunk]);
  }
}

async function getCountryIdMap(connection) {
  const [countryRows] = await connection.execute("SELECT id, name FROM countries");
  const countryIdByName = new Map();
  for (const row of countryRows) {
    countryIdByName.set(normalizeKey(row.name), row.id);
  }

  return countryIdByName;
}

async function migrateCountries(connection) {
  const rawData = fs.readFileSync(path.resolve(__dirname, "country.json"), "utf8");
  const countries = JSON.parse(rawData).map(normalizeCountry).filter(Boolean);

  const [existingRows] = await connection.execute("SELECT id, name, slug, img_url FROM countries");
  const existingByName = new Map();
  for (const row of existingRows) {
    existingByName.set(normalizeKey(row.name), row);
  }

  const toInsert = [];
  const toUpdate = [];

  for (const country of countries) {
    const existing = existingByName.get(normalizeKey(country.name));
    if (!existing) {
      toInsert.push([country.name, country.slug, country.img_url]);
      continue;
    }

    if ((existing.slug || null) !== country.slug || (existing.img_url || null) !== country.img_url) {
      toUpdate.push([country.slug, country.img_url, existing.id]);
    }
  }

  await insertBatch(connection, "countries", "name, slug, img_url", toInsert);

  for (const [slug, imgUrl, id] of toUpdate) {
    await connection.execute("UPDATE countries SET slug = ?, img_url = ? WHERE id = ?", [
      slug,
      imgUrl,
      id,
    ]);
  }

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
  };
}

async function migrateLeagues(connection, leagues, countryIdByName) {
  const unresolvedCountries = new Set();
  const leaguesWithCountryId = leagues
    .map((league) => {
      const countryId = countryIdByName.get(normalizeKey(league.countryName));
      if (!countryId) {
        unresolvedCountries.add(league.countryName);
        return null;
      }

      return {
        ...league,
        countryId,
      };
    })
    .filter(Boolean);

  if (unresolvedCountries.size > 0) {
    throw new Error(
      `Cannot resolve country_id for: ${Array.from(unresolvedCountries).join(", ")}. Run country migration first or fix country names in league.json.`,
    );
  }

  const [existingRows] = await connection.execute(
    "SELECT id, name, img_url, country_id FROM leagues",
  );
  const existingByName = new Map();
  for (const row of existingRows) {
    existingByName.set(normalizeKey(row.name), row);
  }

  const toInsert = [];
  const toUpdate = [];

  for (const league of leaguesWithCountryId) {
    const existing = existingByName.get(normalizeKey(league.name));
    if (!existing) {
      toInsert.push([league.name, league.img_url, league.countryId]);
      continue;
    }

    const isImgChanged = (existing.img_url || null) !== league.img_url;
    const isCountryChanged = String(existing.country_id) !== String(league.countryId);

    if (isImgChanged || isCountryChanged) {
      toUpdate.push([league.img_url, league.countryId, existing.id]);
    }
  }

  await insertBatch(connection, "leagues", "name, img_url, country_id", toInsert);

  for (const [imgUrl, countryId, id] of toUpdate) {
    await connection.execute("UPDATE leagues SET img_url = ?, country_id = ? WHERE id = ?", [
      imgUrl,
      countryId,
      id,
    ]);
  }

  const [allLeagueRows] = await connection.execute("SELECT id, name, country_id FROM leagues");
  const leagueByName = new Map();
  for (const row of allLeagueRows) {
    leagueByName.set(normalizeKey(row.name), row);
  }

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    data: leaguesWithCountryId,
    leagueByName,
  };
}

async function migrateClubs(connection, leaguesWithCountryId, leagueByName) {
  const clubsWithRefs = [];

  for (const league of leaguesWithCountryId) {
    const dbLeague = leagueByName.get(normalizeKey(league.name));
    if (!dbLeague) {
      throw new Error(`Cannot resolve league_id for league '${league.name}'.`);
    }

    for (const club of league.clubs) {
      clubsWithRefs.push({
        name: club.name,
        img_url: club.img_url,
        leagueId: dbLeague.id,
        countryId: dbLeague.country_id,
        players: club.players,
      });
    }
  }

  const [existingRows] = await connection.execute("SELECT id, name, img_url, league_id FROM clubs");
  const existingByKey = new Map();
  for (const row of existingRows) {
    const key = `${normalizeKey(row.name)}|${String(row.league_id)}`;
    existingByKey.set(key, row);
  }

  const toInsert = [];
  const toUpdate = [];

  for (const club of clubsWithRefs) {
    const key = `${normalizeKey(club.name)}|${String(club.leagueId)}`;
    const existing = existingByKey.get(key);

    if (!existing) {
      toInsert.push([club.name, club.slug, club.img_url, club.leagueId]);
      continue;
    }

    if (
      (existing.slug || null) !== (club.slug || null) ||
      (existing.img_url || null) !== (club.img_url || null)
    ) {
      toUpdate.push([club.slug, club.img_url, existing.id]);
    }
  }

  await insertBatch(connection, "clubs", "name, slug, img_url, league_id", toInsert);

  for (const [slug, imgUrl, id] of toUpdate) {
    await connection.execute("UPDATE clubs SET slug = ?, img_url = ? WHERE id = ?", [
      slug,
      imgUrl,
      id,
    ]);
  }

  const [allClubRows] = await connection.execute("SELECT id, name, league_id FROM clubs");
  const clubByKey = new Map();
  for (const row of allClubRows) {
    const key = `${normalizeKey(row.name)}|${String(row.league_id)}`;
    clubByKey.set(key, row);
  }

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    data: clubsWithRefs,
    clubByKey,
  };
}

async function migratePlayers(connection, clubsWithRefs, clubByKey, countryIdByName) {
  const [existingRows] = await connection.execute(
    "SELECT id, name, slug, season, country_id, club_id, height, body_type, `pass`, long_pass, vision, shoot, tackle, balance, dribbling, acceleration, speed, stamina, positions FROM players",
  );

  const existingByKey = new Map();
  for (const row of existingRows) {
    const key = `${normalizeKey(row.name)}|${String(row.season)}`;
    existingByKey.set(key, row);
  }

  const toInsert = [];
  const toUpdate = [];

  for (const club of clubsWithRefs) {
    const clubKey = `${normalizeKey(club.name)}|${String(club.leagueId)}`;
    const dbClub = clubByKey.get(clubKey);

    if (!dbClub) {
      throw new Error(`Cannot resolve club_id for club '${club.name}'.`);
    }

    for (const player of club.players) {
      const countryId = player.countryName
        ? (countryIdByName.get(normalizeKey(player.countryName)) ?? null)
        : club.countryId;

      const record = {
        name: player.name,
        slug: player.slug,
        season: player.season,
        country_id: countryId,
        club_id: dbClub.id,
        height: player.height,
        body_type: player.body_type,
        pass: player.pass,
        long_pass: player.long_pass,
        vision: player.vision,
        shoot: player.shoot,
        tackle: player.tackle,
        balance: player.balance,
        dribbling: player.dribbling,
        acceleration: player.acceleration,
        speed: player.speed,
        stamina: player.stamina,
        positions: normalizePositions(player.positions),
      };

      const key = `${normalizeKey(record.name)}|${String(record.season)}`;
      const existing = existingByKey.get(key);

      if (!existing) {
        toInsert.push([
          record.name,
          record.slug,
          record.season,
          record.country_id,
          record.club_id,
          record.height,
          record.body_type,
          record.pass,
          record.long_pass,
          record.vision,
          record.shoot,
          record.tackle,
          record.balance,
          record.dribbling,
          record.acceleration,
          record.speed,
          record.stamina,
          record.positions,
        ]);
        continue;
      }

      const changed =
        String(existing.slug || "") !== String(record.slug || "") ||
        String(existing.country_id) !== String(record.country_id) ||
        String(existing.club_id) !== String(record.club_id) ||
        Number(existing.height) !== Number(record.height) ||
        String(existing.body_type) !== String(record.body_type) ||
        Number(existing.pass) !== Number(record.pass) ||
        Number(existing.long_pass) !== Number(record.long_pass) ||
        Number(existing.vision) !== Number(record.vision) ||
        Number(existing.shoot) !== Number(record.shoot) ||
        Number(existing.tackle) !== Number(record.tackle) ||
        Number(existing.balance) !== Number(record.balance) ||
        Number(existing.dribbling) !== Number(record.dribbling) ||
        Number(existing.acceleration) !== Number(record.acceleration) ||
        Number(existing.speed) !== Number(record.speed) ||
        Number(existing.stamina) !== Number(record.stamina) ||
        JSON.stringify(normalizeJsonValue(existing.positions)) !== JSON.stringify(record.positions);

      if (changed) {
        toUpdate.push([
          record.slug,
          record.country_id,
          record.club_id,
          record.height,
          record.body_type,
          record.pass,
          record.long_pass,
          record.vision,
          record.shoot,
          record.tackle,
          record.balance,
          record.dribbling,
          record.acceleration,
          record.speed,
          record.stamina,
          JSON.stringify(record.positions),
          existing.id,
        ]);
      }
    }
  }

  await insertBatch(
    connection,
    "players",
    "name, slug, season, country_id, club_id, height, body_type, `pass`, long_pass, vision, shoot, tackle, balance, dribbling, acceleration, speed, stamina, positions",
    toInsert,
  );

  for (const values of toUpdate) {
    await connection.execute(
      "UPDATE players SET slug = ?, country_id = ?, club_id = ?, height = ?, body_type = ?, `pass` = ?, long_pass = ?, vision = ?, shoot = ?, tackle = ?, balance = ?, dribbling = ?, acceleration = ?, speed = ?, stamina = ?, positions = ? WHERE id = ?",
      values,
    );
  }

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
  };
}

async function migratePlayerSkills(connection, clubsWithRefs) {
  const [playerRows] = await connection.execute("SELECT id, name, season FROM players");
  const playerByKey = new Map();
  for (const row of playerRows) {
    playerByKey.set(`${normalizeKey(row.name)}|${String(row.season)}`, row);
  }

  const [existingRows] = await connection.execute("SELECT player_id, skill FROM player_skills");
  const existingByKey = new Set(
    existingRows.map((row) => `${String(row.player_id)}|${String(row.skill)}`),
  );

  const skillRows = [];
  for (const club of clubsWithRefs) {
    for (const player of club.players) {
      if (!Array.isArray(player.skills) || player.skills.length === 0) {
        continue;
      }

      const dbPlayer = playerByKey.get(`${normalizeKey(player.name)}|${String(player.season)}`);
      if (!dbPlayer) {
        continue;
      }

      for (const skill of player.skills) {
        const key = `${String(dbPlayer.id)}|${String(skill)}`;
        if (existingByKey.has(key)) {
          continue;
        }
        existingByKey.add(key);
        skillRows.push([dbPlayer.id, skill, getPlayerSkillSlug(skill)]);
      }
    }
  }

  await insertBatch(connection, "player_skills", "player_id, skill, slug", skillRows);

  return {
    inserted: skillRows.length,
  };
}

// Ensure admin user exists (username: admin, password: 123). Returns admin user id.
async function migrateAdminUser(connection) {
  const [rows] = await connection.execute("SELECT id FROM users WHERE userName = ?", ["admin"]);

  if (rows.length > 0) {
    console.log("Admin user already exists, reusing existing admin.");
    return rows[0].id;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("123", salt);

  const [result] = await connection.execute(
    "INSERT INTO users (userName, password_hash, salt) VALUES (?, ?, ?)",
    ["admin", passwordHash, salt],
  );

  console.log(`Admin user created with id: ${result.insertId}`);
  return result.insertId;
}

// Create a BOT team for each club under the given admin user.
async function migrateTeams(connection, clubsWithRefs, clubByKey, adminId) {
  const [existingRows] = await connection.execute(
    "SELECT id, team_name FROM teams WHERE user_id = ? AND type = 2",
    [adminId],
  );
  const existingByName = new Set(existingRows.map((r) => normalizeKey(r.team_name)));

  const toInsert = [];
  for (const club of clubsWithRefs) {
    const dbClub = clubByKey.get(`${normalizeKey(club.name)}|${String(club.leagueId)}`);
    if (!dbClub) continue;

    if (!existingByName.has(normalizeKey(club.name))) {
      // columns: user_id, team_name, img_url, formation(F442=1), pass_ratio, shot_ratio, pressure, rank_point, budget, type(BOT=2)
      toInsert.push([adminId, club.name, club.img_url || null, 1, 0, 0, 50, 0, 360000000, 2]);
    }
  }

  await insertBatch(
    connection,
    "teams",
    "user_id, team_name, img_url, formation, pass_ratio, shot_ratio, pressure, rank_point, budget, type",
    toInsert,
  );

  return { inserted: toInsert.length };
}

// Insert user_players (and their skills) for each club's players under the admin user.
async function migrateUserPlayersForAdmin(connection, clubsWithRefs, clubByKey, adminId) {
  // Collect all DB club IDs from the migrated clubs
  const clubDbIds = [];
  for (const club of clubsWithRefs) {
    const dbClub = clubByKey.get(`${normalizeKey(club.name)}|${String(club.leagueId)}`);
    if (dbClub) clubDbIds.push(dbClub.id);
  }

  if (clubDbIds.length === 0) return { inserted: 0 };

  // Fetch all players belonging to these clubs
  const [allPlayers] = await connection.query(
    "SELECT id, positions FROM players WHERE club_id IN (?)",
    [clubDbIds],
  );

  if (allPlayers.length === 0) return { inserted: 0 };

  // Find which players admin already owns
  const [existingRows] = await connection.execute(
    "SELECT player_id FROM user_players WHERE user_id = ?",
    [adminId],
  );
  const existingPlayerIds = new Set(existingRows.map((r) => String(r.player_id)));

  // Build rows to insert
  const toInsert = [];
  for (const player of allPlayers) {
    if (existingPlayerIds.has(String(player.id))) continue;
    const positions =
      typeof player.positions === "string" ? player.positions : JSON.stringify(player.positions);
    // columns: user_id, player_id, exp, bonus_attack, bonus_defense, bonus_agility, bonus_pass, bonus_goalkeeping, positions
    toInsert.push([adminId, player.id, 0, 0, 0, 0, 0, 0, positions]);
  }

  if (toInsert.length === 0) return { inserted: 0 };

  await insertBatch(
    connection,
    "user_players",
    "user_id, player_id, exp, bonus_attack, bonus_defense, bonus_agility, bonus_pass, bonus_goalkeeping, positions",
    toInsert,
  );

  // Retrieve the newly inserted user_player IDs
  const newPlayerIds = toInsert.map((row) => row[1]);
  const [newUserPlayers] = await connection.query(
    "SELECT id, player_id FROM user_players WHERE user_id = ? AND player_id IN (?)",
    [adminId, newPlayerIds],
  );

  // Fetch all relevant player skills in one query
  const [allSkillRows] = await connection.query(
    "SELECT player_id, skill FROM player_skills WHERE player_id IN (?)",
    [newPlayerIds],
  );
  const skillsByPlayerId = new Map();
  for (const row of allSkillRows) {
    const key = String(row.player_id);
    if (!skillsByPlayerId.has(key)) skillsByPlayerId.set(key, []);
    skillsByPlayerId.get(key).push(row.skill);
  }

  // Batch insert user_player_skills
  const skillsToInsert = [];
  for (const userPlayer of newUserPlayers) {
    const skills = skillsByPlayerId.get(String(userPlayer.player_id)) || [];
    for (const skill of skills) {
      skillsToInsert.push([userPlayer.id, skill]);
    }
  }

  if (skillsToInsert.length > 0) {
    await insertBatch(connection, "user_player_skills", "user_player_id, skill", skillsToInsert);
  }

  return { inserted: toInsert.length };
}

async function runMigration() {
  loadEnv();

  const connection = await mysql.createConnection(buildDbConfig());

  try {
    await connection.beginTransaction();

    const countryResult = await migrateCountries(connection);
    const countryIdByName = await getCountryIdMap(connection);

    const rawLeagueData = fs.readFileSync(path.resolve(__dirname, "league.json"), "utf8");
    const leagues = JSON.parse(rawLeagueData).map(normalizeLeague).filter(Boolean);

    const leagueResult = await migrateLeagues(connection, leagues, countryIdByName);
    const clubResult = await migrateClubs(connection, leagueResult.data, leagueResult.leagueByName);
    const playerResult = await migratePlayers(
      connection,
      clubResult.data,
      clubResult.clubByKey,
      countryIdByName,
    );
    const playerSkillResult = await migratePlayerSkills(connection, clubResult.data);

    const adminId = await migrateAdminUser(connection);
    const teamResult = await migrateTeams(
      connection,
      clubResult.data,
      clubResult.clubByKey,
      adminId,
    );
    const userPlayerResult = await migrateUserPlayersForAdmin(
      connection,
      clubResult.data,
      clubResult.clubByKey,
      adminId,
    );

    await connection.commit();

    console.log(
      `Country migration completed. Inserted: ${countryResult.inserted}, updated: ${countryResult.updated}.`,
    );
    console.log(
      `League migration completed. Inserted: ${leagueResult.inserted}, updated: ${leagueResult.updated}.`,
    );
    console.log(
      `Club migration completed. Inserted: ${clubResult.inserted}, updated: ${clubResult.updated}.`,
    );
    console.log(
      `Player migration completed. Inserted: ${playerResult.inserted}, updated: ${playerResult.updated}.`,
    );
    console.log(`Player skill migration completed. Inserted: ${playerSkillResult.inserted}.`);
    console.log(`Team (BOT) migration completed. Inserted: ${teamResult.inserted}.`);
    console.log(
      `User-player migration for admin completed. Inserted: ${userPlayerResult.inserted}.`,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
