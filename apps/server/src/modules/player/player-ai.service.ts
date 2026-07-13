import { Injectable } from "@nestjs/common";
import { PlayerEntity } from "./entities/player-admin.entity";
import { DEFAULT_PLAYER_AI_PROFILE, PlayerAiProfile } from "./player-ai.types";

const ISAGI_AI_PROFILE: PlayerAiProfile = {
  code: "isagi",
  label: "Isagi space infiltrator",
  tendencies: {
    defensiveWorkRate: 0.72,
    stayForwardBias: 0.58,
    passBias: 1.04,
    shootBias: 1.34,
    dribbleBias: 0.92,
    flairBias: 0.42,
    riskTaking: 0.82,
    offBallRunBias: 1.68,
    boxInfiltrationBias: 0.94,
    shootSkillChargeMultiplier: 1.28,
    dribbleSkillChargeMultiplier: 0.9,
  },
};

const PLAYER_AI_BY_KEY: Record<string, PlayerAiProfile> = {
  loki: {
    code: "loki",
    label: "Loki creative finisher",
    tendencies: {
      defensiveWorkRate: 0.18,
      stayForwardBias: 0.88,
      passBias: 0.54,
      shootBias: 1.42,
      dribbleBias: 1.46,
      flairBias: 0.84,
      riskTaking: 0.86,
      offBallRunBias: 1.18,
      boxInfiltrationBias: 0.34,
      shootSkillChargeMultiplier: 1.24,
      dribbleSkillChargeMultiplier: 1.28,
    },
  },
  isagi: ISAGI_AI_PROFILE,
  "isagi-yoichi": ISAGI_AI_PROFILE,
};

@Injectable()
export class PlayerAiService {
  getProfileForPlayer(player: Pick<PlayerEntity, "name" | "slug">): PlayerAiProfile {
    const keys = [
      normalizePlayerAiKey(player.slug),
      normalizePlayerAiKey(player.name),
      normalizePlayerAiKey(player.name).split("-")[0],
    ].filter(Boolean);

    for (const key of keys) {
      const profile = PLAYER_AI_BY_KEY[key];
      if (profile) return profile;
    }

    return DEFAULT_PLAYER_AI_PROFILE;
  }
}

function normalizePlayerAiKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
