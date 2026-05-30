import { Inject, Injectable } from "@nestjs/common";
import { DataSource, In } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { TeamEntity } from "../auth/entities/auth.entities";
import { GachaBannerEntity, GachaLogEntity } from "./entities/gacha.entities";
import { PlayerTemplateEntity } from "../player/entities/player-admin.entities";
import { UserPlayerEntity } from "../player/entities/player.entities";

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
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  async getProgress(userId: number, bannerCode: string) {
    const key = `${userId}:${bannerCode}`;
    if (!this.dataSource) {
      return (
        this.memProgress.get(key) ?? { totalRolls: 0, rollsSinceLastSpecial: 0 }
      );
    }

    const repository = this.dataSource.getRepository(GachaLogEntity);
    const totalRolls = await repository.count({
      where: { userId: String(userId), bannerCode },
    });
    const latest = await repository.findOne({
      where: { userId: String(userId), bannerCode },
      order: { id: "DESC" },
    });
    return {
      totalRolls,
      rollsSinceLastSpecial: Number(latest?.rollsSinceLastSpecial ?? 0),
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

    if (!this.dataSource) {
      return;
    }

    const repository = this.dataSource.getRepository(GachaLogEntity);
    await repository.save(
      repository.create({
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
  ): Promise<Array<{ id: number; name: string; imageUrl: string }>> {
    if (!this.dataSource) {
      return [
        {
          id: 1,
          name: "Default Player",
          imageUrl: "https://example.com/player.png",
        },
      ];
    }

    const bannerRepository = this.dataSource.getRepository(GachaBannerEntity);
    const templateRepository =
      this.dataSource.getRepository(PlayerTemplateEntity);
    const banners = await bannerRepository.find({
      where: { bannerCode, status: 1 },
    });

    if (!banners.length) {
      return [];
    }

    const templateIds = banners.map((item) => item.playerId);
    const templates = await templateRepository.find({
      where: { id: In(templateIds) },
    });
    return templates.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      imageUrl: String(row.avatarUrl ?? ""),
    }));
  }

  async getTeamBudget(userId: number): Promise<number> {
    if (!this.dataSource) {
      return 360000000;
    }
    const repository = this.dataSource.getRepository(TeamEntity);
    const team = await repository.findOne({
      where: { userId: String(userId) },
    });
    return Number(team?.budget ?? 0);
  }

  async deductBudget(userId: number, amount: number): Promise<boolean> {
    if (!this.dataSource) {
      return true;
    }
    const repository = this.dataSource.getRepository(TeamEntity);
    const team = await repository.findOne({
      where: { userId: String(userId) },
    });
    if (!team || Number(team.budget) < amount) {
      return false;
    }
    team.budget = String(Number(team.budget) - amount);
    await repository.save(team);
    return true;
  }

  async addUserPlayer(userId: number, playerTemplateId: number): Promise<void> {
    if (!this.dataSource) {
      return;
    }
    const repository = this.dataSource.getRepository(UserPlayerEntity);
    await repository.save(
      repository.create({
        userId: String(userId),
        playerTemplateId: String(playerTemplateId),
        exp: 0,
        currentPoints: 0,
      }),
    );
  }
}
