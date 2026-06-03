import { CreateTeamByClubDTO } from "../dto/create-team-by-club.dto";
import { TeamEntity } from "../entities/team.entity";

export interface ITeamService {
    getListTeamByUserId(userId: bigint): Promise<TeamEntity[]>;
    
    createByClub(data: CreateTeamByClubDTO): Promise<TeamEntity>;
}