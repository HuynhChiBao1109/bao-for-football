import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlayerController } from "./player.controller";
import { PlayerRepository } from "./player.repository";
import { PlayerService } from "./player.service";
import { PlayerAdminController } from "./playeradmin.controller";
import { PlayerAdminRepository } from "./playeradmin.repository";
import { PlayerAdminService } from "./playeradmin.service";

@Module({
  imports: [AuthModule],
  controllers: [PlayerController, PlayerAdminController],
  providers: [
    PlayerRepository,
    PlayerService,
    PlayerAdminRepository,
    PlayerAdminService,
  ],
})
export class PlayerModule {}
