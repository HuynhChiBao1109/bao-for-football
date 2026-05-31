import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { GachaBannerEntity, GachaLogEntity } from "./entities/gacha.entities";

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
    // Nếu cần PlayerTemplateEntity, UserPlayerEntity, TeamEntity thì inject thêm ở đây
  ) {}

  async getProgress(userId: number, bannerCode: string) {
    const key = `${userId}:${bannerCode}`;
    const totalRolls = await this.gachaLogRepository.count({
      where: { userId: String(userId), bannerCode },
    });
    const latest = await this.gachaLogRepository.findOne({
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
  ): Promise<Array<{ id: number; name: string; imageUrl: string }>> {
    // Đoạn này cần inject thêm PlayerTemplateRepository nếu dùng thực tế
    const banners = await this.gachaBannerRepository.find({
      where: { bannerCode, status: 1 },
    });
    if (!banners.length) {
      return [];
    }
    // Giả lập trả về rỗng, cần bổ sung PlayerTemplateRepository nếu muốn lấy player thực tế
    return [];
  }

  // Các hàm liên quan TeamEntity, UserPlayerEntity cần inject thêm repository nếu muốn dùng thực tế
}
