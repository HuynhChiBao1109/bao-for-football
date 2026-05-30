import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { PlayerTemplateEntity } from "./entities/player-admin.entities";
import { UserPlayerEntity } from "./entities/player.entities";

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
      shooting: this.numberOf(source?.shoot),
      passing: this.numberOf(source?.pass),
      longPass: this.numberOf(source?.longPass),
      vision: this.numberOf(source?.vision),
      attackingAwareness: 0,
      defensiveAwareness: this.numberOf(source?.tackle),
      duels: this.numberOf(source?.tackle),
      pace: this.numberOf(source?.speed),
      stamina: this.numberOf(source?.stamina),
      balance: this.numberOf(source?.balance),
      technique: this.numberOf(source?.dribbling),
      determination: 0,
      strength: this.numberOf(source?.bodyType),
      standingTackle: this.numberOf(source?.tackle),
      slidingTackle: this.numberOf(source?.tackle),
      dribbling: this.numberOf(source?.dribbling),
      curve: 0,
      gkParrying: 0,
      gkReflex: 0,
      gkReach: 0,
    } as Record<(typeof this.statKeys)[number], number>;
  }

  private buildBonusStats(card: UserPlayerEntity) {
    return {
      shooting: this.numberOf(card.bonusShoot),
      passing: this.numberOf(card.bonusPass),
      longPass: this.numberOf(card.bonusLongPass),
      vision: this.numberOf(card.bonusVision),
      attackingAwareness: 0,
      defensiveAwareness: this.numberOf(card.bonusTackle),
      duels: this.numberOf(card.bonusTackle),
      pace: this.numberOf(card.bonusSpeed),
      stamina: this.numberOf(card.bonusStamina),
      balance: this.numberOf(card.bonusBalance),
      technique: this.numberOf(card.bonusDribbling),
      determination: 0,
      strength: 0,
      standingTackle: this.numberOf(card.bonusTackle),
      slidingTackle: this.numberOf(card.bonusTackle),
      dribbling: this.numberOf(card.bonusDribbling),
      curve: 0,
      gkParrying: 0,
      gkReflex: 0,
      gkReach: 0,
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
      level: 1,
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

    if (!this.dataSource) {
      const cards = this.memStore.get(userId) ?? [];
      const card = cards.find(
        (item) => Number(item.userPlayerId) === Number(userPlayerId),
      );
      if (!card) {
        return null;
      }
      card.bonusStats = { ...(card.bonusStats ?? {}), ...normalizedDeltas };
      const totalDelta = Object.values(normalizedDeltas).reduce(
        (sum, value) => sum + Number(value),
        0,
      );
      card.currentPoints = Number(card.currentPoints ?? 0) - totalDelta;
      return card;
    }

    const repository = this.dataSource.getRepository(UserPlayerEntity);
    const entity = await repository.findOne({
      where: { userId: String(userId), id: String(userPlayerId) },
    });
    if (!entity) {
      return null;
    }

    const propertyMap: Record<string, keyof UserPlayerEntity> = {
      shooting: "bonusShoot",
      passing: "bonusPass",
      longPass: "bonusLongPass",
      vision: "bonusVision",
      defending: "bonusTackle",
      defensiveAwareness: "bonusTackle",
      duels: "bonusTackle",
      pace: "bonusSpeed",
      stamina: "bonusStamina",
      balance: "bonusBalance",
      technique: "bonusDribbling",
      standingTackle: "bonusTackle",
      slidingTackle: "bonusTackle",
      dribbling: "bonusDribbling",
    };

    for (const [key, value] of Object.entries(normalizedDeltas)) {
      const mapped = propertyMap[key];
      if (!mapped) {
        continue;
      }
      const current = Number(entity[mapped] ?? 0);
      (entity[mapped] as number) = current + Number(value);
    }
    const totalDelta = Object.values(normalizedDeltas).reduce(
      (sum, value) => sum + Number(value),
      0,
    );
    entity.currentPoints -= totalDelta;
    await repository.save(entity);
    return this.findByUserPlayerID(userId, userPlayerId);
  }
}
