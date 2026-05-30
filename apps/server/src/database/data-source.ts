import "reflect-metadata";
import { config } from "dotenv";
import { DataSource } from "typeorm";

config({
  path: process.env.NODE_ENV === "development" ? ".env.development" : ".env",
});

export default new DataSource({
  type: "mysql",
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [__dirname + "/entities/*{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: false,
});
