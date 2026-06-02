import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GoExceptionFilter } from "../../common/filters/exception.filter";
import { AuthGuard } from "../../common/guards/auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { UserPlayerEntity } from "../player/entities/player.entities";
import { AdminGuard } from "./admin.guard";
import { AdminAuthController } from "./admin-auth.controller";
import { AuthController } from "./auth.controller";
import { TeamEntity, UserEntity } from "./entities/auth.entities";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { PlayerEntity } from "../player/entities/player-admin.entities";
import { ClubEntity } from "../player/entities/club.entites";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClubEntity,
      UserEntity,
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
  controllers: [AuthController, AdminAuthController],
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
