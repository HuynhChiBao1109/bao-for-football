import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CampainService } from "./campain.service";
import { AuthUser } from "../auth/types";
import { CurrentUser } from "src/common/decorations/currentUser.decoration";

@ApiTags("campains")
@Controller("api/v1/campains")
export class CampainController {
  constructor(private readonly campainService: CampainService) {}

  @Get("team/:teamId")
  async getListCampainByTeamId(@Param("teamId") teamId: bigint) {
    return this.campainService.getListCampainByTeamId(teamId);
  }

  @Post("team/:teamId/normal")
  async createCompainNormal(@Param("teamId") teamId: bigint, @CurrentUser() user: AuthUser) {
    return this.campainService.createCompainNormal(teamId, user);
  }
}
