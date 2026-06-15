import { EPlayerSkill } from "src/modules/player/enum/player-skill.enum";
import { EMatchEvent } from "./enums";

export type SkillContext = {
  actorShoot: number;
  actorDribbling: number;
  actorSpeed: number;
  keeperReflex: number;
  keeperDiving: number;
  keeperReach: number;
  defenderTackle: number;
  attackScore: number;
  defenseScore: number;
  random: () => number;
};

export type SkillActivation = {
  skill: EPlayerSkill;
  label: string;
  attackBonus: number;
  defensePenalty: number;
  event: EMatchEvent | null;
  dribbleSuccess?: boolean;
};

export type TrajectoryPoint = { x: number; y: number };

const SKILL_META: Record<
  EPlayerSkill,
  { label: string; triggerThreshold: number; attackRole?: string[] }
> = {
  [EPlayerSkill.SHOOT_THUNDER]: {
    label: "Thunder Shot",
    triggerThreshold: 0.34,
    attackRole: ["ST", "LW", "RW", "LST", "RST", "CF", "CAM"],
  },
  [EPlayerSkill.DRIBBLE_MAGIC]: {
    label: "Magic Dribble",
    triggerThreshold: 0.42,
    attackRole: ["LW", "RW", "ST", "LST", "RST", "LM", "RM", "LCM", "CM", "RCM"],
  },
  [EPlayerSkill.TANK_TACKLE]: {
    label: "Tank Tackle",
    triggerThreshold: 0.38,
    attackRole: ["CB", "LCB", "RCB", "LB", "RB", "DM", "CDM", "CM", "LCM", "RCM"],
  },
};

export function tryActivateSkill(
  skills: EPlayerSkill[],
  role: string,
  phase: "shoot" | "dribble" | "tackle" | "build_up",
  random: () => number,
): EPlayerSkill | null {
  for (const skill of skills) {
    const meta = SKILL_META[skill];
    if (!meta) {
      continue;
    }

    if (phase === "shoot" && skill === EPlayerSkill.SHOOT_THUNDER) {
      if ((meta.attackRole ?? []).includes(role) && random() > meta.triggerThreshold) {
        return skill;
      }
    }

    if (phase === "dribble" && skill === EPlayerSkill.DRIBBLE_MAGIC) {
      if ((meta.attackRole ?? []).includes(role) && random() > meta.triggerThreshold) {
        return skill;
      }
    }

    if (phase === "tackle" && skill === EPlayerSkill.TANK_TACKLE) {
      if ((meta.attackRole ?? []).includes(role) && random() > meta.triggerThreshold) {
        return skill;
      }
    }
  }

  return null;
}

export function resolveSkillActivation(
  skill: EPlayerSkill,
  context: SkillContext,
): SkillActivation {
  if (skill === EPlayerSkill.SHOOT_THUNDER) {
    const keeperPenalty =
      context.keeperReflex * 0.18 +
      context.keeperDiving * 0.14 +
      context.keeperReach * 0.1;

    return {
      skill,
      label: SKILL_META[skill].label,
      attackBonus: 28 + context.actorShoot * 0.16,
      defensePenalty: keeperPenalty * 0.55,
      event: EMatchEvent.SKILL_USED,
    };
  }

  if (skill === EPlayerSkill.DRIBBLE_MAGIC) {
    const dribblePower = context.actorDribbling * 0.4 + context.actorSpeed * 0.25;
    const success = dribblePower + context.random() * 34 > context.defenderTackle - 2;

    return {
      skill,
      label: SKILL_META[skill].label,
      attackBonus: 12 + context.actorDribbling * 0.1,
      defensePenalty: context.defenderTackle * 0.28,
      event: EMatchEvent.SKILL_USED,
      dribbleSuccess: success,
    };
  }

  if (skill === EPlayerSkill.TANK_TACKLE) {
    const tacklePower = context.defenderTackle * 0.48 + context.defenseScore * 0.08;

    return {
      skill,
      label: SKILL_META[skill].label,
      attackBonus: 0,
      defensePenalty: 24 + tacklePower * 0.18,
      event: EMatchEvent.SKILL_USED,
      dribbleSuccess: tacklePower + context.random() * 30 > context.actorDribbling * 0.62 + context.actorSpeed * 0.24,
    };
  }

  return {
    skill,
    label: "Skill",
    attackBonus: 0,
    defensePenalty: 0,
    event: null,
  };
}

export function buildThunderShotTrajectory(
  fromX: number,
  fromY: number,
  goalY: number,
  side: "home" | "away",
  segments: number,
  random: () => number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [{ x: fromX, y: fromY }];
  const totalSteps = Math.max(4, segments);

  for (let index = 1; index <= totalSteps; index += 1) {
    const progress = index / totalSteps;
    const zigzag = Math.sin(progress * Math.PI * 6 + random() * 0.5) * (10 - progress * 3.5);
    const x = clamp(fromX + zigzag + (random() - 0.5) * 3.2, 8, 92);
    const y = clamp(fromY + (goalY - fromY) * progress, 6, 94);
    points.push({ x, y });
  }

  return points;
}

export function buildMagicDribbleTrajectory(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  segments: number,
  random: () => number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [{ x: fromX, y: fromY }];
  const totalSteps = Math.max(4, segments);

  for (let index = 1; index <= totalSteps; index += 1) {
    const progress = index / totalSteps;
    const curve = Math.sin(progress * Math.PI) * 6 * (random() > 0.5 ? 1 : -1);
    const x = clamp(fromX + (toX - fromX) * progress + curve, 8, 92);
    const y = clamp(fromY + (toY - fromY) * progress, 6, 94);
    points.push({ x, y });
  }

  return points;
}

export function getSkillLabel(skill: EPlayerSkill | null): string {
  if (!skill) {
    return "Build-up";
  }
  return SKILL_META[skill]?.label ?? "Skill";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}
