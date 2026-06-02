import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { TacticsController } from "./tactics.controller";
import { TeamLineupEntity, TeamTacticsEntity } from "./entities/tactics.entities";
import { TacticsRepository } from "./tactics.repository";
import { TacticsService } from "./tactics.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([TeamTacticsEntity, TeamLineupEntity]),
  ],
  controllers: [TacticsController],
  providers: [TacticsRepository, TacticsService],
})
export class TacticsModule {}
