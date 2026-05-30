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
