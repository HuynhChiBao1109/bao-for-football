import { Injectable } from "@nestjs/common";
import { Repository, In } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { ClubEntity } from "../club/entities/club.entities";
import {
  CountryEntity,
  LeagueEntity,
  PlayerPositionEntity,
  PlayerTemplateEntity,
} from "./entities/player-admin.entities";
import { EPlayerPosition } from "./types/player-position.enum";

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
    @InjectRepository(CountryEntity)
    private readonly countryRepository: Repository<CountryEntity>,
    @InjectRepository(LeagueEntity)
    private readonly leagueRepository: Repository<LeagueEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubRepository: Repository<ClubEntity>,
    @InjectRepository(PlayerTemplateEntity)
    private readonly playerTemplateRepository: Repository<PlayerTemplateEntity>,
    @InjectRepository(PlayerPositionEntity)
    private readonly playerPositionRepository: Repository<PlayerPositionEntity>,
    // removed dataSource, use repositories only
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
    if (!playerIDs.length) {
      return positionsMap;
    }
    const rows = await this.playerPositionRepository.find({
      where: playerIDs.map((id) => ({ playerId: String(id) })),
    });

    for (const row of rows) {
      const key = String(row.playerId);
      const current = positionsMap.get(key) ?? [];
      current.push({
        position: String(row.position ?? ""),
        effect: 1,
      });
      positionsMap.set(key, current);
    }

    return positionsMap;
  }

  private async loadSkillsByPlayerIDs(playerIDs: number[]) {
    // const skillsMap = new Map<string, any[]>();
    // if (!playerIDs.length) {
    //   return skillsMap;
    // }

    // // Get all skill pivots for the given player IDs
    // const pivots = await this.playerSpecialSkillRepository.find({
    //   where: { playerTemplateId: In(playerIDs.map((item) => String(item))) },
    // });
    // // Get all unique skill IDs from pivots
    // const skillIds = Array.from(
    //   new Set(pivots.map((item) => String(item.skilCode))),
    // );
    // // If you have a SkillEntity and repository, use it here. Otherwise, this will be empty.
    // // For now, just map the skillCode as id and return minimal info.
    // // TODO: Replace with actual skill repository if available.
    // for (const pivot of pivots) {
    //   const key = String(pivot.playerTemplateId);
    //   const current = skillsMap.get(key) ?? [];
    //   current.push({
    //     id: Number(pivot.skilCode),
    //     name: String(pivot.skilCode),
    //     iconUrl: null,
    //     buffType: null,
    //     buffValue: 0,
    //   });
    //   skillsMap.set(key, current);
    // }
    // return skillsMap;
  }

  private async loadCountriesByIDs(countryIDs: string[]) {
    const countryMap = new Map<string, any>();
    if (!countryIDs.length) {
      return countryMap;
    }
    const countries = await this.countryRepository.findByIds(countryIDs);
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
      baseClub: source.baseClub ?? "",
      season: source.season ?? "normal",
      sourceType: String(source.sourceType ?? "base"),
      positions,
      skills,
      shooting: Number(player.shoot ?? 0),
      passing: Number(player.pass ?? 0),
      longPass: Number(player.longPass ?? 0),
      vision: Number(player.vision ?? 0),
      attackingAwareness: Number(source.baseCounterAttackAwareness ?? 0),
      defensiveAwareness: Number(player.tackle ?? 0),
      duels: Number(source.baseDuels ?? 0),
      pace: Number(source.speed ?? 0),
      stamina: Number(source.stamina ?? 0),
      balance: Number(player.balance ?? 0),
      technique: Number(source.baseTechnique ?? 0),
      determination: Number(source.baseDetermination ?? 0),
      strength: Number(source.basePhysical ?? 0),
      standingTackle: Number(player.tackle ?? 0),
      slidingTackle: Number(player.tackle ?? 0),
      dribbling: Number(player.dribbling ?? 0),
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
        [], // skillsMap.get(key) ?? [],
        countryMap.get(String(player.countryId ?? "")) ?? null,
      );
    });
  }

  private async syncPlayerPositions(playerID: number, input: EPlayerPosition) {
    const normalized = this.normalizePositions(input);
    await this.playerPositionRepository.delete({
      playerId: String(playerID),
    });
    if (!normalized.length) {
      return;
    }
    await this.playerPositionRepository.save(
      normalized.map((item) =>
        this.playerPositionRepository.create({
          playerId: String(playerID),
          position: item.position as EPlayerPosition,
        }),
      ),
    );
  }

  async listPlayers(filters: Record<string, any>) {
    const qb = this.playerTemplateRepository
      .createQueryBuilder("player")
      .orderBy("player.id", "DESC")
      .limit(200);
    if (filters?.name) {
      qb.andWhere("LOWER(player.name) LIKE :name", {
        name: `%${String(filters.name).toLowerCase()}%`,
      });
    }
    if (filters?.countryId) {
      qb.andWhere("player.country_id = :countryId", {
        countryId: String(filters.countryId),
      });
    }
    const players = await qb.getMany();
    return this.mapPlayersResponse(players);
  }

  async detailPlayer(id: number) {
    // ...existing code...
    const player = await this.playerTemplateRepository.findOne({
      where: { id: String(id) },
    });
    if (!player) {
      return null;
    }
    const [mapped] = await this.mapPlayersResponse([player]);
    return mapped;
  }

  async createPlayer(body: any) {
    const created = await this.playerTemplateRepository.save(
      this.playerTemplateRepository.create({
        name: body.name,
        avatarUrl: body.avatarUrl ?? body.avatar ?? null,
        countryId: body.countryId != null ? String(body.countryId) : null,
        clubId: body.clubId != null ? String(body.clubId) : null,
        height: Number(body.height ?? 180),
        pass: Number(body.passing ?? 75),
        longPass: Number(body.longPass ?? body.passing ?? 75),
        vision: Number(body.vision ?? body.passing ?? 75),
        shoot: Number(body.shooting ?? 75),
        tackle: Number(body.defending ?? 75),
        balance: Number(body.balance ?? 75),
        dribbling: Number(body.dribbling ?? 75),
      }),
    );
    await this.syncPlayerPositions(Number(created.id), body.positions);
    const [mapped] = await this.mapPlayersResponse([created]);
    return mapped;
  }

  async updatePlayer(id: number, body: any) {
    const player = await this.playerTemplateRepository.findOne({
      where: { id: String(id) },
    });
    if (!player) {
      return null;
    }
    Object.assign(player, {
      name: body.name ?? player.name,
      avatarUrl: body.avatarUrl ?? body.avatar ?? player.avatarUrl,
      countryId:
        body.countryId != null ? String(body.countryId) : player.countryId,
      clubId: body.clubId != null ? String(body.clubId) : player.clubId,
      height: body.height != null ? Number(body.height) : player.height,
      pass: body.passing != null ? Number(body.passing) : player.pass,
      longPass: body.longPass != null ? Number(body.longPass) : player.longPass,
      vision: body.vision != null ? Number(body.vision) : player.vision,
      shoot: body.shooting != null ? Number(body.shooting) : player.shoot,
      tackle: body.defending != null ? Number(body.defending) : player.tackle,
      balance: body.balance != null ? Number(body.balance) : player.balance,
      dribbling:
        body.dribbling != null ? Number(body.dribbling) : player.dribbling,
    });
    const updated = await this.playerTemplateRepository.save(player);
    if (Object.prototype.hasOwnProperty.call(body, "positions")) {
      await this.syncPlayerPositions(Number(updated.id), body.positions);
    }
    const [mapped] = await this.mapPlayersResponse([updated]);
    return mapped;
  }

  async deletePlayer(id: number) {
    await this.playerPositionRepository.delete({
      playerId: String(id),
    });
    await this.playerTemplateRepository.delete({ id: String(id) });
  }

  async listCountries() {
    return this.countryRepository.find({ order: { id: "DESC" } });
  }

  async createCountry(body: any) {
    return this.countryRepository.save(this.countryRepository.create(body));
  }

  async listLeagues() {
    return this.leagueRepository.find({ order: { id: "DESC" } });
  }

  async createLeague(body: any) {
    return this.leagueRepository.save(
      this.leagueRepository.create({
        name: body.name,
        countryId: body.countryId != null ? String(body.countryId) : null,
        logo: body.logo ?? null,
      }),
    );
  }

  async updateLeague(id: number, body: any) {
    const league = await this.leagueRepository.findOne({
      where: { id: String(id) },
    });
    if (!league) {
      return null;
    }
    league.name = body.name ?? league.name;
    league.countryId =
      body.countryId != null ? String(body.countryId) : league.countryId;
    league.logo = body.logo ?? league.logo;
    return this.leagueRepository.save(league);
  }

  async deleteLeague(id: number) {
    await this.leagueRepository.delete({ id: String(id) });
  }

  async createClub(body: any) {
    return this.clubRepository.save(
      this.clubRepository.create({
        name: body.name,
        logo: body.logo ?? null,
        countryId: body.countryId != null ? String(body.countryId) : null,
        leagueId: body.leagueId != null ? String(body.leagueId) : null,
      }),
    );
  }

  async listSkills() {
    // Nếu muốn lấy skills từ DB, cần tạo entity cho bảng skills và inject repository tương ứng
    return this.memory.skills;
  }

  async createSkill(body: any) {
    // Nếu muốn tạo skill trong DB, cần tạo entity cho bảng skills và inject repository tương ứng
    const created = { id: this.memory.skills.length + 1, ...body };
    this.memory.skills.push(created);
    return created;
  }

  async assignSkill(playerId: number, body: any) {
    // Nếu muốn thao tác skill trong DB, cần tạo entity cho bảng skills và inject repository tương ứng
    return { playerId, ...body };
  }

  async removeSkill(playerId: number, skillId: number) {
    // Nếu muốn thao tác skill trong DB, cần tạo entity cho bảng skills và inject repository tương ứng
    return;
  }
}
