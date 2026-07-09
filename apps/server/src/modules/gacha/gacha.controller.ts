import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { GachaService } from "./gacha.service";

@ApiTags("gacha")
@Controller("api/v1/gacha")
export class GachaController {
  constructor(private readonly gachaService: GachaService) {}

  @Get("banners")
  async getActiveBanners() {
    return {
      data: await this.gachaService.getActiveBanners(),
    };
  }

  @Get("progress")
  async getProgress(@CurrentUser("id") userId: number, @Query("bannerCode") bannerCode: string) {
    return {
      data: await this.gachaService.getProgress(Number(userId), bannerCode),
    };
  }

  @Post("roll")
  async roll(@CurrentUser("id") userId: number, @Body() body: { bannerCode: string }) {
    const result = await this.gachaService.roll(Number(userId), body.bannerCode);
    return { message: "roll successful", data: result };
  }
}
