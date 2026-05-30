import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { GoExceptionFilter } from "../../common/filters/exception.filter";
import { AuthGuard } from "../../common/guards/auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { AdminGuard } from "./admin.guard";
import { AdminAuthController } from "./admin-auth.controller";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";

@Module({
  imports: [
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
