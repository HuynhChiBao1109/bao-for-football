import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
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
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
    @InjectRepository(MatchEntity)
    private readonly matchRepository: Repository<MatchEntity>,
  ) {}

  async getHomeClubName(userId: number): Promise<string> {
    const team = await this.teamRepository.findOne({
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

  async findMatchById(matchId: string): Promise<MatchRecord | null> {
    const existing = this.memStore.get(matchId);
    if (existing) {
      return existing;
    }

    if (!this.dataSource) {
      return null;
    }

    const repository = this.dataSource.getRepository(MatchEntity);
    const match = await repository.findOne({ where: { matchId } });
    if (!match) {
      return null;
    }

    return {
      matchId: match.matchId,
      homeClubName: match.homeClubName,
      awayClubName: match.awayClubName,
      mode: match.mode,
      stageNo: match.stageNo ?? undefined,
      startedAt: match.startedAt,
      endedAt: match.endedAt ?? undefined,
      homeScore: match.homeScore ?? undefined,
      awayScore: match.awayScore ?? undefined,
      homeStats: match.homeStats ?? undefined,
      awayStats: match.awayStats ?? undefined,
      status: match.status,
    };
  }
}
