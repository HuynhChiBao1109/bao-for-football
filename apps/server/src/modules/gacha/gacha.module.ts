import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GachaController } from "./gacha.controller";
import { GachaRepository } from "./gacha.repository";
import { GachaService } from "./gacha.service";

@Module({
  imports: [AuthModule],
  controllers: [GachaController],
  providers: [GachaRepository, GachaService],
})
export class GachaModule {}
