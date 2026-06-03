import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthRepository } from "./auth.repository";
import { IAuthService } from "./interfaces/auth-service.interface";
import { AuthUser, ClubOption, TeamAssignment, TokenClaims } from "./types";
import { RegisterDto } from "./dto/input/register.dto";
import { LoginDto } from "./dto/input/login.dto";
import { CryptoUtil } from "src/common/utils";
import { TeamEntity } from "../team/entities/team.entity";
import { TeamService } from "../team/team.service";

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly teamService: TeamService,
  ) {}

  private jwtSecret(): string {
    return this.configService.get<string>("JWT_SECRET") || "fifam-dev-secret";
  }

  async register(data: RegisterDto): Promise<AuthUser> {
    const { userName, password } = data;

    const safeUsername = userName.trim();
    const safePassword = password.trim();

    if (!safeUsername || !safePassword) {
      throw new BadRequestException("username and password are required");
    }
    if (safePassword.length < 4) {
      throw new BadRequestException("password must be at least 4 characters");
    }

    const existing = await this.repository.findUserByUserName(safeUsername);
    if (existing) {
      throw new BadRequestException("username already exists");
    }

    const newUser = await this.repository.create({
      userName: safeUsername,
      password: safePassword,
    });

    return newUser;
  }

  async login(data: LoginDto): Promise<{ token: string; user: AuthUser }> {
    const { userName, password } = data;

    if (!userName || !password) {
      throw new BadRequestException("username and password are required");
    }

    const user = await this.repository.findUserByUserName(userName);
    if (!user) {
      throw new BadRequestException("invalid credentials");
    }

    const comparePasswordHash = await CryptoUtil.compareHashWithSalt({
      value: password,
      hashedValue: user.passwordHash,
      salt: user.salt,
    });

    if (!comparePasswordHash) {
      throw new BadRequestException("invalid credentials");
    }

    const token = await this.signToken({
      id: Number(user.id),
      userName: user.userName,
      isAdmin: false,
    });

    return {
      token,
      user: { id: Number(user.id), userName: user.userName, isAdmin: false },
    };
  }

  async me(
    claims: TokenClaims,
  ): Promise<{ user: AuthUser; team: TeamEntity[] }> {
    const { id, userName, isAdmin } = claims;
    const user = await this.repository.findUserById(BigInt(id));
    if (!user) {
      throw new BadRequestException("user not found");
    }
    const teams = await this.teamService.getListTeamByUserId(user.id);
    return { user: { id: Number(user.id), userName: user.userName, isAdmin }, team: teams };
  }

  private async signToken(claims: TokenClaims): Promise<string> {
    return this.jwtService.signAsync(claims, {
      secret: this.jwtSecret(),
      expiresIn: "24h",
    });
  }
}
