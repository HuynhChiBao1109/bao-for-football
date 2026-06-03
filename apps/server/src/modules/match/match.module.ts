import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { MatchController } from "./match.controller";
import { MatchEntity } from "./entities/match.entities";
import { MatchRepository } from "./match.repository";
import { MatchService } from "./match.service";
import { TeamEntity } from "../team/entities/team.entities";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([TeamEntity, MatchEntity]),
  ],
  controllers: [MatchController],
  providers: [MatchRepository, MatchService],
})
export class MatchModule {}
