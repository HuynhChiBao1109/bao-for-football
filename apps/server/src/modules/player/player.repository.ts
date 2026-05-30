import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { PlayerTemplateEntity } from "../../database/entities/player-admin.entities";
import { UserPlayerEntity } from "../../database/entities/player.entities";

@Injectable()
export class PlayerRepository {
  private readonly memStore = new Map<number, any[]>();
  private readonly statKeys = [
    "shooting",
    "passing",
    "longPass",
    "vision",
    "attackingAwareness",
    "defensiveAwareness",
    "duels",
    "pace",
    "stamina",
    "balance",
    "technique",
    "determination",
    "strength",
    "standingTackle",
    "slidingTackle",
    "dribbling",
    "curve",
    "gkParrying",
    "gkReflex",
    "gkReach",
  ] as const;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  private numberOf(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private buildBaseStats(template: PlayerTemplateEntity | null | undefined) {
    const source = template as any;
    return {
      shooting: this.numberOf(source?.baseShooting),
      passing: this.numberOf(source?.basePassing),
      longPass: this.numberOf(source?.baseLongPass),
      vision: this.numberOf(source?.baseVision),
      attackingAwareness: this.numberOf(source?.baseCounterAttackAwareness),
      defensiveAwareness: this.numberOf(source?.baseDefending),
      duels: this.numberOf(source?.baseDuels),
      pace: this.numberOf(source?.basePace),
      stamina: this.numberOf(source?.baseStamina),
      balance: this.numberOf(source?.baseBalance),
      technique: this.numberOf(source?.baseTechnique),
      determination: this.numberOf(source?.baseDetermination),
      strength: this.numberOf(source?.basePhysical),
      standingTackle: this.numberOf(source?.baseStandingTackle),
      slidingTackle: this.numberOf(source?.baseSlidingTackle),
      dribbling: this.numberOf(source?.baseDribbling),
      curve: this.numberOf(source?.baseCurve),
      gkParrying: this.numberOf(source?.baseGkParrying),
      gkReflex: this.numberOf(source?.baseGkReflex),
      gkReach: this.numberOf(source?.baseGkReach),
    } as Record<(typeof this.statKeys)[number], number>;
  }

  private buildBonusStats(card: UserPlayerEntity) {
    return {
      shooting: this.numberOf(card.bonusShooting),
      passing: this.numberOf(card.bonusPassing),
      longPass: this.numberOf(card.bonusLongPass),
      vision: this.numberOf(card.bonusVision),
      attackingAwareness: this.numberOf(card.bonusCounterAttackAwareness),
      defensiveAwareness: this.numberOf(card.bonusDefending),
      duels: this.numberOf(card.bonusDuels),
      pace: this.numberOf(card.bonusPace),
      stamina: this.numberOf(card.bonusStamina),
      balance: this.numberOf(card.bonusBalance),
      technique: this.numberOf(card.bonusTechnique),
      determination: this.numberOf(card.bonusDetermination),
      strength: this.numberOf(card.bonusPhysical),
      standingTackle: this.numberOf(card.bonusStandingTackle),
      slidingTackle: this.numberOf(card.bonusSlidingTackle),
      dribbling: this.numberOf(card.bonusDribbling),
      curve: this.numberOf(card.bonusCurve),
      gkParrying: this.numberOf(card.bonusGkParrying),
      gkReflex: this.numberOf(card.bonusGkReflex),
      gkReach: this.numberOf(card.bonusGkReach),
    } as Record<(typeof this.statKeys)[number], number>;
  }

  private buildCardResponse(card: UserPlayerEntity, template: any) {
    const baseStats = this.buildBaseStats(template ?? null);
    const bonusStats = this.buildBonusStats(card);
    const totalStats = this.statKeys.reduce(
      (acc, key) => ({
        ...acc,
        [key]: this.numberOf(baseStats[key]) + this.numberOf(bonusStats[key]),
      }),
      {} as Record<(typeof this.statKeys)[number], number>,
    );

    return {
      userPlayerId: Number(card.id),
      templateId: Number(card.playerTemplateId),
      playerTemplateId: Number(card.playerTemplateId),
      name: template?.name ?? "",
      imageUrl: template?.avatarUrl ?? "",
      baseClub: template?.baseClub ?? "",
      season: template?.season ?? "",
      level: this.numberOf(card.level),
      currentExp: this.numberOf(card.exp),
      exp: this.numberOf(card.exp),
      currentPoints: this.numberOf(card.currentPoints),
      baseStats,
      bonusStats,
      totalStats,
    };
  }

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
      return this.buildCardResponse(card, template);
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
