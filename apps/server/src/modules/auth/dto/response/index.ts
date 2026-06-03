import { TeamEntity } from "src/modules/team/entities/team.entity";
import { AuthUser } from "../../types";

export interface LoginResponseDto {
  token: string;
  user: AuthUser;
}

export interface MeResponseDto {
  user: AuthUser;
  teams: TeamEntity[] | null;
}
