import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { MatchService } from "./match.service";

@ApiTags("matches")
@Controller("api/v1/matches")
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post("start")
  async start(
    @CurrentUser("userId") userId: number,
    @Body() body: { awayClubName?: string; mode?: string; stageNo?: number },
  ) {
    const match = await this.matchService.start(Number(userId), body);
    return { data: match };
  }

  @Post(":matchId/finalize")
  async finalize(@Param("matchId") matchId: string, @Body() body: any) {
    const match = await this.matchService.finalize(matchId, body);
    return { data: match };
  }
}
