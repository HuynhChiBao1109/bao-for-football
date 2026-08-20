import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { MatchEntity } from "./entities/match.entity";
import { CampainMatchEntity } from "../campain/entities/campain-match.entity";
import { MatchEventEntity } from "./entities/match-event.entity";
import { MatchPlayerStatsEntity } from "./entities/match-player-stats.entity";
import { TeamEntity } from "../team/entities/team.entity";
import { TeamFormationEntity } from "../team/entities/team-formatition.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "../player/entities/player-user.entity";
import { PlayerEntity } from "../player/entities/player-admin.entity";
import { EMatchStatus } from "./enums";
import type { TeamTactics } from "../team/team-tactics";

@Injectable()
export class MatchRepository {
  constructor(
    @InjectRepository(MatchEntity)
    private readonly matchRepository: Repository<MatchEntity>,

    @InjectRepository(CampainMatchEntity)
    private readonly campainMatchRepository: Repository<CampainMatchEntity>,

    @InjectRepository(MatchEventEntity)
    private readonly matchEventRepository: Repository<MatchEventEntity>,

    @InjectRepository(MatchPlayerStatsEntity)
    private readonly matchPlayerStatsRepository: Repository<MatchPlayerStatsEntity>,

    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,

    @InjectRepository(TeamFormationEntity)
    private readonly teamFormationRepository: Repository<TeamFormationEntity>,

    @InjectRepository(UserPlayerEntity)
    private readonly userPlayerRepository: Repository<UserPlayerEntity>,

    @InjectRepository(UserPlayerSkillEntity)
    private readonly userPlayerSkillRepository: Repository<UserPlayerSkillEntity>,

    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,
  ) {}

