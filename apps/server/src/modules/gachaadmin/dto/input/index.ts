export interface CreateBannerInputDto {
  bannerCode: string;
  bannerName: string;
  bannerImageUrl: string;
  playerId: number;
  expiredAt: string;
  status?: number;
}

export interface UploadBannerImageInputDto {
  file: Express.Multer.File;
}
