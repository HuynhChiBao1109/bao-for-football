import { AuthUser, ClubOption, TeamAssignment, TokenClaims } from "../types";
import { LoginDto } from "../dto/input/login.dto";
import { RegisterDto } from "../dto/input/register.dto";

export interface IAuthService {
  register(data: RegisterDto): Promise<AuthUser>;

  login(data: LoginDto): Promise<{ token: string; user: AuthUser }>;

  me(claims: TokenClaims): Promise<{ user: AuthUser; team: TeamAssignment[] }>;
}
