import { AuthUser } from "src/modules/auth/types";
import { MatchEntity } from "../entities/match.entity";

type MatchStartPayload = {
  matchId: string;
  homeLineup: unknown[];
  awayLineup: unknown[];
};

export interface IMatchService {
  startCampaignMatch(
    user: AuthUser,
    campaignMatchId: number,
  ): Promise<MatchStartPayload>;

  getById(matchId: number): Promise<MatchEntity>;

  getNextTick(matchId: number): Promise<unknown>;

  finalize(matchId: number, payload: Partial<MatchEntity>): Promise<MatchEntity>;
}
