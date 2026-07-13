import { Injectable } from "@nestjs/common";
import { ICampainService } from "./interfaces/campain-service.interface";
import { CampainRepository } from "./campain.respository";
import { AuthUser } from "../auth/types";
import { CampainMatchEntity } from "./entities/campain-match.entity";
import { CampainEntity } from "./entities/campain.entity";
import { ECampainType } from "./enum/campain-type.enum";
import { EMatchStatus } from "../match/enums";

@Injectable()
export class CampainService implements ICampainService {
  constructor(private readonly repository: CampainRepository) {}

  async getListCampainByTeamId(teamId: number): Promise<CampainEntity[]> {
    const listCampain = await this.repository.getListCampainByTeamId(teamId);
    return listCampain.map((campain) => {
      campain.level = this.getEffectiveUnlockedLevel(campain);
      return campain;
    });
  }

  async createCompainNormal(teamId: number, user: AuthUser): Promise<CampainMatchEntity[]> {
    const isExistCampain = await this.repository.getCompainByTeamAndType(
      teamId,
      ECampainType.NORMAL,
    );
    if (isExistCampain) {
      const listCampainMatch = isExistCampain.campainMatches;
      return listCampainMatch;
    }

    const createCampain = await this.repository.createCompainNormal(teamId);

    return createCampain;
  }

  private getEffectiveUnlockedLevel(campain: CampainEntity) {
    const matches = [...(campain.campainMatches ?? [])].sort(
      (left, right) => Number(left.level) - Number(right.level),
    );
    let unlockedLevel = 1;

    for (const campaignMatch of matches) {
      const level = Number(campaignMatch.level ?? 0);
      if (level < unlockedLevel) continue;
      if (level > unlockedLevel) break;

      const match = campaignMatch.match;
      if (!match || match.status !== EMatchStatus.FINISHED) break;

      const homeScore = Number(match.homeScore ?? 0);
      const awayScore = Number(match.awayScore ?? 0);
      const campaignTeamWon =
        Number(match.homeTeamId) === Number(campain.teamId)
          ? homeScore > awayScore
          : Number(match.awayTeamId) === Number(campain.teamId)
            ? awayScore > homeScore
            : false;

      if (!campaignTeamWon) break;
      unlockedLevel = level + 1;
    }

    return unlockedLevel;
  }
}
