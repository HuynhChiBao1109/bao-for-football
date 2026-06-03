import { Injectable } from "@nestjs/common";
import { ITeamService } from "./interfaces/team-service.interface";
import { TeamRepository } from "./team.repository";
import { TeamEntity } from "./entities/team.entity";


@Injectable()
export class TeamService implements ITeamService {
  constructor(
    private readonly repository: TeamRepository,
  ) {}

    async getListTeamByUserId(userId: bigint) : Promise<TeamEntity[]> {
        return await this.repository.getListTeamByUserId(userId);
    }

    async createTeamForUser(userId: bigint, clubId: bigint, teamName: string) {}

    
}
