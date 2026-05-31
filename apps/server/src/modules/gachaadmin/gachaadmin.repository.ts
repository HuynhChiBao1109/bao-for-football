import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { GachaBannerEntity } from "../gacha/entities/gacha.entities";

export interface GachaBanner {
  id?: number;
  bannerCode: string;
  bannerName: string;
  bannerImageUrl: string;
  playerId: number;
  expiredAt: string;
  status: number;
  statusLabel?: string;
  createdAt?: string;
}

@Injectable()
export class GachaAdminRepository {
  private readonly memStore: GachaBanner[] = [];

  constructor(
    @InjectRepository(GachaBannerEntity)
    private readonly gachaBannerRepository: Repository<GachaBannerEntity>,
  ) {}

  async listBanners(): Promise<GachaBanner[]> {
    const rows = await this.gachaBannerRepository.find({
      where: { status: 1 },
      order: { id: "DESC" },
    });
    return rows.map((row) => ({
      id: Number(row.id),
      bannerCode: row.bannerCode,
      bannerName: row.bannerName,
      bannerImageUrl: row.bannerImageUrl,
      playerId: Number(row.playerId),
      expiredAt: row.expiredAt.toISOString(),
      status: row.status,
      createdAt: row.createdAt?.toISOString(),
    }));
  }

  async createBanner(input: GachaBanner): Promise<GachaBanner> {
    const status =
      input.expiredAt && new Date(input.expiredAt).getTime() <= Date.now()
        ? 4
        : 1;
    const banner: GachaBanner = { ...input, status };

    const saved = await this.gachaBannerRepository.save(
      this.gachaBannerRepository.create({
        bannerCode: banner.bannerCode,
        bannerName: banner.bannerName,
        bannerImageUrl: banner.bannerImageUrl,
        playerId: String(banner.playerId),
        expiredAt: new Date(banner.expiredAt),
        status: banner.status,
      }),
    );
    banner.id = Number(saved.id);
    banner.createdAt = saved.createdAt?.toISOString();
    return banner;
  }

  async syncExpiredBanners(): Promise<void> {
    await this.gachaBannerRepository
      .createQueryBuilder()
      .update(GachaBannerEntity)
      .set({ status: 4 })
      .where("expired_at <= :now", { now: new Date() })
      .andWhere("status <> :status", { status: 4 })
      .execute();
  }
}
