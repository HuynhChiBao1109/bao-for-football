import { AuthUser, ClubOption, TeamAssignment, TokenClaims } from "../types";

export interface AuthServiceInterface {
  ensureAdmin(): Promise<void>;
  listRegistrationClubs(): Promise<ClubOption[]>;
  register(username: string, password: string): Promise<AuthUser>;
  login(
    username: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }>;
  adminLogin(
    username: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }>;
  me(
    userId: number,
    username: string,
    isAdmin: boolean,
  ): Promise<{ user: AuthUser; team: TeamAssignment | null }>;
  assignClub(userId: number, clubId: number): Promise<TeamAssignment | null>;
  validateToken(token: string): Promise<TokenClaims>;
}
