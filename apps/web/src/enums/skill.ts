export const EPlayerSkill = {
  SHOOT_THUNDER: 1,
  DRIBBLE_MAGIC: 2,
  TANK_TACKLE: 3,
} as const;

export type EPlayerSkill = (typeof EPlayerSkill)[keyof typeof EPlayerSkill];

export const SKILL_META: Record<
  EPlayerSkill,
  { name: string; image: string; animation: string }
> = {
  [EPlayerSkill.SHOOT_THUNDER]: {
    name: 'Thunder Shot',
    image: '/skills/1.jpg',
    animation: '/skills/animations/1.mp4',
  },
  [EPlayerSkill.DRIBBLE_MAGIC]: {
    name: 'Magic Dribble',
    image: '/skills/1.jpg',
    animation: '/skills/animations/2.mp4',
  },
  [EPlayerSkill.TANK_TACKLE]: {
    name: 'Tank Tackle',
    image: '/skills/1.jpg',
    animation: '/skills/animations/2.mp4',
  },
};

export function skillImage(skill?: number | null) {
  if (skill === EPlayerSkill.SHOOT_THUNDER) {
    return SKILL_META[EPlayerSkill.SHOOT_THUNDER].image;
  }
  if (skill === EPlayerSkill.DRIBBLE_MAGIC) {
    return SKILL_META[EPlayerSkill.DRIBBLE_MAGIC].image;
  }
  if (skill === EPlayerSkill.TANK_TACKLE) {
    return SKILL_META[EPlayerSkill.TANK_TACKLE].image;
  }
  return '/app/logo.png';
}

export function skillAnimation(skill?: number | null) {
  if (skill === EPlayerSkill.SHOOT_THUNDER) {
    return SKILL_META[EPlayerSkill.SHOOT_THUNDER].animation;
  }
  if (skill === EPlayerSkill.DRIBBLE_MAGIC) {
    return SKILL_META[EPlayerSkill.DRIBBLE_MAGIC].animation;
  }
  if (skill === EPlayerSkill.TANK_TACKLE) {
    return SKILL_META[EPlayerSkill.TANK_TACKLE].animation;
  }
  return null;
}

export function skillName(skill?: number | null) {
  if (skill === EPlayerSkill.SHOOT_THUNDER) {
    return SKILL_META[EPlayerSkill.SHOOT_THUNDER].name;
  }
  if (skill === EPlayerSkill.DRIBBLE_MAGIC) {
    return SKILL_META[EPlayerSkill.DRIBBLE_MAGIC].name;
  }
  if (skill === EPlayerSkill.TANK_TACKLE) {
    return SKILL_META[EPlayerSkill.TANK_TACKLE].name;
  }
  return null;
}
