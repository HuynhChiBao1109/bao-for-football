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

  startAutoTick(matchId: number): Promise<unknown>;

  stopAutoTick(matchId: number): Promise<unknown>;

  resetMatch(matchId: number): Promise<MatchEntity>;

  finalize(matchId: number, payload: Partial<MatchEntity>): Promise<MatchEntity>;
}
