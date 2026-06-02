import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../common/constants/app.constants";

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
        const host = configService.get<string>("MYSQL_HOST");
        const port = configService.get<number | string>("MYSQL_PORT");
        const username = configService.get<string>("MYSQL_USER");
        const password = configService.get<string>("MYSQL_PASSWORD");
        const database = configService.get<string>("MYSQL_DATABASE");

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
          entities: [__dirname + "/../modules/**/entities/*{.ts,.js}"],
          migrations: [__dirname + "/migrations/*{.ts,.js}"],
          synchronize: true,
          migrationsRun: true,
        });

        try {
          if (!dataSource.isInitialized) {
            await dataSource.initialize();
          }
          await dropUnmappedTables(dataSource, database);
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
