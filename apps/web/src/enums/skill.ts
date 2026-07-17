export const EPlayerSkill = {
  SHOOT_THUNDER: 1,
  DRIBBLE_MAGIC: 2,
  TANK_TACKLE: 3,
  LIGHTNING_DRIBBLE: 4,
  KAISER_SHOT: 5,
  EAGLE_EYE: 6,
} as const;

export type EPlayerSkill = (typeof EPlayerSkill)[keyof typeof EPlayerSkill];

export const SKILL_META: Record<
  EPlayerSkill,
  { name: string; image: string }
> = {
  [EPlayerSkill.SHOOT_THUNDER]: {
    name: 'Thunder Shot',
    image: '/skills/images/1.jpg',
  },
  [EPlayerSkill.DRIBBLE_MAGIC]: {
    name: 'Magic Dribble',
    image: '/skills/images/1.jpg',
  },
  [EPlayerSkill.TANK_TACKLE]: {
    name: 'Tank Tackle',
    image: '/skills/images/1.jpg',
  },
  [EPlayerSkill.LIGHTNING_DRIBBLE]: {
    name: 'Lightning Dribble',
    image: '/skills/images/1.jpg',
  },
  [EPlayerSkill.KAISER_SHOT]: {
    name: 'Kaiser Shot',
    image: '/skills/images/1.jpg',
  },
  [EPlayerSkill.EAGLE_EYE]: {
    name: 'Eagle Eye',
    image: '/skills/images/1.jpg',
  },
};

export function skillImage(skill?: number | null) {
  if (skill && skill in SKILL_META) {
    return SKILL_META[skill as EPlayerSkill].image;
  }
  return '/app/logo.png';
}

export function skillName(skill?: number | null) {
  if (skill && skill in SKILL_META) {
    return SKILL_META[skill as EPlayerSkill].name;
  }
  return null;
}
