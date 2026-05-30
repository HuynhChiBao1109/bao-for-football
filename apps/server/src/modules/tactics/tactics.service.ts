import { BadRequestException, Injectable } from "@nestjs/common";
import { TacticsServiceInterface } from "./interfaces/tactics-service.interface";
import { TacticsConfig, TacticsRepository } from "./tactics.repository";

const modeProfiles: Record<string, NonNullable<TacticsConfig["gameplay"]>> = {
  ranked: {
    passSpeedScale: 0.96,
    interceptionRadius: 0.92,
    gkBuildUpBias: 1.2,
    tempoScale: 0.98,
  },
  casual: {
    passSpeedScale: 1.05,
    interceptionRadius: 1.02,
    gkBuildUpBias: 1,
    tempoScale: 1.05,
  },
  ai_campaign: {
    passSpeedScale: 0.92,
    interceptionRadius: 1.12,
    gkBuildUpBias: 1.1,
    tempoScale: 0.94,
  },
};

@Injectable()
export class TacticsService implements TacticsServiceInterface {
  constructor(private readonly repository: TacticsRepository) {}

  private normalizeTeamID(teamId: string): string {
    const value = teamId.trim();
    if (!value) {
      throw new BadRequestException("teamId is required");
    }
    return value.startsWith("user-") ? value : `user-${value}`;
  }

  async save(config: TacticsConfig): Promise<TacticsConfig> {
    const teamId = this.normalizeTeamID(config.teamId);
    const formation = config.formation.trim();

    if (formation !== "4-3-3" && formation !== "4-4-2") {
      throw new BadRequestException("formation must be 4-3-3 or 4-4-2");
    }

    if (config.passRatio < 0 || config.passRatio > 100) {
      throw new BadRequestException("passRatio must be between 0 and 100");
    }
    if (config.shotRatio < 0 || config.shotRatio > 100) {
      throw new BadRequestException("shotRatio must be between 0 and 100");
    }
    if (config.pressure < 0 || config.pressure > 100) {
      throw new BadRequestException("pressure must be between 0 and 100");
    }

    const mode = (config.mode || "casual").trim().toLowerCase();
    const profile = modeProfiles[mode];
    if (!profile) {
      throw new BadRequestException(
        "mode must be ranked, casual, or ai_campaign",
      );
    }

    const gameplay = {
      ...profile,
      ...(config.gameplay ?? {}),
    };

    return this.repository.save({
      ...config,
      teamId,
      formation,
      mode,
      passRatio: config.passRatio / 100,
      shotRatio: config.shotRatio / 100,
      pressure: config.pressure / 100,
      gameplay,
    });
  }

  async get(teamId: string): Promise<TacticsConfig | null> {
    const normalizedID = this.normalizeTeamID(teamId);
    return this.repository.findByTeamID(normalizedID);
  }
}
