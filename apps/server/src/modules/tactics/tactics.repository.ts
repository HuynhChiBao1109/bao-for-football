import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import {
  TeamLineupEntity,
  TeamTacticsEntity,
} from "./entities/tactics.entities";

export interface TacticsLineupSlot {
  slotId: string;
  position: string;
  userPlayerId: number;
}

export interface TacticsGameplay {
  passSpeedScale?: number;
  interceptionRadius?: number;
  gkBuildUpBias?: number;
  tempoScale?: number;
}

export interface TacticsConfig {
  teamId: string;
  formation: string;
  passRatio: number;
  shotRatio: number;
  pressure: number;
  mode?: string;
  gameplay?: TacticsGameplay;
  lineup?: TacticsLineupSlot[];
  updatedAt?: Date;
}

@Injectable()
export class TacticsRepository {
  private readonly memStore = new Map<string, TacticsConfig>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  async findByTeamID(teamId: string): Promise<TacticsConfig | null> {
    const memo = this.memStore.get(teamId);

    if (!this.dataSource) {
      return memo ?? null;
    }

    const tacticsRepository = this.dataSource.getRepository(TeamTacticsEntity);
    const tactic = await tacticsRepository.findOne({ where: { teamId } });

    if (!tactic) {
      return memo ?? null;
    }

    const config: TacticsConfig = {
      teamId: tactic.teamId,
      formation: tactic.formation,
      passRatio: Number(tactic.passRatio),
      shotRatio: Number(tactic.shotRatio),
      pressure: Number(tactic.pressure),
      updatedAt: tactic.updatedAt,
      lineup: await this.loadLineup(teamId),
    };

    if (memo) {
      config.mode = memo.mode;
      config.gameplay = memo.gameplay;
      if (!config.lineup?.length) {
        config.lineup = memo.lineup;
      }
    }

    return config;
  }

  async save(config: TacticsConfig): Promise<TacticsConfig> {
    config.updatedAt = new Date();
    this.memStore.set(config.teamId, config);

    if (!this.dataSource) {
      return config;
    }

    const tacticsRepository = this.dataSource.getRepository(TeamTacticsEntity);
    const existing = await tacticsRepository.findOne({
      where: { teamId: config.teamId },
    });
    await tacticsRepository.save(
      tacticsRepository.create({
        id: existing?.id,
        teamId: config.teamId,
        formation: config.formation,
        passRatio: config.passRatio,
        shotRatio: config.shotRatio,
        pressure: config.pressure,
        updatedAt: config.updatedAt,
      }),
    );

    await this.saveLineup(config.teamId, config.lineup ?? []);
    return config;
  }

  private async loadLineup(teamId: string): Promise<TacticsLineupSlot[]> {
    if (!this.dataSource) {
      return [];
    }

    const lineupRepository = this.dataSource.getRepository(TeamLineupEntity);
    const rows = await lineupRepository.find({
      where: { teamId },
      order: { slotId: "ASC" },
    });

    return rows.map((row) => ({
      slotId: String(row.slotId),
      position: String(row.position),
      userPlayerId: Number(row.userPlayerId),
    }));
  }

  private async saveLineup(
    teamId: string,
    lineup: TacticsLineupSlot[],
  ): Promise<void> {
    if (!this.dataSource) {
      return;
    }

    const lineupRepository = this.dataSource.getRepository(TeamLineupEntity);
    await lineupRepository.delete({ teamId });

    const records = lineup
      .map((item) => {
        const slotId = item.slotId.trim().toLowerCase();
        const position = item.position.trim().toUpperCase();
        if (!slotId || !position || !item.userPlayerId) {
          return null;
        }

        return lineupRepository.create({
          teamId,
          slotId,
          position,
          userPlayerId: String(item.userPlayerId),
        });
      })
      .filter((item): item is TeamLineupEntity => item !== null);

    if (records.length) {
      await lineupRepository.save(records);
    }
  }
}
