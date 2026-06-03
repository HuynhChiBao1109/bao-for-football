import { Body, Controller, Param, Patch, Post } from "@nestjs/common";
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
    @Body("campainId") campainId: bigint,
  ) {
    return this.matchService.startCampaignMatch(user, campainId);
  }
}
