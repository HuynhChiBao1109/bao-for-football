import { TeamEntity } from "../entities/team.entity";

export interface ITeamService {
    getListTeamByUserId(userId: bigint): Promise<TeamEntity[]>;
}