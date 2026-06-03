import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { MatchEntity } from "./entities/match.entity";

@Injectable()
export class MatchRepository {
  constructor(
    @InjectRepository(MatchEntity)
    private readonly matchRepository: Repository<MatchEntity>,
  ) {}

  async findMatchById(matchId: bigint): Promise<MatchEntity> {
    return this.matchRepository.findOne({ where: { id: matchId } });
  }

  async create(match: Partial<MatchEntity>): Promise<MatchEntity> {
    const newMatch = this.matchRepository.create(match);
    return this.matchRepository.save(newMatch);
  }
}
