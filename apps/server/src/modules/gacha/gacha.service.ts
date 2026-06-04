import { BadRequestException, Injectable } from "@nestjs/common";
import { GachaRepository, GachaRollResult } from "./gacha.repository";
import { GachaServiceInterface } from "./interfaces/gacha-service.interface";

@Injectable()
export class GachaService implements GachaServiceInterface {
  constructor(private readonly repository: GachaRepository) {}

  async getProgress(userId: number, bannerCode: string) {
    return this.repository.getProgress(userId, bannerCode);
  }

  async roll(userId: number, bannerCode: string): Promise<GachaRollResult> {
    if (!userId) {
      throw new BadRequestException("userId is required");
    }
    if (!bannerCode) {
      throw new BadRequestException("bannerCode is required");
    }

    const progress = await this.repository.getProgress(userId, bannerCode);
    const totalRolls = progress.totalRolls + 1;
    const rollsSinceLastSpecial = progress.rollsSinceLastSpecial + 1;
    const pityTriggered = rollsSinceLastSpecial >= 80;
    const isSpecial = pityTriggered || Math.random() < 0.1;
    const rarity = isSpecial ? "SSR" : "R";
    const playerPool = await this.repository.getBannerPlayers(bannerCode);
    if (!playerPool.length) {
      throw new BadRequestException("banner not found");
    }
    const selectedPlayer = playerPool[Math.floor(Math.random() * playerPool.length)] ?? {
      id: 0,
      name: "Unknown",
      imageUrl: "",
    };

    const costDeducted = 360000;
    const budget = await this.repository.getTeamBudget(userId);
    if (budget < costDeducted) {
      throw new BadRequestException("insufficient budget");
    }
    const budgetOk = await this.repository.deductBudget(userId, costDeducted);
    if (!budgetOk) {
      throw new BadRequestException("insufficient budget");
    }

    if (selectedPlayer.id) {
      await this.repository.addUserPlayer(userId, selectedPlayer.id);
    }

    await this.repository.roll(userId, bannerCode, {
      rarity,
      isPityTriggered: pityTriggered,
      totalRolls,
      rollsSinceLastSpecial: isSpecial ? 0 : rollsSinceLastSpecial,
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      playerImageUrl: selectedPlayer.imageUrl,
      costDeducted,
    });

    return {
      userId,
      bannerCode,
      rarity,
      season: "normal",
      isSpecial,
      isPityTriggered: pityTriggered,
      totalRolls,
      rollsSinceLastSpecial: isSpecial ? 0 : rollsSinceLastSpecial,
      nextRollGuaranteedHint: rollsSinceLastSpecial >= 70,
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      playerImageUrl: selectedPlayer.imageUrl,
      costDeducted,
    };
  }
}
