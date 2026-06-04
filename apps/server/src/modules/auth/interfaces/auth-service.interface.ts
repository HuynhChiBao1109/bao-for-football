import { AuthUser } from "../types";
import { LoginDTO } from "../dto/input/login.dto";
import { TeamEntity } from "src/modules/team/entities/team.entity";
import { RegisterDTO } from "../dto/input/register.dto";

export interface IAuthService {
  register(data: RegisterDTO): Promise<AuthUser>;

  login(data: LoginDTO): Promise<{ token: string; user: AuthUser }>;

  me(claims: AuthUser): Promise<{ user: AuthUser; team: TeamEntity }>;

  verifyToken(token: string): Promise<AuthUser>;
}
