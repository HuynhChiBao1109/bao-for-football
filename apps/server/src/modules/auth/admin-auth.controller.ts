import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../../common/decorations/public.decoration";
import { LoginDto } from "./dto/input/login.dto";
import { AuthService } from "./auth.service";

@Controller()
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("admin/login")
  @Public()
  async adminLogin(@Body() body: LoginDto) {
    const result = await this.authService.adminLogin(
      body.username,
      body.password,
    );
    return {
      message: "login successful",
      token: result.token,
      user: result.user,
    };
  }
}
