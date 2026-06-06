import { AuthUser } from "src/modules/auth/types";

export interface IPlayerService {
  insertPlayerToUserByClubId(user: AuthUser, clubId: number): Promise<void>;
}
