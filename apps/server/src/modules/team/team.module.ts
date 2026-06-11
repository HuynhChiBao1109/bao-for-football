import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { TeamEntity } from "./entities/team.entity";
import { TeamFormationEntity } from "./entities/team-formatition.entity";
import { CampainEntity } from "../campain/entities/campain.entity";
import { CampainMatchEntity } from "../campain/entities/campain-match.entity";
import { TeamRepository } from "./team.repository";
import { TeamService } from "./team.service";
import { ReferenceModule } from "../reference/reference.module";
import { PlayerModule } from "../player/player.module";
import { TeamController } from "./team.controller";
import { ClubEntity } from "../reference/entities/club.entity";
import { TeamImageService } from "./team-image.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      TeamEntity,
      TeamFormationEntity,
      CampainEntity,
      CampainMatchEntity,
      ClubEntity,
    ]),
    ReferenceModule,
    PlayerModule,
  ],
  controllers: [TeamController],
  providers: [TeamRepository, TeamService, TeamImageService],
  exports: [TeamService],
})
export class TeamModule {}
