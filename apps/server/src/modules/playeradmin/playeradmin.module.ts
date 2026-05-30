import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlayerAdminController } from "./playeradmin.controller";
import { PlayerAdminRepository } from "./playeradmin.repository";
import { PlayerAdminService } from "./playeradmin.service";

@Module({
  imports: [AuthModule],
  controllers: [PlayerAdminController],
  providers: [PlayerAdminRepository, PlayerAdminService],
})
export class PlayerAdminModule {}
