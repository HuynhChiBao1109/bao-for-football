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

  async findMatchById(matchId: bigint): Promise<MatchEntity | null> {
    return this.matchRepository.findOne({
      where: { id: matchId },
      relations: {
        matchEvents: true,
        matchPlayerStats: true,
      },
      order: {
        matchEvents: {
          minute: "ASC",
        },
      },
    });
  }

  async findMatchByCampaignMatchId(campaignMatchId: bigint): Promise<MatchEntity | null> {
    return this.matchRepository.findOne({ where: { campainId: campaignMatchId } });
  }

  async findCampaignMatchById(campaignMatchId: bigint): Promise<CampainMatchEntity | null> {
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

  async create(match: Partial<MatchEntity>): Promise<MatchEntity> {
    const newMatch = this.matchRepository.create(match);
    return this.matchRepository.save(newMatch);
  }

  async update(matchId: bigint, payload: Partial<MatchEntity>): Promise<void> {
    await this.matchRepository.update({ id: matchId }, payload);
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

  async getTeamFormations(teamId: bigint): Promise<TeamFormationEntity[]> {
    return this.teamFormationRepository.find({ where: { teamId } });
  }

  async getUserPlayersByUserId(userId: bigint): Promise<UserPlayerEntity[]> {
    return this.userPlayerRepository.find({ where: { userId } });
  }

  async getUserPlayerSkills(userPlayerIds: bigint[]): Promise<UserPlayerSkillEntity[]> {
    if (!userPlayerIds.length) {
      return [];
    }

    return this.userPlayerSkillRepository
      .createQueryBuilder("skill")
      .where("skill.user_player_id IN (:...userPlayerIds)", { userPlayerIds })
      .getMany();
  }

  async getPlayersByIds(playerIds: bigint[]): Promise<PlayerEntity[]> {
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
