import { Injectable } from "@nestjs/common";
import { TeamEntity } from "./entities/team.entity";
import { Repository } from "typeorm/repository/Repository.js";
import { InjectRepository } from "@nestjs/typeorm/dist/common/typeorm.decorators";
import { ETeamType } from "./enums/team-type.enum";

@Injectable()
export class TeamRepository {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly repository: Repository<TeamEntity>,
  ) {}

  async getListTeamByUserId(userId: number): Promise<TeamEntity[]> {
    return await this.repository.find({ where: { userId: userId } });
  }

  async create(data: Partial<TeamEntity>): Promise<TeamEntity> {
    const newTeam = this.repository.create(data);
    return this.repository.save(newTeam);
  }

  async getById(id: number): Promise<TeamEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async getBotTeams(limit = 10, excludeTeamId?: number): Promise<TeamEntity[]> {
    return this.repository
      .find({
        where: {
          type: ETeamType.BOT,
          ...(excludeTeamId ? { id: undefined } : {}),
        },
        order: { id: "ASC" },
        take: limit + (excludeTeamId ? 1 : 0),
      })
      .then((teams) =>
        excludeTeamId ? teams.filter((team) => team.id !== excludeTeamId).slice(0, limit) : teams,
      );
  }
}
