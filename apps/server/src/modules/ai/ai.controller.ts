import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { AiService } from "./ai.service";

@ApiTags("ai")
@Controller("api/v1/ai")
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get("stages")
  async listStages(@CurrentUser("userId") userId: number) {
    return this.service.listStages(Number(userId));
  }

  @Get("stages/:stageNo")
  async getStageDetail(
    @CurrentUser("userId") userId: number,
    @Param("stageNo") stageNo: string,
  ) {
    return this.service.getStageDetail(Number(userId), Number(stageNo));
  }

  @Post("stages/:stageNo/result")
  async submitResult(
    @CurrentUser("userId") userId: number,
    @Param("stageNo") stageNo: string,
    @Body() body: { isWin: boolean },
  ) {
    return this.service.submitResult(
      Number(userId),
      Number(stageNo),
      Boolean(body.isWin),
    );
  }
}
