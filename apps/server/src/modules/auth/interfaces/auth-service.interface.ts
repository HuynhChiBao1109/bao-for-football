import { AuthUser, ClubOption, TeamAssignment, TokenClaims } from "../types";

export interface AuthServiceInterface {
  ensureAdmin(): Promise<void>;

  listRegistrationClubs(): Promise<ClubOption[]>;

  register(userName: string, password: string): Promise<AuthUser>;

  login(
    userName: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }>;

  adminLogin(
    userName: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }>;

  me(
    userId: number,
    userName: string,
    isAdmin: boolean,
  ): Promise<{ user: AuthUser; team: TeamAssignment | null }>;
  
  assignClub(userId: number, clubId: number): Promise<TeamAssignment | null>;

  validateToken(token: string): Promise<TokenClaims>;
}
