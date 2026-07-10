import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlayerController } from "./player.controller";
import { PlayerEntity, PlayerSkillEntity } from "./entities/player-admin.entity";
import { PlayerRepository } from "./player.repository";
import { PlayerService } from "./player.service";
import { LeagueEntity } from "../reference/entities/league.entity";
import { CountryEntity } from "../reference/entities/country.entity";
import { ClubEntity } from "../reference/entities/club.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "./entities/player-user.entity";
import { PlayerSlugService } from "./player-slug.service";
import { PlayerAiService } from "./player-ai.service";

@Module({
  imports: [
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
  controllers: [PlayerController],
  providers: [PlayerRepository, PlayerService, PlayerSlugService, PlayerAiService],
  exports: [PlayerService, PlayerAiService],
})
export class PlayerModule {}
