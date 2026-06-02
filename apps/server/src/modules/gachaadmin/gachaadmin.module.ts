import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { GachaBannerEntity } from "../gacha/entities/gacha.entities";
import { GachaAdminController } from "./gachaadmin.controller";
import { GachaAdminRepository } from "./gachaadmin.repository";
import { GachaAdminService } from "./gachaadmin.service";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([GachaBannerEntity])],
  controllers: [GachaAdminController],
  providers: [GachaAdminRepository, GachaAdminService],
})
export class GachaAdminModule {}
