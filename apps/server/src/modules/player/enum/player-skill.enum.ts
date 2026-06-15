export enum EPlayerSkill {
  SHOOT_THUNDER = 1,
  DRIBBLE_MAGIC = 2,
  TANK_TACKLE = 3,
}

const PLAYER_SKILL_SLUGS: Record<EPlayerSkill, string> = {
  [EPlayerSkill.SHOOT_THUNDER]: "shoot-thunder",
  [EPlayerSkill.DRIBBLE_MAGIC]: "dribble-magic",
  [EPlayerSkill.TANK_TACKLE]: "tank-tackle",
};

export function getPlayerSkillSlug(skill: EPlayerSkill | null | undefined): string | null {
  if (!skill) {
    return null;
  }

  return PLAYER_SKILL_SLUGS[skill] ?? `skill-${String(skill)}`;
}
