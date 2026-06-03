import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { PlayerController } from "./player.controller";
import {
  PlayerEntity,
  PlayerSkillEntity,
} from "./entities/player-admin.entity";
import { PlayerRepository } from "./player.repository";
import { PlayerService } from "./player.service";
import { LeagueEntity } from "./entities/league.entity";
import { CountryEntity } from "./entities/country.entity";
import { ClubEntity } from "./entities/club.entity.";
import { UserPlayerEntity, UserPlayerSkillEntity } from "./entities/player-user.entity";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      UserPlayerEntity,
      UserPlayerSkillEntity,
      CountryEntity,
      LeagueEntity,
      ClubEntity,
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
