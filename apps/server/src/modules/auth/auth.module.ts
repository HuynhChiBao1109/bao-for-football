import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GoExceptionFilter } from "../../common/filters/exception.filter";
import { AuthGuard } from "../../common/guards/auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { PlayerEntity } from "../player/entities/player-admin.entities";
import { ClubEntity } from "../player/entities/club.entites";
import { TeamEntity } from "../team/entities/team.entities";
import { UserPlayerEntity } from "../player/entities/player-user.entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClubEntity,
      TeamEntity,
      PlayerEntity,
      UserPlayerEntity,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET") || "fifam-dev-secret",
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    AuthGuard,
    AdminGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GoExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
