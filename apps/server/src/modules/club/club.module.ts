import { Module } from "@nestjs/common";
import { ClubController } from "./club.controller";
import { ClubRepository } from "./club.repository";
import { ClubService } from "./club.service";

@Module({
  controllers: [ClubController],
  providers: [ClubRepository, ClubService],
  exports: [ClubService],
})
export class ClubModule {}
