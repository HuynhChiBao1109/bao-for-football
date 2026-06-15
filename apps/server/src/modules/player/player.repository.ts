import { BadRequestException, Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { PlayerEntity } from "./entities/player-admin.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "./entities/player-user.entity";

@Injectable()
export class PlayerRepository {
  constructor(
    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,

    @InjectRepository(UserPlayerEntity)
    private readonly userPlayerRepository: Repository<UserPlayerEntity>,

    @InjectRepository(UserPlayerSkillEntity)
    private readonly userPlayerSkillRepository: Repository<UserPlayerSkillEntity>,
  ) {}

  async getListPlayerByClubId(clubId: number): Promise<PlayerEntity[]> {
    return await this.playerRepository.find({
      where: { clubId },
    });
  }

  async getPlayerById(playerId: number): Promise<PlayerEntity> {
    return await this.playerRepository.findOne({
      where: { id: playerId },
      relations: {
        skills: true,
      },
    });
  }

  async getUserPlayersByUserId(userId: number): Promise<UserPlayerEntity[]> {
    return this.userPlayerRepository.find({
      where: { userId },
      order: { id: "ASC" },
    });
  }

  async getPlayersByIds(playerIds: number[]): Promise<PlayerEntity[]> {
    if (!playerIds.length) {
      return [];
    }

    return this.playerRepository
      .createQueryBuilder("player")
      .leftJoinAndSelect("player.skills", "skills")
      .where("player.id IN (:...playerIds)", { playerIds })
      .getMany();
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

  async createPlayerUser(userId: number, playerId: number): Promise<UserPlayerEntity> {
    const player = await this.getPlayerById(playerId);
    if (!player) {
      throw new BadRequestException("Player not found");
    }

    // insert player to user
    const userPlayer = this.userPlayerRepository.create({
      userId,
      playerId,
      exp: 0,
      bonusAttack: 0,
      bonusDefense: 0,
      bonusAgility: 0,
      bonusPass: 0,
      bonusGoalkeeping: 0,
      positions: player.positions,
    });

    const newUserPlayer = await this.userPlayerRepository.save(userPlayer);

    const playerSkills = player.skills;
    for (const skill of playerSkills) {
      const userPlayerSkill = this.userPlayerSkillRepository.create({
        userPlayerId: newUserPlayer.id,
        skill: skill.skill,
      });
      await this.userPlayerSkillRepository.save(userPlayerSkill);
    }

    return newUserPlayer;
  }
}
