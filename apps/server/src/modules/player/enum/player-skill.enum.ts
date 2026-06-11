export enum EPlayerSkill {
  SHOOT_THUNDER = 1,
  DRIBBLE_MAGIC = 2,
}

const PLAYER_SKILL_SLUGS: Record<EPlayerSkill, string> = {
  [EPlayerSkill.SHOOT_THUNDER]: "shoot-thunder",
  [EPlayerSkill.DRIBBLE_MAGIC]: "dribble-magic",
};

export function getPlayerSkillSlug(skill: EPlayerSkill | null | undefined): string | null {
  if (!skill) {
    return null;
  }

  return PLAYER_SKILL_SLUGS[skill] ?? `skill-${String(skill)}`;
}
