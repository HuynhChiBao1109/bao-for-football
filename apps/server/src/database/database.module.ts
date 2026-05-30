import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../common/constants/app.constants";

function asBoolean(
  value: string | number | boolean | undefined,
  fallback: boolean,
) {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

async function dropUnmappedTables(
  dataSource: DataSource,
  databaseName: string,
) {
  const rows = (await dataSource.query(
    `
SELECT table_name AS tableName
FROM information_schema.tables
WHERE table_schema = ?
  AND table_type = 'BASE TABLE'`,
    [databaseName],
  )) as Array<{ tableName: string }>;

  const mapped = new Set(
    dataSource.entityMetadatas.map((meta) => meta.tableName.toLowerCase()),
  );
  const protectedTables = new Set(["migrations", "typeorm_metadata"]);

  for (const row of rows) {
    const tableName = String(row.tableName || "");
    const normalized = tableName.toLowerCase();
    if (
      !tableName ||
      mapped.has(normalized) ||
      protectedTables.has(normalized)
    ) {
      continue;
    }
    const escapedTableName = tableName.replace(/`/g, "``");
    await dataSource.query(`DROP TABLE IF EXISTS \`${escapedTableName}\``);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const nodeEnv = configService.get<string>("NODE_ENV") || "development";
        const isDevelopment = nodeEnv === "development";
        const host =
          configService.get<string>("DATABASE_HOST") ||
          configService.get<string>("MYSQL_HOST") ||
          "localhost";
        const port =
          configService.get<number | string>("DATABASE_PORT") ||
          configService.get<number | string>("MYSQL_PORT") ||
          3306;
        const username =
          configService.get<string>("DATABASE_USERNAME") ||
          configService.get<string>("MYSQL_USER");
        const password =
          configService.get<string>("DATABASE_PASSWORD") ||
          configService.get<string>("MYSQL_PASSWORD");
        const database =
          configService.get<string>("DATABASE_NAME") ||
          configService.get<string>("MYSQL_DATABASE");
        const synchronize = asBoolean(
          configService.get<string | boolean>("DB_SYNC_ON_START"),
          isDevelopment,
        );
        const dropUnmapped = asBoolean(
          configService.get<string | boolean>("DB_DROP_UNMAPPED_TABLES"),
          isDevelopment,
        );

        if (!username || !database) {
          return null;
        }

        const dataSource = new DataSource({
          type: "mysql",
          host,
          port: Number(port),
          username,
          password,
          database,
          entities: [__dirname + "/entities/*{.ts,.js}"],
          migrations: [__dirname + "/migrations/*{.ts,.js}"],
          synchronize,
          migrationsRun: !synchronize && isDevelopment,
        });

        try {
          if (!dataSource.isInitialized) {
            await dataSource.initialize();
          }
          if (dropUnmapped) {
            await dropUnmappedTables(dataSource, database);
          }
          return dataSource;
        } catch {
          return null;
        }
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
