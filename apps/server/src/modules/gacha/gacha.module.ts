import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { GachaController } from "./gacha.controller";
import { GachaBannerEntity, GachaLogEntity } from "./entities/gacha.entity";
import { GachaRepository } from "./gacha.repository";
import { GachaService } from "./gacha.service";
import { PlayerEntity } from "../player/entities/player-admin.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "../player/entities/player-user.entity";
import { TeamEntity } from "../team/entities/team.entity";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      GachaLogEntity,
      GachaBannerEntity,
      PlayerEntity,
      UserPlayerEntity,
      UserPlayerSkillEntity,
      TeamEntity,
    ]),
  ],
  controllers: [GachaController],
  providers: [GachaRepository, GachaService],
})
export class GachaModule {}
