import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthRepository } from "./auth.repository";
import { AuthServiceInterface } from "./interfaces/auth-service.interface";
import { AuthUser, ClubOption, TeamAssignment, TokenClaims } from "./types";

@Injectable()
export class AuthService implements AuthServiceInterface {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private jwtSecret(): string {
    return this.configService.get<string>("JWT_SECRET") || "fifam-dev-secret";
  }

  private adminUsername(): string {
    return this.configService.get<string>("ADMIN_USERNAME") || "admin";
  }

  private adminPassword(): string {
    return this.configService.get<string>("ADMIN_PASSWORD") || "admin123";
  }

  async ensureAdmin(): Promise<void> {
    await this.repository.ensureAdmin(
      this.adminUsername(),
      this.adminPassword(),
    );
  }

  async listRegistrationClubs(): Promise<ClubOption[]> {
    return this.repository.listRegistrationClubs();
  }

  async register(username: string, password: string): Promise<AuthUser> {
    const safeUsername = username.trim();
    const safePassword = password.trim();

    if (!safeUsername || !safePassword) {
      throw new BadRequestException("username and password are required");
    }
    if (safePassword.length < 4) {
      throw new BadRequestException("password must be at least 4 characters");
    }
    if (safeUsername === this.adminUsername()) {
      throw new BadRequestException("reserved username");
    }

    const existing = await this.repository.findByUsername(safeUsername);
    if (existing) {
      throw new BadRequestException("username already exists");
    }

    return this.repository.create(safeUsername, safePassword);
  }

  async login(
    username: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }> {
    const safeUsername = username.trim();
    const safePassword = password.trim();

    if (!safeUsername || !safePassword) {
      throw new BadRequestException("username and password are required");
    }
    if (safeUsername === this.adminUsername()) {
      throw new UnauthorizedException("admin must use /admin/login");
    }

    const user = await this.repository.findByUsername(safeUsername);
    if (!user) {
      throw new UnauthorizedException("invalid credentials");
    }

    const auth = await import("bcrypt");
    const matches = await auth.compare(safePassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("invalid credentials");
    }

    const token = await this.signToken({
      userId: user.id,
      username: user.username,
      isAdmin: false,
    });
    return {
      token,
      user: { id: user.id, username: user.username, isAdmin: false },
    };
  }

  async adminLogin(
    username: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }> {
    const safeUsername = username.trim();
    const safePassword = password.trim();

    if (safeUsername !== this.adminUsername()) {
      throw new UnauthorizedException("invalid admin credentials");
    }

    const user = await this.repository.findByUsername(safeUsername);
    if (!user) {
      throw new UnauthorizedException("admin account not found");
    }

    const auth = await import("bcrypt");
    const matches = await auth.compare(safePassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("invalid admin credentials");
    }

    const token = await this.signToken({
      userId: user.id,
      username: user.username,
      isAdmin: true,
    });
    return {
      token,
      user: { id: user.id, username: user.username, isAdmin: true },
    };
  }

  async me(
    userId: number,
    username: string,
    isAdmin: boolean,
  ): Promise<{ user: AuthUser; team: TeamAssignment | null }> {
    const team = await this.repository.getTeamAssignment(userId);
    if (team) {
      team.tacticsTeamId = `user-${userId}`;
    }

    return {
      user: { id: userId, username, isAdmin },
      team,
    };
  }

  async assignClub(
    userId: number,
    clubId: number,
  ): Promise<any> {
    // if (!userId) {
    //   throw new BadRequestException("userId is required");
    // }
    // if (!clubId || clubId <= 0) {
    //   throw new BadRequestException("clubId is required");
    // }

    // const clubs = await this.repository.listRegistrationClubs();
    // const selected = clubs.find((item) => item.id === clubId);
    // if (!selected) {
    //   throw new BadRequestException("invalid clubId");
    // }

    // const assignment = await this.repository.assignClubToUser(
    //   userId,
    //   clubId,
    //   selected.name,
    // );
    // if (!assignment.ok) {
    //   throw new BadRequestException(
    //     assignment.reason || "failed to assign club",
    //   );
    // }

    // const ownedCount = await this.repository.countOwnedPlayers(userId);
    // if (ownedCount < 22) {
    //   const availableCount = await this.repository.countTemplatesByClub(clubId);
    //   if (availableCount < 22) {
    //     throw new BadRequestException(
    //       `starter club id ${clubId} (${assignment.starterClubName || selected.name}) does not have enough player templates`,
    //     );
    //   }

    //   const slotsLeft = 50 - ownedCount;
    //   if (slotsLeft <= 0) {
    //     throw new BadRequestException(
    //       "user cannot own more than 50 player cards",
    //       );
    //     }

    //   const assignCount = Math.min(22 - ownedCount, slotsLeft);
    //   const ownedTemplateIds =
    //     await this.repository.listOwnedTemplateIds(userId);
    //   const templates = await this.repository.listTemplatesByClub(clubId, 50);
    //   const templateIdsToAssign = templates
    //     .filter((item) => !ownedTemplateIds.has(String(item.id)))
    //     .slice(0, assignCount)
    //     .map((item) => String(item.id));

    //   if (templateIdsToAssign.length !== assignCount) {
    //     throw new BadRequestException(
    //       `expected to assign ${assignCount} starter players, assigned ${templateIdsToAssign.length}`,
    //     );
    //   }

    //   await this.repository.createUserPlayers(userId, templateIdsToAssign);
    // }

    // return this.repository.getTeamAssignment(userId);
  }

  async validateToken(token: string): Promise<TokenClaims> {
    try {
      const claims = await this.jwtService.verifyAsync<TokenClaims>(token, {
        secret: this.jwtSecret(),
      });
      return claims;
    } catch {
      throw new UnauthorizedException("invalid token");
    }
  }

  private async signToken(claims: TokenClaims): Promise<string> {
    return this.jwtService.signAsync(claims, {
      secret: this.jwtSecret(),
      expiresIn: "24h",
    });
  }
}
