import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { PlayerController } from "./player.controller";
import {
  ClubEntity,
  CountryEntity,
  LeagueEntity,
  PlayerPositionEntity,
  PlayerSkillEntity,
  PlayerTemplateEntity,
} from "./entities/player-admin.entities";
import { UserPlayerEntity } from "./entities/player.entities";
import { PlayerRepository } from "./player.repository";
import { PlayerService } from "./player.service";
import { PlayerAdminController } from "./playeradmin.controller";
import { PlayerAdminRepository } from "./playeradmin.repository";
import { PlayerAdminService } from "./playeradmin.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      PlayerTemplateEntity,
      UserPlayerEntity,
      CountryEntity,
      LeagueEntity,
      ClubEntity,
      PlayerPositionEntity,
      PlayerSkillEntity,
    ]),
  ],
  controllers: [PlayerController, PlayerAdminController],
  providers: [
    PlayerRepository,
    PlayerService,
    PlayerAdminRepository,
    PlayerAdminService,
  ],
})
export class PlayerModule {}
