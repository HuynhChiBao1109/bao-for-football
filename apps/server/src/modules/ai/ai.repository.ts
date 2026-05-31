import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { UserStageEntity } from "./entities/ai.entities";

export interface CampaignStage {
  stageNo: number;
  clubId: number;
  clubName: string;
  rewardMoney: number;
  rewardExp: number;
  enemyStatBonus: number;
  isUnlocked: boolean;
  isCleared: boolean;
  attempts: number;
  wins: number;
  unlockedAt?: string;
  lastClearedAt?: string;
  updatedAt?: string;
}

export interface StageDetail {
  stage: CampaignStage;
  opponent: Array<Record<string, any>>;
}

export interface StageResult {
  stageNo: number;
  isWin: boolean;
  isCleared: boolean;
  unlockedNext: boolean;
  nextUnlockedStage: number;
  grantedMoney: number;
  grantedExpPerPlayer: number;
  rewardedPlayers: number;
}

@Injectable()
export class AiRepository {
  private readonly memStages = new Map<number, CampaignStage[]>();

  constructor(
    @InjectRepository(UserStageEntity)
    private readonly userStageRepository: Repository<UserStageEntity>,
  ) {}

  private seedStages(): CampaignStage[] {
    const stages: CampaignStage[] = [];
    for (let index = 1; index <= 50; index += 1) {
      stages.push({
        stageNo: index,
        clubId: index,
        clubName: `Stage Club ${index}`,
        rewardMoney: 100000 * index,
        rewardExp: 50 * index,
        enemyStatBonus: Math.min(20, Math.floor(index / 3)),
        isUnlocked: index === 1,
        isCleared: false,
        attempts: 0,
        wins: 0,
      });
    }
    return stages;
  }

  async ensureUserStages(userId: number): Promise<CampaignStage[]> {
    if (this.dataSource) {
      const repository = this.dataSource.getRepository(UserStageEntity);
      const existing = await repository.find({
        where: { userId: String(userId) },
        order: { stageNo: "ASC" },
      });
      if (!existing.length) {
        const seeded = this.seedStages();
        await repository.save(
          seeded.map((stage) =>
            repository.create({
              userId: String(userId),
              stageNo: stage.stageNo,
              clubId: String(stage.clubId),
              clubName: stage.clubName,
              rewardMoney: String(stage.rewardMoney),
              rewardExp: stage.rewardExp,
              enemyStatBonus: stage.enemyStatBonus,
              isUnlocked: stage.isUnlocked,
              isCleared: stage.isCleared,
              attempts: stage.attempts,
              wins: stage.wins,
            }),
          ),
        );
        return seeded;
      }

      return existing.map((stage) => ({
        stageNo: stage.stageNo,
        clubId: Number(stage.clubId),
        clubName: stage.clubName,
        rewardMoney: Number(stage.rewardMoney),
        rewardExp: stage.rewardExp,
        enemyStatBonus: stage.enemyStatBonus,
        isUnlocked: stage.isUnlocked,
        isCleared: stage.isCleared,
        attempts: stage.attempts,
        wins: stage.wins,
        unlockedAt: stage.unlockedAt?.toISOString(),
        lastClearedAt: stage.lastClearedAt?.toISOString(),
        updatedAt: stage.updatedAt?.toISOString(),
      }));
    }

    if (!this.memStages.has(userId)) {
      this.memStages.set(userId, this.seedStages());
    }
    return this.memStages.get(userId) ?? [];
  }

  async listStages(userId: number): Promise<CampaignStage[]> {
    return this.ensureUserStages(userId);
  }

  async getStageDetail(
    userId: number,
    stageNo: number,
  ): Promise<StageDetail | null> {
    const stages = await this.ensureUserStages(userId);
    const stage = stages[stageNo - 1];
    if (!stage) {
      return null;
    }
    return {
      stage,
      opponent: Array.from({ length: 22 }, (_, index) => ({
        name: `Opponent ${index + 1}`,
        role: "CF",
        shooting: 70,
        passing: 70,
        pace: 70,
        physical: 70,
        defending: 70,
        dribbling: 70,
      })),
    };
  }

  async applyStageResult(
    userId: number,
    stageNo: number,
    isWin: boolean,
  ): Promise<StageResult | null> {
    const stages = await this.ensureUserStages(userId);
    const stage = stages[stageNo - 1];
    if (!stage) {
      return null;
    }

    stage.attempts += 1;
    if (isWin) {
      stage.wins += 1;
      stage.isCleared = true;
      stage.lastClearedAt = new Date().toISOString();
      if (stages[stageNo]) {
        stages[stageNo].isUnlocked = true;
        stages[stageNo].unlockedAt = new Date().toISOString();
      }
    }
    stage.updatedAt = new Date().toISOString();

    if (this.dataSource) {
      const repository = this.dataSource.getRepository(UserStageEntity);
      const entity = await repository.findOne({
        where: { userId: String(userId), stageNo },
      });
      if (entity) {
        entity.attempts = stage.attempts;
        entity.wins = stage.wins;
        entity.isCleared = stage.isCleared;
        entity.lastClearedAt = stage.lastClearedAt
          ? new Date(stage.lastClearedAt)
          : null;
        entity.updatedAt = stage.updatedAt
          ? new Date(stage.updatedAt)
          : new Date();
        await repository.save(entity);
      }

      if (isWin && stages[stageNo]) {
        const nextEntity = await repository.findOne({
          where: { userId: String(userId), stageNo: stageNo + 1 },
        });
        if (nextEntity && !nextEntity.isUnlocked) {
          nextEntity.isUnlocked = true;
          nextEntity.unlockedAt = new Date();
          await repository.save(nextEntity);
        }
      }
    }

    return {
      stageNo,
      isWin,
      isCleared: stage.isCleared,
      unlockedNext: Boolean(stages[stageNo]?.isUnlocked),
      nextUnlockedStage: stageNo + 1,
      grantedMoney: isWin ? stage.rewardMoney : 0,
      grantedExpPerPlayer: isWin ? stage.rewardExp : 0,
      rewardedPlayers: isWin ? 22 : 0,
    };
  }
}
