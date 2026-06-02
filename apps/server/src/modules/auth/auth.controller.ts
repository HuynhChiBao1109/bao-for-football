import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { Public } from "../../common/decorations/public.decoration";
import { TokenClaims } from "./types";
import { AuthService } from "./auth.service";
import { AssignClubDto } from "./dto/input/assign-club.dto";
import { LoginDto } from "./dto/input/login.dto";
import { RegisterDto } from "./dto/input/register.dto";

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("clubs")
  @Public()
  async listRegistrationClubs() {
    return { data: await this.authService.listRegistrationClubs() };
  }

  @Post("register")
  @Public()
  async register(@Body() body: RegisterDto) {
    const user = await this.authService.register(body.username, body.password);
    return { message: "registered successfully", data: user };
  }

  @Post("login")
  @Public()
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(body.username, body.password);
    return {
      message: "login successful",
      token: result.token,
      user: result.user,
    };
  }

  @Post("team")
  async assignClub(
    @Body() body: AssignClubDto,
    @CurrentUser("userId") userId: number,
  ) {
    const team = await this.authService.assignClub(Number(userId), body.clubId);
    return { message: "club assigned", data: team };
  }

  @Get("me")
  async me(@CurrentUser() user: TokenClaims) {
    return {
      data: await this.authService.me(
        Number(user?.userId),
        String(user?.username ?? ""),
        Boolean(user?.isAdmin),
      ),
    };
  }
}
