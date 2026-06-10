import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { MatchService } from "./match.service";
import { AuthUser } from "../auth/types";

@ApiTags("matches")
@Controller("api/v1/matches")
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post("campaign/start")
  async start(
    @CurrentUser() user: AuthUser,
    @Body("campainMatchId") campainMatchId?: number,
    @Body("campainId") legacyCampainId?: number,
  ) {
    return this.matchService.startCampaignMatch(user, campainMatchId ?? legacyCampainId);
  }

  @Get(":matchId")
  async getById(@Param("matchId") matchId: number) {
    return this.matchService.getById(matchId);
  }

  @Post(":matchId/next-tick")
  async getNextTick(@Param("matchId") matchId: number) {
    return this.matchService.getNextTick(matchId);
  }
}
