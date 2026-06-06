import { AuthUser } from "src/modules/auth/types";
import { CampainMatchEntity } from "../entities/campain-match.entity";
import { CampainEntity } from "../entities/campain.entity";

export interface ICampainService {
  getListCampainByTeamId(teamId: number): Promise<CampainEntity[]>;

  createCompainNormal(teamId: number, user: AuthUser): Promise<CampainMatchEntity[]>;
}
