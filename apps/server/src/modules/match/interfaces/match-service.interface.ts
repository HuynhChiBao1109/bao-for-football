import { AuthUser } from "src/modules/auth/types";
import { MatchEntity } from "../entities/match.entity";

export interface IMatchService {
  startCampaignMatch(
    user: AuthUser,
    campaignMatchId: number,
  ): Promise<{ matchId: string; status: string; latestSnapshot: unknown }>;

  getById(matchId: number): Promise<MatchEntity>;

  finalize(matchId: number, payload: Partial<MatchEntity>): Promise<MatchEntity>;
}
