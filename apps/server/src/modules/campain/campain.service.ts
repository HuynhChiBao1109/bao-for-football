import { Injectable } from "@nestjs/common";
import { ICampainService } from "./interfaces/campain-service.interface";
import { CampainRepository } from "./campain.respository";
import { AuthUser } from "../auth/types";
import { CampainMatchEntity } from "./entities/campain-match.entity";
import { CampainEntity } from "./entities/campain.entity";
import { ECampainType } from "./enum/campain-type.enum";


@Injectable()
export class CampainService implements ICampainService {
  constructor(
    private readonly repository: CampainRepository,
  ) {}

    async getListCampainByTeamId(teamId: bigint) : Promise<CampainEntity[]> {
        const listCampain = await this.repository.getListCampainByTeamId(teamId);
        return listCampain;
    }

    async createCompainNormal(teamId: bigint, user: AuthUser) : Promise<CampainMatchEntity[]> {
        const isExistCampain = await this.repository.getCompainByTeamAndType(teamId, ECampainType.NORMAL);
        if (isExistCampain) {
            const listCampainMatch = isExistCampain.campainMatches;
            return listCampainMatch;
        }

        const createCampain = await this.repository.createCompainNormal(teamId);

        return createCampain;
    }
}
