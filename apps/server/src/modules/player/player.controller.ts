import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { PlayerService } from "./player.service";
import { AuthUser } from "../auth/types";

@ApiTags("players")
@Controller("api/v1/players")
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get()
  async getMyPlayers(@CurrentUser() user: AuthUser) {
    return this.playerService.getMyPlayers(user);
  }
}
