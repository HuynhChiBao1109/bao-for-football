import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { TypeOrmModule } from "@nestjs/typeorm";
import { join, resolve } from "path";
import { AppController } from "./app.controller";
import { LoggingMiddleware } from "./common/middleware/logging.middleware";
import { DatabaseModule } from "./database/database.module";
import { AiModule } from "./modules/ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ClubModule } from "./modules/club/club.module";
import { GachaAdminModule } from "./modules/gachaadmin/gachaadmin.module";
import { GachaModule } from "./modules/gacha/gacha.module";
import { MatchModule } from "./modules/match/match.module";
import { PlayerModule } from "./modules/player/player.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { TacticsModule } from "./modules/tactics/tactics.module";

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
        const nodeEnv = configService.get<string>("NODE_ENV") || "development";
        const rawSync = configService.get<string | boolean>("DB_SYNC_ON_START");
        const synchronize =
          rawSync == null
            ? false
            : ["1", "true", "yes", "on"].includes(
                String(rawSync).trim().toLowerCase(),
              );

        return {
          type: "mysql" as const,
          host:
            configService.get<string>("DATABASE_HOST") ||
            configService.get<string>("MYSQL_HOST") ||
            "localhost",
          port: Number(
            configService.get<number | string>("DATABASE_PORT") ||
              configService.get<number | string>("MYSQL_PORT") ||
              3306,
          ),
          username:
            configService.get<string>("DATABASE_USERNAME") ||
            configService.get<string>("MYSQL_USER"),
          password:
            configService.get<string>("DATABASE_PASSWORD") ||
            configService.get<string>("MYSQL_PASSWORD"),
          database:
            configService.get<string>("DATABASE_NAME") ||
            configService.get<string>("MYSQL_DATABASE"),
          autoLoadEntities: true,
          synchronize,
        };
      },
    }),
    DatabaseModule,
    AuthModule,
    ClubModule,
    TacticsModule,
    AiModule,
    GachaModule,
    GachaAdminModule,
    PlayerModule,
    MatchModule,
    RealtimeModule,
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
