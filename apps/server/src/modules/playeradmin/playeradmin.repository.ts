import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { ClubEntity } from "../../database/entities/club.entities";
import {
  CountryEntity,
  LeagueEntity,
  PlayerSpecialSkillEntity,
  PlayerTemplateEntity,
  SkillEntity,
} from "../../database/entities/player-admin.entities";

@Injectable()
export class PlayerAdminRepository {
  private readonly memory = {
    countries: [] as any[],
    leagues: [] as any[],
    clubs: [] as any[],
    players: [] as any[],
    skills: [] as any[],
  };

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  async listPlayers(filters: Record<string, any>) {
    if (!this.dataSource) {
      return this.memory.players.filter((item) => {
        if (
          filters?.name &&
          !String(item.name ?? "")
            .toLowerCase()
            .includes(String(filters.name).toLowerCase())
        ) {
          return false;
        }
        if (
          filters?.countryId &&
          String(item.countryId ?? "") !== String(filters.countryId)
        ) {
          return false;
        }
        if (
          filters?.baseClub &&
          String(item.baseClub ?? "").toLowerCase() !==
            String(filters.baseClub).toLowerCase()
        ) {
          return false;
        }
        return true;
      });
    }

    const repository = this.dataSource.getRepository(PlayerTemplateEntity);
    const builder = repository
      .createQueryBuilder("player")
      .orderBy("player.id", "DESC")
      .limit(200);
    if (filters?.name) {
      builder.andWhere("LOWER(player.name) LIKE :name", {
        name: `%${String(filters.name).toLowerCase()}%`,
      });
    }
    if (filters?.countryId) {
      builder.andWhere("player.country_id = :countryId", {
        countryId: String(filters.countryId),
      });
    }
    if (filters?.baseClub) {
      builder.andWhere("LOWER(player.base_club) = :baseClub", {
        baseClub: String(filters.baseClub).toLowerCase(),
      });
    }
    return builder.getMany();
  }

  async detailPlayer(id: number) {
    if (!this.dataSource) {
      return (
        this.memory.players.find((item) => Number(item.id) === Number(id)) ??
        null
      );
    }
    const repository = this.dataSource.getRepository(PlayerTemplateEntity);
    return repository.findOne({ where: { id: String(id) } });
  }

  async createPlayer(body: any) {
    if (!this.dataSource) {
      const created = { id: this.memory.players.length + 1, ...body };
      this.memory.players.push(created);
      return created;
    }
    const repository = this.dataSource.getRepository(PlayerTemplateEntity);
    return repository.save(
      repository.create({
        name: body.name,
        avatarUrl: body.avatarUrl ?? null,
        baseClub: body.baseClub ?? null,
        season: body.season ?? "normal",
        countryId: body.countryId != null ? String(body.countryId) : null,
        clubId: body.clubId != null ? String(body.clubId) : null,
        positionsJson: body.positions ? JSON.stringify(body.positions) : null,
        basePace: Number(body.pace ?? 0),
        basePassing: Number(body.passing ?? 0),
        baseLongPass: Number(body.longPass ?? body.passing ?? 0),
        baseVision: Number(body.vision ?? body.passing ?? 0),
        baseShooting: Number(body.shooting ?? 0),
        baseDefending: Number(body.defending ?? 0),
        baseStandingTackle: Number(body.standingTackle ?? 0),
        baseSlidingTackle: Number(body.slidingTackle ?? 0),
        basePhysical: Number(body.physical ?? body.strength ?? 0),
        baseDribbling: Number(body.dribbling ?? 0),
      }),
    );
  }

  async updatePlayer(id: number, body: any) {
    if (!this.dataSource) {
      const index = this.memory.players.findIndex(
        (item) => Number(item.id) === Number(id),
      );
      if (index >= 0) {
        this.memory.players[index] = { ...this.memory.players[index], ...body };
        return this.memory.players[index];
      }
      return null;
    }
    const repository = this.dataSource.getRepository(PlayerTemplateEntity);
    const player = await repository.findOne({ where: { id: String(id) } });
    if (!player) {
      return null;
    }
    Object.assign(player, {
      name: body.name ?? player.name,
      avatarUrl: body.avatarUrl ?? player.avatarUrl,
      baseClub: body.baseClub ?? player.baseClub,
      season: body.season ?? player.season,
      countryId:
        body.countryId != null ? String(body.countryId) : player.countryId,
      clubId: body.clubId != null ? String(body.clubId) : player.clubId,
      positionsJson: body.positions
        ? JSON.stringify(body.positions)
        : player.positionsJson,
      basePace: body.pace != null ? Number(body.pace) : player.basePace,
      basePassing:
        body.passing != null ? Number(body.passing) : player.basePassing,
      baseLongPass:
        body.longPass != null ? Number(body.longPass) : player.baseLongPass,
      baseVision: body.vision != null ? Number(body.vision) : player.baseVision,
      baseShooting:
        body.shooting != null ? Number(body.shooting) : player.baseShooting,
      baseDefending:
        body.defending != null ? Number(body.defending) : player.baseDefending,
      baseStandingTackle:
        body.standingTackle != null
          ? Number(body.standingTackle)
          : player.baseStandingTackle,
      baseSlidingTackle:
        body.slidingTackle != null
          ? Number(body.slidingTackle)
          : player.baseSlidingTackle,
      basePhysical:
        body.physical != null ? Number(body.physical) : player.basePhysical,
      baseDribbling:
        body.dribbling != null ? Number(body.dribbling) : player.baseDribbling,
    });
    return repository.save(player);
  }

