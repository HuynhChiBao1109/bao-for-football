import { AuthUser } from "src/modules/auth/types";
import { CampainMatchEntity } from "../entities/campain-match.entity";
import { CampainEntity } from "../entities/campain.entity";

export interface ICampainService {
  getListCampainByTeamId(teamId: bigint): Promise<CampainEntity[]>;

  createCompainNormal(teamId: bigint, user: AuthUser): Promise<CampainMatchEntity[]>;
}
