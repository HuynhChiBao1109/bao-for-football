import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CampainEntity } from "./entities/campain.entity";
import { CampainMatchEntity } from "./entities/campain-match.entity";
import { TeamEntity } from "../team/entities/team.entity";
import { CampainRepository } from "./campain.respository";
import { CampainController } from "./campain.controller";
import { CampainService } from "./campain.service";
import { ClubEntity } from "../reference/entities/club.entity";

@Module({
  imports: [TypeOrmModule.forFeature([CampainEntity, CampainMatchEntity, TeamEntity, ClubEntity])],
  controllers: [CampainController],
  providers: [CampainService, CampainRepository],
})
export class CampainModule {}
