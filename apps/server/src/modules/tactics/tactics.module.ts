import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TacticsController } from "./tactics.controller";
import { TacticsRepository } from "./tactics.repository";
import { TacticsService } from "./tactics.service";

@Module({
  imports: [AuthModule],
  controllers: [TacticsController],
  providers: [TacticsRepository, TacticsService],
})
export class TacticsModule {}
