import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { PlayerTemplateEntity } from "../../database/entities/player-admin.entities";
import { UserPlayerEntity } from "../../database/entities/player.entities";

@Injectable()
export class PlayerRepository {
  private readonly memStore = new Map<number, any[]>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  async listMyCards(userId: number): Promise<any[]> {
    if (!this.dataSource) {
      return this.memStore.get(userId) ?? [];
    }

    const playerRepository = this.dataSource.getRepository(UserPlayerEntity);
    const templateRepository =
      this.dataSource.getRepository(PlayerTemplateEntity);
    const cards = await playerRepository.find({
      where: { userId: String(userId) },
      order: { id: "ASC" },
    });
    if (!cards.length) {
      return [];
    }

    const templates = await templateRepository.findByIds(
      cards.map((item) => item.playerTemplateId),
    );
    const templateMap = new Map(templates.map((item) => [item.id, item]));
    return cards.map((card) => {
      const template = templateMap.get(card.playerTemplateId);
      return {
        userPlayerId: Number(card.id),
        playerTemplateId: Number(card.playerTemplateId),
        name: template?.name ?? "",
        imageUrl: template?.avatarUrl ?? "",
        baseClub: template?.baseClub ?? "",
        season: template?.season ?? "",
        level: card.level,
        exp: card.exp,
        currentPoints: card.currentPoints,
      };
    });
  }

  async findByUserPlayerID(
    userId: number,
    userPlayerId: number,
  ): Promise<any | null> {
    const cards = await this.listMyCards(userId);
    return (
      cards.find(
        (item) => Number(item.userPlayerId) === Number(userPlayerId),
      ) ?? null
    );
  }

  async getAllocationContext(
    userId: number,
    userPlayerId: number,
  ): Promise<{ currentPoints: number; card: any | null }> {
    if (!this.dataSource) {
      const cards = this.memStore.get(userId) ?? [];
      const card =
        cards.find(
          (item) => Number(item.userPlayerId) === Number(userPlayerId),
        ) ?? null;
      return { currentPoints: Number(card?.currentPoints ?? 0), card };
    }

    const card = await this.findByUserPlayerID(userId, userPlayerId);
    return { currentPoints: Number(card?.currentPoints ?? 0), card };
  }

  async allocateStats(
    userId: number,
    userPlayerId: number,
    deltas: Record<string, number>,
  ): Promise<any> {
    const normalizedDeltas = Object.fromEntries(
      Object.entries(deltas).map(([key, value]) => [key, Number(value ?? 0)]),
    );
    const totalDelta = Object.values(normalizedDeltas).reduce(
      (sum, value) => sum + Number(value),
      0,
    );

    if (totalDelta <= 0) {
      throw new Error("invalid stat allocation");
    }

    const negativeKey = Object.entries(normalizedDeltas).find(
      ([, value]) => value < 0,
    )?.[0];
    if (negativeKey) {
      throw new Error(`invalid stat allocation for ${negativeKey}`);
    }

    const { currentPoints, card } = await this.getAllocationContext(
      userId,
      userPlayerId,
    );
    if (!card) {
      throw new Error("card not found");
    }
    if (totalDelta > currentPoints) {
      throw new Error("insufficient current points");
    }

    if (!this.dataSource) {
      const cards = this.memStore.get(userId) ?? [];
      const card = cards.find(
        (item) => Number(item.userPlayerId) === Number(userPlayerId),
      );
      if (!card) {
        throw new Error("card not found");
      }
      card.bonusStats = { ...(card.bonusStats ?? {}), ...normalizedDeltas };
      card.currentPoints = Number(card.currentPoints ?? 0) - totalDelta;
      return card;
    }

    const repository = this.dataSource.getRepository(UserPlayerEntity);
    const entity = await repository.findOne({
      where: { userId: String(userId), id: String(userPlayerId) },
    });
    if (!entity) {
      throw new Error("card not found");
    }

    const propertyMap: Record<string, keyof UserPlayerEntity> = {
      shooting: "bonusShooting",
      passing: "bonusPassing",
      longPass: "bonusLongPass",
      vision: "bonusVision",
      gkReach: "bonusGkReach",
      counterAttackAwareness: "bonusCounterAttackAwareness",
      attackingAwareness: "bonusCounterAttackAwareness",
      defending: "bonusDefending",
      defensiveAwareness: "bonusDefending",
      gkParrying: "bonusGkParrying",
      gkReflex: "bonusGkReflex",
      duels: "bonusDuels",
      pace: "bonusPace",
      stamina: "bonusStamina",
      balance: "bonusBalance",
      technique: "bonusTechnique",
      determination: "bonusDetermination",
      physical: "bonusPhysical",
      strength: "bonusPhysical",
      standingTackle: "bonusStandingTackle",
      slidingTackle: "bonusSlidingTackle",
      dribbling: "bonusDribbling",
      curve: "bonusCurve",
    };

    for (const [key, value] of Object.entries(normalizedDeltas)) {
      const mapped = propertyMap[key];
      if (!mapped) {
        continue;
      }
      const current = Number(entity[mapped] ?? 0);
      (entity[mapped] as number) = current + Number(value);
    }
    entity.currentPoints -= totalDelta;
    await repository.save(entity);
    return this.findByUserPlayerID(userId, userPlayerId);
  }
}
