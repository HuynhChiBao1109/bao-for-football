import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { TypeOrmModule } from "@nestjs/typeorm";
import { createConnection } from "mysql2/promise";
import { join, resolve } from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { AppController } from "./app.controller";
import { LoggingMiddleware } from "./common/middleware/logging.middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { GachaModule } from "./modules/gacha/gacha.module";
import { MatchModule } from "./modules/match/match.module";
import { PlayerModule } from "./modules/player/player.module";
import { TeamModule } from "./modules/team/team.module";
import { TourmentModule } from "./modules/tourment/tourment.module";
import { UserModule } from "./modules/user/user.module";
import { CampainModule } from "./modules/campain/campain.module";
import { ReferenceModule } from "./modules/reference/reference.module";
import { SocketModule } from "./modules/socket/socket.module";
import { RedisModule } from "./modules/redis/redis.module";
import { TrainingRoomModule } from "./modules/training/training-room.module";
import { DailyLoginModule } from "./modules/daily-login/daily-login.module";

const escapeIdentifier = (value: string) => value.replace(/`/g, "``");

const isEnabled = (value: unknown) => String(value ?? "").toLowerCase() === "true";

const ensureDatabaseExists = async (options: DataSourceOptions) => {
  if (options.type !== "mysql") {
    return;
  }

  const mysqlOptions = options as DataSourceOptions & {
    database?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };

  if (!mysqlOptions.database || !mysqlOptions.username) {
    throw new Error("Missing MYSQL_DATABASE or MYSQL_USER for database bootstrap.");
  }

  const connection = await createConnection({
    host: mysqlOptions.host,
    port: mysqlOptions.port,
    user: mysqlOptions.username,
    password: mysqlOptions.password,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${escapeIdentifier(
        mysqlOptions.database,
      )}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
};

const dropTablesNotInEntities = async (dataSource: DataSource) => {
  const databaseName = String(dataSource.options.database || "");
  if (!databaseName) {
    return;
  }

  const rows: Array<{ tableName: string }> = await dataSource.query(
    `SELECT TABLE_NAME as tableName
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?`,
    [databaseName],
  );

  const entityTableNames = new Set(
    dataSource.entityMetadatas.map((metadata) => metadata.tableName),
  );

  const tablesToDrop = rows
    .map((row) => row.tableName)
    .filter((tableName) => tableName !== "typeorm_metadata")
    .filter((tableName) => !entityTableNames.has(tableName));

  if (!tablesToDrop.length) {
    return;
  }

  await dataSource.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const tableName of tablesToDrop) {
      await dataSource.query(`DROP TABLE IF EXISTS \`${escapeIdentifier(tableName)}\``);
    }
  } finally {
    await dataSource.query("SET FOREIGN_KEY_CHECKS = 1");
  }
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "../.env"),
        resolve(process.cwd(), "../../.env"),
      ],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads", "image"),
      serveRoot: "/uploads/image",
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          type: "mysql" as const,
          host: configService.get<string>("MYSQL_HOST"),
          port: Number(configService.get<number | string>("MYSQL_PORT")),
          username: configService.get<string>("MYSQL_USER"),
          password: configService.get<string>("MYSQL_PASSWORD"),
          database: configService.get<string>("MYSQL_DATABASE"),
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
        };
      },
      dataSourceFactory: async (options) => {
        const dataSourceOptions = options as DataSourceOptions;
        await ensureDatabaseExists(dataSourceOptions);

        const dataSource = new DataSource(dataSourceOptions);
        await dataSource.initialize();
        if (isEnabled(process.env.DB_DROP_UNMAPPED_TABLES)) {
          await dropTablesNotInEntities(dataSource);
        }
        await dataSource.synchronize();
        return dataSource;
      },
    }),
    AuthModule,
    GachaModule,
    PlayerModule,
    MatchModule,
    TeamModule,
    TourmentModule,
    UserModule,
    CampainModule,
    ReferenceModule,
    SocketModule,
    RedisModule,
    TrainingRoomModule,
    DailyLoginModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes({
      path: "*",
      method: RequestMethod.ALL,
    });
  }
}
