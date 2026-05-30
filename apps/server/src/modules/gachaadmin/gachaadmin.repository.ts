import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
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
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  async listBanners(): Promise<GachaBanner[]> {
    if (!this.dataSource) {
      return this.memStore.filter((item) => item.status === 1);
    }

    const repository = this.dataSource.getRepository(GachaBannerEntity);
    const rows = await repository.find({
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

    if (!this.dataSource) {
      banner.id = this.memStore.length + 1;
      banner.createdAt = new Date().toISOString();
      this.memStore.push(banner);
      return banner;
    }

    const repository = this.dataSource.getRepository(GachaBannerEntity);
    const saved = await repository.save(
      repository.create({
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
    if (!this.dataSource) {
      this.memStore.forEach((item) => {
        if (new Date(item.expiredAt).getTime() <= Date.now()) {
          item.status = 4;
        }
      });
      return;
    }

    const repository = this.dataSource.getRepository(GachaBannerEntity);
    await repository
      .createQueryBuilder()
      .update(GachaBannerEntity)
      .set({ status: 4 })
      .where("expired_at <= :now", { now: new Date() })
      .andWhere("status <> :status", { status: 4 })
      .execute();
  }
}
