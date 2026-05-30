import { AuthUser, TeamAssignment } from "../../types";

export interface LoginResponseDto {
  token: string;
  user: AuthUser;
}

export interface MeResponseDto {
  user: AuthUser;
  team: TeamAssignment | null;
}
