import { Inject, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { TeamEntity, UserEntity } from "./entities/auth.entities";
import { ClubEntity } from "../club/entities/club.entities";
import { PlayerTemplateEntity } from "../player/entities/player-admin.entities";
import { UserPlayerEntity } from "../player/entities/player.entities";
import { AuthUser, ClubOption, TeamAssignment } from "./types";

const defaultTeamBudget = 360000000;

@Injectable()
export class AuthRepository {
  private readonly memData = new Map<
    string,
    { id: number; username: string; passwordHash: string; createdAt: Date }
  >();
  private readonly memTeams = new Map<number, ClubOption>();
  private nextID = 1;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  async ensureUserTable(): Promise<void> {
    return;
  }

  async listRegistrationClubs(): Promise<ClubOption[]> {
    if (!this.dataSource) {
      return defaultClubs();
    }

    const repository = this.dataSource.getRepository(ClubEntity);
    const rows = await repository
      .createQueryBuilder("club")
      .leftJoinAndSelect("club.league", "league")
      .orderBy("club.id", "ASC")
      .getMany();

    if (!rows.length) {
      return defaultClubs();
    }

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      logo: row.logo ?? "",
      countryId: row.countryId != null ? Number(row.countryId) : undefined,
      leagueId: row.leagueId != null ? Number(row.leagueId) : undefined,
      budget: defaultTeamBudget,
      leagueName: row.league?.name ?? "",
    }));
  }

  async findByUsername(username: string): Promise<{
    id: number;
    username: string;
    passwordHash: string;
    createdAt: Date;
  } | null> {
    if (!this.dataSource) {
      return this.memData.get(username) ?? null;
    }

    const repository = this.dataSource.getRepository(UserEntity);
    const user = await repository.findOne({ where: { username } });
    if (!user) {
      return null;
    }

    return {
      id: Number(user.id),
      username: user.username,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
    };
  }

  async create(username: string, password: string): Promise<AuthUser> {
    const passwordHash = await bcrypt.hash(password, 10);

    if (!this.dataSource) {
      if (this.memData.has(username)) {
        const existing = this.memData.get(username)!;
        return {
          id: existing.id,
          username: existing.username,
          isAdmin: false,
        };
      }

      const user = {
        id: this.nextID++,
        username,
        passwordHash,
        createdAt: new Date(),
      };
      this.memData.set(username, user);
      return { id: user.id, username: user.username, isAdmin: false };
    }

    const repository = this.dataSource.getRepository(UserEntity);
    const saved = await repository.save(
      repository.create({ username, passwordHash }),
    );
    const insertedId = Number(saved.id);
    return { id: insertedId, username, isAdmin: false };
  }

  async ensureAdmin(username: string, password: string): Promise<void> {
    const user = await this.findByUsername(username);
    if (user) {
      return;
    }
    await this.create(username, password);
  }

  async getTeamAssignment(userId: number): Promise<TeamAssignment | null> {
    if (!this.dataSource) {
      const club = this.memTeams.get(userId);
      if (!club) {
        return null;
      }

      return {
        userId,
        clubId: club.id,
        clubName: club.name,
        image: club.logo,
        budget: club.budget,
        rankPoint: 0,
        tacticsTeamId: `user-${userId}`,
      };
    }

    const teamRepository = this.dataSource.getRepository(TeamEntity);
    const clubRepository = this.dataSource.getRepository(ClubEntity);
    const team = await teamRepository.findOne({
      where: { userId: String(userId) },
    });
    if (!team) {
      return null;
    }
    const club = await clubRepository.findOne({
      where: { name: team.clubName },
    });
    return {
      userId,
      clubId: club?.id != null ? Number(club.id) : undefined,
      clubName: team.clubName,
      image: team.image ?? "",
      budget: Number(team.budget),
      rankPoint: Number(team.rankPoint ?? 0),
      tacticsTeamId: `user-${userId}`,
    };
  }

  async assignClubToUser(
    userId: number,
    clubId: number,
    clubName: string,
  ): Promise<{ ok: boolean; reason?: string; starterClubName?: string }> {
    if (!this.dataSource) {
      const selected = defaultClubs().find((item) => item.id === clubId);
      if (!selected) {
        return { ok: false, reason: `club id ${clubId} not found` };
      }

      this.memTeams.set(userId, {
        ...selected,
        name: clubName.trim() || selected.name,
      });
      return { ok: true, starterClubName: selected.name };
    }

    const clubRepository = this.dataSource.getRepository(ClubEntity);
    const club = await clubRepository.findOne({
      where: { id: String(clubId) },
    });
    if (!club) {
      return { ok: false, reason: `club id ${clubId} not found` };
    }

    const starterClubName = String(club.name);
    const starterClubLogo = String(club.logo ?? "");
    const finalClubName = clubName.trim() || starterClubName;

    const teamRepository = this.dataSource.getRepository(TeamEntity);
    const existingTeam = await teamRepository.findOne({
      where: { userId: String(userId) },
    });
    await teamRepository.save(
      teamRepository.create({
        id: existingTeam?.id,
        userId: String(userId),
        clubName: finalClubName,
        image: starterClubLogo,
        budget: String(defaultTeamBudget),
        rankPoint: 0,
      }),
    );

    return { ok: true, starterClubName };
  }

  async countOwnedPlayers(userId: number): Promise<number> {
    if (!this.dataSource) {
      return 0;
    }
    const userPlayerRepository =
      this.dataSource.getRepository(UserPlayerEntity);
    return userPlayerRepository.count({ where: { userId: String(userId) } });
  }

  async countTemplatesByClub(clubId: number): Promise<number> {
    if (!this.dataSource) {
      return 50;
    }
    const templateRepository =
      this.dataSource.getRepository(PlayerTemplateEntity);
    return templateRepository.count({ where: { clubId: String(clubId) } });
  }

  async listOwnedTemplateIds(userId: number): Promise<Set<string>> {
    if (!this.dataSource) {
      return new Set<string>();
    }
    const userPlayerRepository =
      this.dataSource.getRepository(UserPlayerEntity);
    const existingCards = await userPlayerRepository.find({
      where: { userId: String(userId) },
      select: { playerTemplateId: true },
    });
    return new Set(existingCards.map((item) => String(item.playerTemplateId)));
  }

  async listTemplatesByClub(
    clubId: number,
    limit: number,
  ): Promise<PlayerTemplateEntity[]> {
    if (!this.dataSource) {
      return [];
    }
    const templateRepository =
      this.dataSource.getRepository(PlayerTemplateEntity);
    return templateRepository.find({
      where: { clubId: String(clubId) },
      order: { id: "ASC" },
      take: limit,
    });
  }

  async createUserPlayers(
    userId: number,
    templateIds: string[],
  ): Promise<void> {
    if (!this.dataSource || !templateIds.length) {
      return;
    }
    const userPlayerRepository =
      this.dataSource.getRepository(UserPlayerEntity);
    await userPlayerRepository.save(
      templateIds.map((templateId) =>
        userPlayerRepository.create({
          userId: String(userId),
          playerTemplateId: templateId,
          exp: 0,
          currentPoints: 0,
          bonusShoot: 0,
          bonusPass: 0,
          bonusLongPass: 0,
          bonusVision: 0,
          bonusTackle: 0,
          bonusStamina: 0,
          bonusBalance: 0,
          bonusDribbling: 0,
          bonusSpeed: 0,
        }),
      ),
    );
  }
}

function defaultClubs(): ClubOption[] {
  return [
    {
      id: 1,
      name: "Manchester United",
      logo: "https://media.api-sports.io/football/teams/33.png",
      budget: defaultTeamBudget,
      leagueName: "Premier League",
    },
    {
      id: 2,
      name: "Manchester City",
      logo: "https://media.api-sports.io/football/teams/50.png",
      budget: defaultTeamBudget,
      leagueName: "Premier League",
    },
    {
      id: 3,
      name: "Liverpool",
      logo: "https://media.api-sports.io/football/teams/40.png",
      budget: defaultTeamBudget,
      leagueName: "Premier League",
    },
    {
      id: 4,
      name: "Arsenal",
      logo: "https://media.api-sports.io/football/teams/42.png",
      budget: defaultTeamBudget,
      leagueName: "Premier League",
    },
    {
      id: 5,
      name: "Chelsea",
      logo: "https://media.api-sports.io/football/teams/49.png",
      budget: defaultTeamBudget,
      leagueName: "Premier League",
    },
  ];
}
