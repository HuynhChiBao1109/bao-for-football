import { Injectable } from "@nestjs/common";
import { PlayerEntity } from "./entities/player-admin.entity";
import { DEFAULT_PLAYER_AI_PROFILE, PlayerAiProfile } from "./player-ai.types";

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
      shootSkillChargeMultiplier: 1.24,
      dribbleSkillChargeMultiplier: 1.28,
    },
  },
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
