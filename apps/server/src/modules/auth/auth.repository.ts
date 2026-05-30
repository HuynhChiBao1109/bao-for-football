import { Inject, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { TeamEntity, UserEntity } from "./entities/auth.entities";
import { ClubEntity } from "../club/entities/club.entities";
import { PlayerTemplateEntity } from "../playeradmin/entities/player-admin.entities";
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
        throw new Error("username already exists");
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
  ): Promise<void> {
    if (!this.dataSource) {
      const selected = defaultClubs().find((item) => item.id === clubId);
      if (!selected) {
        throw new Error(`club id ${clubId} not found`);
      }

      this.memTeams.set(userId, {
        ...selected,
        name: clubName.trim() || selected.name,
      });
      return;
    }

    const clubRepository = this.dataSource.getRepository(ClubEntity);
    const club = await clubRepository.findOne({
      where: { id: String(clubId) },
    });
    if (!club) {
      throw new Error(`club id ${clubId} not found`);
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

    await this.ensureStarterPlayers(userId, clubId, starterClubName);
  }

  private async ensureStarterPlayers(
    userId: number,
    starterClubId: number,
    starterClubName: string,
  ): Promise<void> {
    if (!this.dataSource) {
      return;
    }

    const userPlayerRepository =
      this.dataSource.getRepository(UserPlayerEntity);
    const templateRepository =
      this.dataSource.getRepository(PlayerTemplateEntity);
    const ownedCount = await userPlayerRepository.count({
      where: { userId: String(userId) },
    });
    if (ownedCount >= 22) {
      return;
    }

    const availableCount = await templateRepository.count({
      where: { clubId: String(starterClubId), season: "normal" },
    });
    if (availableCount < 22) {
      throw new Error(
        `starter club id ${starterClubId} (${starterClubName}) does not have enough normal player templates`,
      );
    }

    const slotsLeft = 50 - ownedCount;
    if (slotsLeft <= 0) {
      throw new Error("user cannot own more than 50 player cards");
    }

    const assignCount = Math.min(22 - ownedCount, slotsLeft);

    const existingCards = await userPlayerRepository.find({
      where: { userId: String(userId) },
      select: { playerTemplateId: true },
    });
    const existingTemplateIds = new Set(
      existingCards.map((item) => item.playerTemplateId),
    );
    const availableTemplates = await templateRepository.find({
      where: { clubId: String(starterClubId), season: "normal" },
      order: { id: "ASC" },
      take: 50,
    });
    const templatesToAssign = availableTemplates
      .filter((item) => !existingTemplateIds.has(item.id))
      .slice(0, assignCount);

    if (templatesToAssign.length !== assignCount) {
      throw new Error(
        `expected to assign ${assignCount} starter players, assigned ${templatesToAssign.length}`,
      );
    }

    await userPlayerRepository.save(
      templatesToAssign.map((template) =>
        userPlayerRepository.create({
          userId: String(userId),
          playerTemplateId: template.id,
          level: 1,
          exp: 0,
          currentPoints: 0,
          bonusShooting: 0,
          bonusPassing: 0,
          bonusLongPass: 0,
          bonusVision: 0,
          bonusGkReach: 0,
          bonusCounterAttackAwareness: 0,
          bonusDefending: 0,
          bonusGkParrying: 0,
          bonusGkReflex: 0,
          bonusDuels: 0,
          bonusPace: 0,
          bonusStamina: 0,
          bonusBalance: 0,
          bonusTechnique: 0,
          bonusDetermination: 0,
          bonusPhysical: 0,
          bonusStandingTackle: 0,
          bonusSlidingTackle: 0,
          bonusDribbling: 0,
          bonusCurve: 0,
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