  async deletePlayer(id: number) {
    if (!this.dataSource) {
      this.memory.players = this.memory.players.filter(
        (item) => Number(item.id) !== Number(id),
      );
      return;
    }
    const repository = this.dataSource.getRepository(PlayerTemplateEntity);
    await repository.delete({ id: String(id) });
  }

  async listCountries() {
    if (!this.dataSource) {
      return this.memory.countries;
    }
    const repository = this.dataSource.getRepository(CountryEntity);
    return repository.find({ order: { id: "DESC" } });
  }

  async createCountry(body: any) {
    if (!this.dataSource) {
      const created = { id: this.memory.countries.length + 1, ...body };
      this.memory.countries.push(created);
      return created;
    }
    const repository = this.dataSource.getRepository(CountryEntity);
    return repository.save(repository.create(body));
  }

  async listLeagues() {
    if (!this.dataSource) {
      return this.memory.leagues;
    }
    const repository = this.dataSource.getRepository(LeagueEntity);
    return repository.find({ order: { id: "DESC" } });
  }

  async createLeague(body: any) {
    if (!this.dataSource) {
      const created = { id: this.memory.leagues.length + 1, ...body };
      this.memory.leagues.push(created);
      return created;
    }
    const repository = this.dataSource.getRepository(LeagueEntity);
    return repository.save(
      repository.create({
        name: body.name,
        countryId: body.countryId != null ? String(body.countryId) : null,
        logo: body.logo ?? null,
      }),
    );
  }

  async updateLeague(id: number, body: any) {
    if (!this.dataSource) {
      return body;
    }
    const repository = this.dataSource.getRepository(LeagueEntity);
    const league = await repository.findOne({ where: { id: String(id) } });
    if (!league) {
      return null;
    }
    league.name = body.name ?? league.name;
    league.countryId =
      body.countryId != null ? String(body.countryId) : league.countryId;
    league.logo = body.logo ?? league.logo;
    return repository.save(league);
  }

  async deleteLeague(id: number) {
    if (!this.dataSource) {
      return;
    }
    const repository = this.dataSource.getRepository(LeagueEntity);
    await repository.delete({ id: String(id) });
  }

  async createClub(body: any) {
    if (!this.dataSource) {
      const created = { id: this.memory.clubs.length + 1, ...body };
      this.memory.clubs.push(created);
      return created;
    }
    const repository = this.dataSource.getRepository(ClubEntity);
    return repository.save(
      repository.create({
        name: body.name,
        logo: body.logo ?? null,
        countryId: body.countryId != null ? String(body.countryId) : null,
        leagueId: body.leagueId != null ? String(body.leagueId) : null,
      }),
    );
  }

  async listSkills() {
    if (!this.dataSource) {
      return this.memory.skills;
    }
    const repository = this.dataSource.getRepository(SkillEntity);
    return repository.find({ order: { id: "DESC" } });
  }

  async createSkill(body: any) {
    if (!this.dataSource) {
      const created = { id: this.memory.skills.length + 1, ...body };
      this.memory.skills.push(created);
      return created;
    }
    const repository = this.dataSource.getRepository(SkillEntity);
    return repository.save(
      repository.create({
        name: body.name,
        iconUrl: body.iconUrl ?? null,
        buffType: body.buffType,
        buffValue: Number(body.buffValue),
      }),
    );
  }

  async assignSkill(playerId: number, body: any) {
    if (!body?.skillId && !body?.skillName) {
      throw new Error("skillId or skillName is required");
    }
    if (!this.dataSource) {
      return { playerId, ...body };
    }
    const skillRepository = this.dataSource.getRepository(SkillEntity);
    const pivotRepository = this.dataSource.getRepository(
      PlayerSpecialSkillEntity,
    );
    let skillId = body.skillId != null ? String(body.skillId) : undefined;
    if (!skillId && body.skillName) {
      const skill = await skillRepository.findOne({
        where: { name: body.skillName },
      });
      skillId = skill?.id;
    }
    if (!skillId) {
      throw new Error("skillId or skillName is required");
    }
    const existing = await pivotRepository.findOne({
      where: { playerTemplateId: String(playerId), skillId },
    });
    if (!existing) {
      await pivotRepository.save(
        pivotRepository.create({
          playerTemplateId: String(playerId),
          skillId,
        }),
      );
    }
    return this.detailPlayer(playerId);
  }

  async removeSkill(playerId: number, skillId: number) {
    if (!this.dataSource) {
      return;
    }
    const repository = this.dataSource.getRepository(PlayerSpecialSkillEntity);
    await repository.delete({
      playerTemplateId: String(playerId),
      skillId: String(skillId),
    });
  }
}
