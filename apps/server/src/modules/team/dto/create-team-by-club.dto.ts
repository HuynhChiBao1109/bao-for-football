import { AuthUser } from "src/modules/auth/types";

export class CreateTeamByClubDTO {
  clubId: bigint;
  user: AuthUser;
}
