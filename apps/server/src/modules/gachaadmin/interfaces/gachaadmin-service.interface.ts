import { GachaBanner } from "../gachaadmin.repository";

export interface GachaAdminServiceInterface {
  listBanners(): Promise<any[]>;
  createBanner(input: GachaBanner): Promise<any>;
  uploadImage(
    file: Express.Multer.File,
  ): Promise<{ path: string; url: string }>;
  syncExpiredBanners(): Promise<void>;
}
