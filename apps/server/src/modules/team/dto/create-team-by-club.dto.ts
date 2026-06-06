import { AuthUser } from "src/modules/auth/types";

export class CreateTeamByClubDTO {
  clubId: number;
  user: AuthUser;
}
