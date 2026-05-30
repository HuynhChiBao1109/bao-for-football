import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GachaAdminController } from "./gachaadmin.controller";
import { GachaAdminRepository } from "./gachaadmin.repository";
import { GachaAdminService } from "./gachaadmin.service";

@Module({
  imports: [AuthModule],
  controllers: [GachaAdminController],
  providers: [GachaAdminRepository, GachaAdminService],
})
export class GachaAdminModule {}
