import { Injectable } from "@nestjs/common";
import { TeamEntity } from "./entities/team.entity";
import { Repository } from "typeorm/repository/Repository.js";
import { InjectRepository } from "@nestjs/typeorm/dist/common/typeorm.decorators";
import { ETeamType } from "./enums/team-type.enum";
import { TeamFormationEntity } from "./entities/team-formatition.entity";
import { UserPlayerEntity } from "../player/entities/player-user.entity";

@Injectable()
export class TeamRepository {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly repository: Repository<TeamEntity>,

    @InjectRepository(TeamFormationEntity)
    private readonly teamFormationRepository: Repository<TeamFormationEntity>,

    @InjectRepository(UserPlayerEntity)
    private readonly userPlayerRepository: Repository<UserPlayerEntity>,
  ) {}

  async getListTeamByUserId(userId: number): Promise<TeamEntity[]> {
    return await this.repository.find({ where: { userId: userId } });
  }

  async create(data: Partial<TeamEntity>): Promise<TeamEntity> {
    const newTeam = this.repository.create(data);
    return this.repository.save(newTeam);
  }

  async getById(id: number): Promise<TeamEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async getByIdWithFormations(id: number): Promise<TeamEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: { teamFormations: true },
      order: { teamFormations: { id: "ASC" } },
    });
  }

  async getUserPlayersByIds(userId: number, userPlayerIds: number[]): Promise<UserPlayerEntity[]> {
    if (!userPlayerIds.length) {
      return [];
    }

    return this.userPlayerRepository
      .createQueryBuilder("userPlayer")
      .where("userPlayer.user_id = :userId", { userId })
      .andWhere("userPlayer.id IN (:...userPlayerIds)", { userPlayerIds })
      .getMany();
  }

  async saveTactics(
    teamId: number,
    data: Pick<TeamEntity, "formation" | "passRatio" | "shotRatio" | "pressure">,
    lineup: Array<{
      slotId: string;
      position: string;
      userPlayerId: number;
      x?: number | null;
      y?: number | null;
    }>,
  ): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      await manager.update(TeamEntity, { id: teamId }, data);
      await manager.delete(TeamFormationEntity, { teamId });

      if (!lineup.length) {
        return;
      }

      const rows = lineup.map((item) =>
        manager.create(TeamFormationEntity, {
          teamId,
          userPlayerId: item.userPlayerId,
          position: {
            slotId: item.slotId,
            position: item.position,
            x: item.x,
            y: item.y,
          },
        }),
      );
      await manager.save(TeamFormationEntity, rows);
    });
  }

  async getBotTeams(limit = 10, excludeTeamId?: number): Promise<TeamEntity[]> {
    return this.repository
      .find({
        where: {
          type: ETeamType.BOT,
          ...(excludeTeamId ? { id: undefined } : {}),
        },
        order: { id: "ASC" },
        take: limit + (excludeTeamId ? 1 : 0),
      })
      .then((teams) =>
        excludeTeamId ? teams.filter((team) => team.id !== excludeTeamId).slice(0, limit) : teams,
      );
  }
}
