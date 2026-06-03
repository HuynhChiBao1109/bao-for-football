import { BadRequestException, Injectable } from "@nestjs/common";
import { IPlayerService } from "./interfaces/player-service.interface";
import { PlayerRepository } from "./player.repository";

@Injectable()
export class PlayerService implements IPlayerService {
  constructor(private readonly repository: PlayerRepository) {}

  private readonly allocatableKeys = new Set([
    "shooting",
    "passing",
    "longPass",
    "vision",
    "gkReach",
    "counterAttackAwareness",
    "attackingAwareness",
    "defending",
    "defensiveAwareness",
    "gkParrying",
    "gkReflex",
    "duels",
    "pace",
    "stamina",
    "balance",
    "technique",
    "determination",
    "physical",
    "strength",
    "standingTackle",
    "slidingTackle",
    "dribbling",
    "curve",
  ]);

  async listMyCards(userId: number) {
    return { data: await this.repository.listMyCards(userId) };
  }

  async allocateStats(
    userId: number,
    playerUserId: number,
    body: Record<string, number>,
  ) {
    if (!userId || !playerUserId) {
      throw new BadRequestException("userId and playerUserId are required");
    }

    const normalized = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, Number(value ?? 0)]),
    );

    const invalidKey = Object.keys(normalized).find(
      (key) => !this.allocatableKeys.has(key),
    );
    if (invalidKey) {
      throw new BadRequestException(`invalid stat key: ${invalidKey}`);
    }

    const negativeKey = Object.entries(normalized).find(
      ([, value]) => Number(value ?? 0) < 0,
    )?.[0];
    if (negativeKey) {
      throw new BadRequestException(
        `invalid stat allocation for ${negativeKey}`,
      );
    }

    const totalDelta = Object.values(normalized).reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    );
    if (totalDelta <= 0) {
      throw new BadRequestException("invalid stat allocation");
    }

    const { currentPoints, card } = await this.repository.getAllocationContext(
      userId,
      playerUserId,
    );
    if (!card) {
      throw new BadRequestException("card not found");
    }
    if (totalDelta > Number(currentPoints ?? 0)) {
      throw new BadRequestException("insufficient current points");
    }

    const updated = await this.repository.allocateStats(
      userId,
      playerUserId,
      normalized,
    );
    if (!updated) {
      throw new BadRequestException("card not found");
    }
    return { message: "stats allocated", data: updated };
  }
}
