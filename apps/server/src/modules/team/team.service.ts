import { Injectable } from "@nestjs/common";
import { ITeamService } from "./interfaces/team-service.interface";
import { TeamRepository } from "./team.repository";


@Injectable()
export class TeamService implements ITeamService {
  constructor(
    private readonly repository: TeamRepository,
  ) {}

    async getListTeamByUserId(userId: bigint) {
        return await this.repository.getListTeamByUserId(userId);
    }
}