  async findMatchById(matchId: number): Promise<MatchEntity | null> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
      relations: {
        homeTeam: true,
        awayTeam: true,
        campainMatch: {
          campain: true,
        },
      },
    });

    if (!match) {
      return null;
    }

    // Loading both one-to-many collections in the match query multiplies
    // events by player stats before TypeORM sorts/de-duplicates the result.
    // Fetch each bounded collection separately to avoid exhausting MySQL's
    // sort buffer on long simulations.
    const [matchEvents, matchPlayerStats] = await Promise.all([
      this.matchEventRepository.find({
        where: { matchId },
        order: {
          minute: "ASC",
          id: "ASC",
        },
      }),
      this.matchPlayerStatsRepository.find({
        where: { matchId },
        order: {
          id: "ASC",
        },
      }),
    ]);

    Object.assign(match, {
      matchEvents,
      matchPlayerStats,
    });

    return match;
  }

  async findMatchByCampaignMatchId(campaignMatchId: number): Promise<MatchEntity | null> {
    return this.matchRepository.findOne({
      where: { campainId: campaignMatchId },
      relations: {
        campainMatch: {
          campain: true,
        },
      },
    });
  }

  async findCampaignMatchById(campaignMatchId: number): Promise<CampainMatchEntity | null> {
    return this.campainMatchRepository.findOne({
      where: { id: campaignMatchId },
      relations: {
        campain: {
          team: true,
        },
        competitor: true,
      },
    });
  }

  async findCampaignMatchByLevel(
    campaignId: number,
    level: number,
  ): Promise<CampainMatchEntity | null> {
    return this.campainMatchRepository.findOne({
      where: {
        campainId: campaignId,
        level,
      },
    });
  }

  async findCampaignMatchesUpToLevel(campaignId: number, level: number) {
    return this.campainMatchRepository
      .createQueryBuilder("campaignMatch")
      .leftJoinAndSelect("campaignMatch.match", "match")
      .leftJoinAndSelect("campaignMatch.campain", "campain")
      .where("campaignMatch.campain_id = :campaignId", { campaignId })
      .andWhere("campaignMatch.level < :level", { level })
      .orderBy("campaignMatch.level", "ASC")
      .getMany();
  }

  async create(match: Partial<MatchEntity>): Promise<MatchEntity> {
    const newMatch = this.matchRepository.create(match);
    return this.matchRepository.save(newMatch);
  }

  async findTeamById(teamId: number): Promise<TeamEntity | null> {
    return this.teamRepository.findOne({ where: { id: teamId } });
  }

  async updateTeamTactics(
    teamId: number,
    payload: Pick<TeamEntity, keyof TeamTactics | "passRatio" | "shotRatio" | "pressure">,
  ): Promise<void> {
    await this.teamRepository.update({ id: teamId }, payload);
  }

  async update(matchId: number, payload: Partial<MatchEntity>): Promise<void> {
    await this.matchRepository.update({ id: matchId }, payload);
  }

  async resetMatchProgress(
    matchId: number,
    lineups?: Pick<MatchEntity, "homeLineup" | "awayLineup">,
  ): Promise<void> {
    await this.matchRepository.manager.transaction(async (manager) => {
      await manager.delete(MatchEventEntity, { matchId });
      await manager.delete(MatchPlayerStatsEntity, { matchId });
      await manager.update(
        MatchEntity,
        { id: matchId },
        {
          status: EMatchStatus.IN_PROGRESS,
          currentMinute: 0,
          clockSeconds: 0,
          homeScore: 0,
          awayScore: 0,
          latestSnapshot: null,
          timeline: [],
          homeLineup: lineups?.homeLineup ?? null,
          awayLineup: lineups?.awayLineup ?? null,
          endedAt: null,
        },
      );
    });
  }

  async completeCampaignMatch(data: {
    campaignId: number;
    teamId: number;
    nextLevel: number;
    reward: number;
  }): Promise<{ progressUpdated: boolean }> {
    return this.campainMatchRepository.manager.transaction(async (manager) => {
      const progressResult = await manager.query(
        "UPDATE campains SET level = GREATEST(level, ?) WHERE id = ? AND level < ?",
        [data.nextLevel, data.campaignId, data.nextLevel],
      );
      const progressUpdated = Number(progressResult?.affectedRows ?? 0) > 0;

      if (progressUpdated && data.reward > 0) {
        await manager.query("UPDATE teams SET budget = budget + ? WHERE id = ?", [
          data.reward,
          data.teamId,
        ]);
      }

      return { progressUpdated };
    });
  }

  async deleteById(matchId: number): Promise<void> {
    await this.matchRepository.delete({ id: matchId });
  }

  async saveEvents(events: Partial<MatchEventEntity>[]): Promise<MatchEventEntity[]> {
    if (!events.length) {
      return [];
    }

    const entities = this.matchEventRepository.create(events);
    return this.matchEventRepository.save(entities);
  }

  async savePlayerStats(
    stats: Partial<MatchPlayerStatsEntity>[],
  ): Promise<MatchPlayerStatsEntity[]> {
    if (!stats.length) {
      return [];
    }

    const entities = this.matchPlayerStatsRepository.create(stats);
    return this.matchPlayerStatsRepository.save(entities);
  }

  async getTeamFormations(teamId: number): Promise<TeamFormationEntity[]> {
    return this.teamFormationRepository.find({ where: { teamId }, order: { id: "ASC" } });
  }

  async getUserPlayersByUserId(userId: number): Promise<UserPlayerEntity[]> {
    return this.userPlayerRepository.find({ where: { userId } });
  }

  async getUserPlayerSkills(userPlayerIds: number[]): Promise<UserPlayerSkillEntity[]> {
    if (!userPlayerIds.length) {
      return [];
    }

    return this.userPlayerSkillRepository
      .createQueryBuilder("skill")
      .where("skill.user_player_id IN (:...userPlayerIds)", { userPlayerIds })
      .getMany();
  }

  async getPlayersByIds(playerIds: number[]): Promise<PlayerEntity[]> {
    if (!playerIds.length) {
      return [];
    }

    return this.playerRepository
      .createQueryBuilder("player")
      .leftJoinAndSelect("player.club", "club")
      .leftJoinAndSelect("player.skills", "skills")
      .where("player.id IN (:...playerIds)", { playerIds })
      .getMany();
  }
}
