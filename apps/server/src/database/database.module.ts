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
          // migrations: [__dirname + "/migrations/*{.ts}"],
          synchronize: false,
          migrationsRun: false,
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
