import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { ClubEntity } from "../club/entities/club.entities";
import {
  CountryEntity,
  LeagueEntity,
  PlayerSpecialSkillEntity,
  PlayerTemplateEntity,
  SkillEntity,
} from "./entities/player-admin.entities";

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

  private normalizePositions(input: unknown): Array<{
    position: string;
    effect: number;
  }> {
    if (input == null) {
      return [];
    }

    let parsed = input;
    if (typeof input === "string") {
      try {
        parsed = JSON.parse(input);
      } catch {
        return [];
      }
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    const dedup = new Map<string, { position: string; effect: number }>();
    for (const item of parsed) {
      const rawPosition = String((item as any)?.position ?? "").trim();
      if (!rawPosition) {
        continue;
      }

      const effectValue = Number((item as any)?.effect ?? 1);
      dedup.set(rawPosition, {
        position: rawPosition,
        effect: Number.isFinite(effectValue) ? effectValue : 1,
      });
    }

    return Array.from(dedup.values());
  }

  private async loadPositionsByPlayerIDs(playerIDs: number[]) {
    const positionsMap = new Map<
      string,
      Array<{ position: string; effect: number }>
    >();
    if (!this.dataSource || !playerIDs.length) {
      return positionsMap;
    }

    const placeholders = playerIDs.map(() => "?").join(",");
    let rows: any[] = [];
    try {
      rows = await this.dataSource.query(
        `
SELECT player_template_id AS playerTemplateId, position, effect
FROM player_positions
WHERE player_template_id IN (${placeholders})`,
        playerIDs,
      );
    } catch {
      return positionsMap;
    }

    for (const row of rows as any[]) {
      const key = String(row.playerTemplateId);
      const current = positionsMap.get(key) ?? [];
      current.push({
        position: String(row.position ?? ""),
        effect: Number(row.effect ?? 1),
      });
      positionsMap.set(key, current);
    }

    return positionsMap;
  }

  private async loadSkillsByPlayerIDs(playerIDs: number[]) {
    const skillsMap = new Map<string, any[]>();
    if (!this.dataSource || !playerIDs.length) {
      return skillsMap;
    }

    const placeholders = playerIDs.map(() => "?").join(",");
    const rows = await this.dataSource.query(
      `
SELECT
  pss.player_template_id AS playerTemplateId,
  s.id,
  s.name,
  s.icon_url AS iconUrl,
  s.buff_type AS buffType,
  s.buff_value AS buffValue
FROM player_special_skills pss
INNER JOIN skills s ON s.id = pss.skill_id
WHERE pss.player_template_id IN (${placeholders})`,
      playerIDs,
    );

    for (const row of rows as any[]) {
      const key = String(row.playerTemplateId);
      const current = skillsMap.get(key) ?? [];
      current.push({
        id: Number(row.id),
        name: String(row.name ?? ""),
        iconUrl: row.iconUrl != null ? String(row.iconUrl) : null,
        buffType: row.buffType != null ? String(row.buffType) : null,
        buffValue: Number(row.buffValue ?? 0),
      });
      skillsMap.set(key, current);
    }

    return skillsMap;
  }

  private async loadCountriesByIDs(countryIDs: string[]) {
    const countryMap = new Map<string, any>();
    if (!this.dataSource || !countryIDs.length) {
      return countryMap;
    }

    const repository = this.dataSource.getRepository(CountryEntity);
    const countries = await repository.findByIds(countryIDs);
    for (const country of countries) {
      countryMap.set(String(country.id), {
        id: Number(country.id),
        name: country.name,
        code: country.code,
        flag: country.flag,
      });
    }

    return countryMap;
  }

  private toPlayerResponse(
    player: PlayerTemplateEntity,
    positions: Array<{ position: string; effect: number }>,
    skills: any[],
    country: any | null,
  ) {
    const source = player as any;
    const avatar = player.avatarUrl ?? null;

    return {
      id: Number(player.id),
      name: player.name,
      countryId: player.countryId != null ? Number(player.countryId) : null,
      clubId: player.clubId != null ? Number(player.clubId) : null,
      country,
      avatar,
      avatarUrl: avatar,
      imageUrl: avatar,
      baseClub: player.baseClub ?? "",
      season: player.season,
      sourceType: String(source.sourceType ?? "base"),
      positions,
      skills,
      shooting: Number(player.baseShooting ?? 0),
      passing: Number(player.basePassing ?? 0),
      longPass: Number(player.baseLongPass ?? 0),
      vision: Number(player.baseVision ?? 0),
      attackingAwareness: Number(source.baseCounterAttackAwareness ?? 0),
      defensiveAwareness: Number(player.baseDefending ?? 0),
      duels: Number(source.baseDuels ?? 0),
      pace: Number(player.basePace ?? 0),
      stamina: Number(source.baseStamina ?? 0),
      balance: Number(source.baseBalance ?? 0),
      technique: Number(source.baseTechnique ?? 0),
      determination: Number(source.baseDetermination ?? 0),
      strength: Number(player.basePhysical ?? 0),
      standingTackle: Number(player.baseStandingTackle ?? 0),
      slidingTackle: Number(player.baseSlidingTackle ?? 0),
      dribbling: Number(player.baseDribbling ?? 0),
      curve: Number(source.baseCurve ?? 0),
      gkParrying: Number(source.baseGkParrying ?? 0),
      gkReflex: Number(source.baseGkReflex ?? 0),
      gkReach: Number(source.baseGkReach ?? 0),
    };
  }

  private async mapPlayersResponse(players: PlayerTemplateEntity[]) {
    if (!players.length) {
      return [];
    }

    const playerIDs = players.map((item) => Number(item.id));
    const countryIDs = Array.from(
      new Set(
        players
          .map((item) => item.countryId)
          .filter((item): item is string => Boolean(item)),
      ),
    );

    const [positionsMap, skillsMap, countryMap] = await Promise.all([
      this.loadPositionsByPlayerIDs(playerIDs),
      this.loadSkillsByPlayerIDs(playerIDs),
      this.loadCountriesByIDs(countryIDs),
    ]);

    return players.map((player) => {
      const key = String(player.id);
      return this.toPlayerResponse(
        player,
        positionsMap.get(key) ?? [],
        skillsMap.get(key) ?? [],
        countryMap.get(String(player.countryId ?? "")) ?? null,
      );
    });
  }

  private async syncPlayerPositions(playerID: number, input: unknown) {
    if (!this.dataSource) {
      return;
    }

    const normalized = this.normalizePositions(input);
    try {
      await this.dataSource.query(
        "DELETE FROM player_positions WHERE player_template_id = ?",
        [playerID],
      );

      for (const item of normalized) {
        await this.dataSource.query(
          `
INSERT INTO player_positions (player_template_id, position, effect, created_at, updated_at)
VALUES (?, ?, ?, NOW(), NOW())`,
          [playerID, item.position, item.effect],
        );
      }
    } catch {
      return;
    }
  }

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
          filters?.season &&
          String(item.season ?? "").toLowerCase() !==
            String(filters.season).toLowerCase()
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
    if (filters?.season) {
      builder.andWhere("LOWER(player.season) = :season", {
        season: String(filters.season).toLowerCase(),
      });
    }
    const players = await builder.getMany();
    return this.mapPlayersResponse(players);
  }

  async detailPlayer(id: number) {
    if (!this.dataSource) {
      return (
        this.memory.players.find((item) => Number(item.id) === Number(id)) ??
        null
      );
    }
    const repository = this.dataSource.getRepository(PlayerTemplateEntity);
    const player = await repository.findOne({ where: { id: String(id) } });
    if (!player) {
      return null;
    }
    const [mapped] = await this.mapPlayersResponse([player]);
    return mapped;
  }

  async createPlayer(body: any) {
    if (!this.dataSource) {
      const created = { id: this.memory.players.length + 1, ...body };
      this.memory.players.push(created);
      return created;
    }
    const repository = this.dataSource.getRepository(PlayerTemplateEntity);
    const created = await repository.save(
      repository.create({
        name: body.name,
        avatarUrl: body.avatarUrl ?? body.avatar ?? null,
        baseClub: body.baseClub ?? null,
        season: body.season ?? "normal",
        countryId: body.countryId != null ? String(body.countryId) : null,
        clubId: body.clubId != null ? String(body.clubId) : null,
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
    await this.syncPlayerPositions(Number(created.id), body.positions);
    const [mapped] = await this.mapPlayersResponse([created]);
    return mapped;
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
      avatarUrl: body.avatarUrl ?? body.avatar ?? player.avatarUrl,
      baseClub: body.baseClub ?? player.baseClub,
      season: body.season ?? player.season,
      countryId:
        body.countryId != null ? String(body.countryId) : player.countryId,
      clubId: body.clubId != null ? String(body.clubId) : player.clubId,
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
    const updated = await repository.save(player);
    if (Object.prototype.hasOwnProperty.call(body, "positions")) {
      await this.syncPlayerPositions(Number(updated.id), body.positions);
    }
    const [mapped] = await this.mapPlayersResponse([updated]);
    return mapped;
  }

  async deletePlayer(id: number) {
    if (!this.dataSource) {
      this.memory.players = this.memory.players.filter(
        (item) => Number(item.id) !== Number(id),
      );
      return;
    }
    const repository = this.dataSource.getRepository(PlayerTemplateEntity);
    await this.dataSource.query(
      "DELETE FROM player_positions WHERE player_template_id = ?",
      [id],
    );
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
      where: { playerTemplateId: String(playerId), skilCode: skillId },
    });
    if (!existing) {
      await pivotRepository.save(
        pivotRepository.create({
          playerTemplateId: String(playerId),
          skilCode: skillId,
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
      skilCode: String(skillId),
    });
  }
}
