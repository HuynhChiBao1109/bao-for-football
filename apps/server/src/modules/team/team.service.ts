import { BadRequestException, Injectable } from "@nestjs/common";
import { ITeamService } from "./interfaces/team-service.interface";
import { TeamRepository } from "./team.repository";
import { TeamEntity } from "./entities/team.entity";
import { ReferenceService } from "../reference/reference.service";
import { CreateTeamByClubDTO } from "./dto/create-team-by-club.dto";
import { PlayerService } from "../player/player.service";
import { ETeamType } from "./enums/team-type.enum";
import { ETeamFormation } from "./enums/team-formation.enum";
import { AuthUser } from "../auth/types";

type TacticsLineupItem = {
  slotId: string;
  position: string;
  userPlayerId: number;
  x?: number | null;
  y?: number | null;
};

type SaveTacticsInput = {
  teamId: string | number;
  formation?: string | number;
  passRatio?: number;
  shotRatio?: number;
  pressure?: number;
  mode?: string;
  gameplay?: Record<string, unknown>;
  lineup?: TacticsLineupItem[];
};

const FORMATION_BY_KEY: Record<string, ETeamFormation> = {
  "4-4-2": ETeamFormation.F442,
  "4-3-3": ETeamFormation.F433,
  "3-5-2": ETeamFormation.F352,
  "3-4-3": ETeamFormation.F343,
  "4-5-1": ETeamFormation.F451,
  "5-4-1": ETeamFormation.F541,
};

const FORMATION_LABEL_BY_VALUE: Record<number, string> = {
  [ETeamFormation.F442]: "4-4-2",
  [ETeamFormation.F433]: "4-3-3",
  [ETeamFormation.F352]: "3-5-2",
  [ETeamFormation.F343]: "3-4-3",
  [ETeamFormation.F451]: "4-5-1",
  [ETeamFormation.F541]: "5-4-1",
};

const LINEUP_POSITIONS = new Set([
  "GK",
  "LB",
  "CB",
  "RB",
  "CDM",
  "CM",
  "AM",
  "LM",
  "RM",
  "LW",
  "RW",
  "SS",
  "ST",
]);

function parseTeamId(value: string | number): number {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d+/);
  const teamId = Number(match?.[0] ?? raw);
  if (!Number.isFinite(teamId) || teamId <= 0) {
    throw new BadRequestException("Invalid teamId");
  }
  return Math.trunc(teamId);
}

function normalizePercent(value: unknown, fallback: number): number {
  const num = Number(value ?? fallback);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  const percent = num <= 1 ? num * 100 : num;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function normalizeFormation(value: unknown): ETeamFormation {
  const key = String(value ?? "4-3-3").trim();
  const numeric = Number(key);
  if (Number.isFinite(numeric) && FORMATION_LABEL_BY_VALUE[numeric]) {
    return numeric as ETeamFormation;
  }
  return FORMATION_BY_KEY[key] ?? ETeamFormation.F433;
}

function normalizePitchCoordinate(value: unknown): number | null {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) {
    return null;
  }
  return Math.round(Math.max(0, Math.min(100, coordinate)) * 10) / 10;
}

function isGoalkeeperPosition(value: unknown): boolean {
  return String(value ?? "").trim().toUpperCase() === "GK";
}

function isGoalkeeperLineupSlot(item: TacticsLineupItem): boolean {
  return isGoalkeeperPosition(item.position) || String(item.slotId).toLowerCase() === "gk";
}

@Injectable()
export class TeamService implements ITeamService {
  constructor(
    private readonly repository: TeamRepository,
    private readonly referenceService: ReferenceService,
    private readonly playerService: PlayerService,
  ) {}

  async getListTeamByUserId(userId: number): Promise<TeamEntity[]> {
    return await this.repository.getListTeamByUserId(userId);
  }

  async createByClub(data: CreateTeamByClubDTO): Promise<TeamEntity> {
    const { clubId, user } = data;
    const club = await this.referenceService.getClubById(clubId);
    if (!club) {
      throw new BadRequestException("Club not found");
    }

    const existingTeams = await this.repository.getListTeamByUserId(user.id);
    if (existingTeams.length > 0) {
      throw new BadRequestException("Can only create one team per user");
    }

    const createTeamData: Partial<TeamEntity> = {
      userId: user.id,
      teamName: club.name,
      imgUrl: club.slug ? `/clubs/${club.slug}.svg` : club.imgUrl,
      type: ETeamType.USER,
    };

    const newTeam = this.repository.create(createTeamData);

    await this.playerService.insertPlayerToUserByClubId(user, clubId);

    return newTeam;
  }

