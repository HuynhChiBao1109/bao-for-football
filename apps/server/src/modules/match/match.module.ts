import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { MatchController } from "./match.controller";
import { MatchEntity } from "./entities/match.entity";
import { MatchRepository } from "./match.repository";
import { MatchService } from "./match.service";
import { TeamEntity } from "../team/entities/team.entity";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([TeamEntity, MatchEntity]),
  ],
  controllers: [MatchController],
  providers: [MatchRepository, MatchService],
})
export class MatchModule {}
