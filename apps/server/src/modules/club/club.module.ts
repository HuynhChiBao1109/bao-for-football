import { Module } from "@nestjs/common";
import { ClubController } from "./club.controller";
import { ClubRepository } from "./club.repository";
import { ClubService } from "./club.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClubEntity } from "./entities/club.entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([ClubEntity])
  ],
  controllers: [ClubController],
  providers: [ClubRepository, ClubService],
  exports: [ClubService],
})
export class ClubModule {}
