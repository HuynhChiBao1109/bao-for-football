import { GachaRollResult } from "../gacha.repository";

export interface GachaServiceInterface {
  getProgress(userId: number, bannerCode: string): Promise<any>;
  roll(userId: number, bannerCode: string): Promise<GachaRollResult>;
}
