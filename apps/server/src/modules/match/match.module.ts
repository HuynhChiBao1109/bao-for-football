import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { TeamEntity } from "../auth/entities/auth.entities";
import { MatchController } from "./match.controller";
import { MatchEntity } from "./entities/match.entities";
import { MatchRepository } from "./match.repository";
import { MatchService } from "./match.service";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    AuthModule,
    RealtimeModule,
    TypeOrmModule.forFeature([TeamEntity, MatchEntity]),
  ],
  controllers: [MatchController],
  providers: [MatchRepository, MatchService],
})
export class MatchModule {}
