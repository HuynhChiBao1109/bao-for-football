import { AuthUser } from "src/modules/auth/types";
import { MatchEntity } from "../entities/match.entity";

export interface MatchServiceInterface {
  startCampaignMatch(user: AuthUser, campaignMatchId: bigint): Promise<string>;

  finalize(matchId: string, payload: Partial<MatchEntity>): Promise<MatchEntity>;
}
