import { Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { AuthUser } from "../auth/types";
import { DailyLoginService } from "./daily-login.service";

@ApiTags("daily-login")
@Controller("api/v1/daily-login")
export class DailyLoginController {
  constructor(private readonly dailyLoginService: DailyLoginService) {}

  @Get()
  getStatus(@CurrentUser() user: AuthUser) {
    return this.dailyLoginService.getStatus(user);
  }

  @Post("claim")
  claim(@CurrentUser() user: AuthUser) {
    return this.dailyLoginService.claim(user);
  }
}
