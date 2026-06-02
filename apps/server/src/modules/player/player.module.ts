import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { PlayerController } from "./player.controller";
import {
  PlayerEntity,
  PlayerPositionEntity,
  PlayerSkillEntity,
} from "./entities/player-admin.entities";
import { UserPlayerEntity } from "./entities/player.entities";
import { PlayerRepository } from "./player.repository";
import { PlayerService } from "./player.service";
import { CountryEntity } from "./entities/club.entites";
import { LeagueEntity } from "./entities/league.entites";
import { ClubEntity } from "./entities/country.entities";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      UserPlayerEntity,
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
