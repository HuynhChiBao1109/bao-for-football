import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm/repository/Repository.js";
import { InjectRepository } from "@nestjs/typeorm/dist/common/typeorm.decorators";
import { CampainEntity } from "./entities/campain.entity";
import { CampainMatchEntity } from "./entities/campain-match.entity";
import { ECampainType } from "./enum/campain-type.enum";
import { TeamEntity } from "../team/entities/team.entity";
import { ETeamType } from "../team/enums/team-type.enum";

@Injectable()
export class CampainRepository {
  constructor(
    @InjectRepository(CampainEntity)
    private readonly repository: Repository<CampainEntity>,

    @InjectRepository(CampainMatchEntity)
    private readonly campainMatchRepository: Repository<CampainMatchEntity>,

    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
  ) {}

  async getListCampainByTeamId(teamId: bigint) {
    const listCampain = await this.repository.find({
      where: {
        teamId,
      },
      relations: {
        campainMatches: {
          competitor: true,
        },
      },
      order: {
        id: "ASC",
        campainMatches: {
          level: "ASC",
        },
      },
    });
    return listCampain;
  }

  async createCompainNormal(teamId: bigint): Promise<CampainMatchEntity[]> {
    const createCampain = this.repository.create({
      teamId,
      type: ECampainType.NORMAL,
      level: 1,
    });
    const newCampain = await this.repository.save(createCampain);

    const botTeams = await this.teamRepository.find({
      where: {
        type: ETeamType.BOT,
      },
      order: { id: "ASC" },
      take: 10,
    });

    const filteredBotTeams = botTeams.filter((team) => team.id !== teamId);

    if (!filteredBotTeams.length) {
      return [];
    }

    const listCampainMatch: CampainMatchEntity[] = [];

    for (let i = 1; i <= 10; i++) {
      const campainMatch = new CampainMatchEntity();
      campainMatch.campainId = newCampain.id;
      campainMatch.level = i;
      const competitorTeam = filteredBotTeams[(i - 1) % filteredBotTeams.length];
      campainMatch.competitorId = competitorTeam.id;
      campainMatch.matchReward = BigInt(1000 * 1000 * i);
      listCampainMatch.push(campainMatch);
    }

    await this.campainMatchRepository.save(listCampainMatch);

    return listCampainMatch;
  }

  async getCompainByTeamAndType(teamId: bigint, type: ECampainType): Promise<CampainEntity> {
    const campain = await this.repository.findOne({
      where: {
        teamId,
        type,
      },
      relations: {
        campainMatches: {
          competitor: true,
        },
      },
    });
    return campain;
  }
}
