import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { PlayerService } from "./player.service";

@ApiTags("players")
@Controller("api/v1/players")
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get()
  async listMyCards(@CurrentUser("userId") userId: number) {
    return this.playerService.listMyCards(Number(userId));
  }

  @Post(":id/allocate")
  async allocateStats(
    @CurrentUser("userId") userId: number,
    @Param("id") id: string,
    @Body() body: Record<string, number>,
  ) {
    return this.playerService.allocateStats(Number(userId), Number(id), body);
  }
}
