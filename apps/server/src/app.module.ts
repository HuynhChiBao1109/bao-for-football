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
import { GachaModule } from "./modules/gacha/gacha.module";
import { MatchModule } from "./modules/match/match.module";
import { PlayerModule } from "./modules/player/player.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { TacticsModule } from "./modules/tactics/tactics.module";
import { TeamModule } from './modules/team/team.module';

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
          synchronize: true,
        };
      },
    }),
    DatabaseModule,
    AuthModule,
    TacticsModule,
    AiModule,
    GachaModule,
    PlayerModule,
    MatchModule,
    RealtimeModule,
    TeamModule,
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
