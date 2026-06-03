import { Injectable } from "@nestjs/common";
import { TeamEntity } from "./entities/team.entity";
import { Repository } from "typeorm/repository/Repository.js";
import { InjectRepository } from "@nestjs/typeorm/dist/common/typeorm.decorators";


@Injectable()
export class TeamRepository {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly repository: Repository<TeamEntity>,
  ) {}


  async getListTeamByUserId(userId: bigint): Promise<TeamEntity[]> {
    return await this.repository.find({ where: { id: userId } });
  }
}
