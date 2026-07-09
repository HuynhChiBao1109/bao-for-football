import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClubEntity } from "./entities/club.entity";
import { CountryEntity } from "./entities/country.entity";
import { LeagueEntity } from "./entities/league.entity";
import { PlayerEntity } from "../player/entities/player-admin.entity";
import { ReferenceController } from "./reference.controller";
import { ReferenceRepository } from "./reference.repository";
import { ReferenceService } from "./reference.service";
import { ReferenceSlugService } from "./reference-slug.service";

@Module({
  imports: [TypeOrmModule.forFeature([ClubEntity, LeagueEntity, CountryEntity, PlayerEntity])],
  controllers: [ReferenceController],
  providers: [ReferenceRepository, ReferenceService, ReferenceSlugService],
  exports: [ReferenceService],
})
export class ReferenceModule {}
