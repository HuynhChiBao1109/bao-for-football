import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { Public } from "../../common/decorations/public.decoration";
import { TokenClaims } from "./types";
import { AuthService } from "./auth.service";
import { LoginDTO } from "./dto/input/login.dto";
import { RegisterDTO } from "./dto/input/register.dto";

@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Public()
  async register(@Body() registerDto: RegisterDTO) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @Public()
  async login(@Body() loginDto: LoginDTO) {
    return this.authService.login(loginDto);
  }

  @Get("me")
  async me(@CurrentUser() user: TokenClaims) {
    return this.authService.me({id: user.id, userName: user.userName, isAdmin: user.isAdmin});
  }
}
