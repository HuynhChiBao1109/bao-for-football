import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { Public } from "../../common/decorations/public.decoration";
import { TokenClaims } from "./types";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/input/login.dto";
import { RegisterDto } from "./dto/input/register.dto";

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Public()
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @Public()
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      message: "login successful",
      token: result.token,
      user: result.user,
    };
  }

  @Get("me")
  async me(@CurrentUser() user: TokenClaims) {
    return {
      data: await this.authService.me(
        Number(user?.userId),
        String(user?.userName ?? ""),
        Boolean(user?.isAdmin),
      ),
    };
  }
}
