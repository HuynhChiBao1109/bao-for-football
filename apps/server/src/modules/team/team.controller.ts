import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TeamService } from "./team.service";
import { CurrentUser } from "src/common/decorations/currentUser.decoration";
import { AuthUser } from "../auth/types";

@ApiTags("teams")
@Controller("api/v1/teams")
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post("club/:clubId")
  async createByClub(@Param("clubId") clubId: bigint, @CurrentUser() user: AuthUser) {
    return this.teamService.createByClub({clubId, user});
  }
}
