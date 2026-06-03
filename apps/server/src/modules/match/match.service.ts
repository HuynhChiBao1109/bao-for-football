import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { MatchServiceInterface } from "./interfaces/match-service.interface";
import { MatchRepository } from "./match.repository";
import { MatchEntity } from "./entities/match.entity";
import { AuthUser } from "../auth/types";

@Injectable()
export class MatchService implements MatchServiceInterface {
  constructor(private readonly repository: MatchRepository) {}

  async startCampaignMatch(
    user: AuthUser,
    campaignMatchId: bigint,
  ): Promise<any> {}

  async finalize(
    matchId: string,
    payload: Partial<MatchEntity>,
  ): Promise<any> {}
}
