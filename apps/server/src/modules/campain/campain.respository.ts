import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm/repository/Repository.js";
import { InjectRepository } from "@nestjs/typeorm/dist/common/typeorm.decorators";
import { CampainEntity } from "./entities/campain.entity";
import { CampainMatchEntity } from "./entities/campain-match.entity";
import { ECampainType } from "./enum/campain-type.enum";
import { ClubEntity } from "../reference/entities/club.entity";

@Injectable()
export class CampainRepository {
  constructor(
    @InjectRepository(CampainEntity)
    private readonly repository: Repository<CampainEntity>,

    @InjectRepository(CampainMatchEntity)
    private readonly campainMatchRepository: Repository<CampainMatchEntity>,

    @InjectRepository(ClubEntity)
    private readonly clubRepository: Repository<ClubEntity>,
  ) {}

  async getListCampainByTeamId(teamId: bigint) {
    const listCampain = await this.repository.find({
      where: {
        teamId,
      },
      relations: {
        campainMatches: {
          competitorClub: true,
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

    const clubs = await this.clubRepository.find({
      order: { id: "ASC" },
      take: 10,
    });

    if (!clubs.length) {
      return [];
    }

    const listCampainMatch: CampainMatchEntity[] = [];

    for (let i = 1; i <= 10; i++) {
      const campainMatch = new CampainMatchEntity();
      campainMatch.campainId = newCampain.id;
      campainMatch.level = i;
      const competitorClub = clubs[(i - 1) % clubs.length];
      campainMatch.competitorClubId = competitorClub.id;
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
        campainMatches: true,
      },
    });
    return campain;
  }
}
