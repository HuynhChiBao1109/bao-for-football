import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { MatchEntity } from "./entities/match.entities";
import { TeamEntity } from "../auth/entities/auth.entities";

export interface MatchStats {
  [key: string]: any;
}

export interface MatchRecord {
  matchId: string;
  homeClubName: string;
  awayClubName: string;
  mode: string;
  stageNo?: number;
  startedAt: Date;
  endedAt?: Date;
  homeScore?: number;
  awayScore?: number;
  homeStats?: MatchStats;
  awayStats?: MatchStats;
  scorers?: any[];
  status?: string;
}

@Injectable()
export class MatchRepository {
  private readonly memStore = new Map<string, MatchRecord>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  async getHomeClubName(userId: number): Promise<string> {
    if (!this.dataSource) {
      return "Manchester United";
    }

    const repository = this.dataSource.getRepository(TeamEntity);
    const team = await repository.findOne({
      where: { userId: String(userId) },
    });
    return team?.clubName ?? "Manchester United";
  }

  async createMatch(
    input: Omit<MatchRecord, "startedAt" | "status">,
    userId: number,
  ): Promise<MatchRecord> {
    const record: MatchRecord = {
      ...input,
      startedAt: new Date(),
      status: "running",
    };

    this.memStore.set(record.matchId, record);

    if (!this.dataSource) {
      return record;
    }

    const repository = this.dataSource.getRepository(MatchEntity);
    const saved = await repository.save(
      repository.create({
        matchId: record.matchId,
        userId: String(userId),
        homeClubName: record.homeClubName,
        awayClubName: record.awayClubName,
        mode: record.mode,
        stageNo: record.stageNo ?? null,
        status: "running",
      }),
    );

    record.startedAt = saved.startedAt;

    return record;
  }

  async finalizeMatch(
    matchId: string,
    payload: Partial<MatchRecord>,
  ): Promise<MatchRecord | null> {
    const existing = this.memStore.get(matchId);
    if (existing?.status === "finished") {
      throw new Error("match already finalized");
    }

    if (payload.homeScore != null && payload.homeScore < 0) {
      throw new Error("homeScore must be greater than or equal to 0");
    }
    if (payload.awayScore != null && payload.awayScore < 0) {
      throw new Error("awayScore must be greater than or equal to 0");
    }

    const result: MatchRecord = {
      ...(existing ?? {
        matchId,
        homeClubName: "",
        awayClubName: "",
        mode: "casual",
        startedAt: new Date(),
      }),
      ...payload,
      matchId,
      endedAt: new Date(),
      status: "finished",
    };

    this.memStore.set(matchId, result);

    if (!this.dataSource) {
      return result;
    }

    const repository = this.dataSource.getRepository(MatchEntity);
    const match = await repository.findOne({ where: { matchId } });
    if (!match) {
      return null;
    }
    if (match.status === "finished") {
      throw new Error("match already finalized");
    }

    match.status = "finished";
    match.homeScore = result.homeScore ?? 0;
    match.awayScore = result.awayScore ?? 0;
    match.homeStats = result.homeStats ?? {};
    match.awayStats = result.awayStats ?? {};
    match.endedAt = result.endedAt ?? new Date();
    const saved = await repository.save(match);
    result.startedAt = saved.startedAt;
    result.endedAt = saved.endedAt ?? result.endedAt;

    return result;
  }
}
