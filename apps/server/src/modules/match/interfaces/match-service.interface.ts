import { AuthUser } from "src/modules/auth/types";
import { MatchEntity } from "../entities/match.entity";

export interface MatchServiceInterface {
  startCampaignMatch(
    user: AuthUser,
    campaignMatchId: bigint,
  ): Promise<{ matchId: string; status: string; latestSnapshot: unknown }>;

  getById(matchId: bigint): Promise<MatchEntity>;

  finalize(matchId: string, payload: Partial<MatchEntity>): Promise<MatchEntity>;
}
