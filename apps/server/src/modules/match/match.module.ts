import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { MatchController } from "./match.controller";
import { MatchEntity } from "./entities/match.entity";
import { MatchRepository } from "./match.repository";
import { MatchService } from "./match.service";
import { TeamEntity } from "../team/entities/team.entity";
import { MatchEventEntity } from "./entities/match-event.entity";
import { MatchPlayerStatsEntity } from "./entities/match-player-stats.entity";
import { CampainMatchEntity } from "../campain/entities/campain-match.entity";
import { TeamFormationEntity } from "../team/entities/team-formatition.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "../player/entities/player-user.entity";
import { PlayerEntity } from "../player/entities/player-admin.entity";
import { SocketModule } from "../socket/socket.module";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    AuthModule,
    SocketModule,
    RedisModule,
    TypeOrmModule.forFeature([
      TeamEntity,
      TeamFormationEntity,
      CampainMatchEntity,
      MatchEntity,
      MatchEventEntity,
      MatchPlayerStatsEntity,
      UserPlayerEntity,
      UserPlayerSkillEntity,
      PlayerEntity,
    ]),
  ],
  controllers: [MatchController],
  providers: [MatchRepository, MatchService],
})
export class MatchModule {}
