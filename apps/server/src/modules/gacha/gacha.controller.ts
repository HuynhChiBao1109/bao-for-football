import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { GachaService } from "./gacha.service";

@ApiTags("gacha")
@Controller("api/v1/gacha")
export class GachaController {
  constructor(private readonly gachaService: GachaService) {}

  @Get("progress")
  async getProgress(
    @CurrentUser("userId") userId: number,
    @Query("bannerCode") bannerCode: string,
  ) {
    return {
      data: await this.gachaService.getProgress(Number(userId), bannerCode),
    };
  }

  @Post("roll")
  async roll(
    @CurrentUser("userId") userId: number,
    @Body() body: { bannerCode: string },
  ) {
    const result = await this.gachaService.roll(
      Number(userId),
      body.bannerCode,
    );
    return { message: "roll successful", data: result };
  }
}
