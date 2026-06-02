import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { PlayerController } from "./player.controller";
import {
  PlayerEntity,
  PlayerPositionEntity,
  PlayerSkillEntity,
} from "./entities/player-admin.entities";
import { TeamPlayerEntity, TeamPlayerSkillEntity } from "./entities/player.entities";
import { PlayerRepository } from "./player.repository";
import { PlayerService } from "./player.service";
import { LeagueEntity } from "./entities/league.entites";
import { CountryEntity } from "./entities/country.entities";
import { ClubEntity } from "./entities/club.entites";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      TeamPlayerEntity,
      TeamPlayerSkillEntity,
      CountryEntity,
      LeagueEntity,
      ClubEntity,
      PlayerPositionEntity,
      PlayerSkillEntity,
      PlayerEntity,
    ]),
  ],
  controllers: [PlayerController ],
  providers: [
    PlayerRepository,
    PlayerService,
  ],
})
export class PlayerModule {}
