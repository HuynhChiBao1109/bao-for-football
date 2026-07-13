import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlayerEntity, PlayerSkillEntity } from "../player/entities/player-admin.entity";
import {
  UserPlayerEntity,
  UserPlayerSkillEntity,
} from "../player/entities/player-user.entity";
import { TeamEntity } from "../team/entities/team.entity";
import { DailyLoginController } from "./daily-login.controller";
import { DailyLoginService } from "./daily-login.service";
import { DailyLoginProgressEntity } from "./entities/daily-login-progress.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyLoginProgressEntity,
      PlayerEntity,
      PlayerSkillEntity,
      UserPlayerEntity,
      UserPlayerSkillEntity,
      TeamEntity,
    ]),
  ],
  controllers: [DailyLoginController],
  providers: [DailyLoginService],
})
export class DailyLoginModule {}
