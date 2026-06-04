import { BadRequestException, Injectable } from "@nestjs/common";
import { ITeamService } from "./interfaces/team-service.interface";
import { TeamRepository } from "./team.repository";
import { TeamEntity } from "./entities/team.entity";
import { ReferenceService } from "../reference/reference.service";
import { CreateTeamByClubDTO } from "./dto/create-team-by-club.dto";
import { PlayerService } from "../player/player.service";
import { ETeamType } from "./enums/team-type.enum";

@Injectable()
export class TeamService implements ITeamService {
  constructor(
    private readonly repository: TeamRepository,
    private readonly referenceService: ReferenceService,
    private readonly playerService: PlayerService,
  ) {}

  async getListTeamByUserId(userId: bigint): Promise<TeamEntity[]> {
    return await this.repository.getListTeamByUserId(userId);
  }

  async createByClub(data: CreateTeamByClubDTO): Promise<TeamEntity> {
    const { clubId, user } = data;
    const club = await this.referenceService.getClubById(clubId);
    if (!club) {
      throw new BadRequestException("Club not found");
    }

    const existingTeams = await this.repository.getListTeamByUserId(user.id);
    if (existingTeams.length > 0) {
      throw new BadRequestException("Can only create one team per user");
    }

    const createTeamData: Partial<TeamEntity> = {
      userId: user.id,
      teamName: club.name,
      imgUrl: club.imgUrl,
      type: ETeamType.USER,
    };

    const newTeam = this.repository.create(createTeamData);

    await this.playerService.insertPlayerToUserByClubId(user, clubId);

    return newTeam;
  }
}
