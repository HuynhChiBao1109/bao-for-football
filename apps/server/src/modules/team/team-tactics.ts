export const TEAM_MENTALITIES = [
  "park_the_bus",
  "ultra_defensive",
  "defensive",
  "balanced",
  "attacking",
  "ultra_attacking",
  "high_line",
] as const;

export const TEAM_PLAY_STYLES = [
  "long_ball",
  "short_passing",
  "balanced",
  "counter_attack",
] as const;

export type TeamMentality = (typeof TEAM_MENTALITIES)[number];
export type TeamPlayStyle = (typeof TEAM_PLAY_STYLES)[number];

export type TeamTactics = {
  mentality: TeamMentality;
  defensiveWidth: number;
  defensiveDepth: number;
  buildUpPlay: TeamPlayStyle;
  chanceCreation: TeamPlayStyle;
  attackingWidth: number;
  playersInBox: number;
  corners: number;
  freeKicks: number;
};

export type TeamTacticsInput = Partial<Record<keyof TeamTactics, unknown>>;

export const DEFAULT_TEAM_TACTICS: TeamTactics = {
  mentality: "balanced",
  defensiveWidth: 5,
  defensiveDepth: 5,
  buildUpPlay: "balanced",
  chanceCreation: "balanced",
  attackingWidth: 5,
  playersInBox: 5,
  corners: 3,
  freeKicks: 3,
};

function normalizeOption<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  const normalized = String(value ?? "") as T;
  return options.includes(normalized) ? normalized : fallback;
}

function normalizeLevel(value: unknown, fallback: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.round(numeric)));
}

export function normalizeTeamTactics(
  input: TeamTacticsInput | null | undefined,
  fallbackInput: TeamTacticsInput | null | undefined = DEFAULT_TEAM_TACTICS,
): TeamTactics {
  const fallback = {
    ...DEFAULT_TEAM_TACTICS,
    ...(fallbackInput ?? {}),
  };

  return {
    mentality: normalizeOption(
      input?.mentality,
      TEAM_MENTALITIES,
      normalizeOption(fallback.mentality, TEAM_MENTALITIES, DEFAULT_TEAM_TACTICS.mentality),
    ),
    defensiveWidth: normalizeLevel(
      input?.defensiveWidth,
      normalizeLevel(fallback.defensiveWidth, DEFAULT_TEAM_TACTICS.defensiveWidth, 10),
      10,
    ),
    defensiveDepth: normalizeLevel(
      input?.defensiveDepth,
      normalizeLevel(fallback.defensiveDepth, DEFAULT_TEAM_TACTICS.defensiveDepth, 10),
      10,
    ),
    buildUpPlay: normalizeOption(
      input?.buildUpPlay,
      TEAM_PLAY_STYLES,
      normalizeOption(fallback.buildUpPlay, TEAM_PLAY_STYLES, DEFAULT_TEAM_TACTICS.buildUpPlay),
    ),
    chanceCreation: normalizeOption(
      input?.chanceCreation,
      TEAM_PLAY_STYLES,
      normalizeOption(
        fallback.chanceCreation,
        TEAM_PLAY_STYLES,
        DEFAULT_TEAM_TACTICS.chanceCreation,
      ),
    ),
    attackingWidth: normalizeLevel(
      input?.attackingWidth,
      normalizeLevel(fallback.attackingWidth, DEFAULT_TEAM_TACTICS.attackingWidth, 10),
      10,
    ),
    playersInBox: normalizeLevel(
      input?.playersInBox,
      normalizeLevel(fallback.playersInBox, DEFAULT_TEAM_TACTICS.playersInBox, 10),
      10,
    ),
    corners: normalizeLevel(
      input?.corners,
      normalizeLevel(fallback.corners, DEFAULT_TEAM_TACTICS.corners, 5),
      5,
    ),
    freeKicks: normalizeLevel(
      input?.freeKicks,
      normalizeLevel(fallback.freeKicks, DEFAULT_TEAM_TACTICS.freeKicks, 5),
      5,
    ),
  };
}

export function getLegacyTacticRatios(tacticsInput: TeamTacticsInput): {
  passRatio: number;
  shotRatio: number;
  pressure: number;
} {
  const tactics = normalizeTeamTactics(tacticsInput);
  const mentalityIndex = TEAM_MENTALITIES.indexOf(tactics.mentality);
  const mentalityAttack = (mentalityIndex - 3) / 3;
  const passByStyle: Record<TeamPlayStyle, number> = {
    long_ball: 34,
    short_passing: 72,
    balanced: 50,
    counter_attack: 38,
  };
  const chanceAttack: Record<TeamPlayStyle, number> = {
    long_ball: 58,
    short_passing: 44,
    balanced: 50,
    counter_attack: 64,
  };

  return {
    passRatio: passByStyle[tactics.buildUpPlay],
    shotRatio: Math.round(
      Math.max(
        0,
        Math.min(
          100,
          chanceAttack[tactics.chanceCreation] + mentalityAttack * 18 + (tactics.playersInBox - 5) * 3,
        ),
      ),
    ),
    pressure: Math.round(
      Math.max(
        0,
        Math.min(
          100,
          18 + tactics.defensiveDepth * 7 + mentalityAttack * 13 +
            (tactics.mentality === "high_line" ? 10 : 0),
        ),
      ),
    ),
  };
}
