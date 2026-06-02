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
	console.warn("No explicit .env file found, fallback to process environment variables.");
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
	const countries = JSON.parse(rawData)
		.map(normalizeCountry)
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
			await connection.query(
				"INSERT INTO countries (name, img_url) VALUES ?",
				[toInsert],
			);
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

migrateCountries().catch((error) => {
	console.error("Country migration failed:", error);
	process.exitCode = 1;
});
