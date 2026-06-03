import "reflect-metadata";
import { existsSync } from "fs";
import { config } from "dotenv";
import { resolve } from "path";
import { DataSource } from "typeorm";

const envCandidates = [
  resolve(process.cwd(), "../../.env"),
];

const envPath = envCandidates.find((item) => existsSync(item));
if (envPath) {
  config({ path: envPath });
}

export default new DataSource({
  type: "mysql",
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  username:  process.env.MYSQL_USER,
  password:  process.env.MYSQL_PASSWORD,
  database:  process.env.MYSQL_DATABASE,
  entities: [__dirname + "/../modules/**/entities/*{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: false,
});
