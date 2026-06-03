import { AuthUser, TokenClaims } from "../types";
import { LoginDTO } from "../dto/input/login.dto";
import { RegisterDto } from "../dto/input/register.dto";
import { TeamEntity } from "src/modules/team/entities/team.entity";

export interface IAuthService {
  register(data: RegisterDto): Promise<AuthUser>;

  login(data: LoginDTO): Promise<{ token: string; user: AuthUser }>;

  me(claims: TokenClaims): Promise<{ user: AuthUser; team: TeamEntity[] }>;

  verifyToken(token: string): Promise<TokenClaims>;
}
