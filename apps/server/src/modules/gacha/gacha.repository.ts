import { Injectable } from "@nestjs/common";
import { In, MoreThan, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { GachaBannerEntity, GachaLogEntity } from "./entities/gacha.entity";
import { PlayerEntity } from "../player/entities/player-admin.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "../player/entities/player-user.entity";
import { TeamEntity } from "../team/entities/team.entity";

export interface GachaRollResult {
  userId: number;
  bannerCode: string;
  rarity: string;
  season: string;
  isSpecial: boolean;
  isPityTriggered: boolean;
  totalRolls: number;
  rollsSinceLastSpecial: number;
  nextRollGuaranteedHint: boolean;
  playerId: number;
  playerName: string;
  playerImageUrl: string;
  costDeducted: number;
}

@Injectable()
export class GachaRepository {
  private readonly memProgress = new Map<
    string,
    { totalRolls: number; rollsSinceLastSpecial: number }
  >();

  constructor(
    @InjectRepository(GachaLogEntity)
    private readonly gachaLogRepository: Repository<GachaLogEntity>,
    @InjectRepository(GachaBannerEntity)
    private readonly gachaBannerRepository: Repository<GachaBannerEntity>,
    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,
    @InjectRepository(UserPlayerEntity)
    private readonly userPlayerRepository: Repository<UserPlayerEntity>,
    @InjectRepository(UserPlayerSkillEntity)
    private readonly userPlayerSkillRepository: Repository<UserPlayerSkillEntity>,
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
  ) {}

  async getActiveBanners() {
    const banners = await this.gachaBannerRepository.find({
      where: {
        status: 1,
        expiredAt: MoreThan(new Date()),
      },
      order: {
        createdAt: "DESC",
        id: "DESC",
      },
    });

    return banners.map((banner) => ({
      id: Number(banner.id),
      bannerCode: banner.bannerCode,
      bannerName: banner.bannerName,
      bannerImageUrl: banner.bannerImageUrl,
      playerId: Number(banner.playerId),
      expiredAt: banner.expiredAt?.toISOString?.() ?? String(banner.expiredAt),
      status: Number(banner.status),
      statusLabel: Number(banner.status) === 1 ? "Active" : "Inactive",
      createdAt: banner.createdAt?.toISOString?.() ?? String(banner.createdAt),
    }));
  }

  async getProgress(userId: number, bannerCode: string) {
    const key = `${userId}:${bannerCode}`;
    const totalRolls = await this.gachaLogRepository.count({
      where: { userId: String(userId), bannerCode },
    });
    const latest = await this.gachaLogRepository.findOne({
      where: { userId: String(userId), bannerCode },
      order: { id: "DESC" },
    });
    const rollsSinceLastSpecial = Number(latest?.rollsSinceLastSpecial ?? 0);
    return {
      totalRolls,
      rollsSinceLastSpecial,
      rollsSinceSpecial: rollsSinceLastSpecial,
    };
  }

  async roll(
    userId: number,
    bannerCode: string,
    payload: {
      rarity: string;
      isPityTriggered: boolean;
      totalRolls: number;
      rollsSinceLastSpecial: number;
      playerId: number;
      playerName: string;
      playerImageUrl: string;
      costDeducted: number;
    },
  ) {
    const key = `${userId}:${bannerCode}`;
    this.memProgress.set(key, {
      totalRolls: payload.totalRolls,
      rollsSinceLastSpecial: payload.rollsSinceLastSpecial,
    });

    await this.gachaLogRepository.save(
      this.gachaLogRepository.create({
        userId: String(userId),
        bannerCode,
        rarity: payload.rarity,
        isPityTriggered: payload.isPityTriggered,
        totalRolls: payload.totalRolls,
        rollsSinceLastSpecial: payload.rollsSinceLastSpecial,
      }),
    );
  }

  async getBannerPlayers(
    bannerCode: string,
  ): Promise<Array<{ id: number; name: string; imageUrl: string; season: string }>> {
    const banners = await this.gachaBannerRepository.find({
      where: { bannerCode, status: 1, expiredAt: MoreThan(new Date()) },
    });
    if (!banners.length) {
      return [];
    }

    const playerIds = banners.map((banner) => Number(banner.playerId)).filter(Boolean);
    if (!playerIds.length) {
      return [];
    }

    const imageByPlayerId = new Map(
      banners.map((banner) => [Number(banner.playerId), banner.bannerImageUrl]),
    );
    const players = await this.playerRepository.find({
      where: { id: In(playerIds) },
      relations: {
        club: true,
      },
    });

    return players.map((player) => ({
      id: Number(player.id),
      name: player.name,
      season: player.season,
      imageUrl: imageByPlayerId.get(Number(player.id)) || player.club?.imgUrl || "",
    }));
  }

  async getTeamBudget(userId: number): Promise<number> {
    const team = await this.teamRepository.findOne({
      where: { userId },
      order: { id: "ASC" },
    });

    return Number(team?.budget ?? 0);
  }

  async deductBudget(userId: number, amount: number): Promise<boolean> {
    const team = await this.teamRepository.findOne({
      where: { userId },
      order: { id: "ASC" },
    });
    if (!team || Number(team.budget) < amount) {
      return false;
    }

    team.budget = Number(team.budget) - amount;
    await this.teamRepository.save(team);
    return true;
  }

  async addUserPlayer(userId: number, playerId: number): Promise<void> {
    const player = await this.playerRepository.findOne({
      where: { id: playerId },
      relations: {
        skills: true,
      },
    });
    if (!player) {
      return;
    }

    const userPlayer = await this.userPlayerRepository.save(
      this.userPlayerRepository.create({
        userId,
        playerId,
        exp: 0,
        bonusAttack: 0,
        bonusDefense: 0,
        bonusAgility: 0,
        bonusPass: 0,
        bonusGoalkeeping: 0,
        positions: player.positions ?? [],
      }),
    );

    const skills = player.skills ?? [];
    if (!skills.length) {
      return;
    }

    await this.userPlayerSkillRepository.save(
      skills.map((skill) =>
        this.userPlayerSkillRepository.create({
          userPlayerId: userPlayer.id,
          skill: skill.skill,
        }),
      ),
    );
  }
}
