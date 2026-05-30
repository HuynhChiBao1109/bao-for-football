import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { RealtimeService } from "../realtime/realtime.service";
import { MatchServiceInterface } from "./interfaces/match-service.interface";
import { MatchRecord, MatchRepository } from "./match.repository";

@Injectable()
export class MatchService implements MatchServiceInterface {
  constructor(
    private readonly repository: MatchRepository,
    private readonly realtimeService: RealtimeService,
  ) {}

  async start(
    userId: number,
    input: { awayClubName?: string; mode?: string; stageNo?: number },
  ): Promise<MatchRecord> {
    const matchId = randomUUID();
    const homeClubName = await this.repository.getHomeClubName(userId);
    const record = await this.repository.createMatch(
      {
        matchId,
        homeClubName,
        awayClubName: input.awayClubName?.trim() || "Black United",
        mode: input.mode?.trim() || "casual",
        stageNo: input.stageNo,
      },
      userId,
    );
    this.realtimeService.startMatch(
      matchId,
      record.homeClubName,
      record.awayClubName,
    );
    return record;
  }

  async finalize(
    matchId: string,
    payload: Partial<MatchRecord>,
  ): Promise<MatchRecord> {
    if (!matchId) {
      throw new BadRequestException("matchId is required");
    }
    const record = await this.repository.finalizeMatch(matchId, payload);
    if (!record) {
      throw new BadRequestException("match not found");
    }
    this.realtimeService.publish("match.finished", record);
    return record;
  }
}
