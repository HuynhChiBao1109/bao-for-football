import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
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
import { PlayerAdminModule } from "./modules/playeradmin/playeradmin.module";
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
    DatabaseModule,
    AuthModule,
    ClubModule,
    TacticsModule,
    AiModule,
    GachaModule,
    GachaAdminModule,
    PlayerModule,
    PlayerAdminModule,
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
