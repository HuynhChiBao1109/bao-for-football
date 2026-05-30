import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlayerController } from "./player.controller";
import { PlayerRepository } from "./player.repository";
import { PlayerService } from "./player.service";

@Module({
  imports: [AuthModule],
  controllers: [PlayerController],
  providers: [PlayerRepository, PlayerService],
})
export class PlayerModule {}
