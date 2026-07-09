import { GachaRollResult } from "../gacha.repository";

export interface GachaServiceInterface {
  getActiveBanners(): Promise<any>;
  getProgress(userId: number, bannerCode: string): Promise<any>;
  roll(userId: number, bannerCode: string): Promise<GachaRollResult>;
}
