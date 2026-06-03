import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GoExceptionFilter } from "../../common/filters/exception.filter";
import { AuthGuard } from "../../common/guards/auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { PlayerEntity } from "../player/entities/player-admin.entity";
import { ClubEntity } from "../player/entities/club.entity.";
import { TeamEntity } from "../team/entities/team.entity";
import { UserPlayerEntity } from "../player/entities/player-user.entity";
import { UserEntity } from "../user/entities/user.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity
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
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
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
