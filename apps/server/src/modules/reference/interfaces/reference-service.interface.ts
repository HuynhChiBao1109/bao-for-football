import { TeamEntity } from "../entities/team.entity";

export interface IReferenceService {
    getListClubDefault(): Promise<any>;
}