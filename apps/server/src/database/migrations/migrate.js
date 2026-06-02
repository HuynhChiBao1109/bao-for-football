const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { config } = require("dotenv");

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
  console.warn(
    "No explicit .env file found, fallback to process environment variables.",
  );
}

function normalizeCountry(item) {
  const name = String(item?.name || "").trim();
  const imgUrl = item?.flag ? String(item.flag).trim() : null;

  if (!name) {
    return null;
  }

  return {
    name,
    img_url: imgUrl || null,
  };
}

async function migrateCountries() {
  loadEnv();

  const dataFile = path.resolve(__dirname, "country.json");
  const rawData = fs.readFileSync(dataFile, "utf8");
  const countries = JSON.parse(rawData).map(normalizeCountry).filter(Boolean);

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

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false,
  });

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      "SELECT id, name, img_url FROM countries",
    );

    const existingMap = new Map();
    for (const row of existingRows) {
      existingMap.set(row.name, row);
    }

    const toInsert = [];
    const toUpdate = [];

    for (const country of countries) {
      const existing = existingMap.get(country.name);
      if (!existing) {
        toInsert.push([country.name, country.img_url]);
        continue;
      }

      if ((existing.img_url || null) !== country.img_url) {
        toUpdate.push([country.img_url, existing.id]);
      }
    }

    if (toInsert.length > 0) {
      await connection.query("INSERT INTO countries (name, img_url) VALUES ?", [
        toInsert,
      ]);
    }

    for (const [imgUrl, id] of toUpdate) {
      await connection.execute(
        "UPDATE countries SET img_url = ? WHERE id = ?",
        [imgUrl, id],
      );
    }

    await connection.commit();

    console.log(
      `Country migration completed. Inserted: ${toInsert.length}, updated: ${toUpdate.length}.`,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function migrateLeagues() {
  loadEnv();

  const dataFile = path.resolve(__dirname, "league.json");
  const rawData = fs.readFileSync(dataFile, "utf8");
  const leagues = JSON.parse(rawData)
    .map((item) => {
      const name = String(item?.name || "").trim();
      const imgUrl = item?.logo ? String(item.logo).trim() : null;
      const countryName = String(item?.country || "").trim();

      if (!name || !countryName) {
        return null;
      }

      return {
        name,
        countryName,
        img_url: imgUrl || null,
      };
    })
    .filter(Boolean);

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

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false,
  });

  try {
    await connection.beginTransaction();

    const [countryRows] = await connection.execute("SELECT id, name FROM countries");
    const countryIdByName = new Map();
    for (const row of countryRows) {
      countryIdByName.set(String(row.name).trim().toLowerCase(), row.id);
    }

    const unresolvedCountries = new Set();
    const leaguesWithCountryId = leagues
      .map((league) => {
        const key = league.countryName.trim().toLowerCase();
        const countryId = countryIdByName.get(key) ?? null;

        if (countryId == null) {
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

    const existingMap = new Map();
    for (const row of existingRows) {
      existingMap.set(row.name, row);
    }

    const toInsert = [];
    const toUpdate = [];

    for (const league of leaguesWithCountryId) {
      const existing = existingMap.get(league.name);
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

    if (toInsert.length > 0) {
      await connection.query(
        "INSERT INTO leagues (name, img_url, country_id) VALUES ?",
        [toInsert],
      );
    }

    for (const [imgUrl, countryId, id] of toUpdate) {
      await connection.execute(
        "UPDATE leagues SET img_url = ?, country_id = ? WHERE id = ?",
        [imgUrl, countryId, id],
      );
    }

    await connection.commit();

    console.log(
      `League migration completed. Inserted: ${toInsert.length}, updated: ${toUpdate.length}.`,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

migrateCountries().catch((error) => {
  console.error("Country migration failed:", error);
  process.exitCode = 1;
});

migrateLeagues().catch((error) => {
  console.error("League migration failed:", error);
  process.exitCode = 1;
});
