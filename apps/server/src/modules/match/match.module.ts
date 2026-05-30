import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MatchController } from "./match.controller";
import { MatchRepository } from "./match.repository";
import { MatchService } from "./match.service";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [MatchController],
  providers: [MatchRepository, MatchService],
})
export class MatchModule {}
