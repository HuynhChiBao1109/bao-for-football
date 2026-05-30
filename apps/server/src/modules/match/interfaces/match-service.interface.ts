import { MatchRecord } from "../match.repository";

export interface MatchServiceInterface {
  start(
    userId: number,
    input: { awayClubName?: string; mode?: string; stageNo?: number },
  ): Promise<MatchRecord>;
  finalize(
    matchId: string,
    payload: Partial<MatchRecord>,
  ): Promise<MatchRecord>;
}
