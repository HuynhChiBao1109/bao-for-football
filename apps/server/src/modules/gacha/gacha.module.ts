import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { GachaController } from "./gacha.controller";
import { GachaBannerEntity, GachaLogEntity } from "./entities/gacha.entity";
import { GachaRepository } from "./gacha.repository";
import { GachaService } from "./gacha.service";
import { UserPlayerEntity } from "../player/entities/player-user.entity";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([GachaLogEntity, GachaBannerEntity, UserPlayerEntity]),
  ],
  controllers: [GachaController],
  providers: [GachaRepository, GachaService],
})
export class GachaModule {}
