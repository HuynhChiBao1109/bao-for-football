import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../common/constants/app.constants";

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>("DATABASE_HOST");
        const port = configService.get<number | string>("DATABASE_PORT");
        const username = configService.get<string>("DATABASE_USERNAME");
        const password = configService.get<string>("DATABASE_PASSWORD");
        const database = configService.get<string>("DATABASE_NAME");

        if (!host || !port || !username || !database) {
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
          synchronize: false,
          migrationsRun:
            configService.get<string>("NODE_ENV") === "development",
        });

        try {
          if (!dataSource.isInitialized) {
            await dataSource.initialize();
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
