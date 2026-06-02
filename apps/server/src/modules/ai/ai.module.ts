import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AiController } from "./ai.controller";
import { UserStageEntity } from "./entities/ai.entities";
import { AiRepository } from "./ai.repository";
import { AiService } from "./ai.service";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserStageEntity])],
  controllers: [AiController],
  providers: [AiRepository, AiService],
})
export class AiModule {}
