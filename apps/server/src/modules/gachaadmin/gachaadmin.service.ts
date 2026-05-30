import { Injectable, OnModuleInit } from "@nestjs/common";
import { mkdirSync } from "fs";
import { extname, join } from "path";
import { GachaAdminServiceInterface } from "./interfaces/gachaadmin-service.interface";
import { GachaAdminRepository, GachaBanner } from "./gachaadmin.repository";

@Injectable()
export class GachaAdminService
  implements OnModuleInit, GachaAdminServiceInterface
{
  constructor(private readonly repository: GachaAdminRepository) {}

  onModuleInit() {
    mkdirSync(join(process.cwd(), "uploads", "image"), { recursive: true });
  }

  async listBanners() {
    return this.repository.listBanners();
  }

  async createBanner(input: GachaBanner) {
    if (
      !input.bannerCode ||
      !input.bannerName ||
      !input.bannerImageUrl ||
      !input.playerId ||
      !input.expiredAt
    ) {
      throw new Error("missing required banner fields");
    }
    return this.repository.createBanner(input);
  }

  async uploadImage(file: Express.Multer.File) {
    const ext = extname(file.originalname || ".png") || ".png";
    const fileName = `${Date.now()}${ext}`;
    const relativePath = `/uploads/image/${fileName}`;
    const fullPath = join(process.cwd(), "uploads", "image", fileName);
    await import("fs/promises").then((fs) =>
      fs.writeFile(fullPath, file.buffer),
    );
    return { path: relativePath, url: relativePath };
  }

  async syncExpiredBanners() {
    await this.repository.syncExpiredBanners();
  }
}
