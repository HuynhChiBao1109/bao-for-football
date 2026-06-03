import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { MatchServiceInterface } from "./interfaces/match-service.interface";
import { MatchRecord, MatchRepository } from "./match.repository";
import { MatchEntity } from "./entities/match.entity";
import { AuthUser } from "../auth/types";

@Injectable()
export class MatchService implements MatchServiceInterface {
  constructor(
    private readonly repository: MatchRepository,
  ) {}

  async startCampaignMatch(
    user: AuthUser,
    campaignMatchId: bigint,
  ): Promise<string> {
    
  }

  async finalize(
    matchId: string,
    payload: Partial<MatchEntity>,    
  ): Promise<any> {
    // if (!matchId) {
    //   throw new BadRequestException("matchId is required");
    // }

    // if (payload.homeScore != null && Number(payload.homeScore) < 0) {
    //   throw new BadRequestException(
    //     "homeScore must be greater than or equal to 0",
    //   );
    // }
    // if (payload.awayScore != null && Number(payload.awayScore) < 0) {
    //   throw new BadRequestException(
    //     "awayScore must be greater than or equal to 0",
    //   );
    // }

    // const existing = await this.repository.findMatchById(matchId);
    // if (!existing) {
    //   throw new BadRequestException("match not found");
    // }
    // if (existing.status === "finished") {
    //   throw new BadRequestException("match already finalized");
    // }

    // const record = await this.repository.finalizeMatch(matchId, payload);
    // if (!record) {
    //   throw new BadRequestException("match not found");
    // }
    // this.realtimeService.publish("match.finished", record);
    // return record;
  }
}