  async getTactics(teamIdValue: string | number, user: AuthUser) {
    const teamId = parseTeamId(teamIdValue);
    const team = await this.repository.getByIdWithFormations(teamId);
    if (!team) {
      throw new BadRequestException("Team not found");
    }
    if (String(team.userId || "") !== String(user.id)) {
      throw new BadRequestException("You do not own this team");
    }

    return this.toTacticsResponse(team);
  }

  async saveTactics(user: AuthUser, input: SaveTacticsInput) {
    const teamId = parseTeamId(input.teamId);
    const team = await this.repository.getById(teamId);
    if (!team) {
      throw new BadRequestException("Team not found");
    }
    if (String(team.userId || "") !== String(user.id)) {
      throw new BadRequestException("You do not own this team");
    }

    const lineup = Array.isArray(input.lineup)
      ? input.lineup
          .map((item) => ({
            slotId: String(item?.slotId || "").trim(),
            position: String(item?.position || "").trim().toUpperCase(),
            userPlayerId: Number(item?.userPlayerId || 0),
            x: normalizePitchCoordinate(item?.x),
            y: normalizePitchCoordinate(item?.y),
          }))
          .filter((item) => item.slotId && item.position && item.userPlayerId > 0)
      : [];

    const uniqueUserPlayerIds = Array.from(new Set(lineup.map((item) => item.userPlayerId)));
    if (uniqueUserPlayerIds.length !== lineup.length) {
      throw new BadRequestException("Lineup contains duplicated players");
    }
    if (new Set(lineup.map((item) => item.slotId)).size !== lineup.length) {
      throw new BadRequestException("Lineup contains duplicated slots");
    }
    if (lineup.some((item) => !LINEUP_POSITIONS.has(item.position))) {
      throw new BadRequestException("Lineup contains an invalid position");
    }

    const ownedPlayers = await this.repository.getUserPlayersByIds(user.id, uniqueUserPlayerIds);
    if (ownedPlayers.length !== uniqueUserPlayerIds.length) {
      throw new BadRequestException("Lineup contains players you do not own");
    }
    const ownedPlayerById = new Map(ownedPlayers.map((player) => [Number(player.id), player]));
    for (const item of lineup) {
      const player = ownedPlayerById.get(Number(item.userPlayerId));
      const isGoalkeeperSlotId = item.slotId.toLowerCase() === "gk";
      if (isGoalkeeperSlotId !== isGoalkeeperPosition(item.position)) {
        throw new BadRequestException("The GK slot must keep the GK position");
      }
      const isPlayerGoalkeeper = Boolean(
        player?.positions?.some((position) => isGoalkeeperPosition(position.position)),
      );
      const isSlotGoalkeeper = isGoalkeeperLineupSlot(item);
      if (isSlotGoalkeeper && !isPlayerGoalkeeper) {
        throw new BadRequestException("Only GK players can be placed in the GK slot");
      }
      if (!isSlotGoalkeeper && isPlayerGoalkeeper) {
        throw new BadRequestException("GK players can only be placed in the GK slot");
      }
    }

    await this.repository.saveTactics(
      teamId,
      {
        formation: normalizeFormation(input.formation),
        passRatio: normalizePercent(input.passRatio, Number(team.passRatio ?? 50)),
        shotRatio: normalizePercent(input.shotRatio, Number(team.shotRatio ?? 50)),
        pressure: normalizePercent(input.pressure, Number(team.pressure ?? 50)),
      },
      lineup,
    );

    const updated = await this.repository.getByIdWithFormations(teamId);
    if (!updated) {
      throw new BadRequestException("Team not found after saving tactics");
    }
    return this.toTacticsResponse(updated, input);
  }

  private toTacticsResponse(team: TeamEntity, input?: Pick<SaveTacticsInput, "mode" | "gameplay">) {
    return {
      teamId: team.id,
      formation: FORMATION_LABEL_BY_VALUE[Number(team.formation)] ?? "4-3-3",
      passRatio: Number(team.passRatio ?? 50),
      shotRatio: Number(team.shotRatio ?? 50),
      pressure: Number(team.pressure ?? 50),
      mode: input?.mode ?? "casual",
      gameplay: input?.gameplay ?? {
        passSpeedScale: 1.05,
        interceptionRadius: 1.02,
        gkBuildUpBias: 1,
        tempoScale: 1.05,
      },
      lineup: (team.teamFormations ?? []).map((item) => ({
        slotId: String(item.position?.slotId ?? ""),
        position: String(item.position?.position ?? ""),
        userPlayerId: Number(item.userPlayerId),
        x: Number.isFinite(Number(item.position?.x)) ? Number(item.position.x) : undefined,
        y: Number.isFinite(Number(item.position?.y)) ? Number(item.position.y) : undefined,
      })),
    };
  }
}
