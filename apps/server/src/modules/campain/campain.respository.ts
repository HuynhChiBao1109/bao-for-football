import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm/repository/Repository.js";
import { InjectRepository } from "@nestjs/typeorm/dist/common/typeorm.decorators";
import { CampainEntity } from "./entities/campain.entity";
import { CampainMatchEntity } from "./entities/campain-match.entity";
import { ECampainType } from "./enum/campain-type.enum";


@Injectable()
export class CampainRepository {
  constructor(
    @InjectRepository(CampainEntity)
    private readonly repository: Repository<CampainEntity>,
  ) {}

    async getListCampainByTeamId(teamId: bigint) {
        const listCampain = await this.repository.find({
            where: {
                teamId,
            },
        });
        return listCampain;
    }

    async createCompainNormal(teamId: bigint): Promise<CampainMatchEntity[]> {
        const createCampain = this.repository.create({
            teamId,
            type: ECampainType.NORMAL,
        });
        const newCampain = await this.repository.save(createCampain);

        const listCampainMatch = [];

        for (let i = 1; i <= 10; i++) {
            const campainMatch = new CampainMatchEntity();
            campainMatch.campainId = newCampain.id;
            campainMatch.level = i;
            campainMatch.matchReward = BigInt(1000 * 1000 * i);
            listCampainMatch.push(campainMatch);
        }

        await this.repository.save(listCampainMatch);
        
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
