import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "src/common/decorations/currentUser.decoration";
import { AuthUser } from "../auth/types";
import { TeamService } from "./team.service";

@ApiTags("tactics")
@Controller("api/v1/tactics")
export class TacticsController {
  constructor(private readonly teamService: TeamService) {}

  @Get(":teamId")
  async getTactics(@Param("teamId") teamId: string, @CurrentUser() user: AuthUser) {
    return this.teamService.getTactics(teamId, user);
  }

  @Post()
  async saveTactics(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.teamService.saveTactics(user, body as any);
  }
}
