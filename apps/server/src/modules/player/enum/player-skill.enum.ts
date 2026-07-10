export enum EPlayerSkill {
  SHOOT_THUNDER = 1,
  DRIBBLE_MAGIC = 2,
  TANK_TACKLE = 3,
  LIGHTNING_DRIBBLE = 4,
  KAISER_SHOT = 5,
  EAGLE_EYE = 6,
}

const PLAYER_SKILL_SLUGS: Record<EPlayerSkill, string> = {
  [EPlayerSkill.SHOOT_THUNDER]: "shoot-thunder",
  [EPlayerSkill.DRIBBLE_MAGIC]: "dribble-magic",
  [EPlayerSkill.TANK_TACKLE]: "tank-tackle",
  [EPlayerSkill.LIGHTNING_DRIBBLE]: "lightning-dribble",
  [EPlayerSkill.KAISER_SHOT]: "kaiser-shot",
  [EPlayerSkill.EAGLE_EYE]: "eagle-eye",
};

export function getPlayerSkillSlug(skill: EPlayerSkill | null | undefined): string | null {
  if (!skill) {
    return null;
  }

  return PLAYER_SKILL_SLUGS[skill] ?? `skill-${String(skill)}`;
}
