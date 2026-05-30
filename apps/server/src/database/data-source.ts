import "reflect-metadata";
import { existsSync } from "fs";
import { config } from "dotenv";
import { resolve } from "path";
import { DataSource } from "typeorm";

const envCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), "../../.env"),
];

const envPath = envCandidates.find((item) => existsSync(item));
if (envPath) {
  config({ path: envPath });
}

export default new DataSource({
  type: "mysql",
  host: process.env.DATABASE_HOST || process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.DATABASE_PORT || process.env.MYSQL_PORT || 3306),
  username: process.env.DATABASE_USERNAME || process.env.MYSQL_USER,
  password: process.env.DATABASE_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.DATABASE_NAME || process.env.MYSQL_DATABASE,
  entities: [__dirname + "/entities/*{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: false,
});
