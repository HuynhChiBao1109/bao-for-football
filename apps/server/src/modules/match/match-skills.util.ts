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
    attackRole: ["CB", "LB", "RB", "DM", "CDM", "CM", "LCM", "RCM"],
  },
  [EPlayerSkill.LIGHTNING_DRIBBLE]: {
    label: "Lightning Dribble",
    triggerThreshold: 0.32,
    attackRole: ["LW", "RW", "ST", "LST", "RST", "CF", "LM", "RM", "CAM", "CM"],
  },
  [EPlayerSkill.KAISER_SHOT]: {
    label: "Kaiser Shot",
    triggerThreshold: 0.36,
    attackRole: ["ST", "CF", "LST", "RST", "CAM", "LW", "RW"],
  },
  [EPlayerSkill.EAGLE_EYE]: {
    label: "Eagle Eye",
    triggerThreshold: 0.34,
    attackRole: ["DM", "CDM", "CM", "LCM", "RCM", "CAM", "CB"],
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

    if (
      phase === "shoot" &&
      (skill === EPlayerSkill.SHOOT_THUNDER || skill === EPlayerSkill.KAISER_SHOT)
    ) {
      if ((meta.attackRole ?? []).includes(role) && random() > meta.triggerThreshold) {
        return skill;
      }
    }

    if (
      phase === "dribble" &&
      (skill === EPlayerSkill.DRIBBLE_MAGIC || skill === EPlayerSkill.LIGHTNING_DRIBBLE)
    ) {
      if ((meta.attackRole ?? []).includes(role) && random() > meta.triggerThreshold) {
        return skill;
      }
    }

    if (phase === "tackle" && skill === EPlayerSkill.TANK_TACKLE) {
      if ((meta.attackRole ?? []).includes(role) && random() > meta.triggerThreshold) {
        return skill;
      }
    }

    if (phase === "build_up" && skill === EPlayerSkill.EAGLE_EYE) {
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
      context.keeperReflex * 0.18 + context.keeperDiving * 0.14 + context.keeperReach * 0.1;

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

  if (skill === EPlayerSkill.LIGHTNING_DRIBBLE) {
    const burstPower = context.actorDribbling * 0.46 + context.actorSpeed * 0.42;
    const success = burstPower + context.random() * 42 > context.defenderTackle * 0.82 - 8;

    return {
      skill,
      label: SKILL_META[skill].label,
      attackBonus: 24 + context.actorDribbling * 0.16 + context.actorSpeed * 0.12,
      defensePenalty: 18 + context.defenderTackle * 0.36,
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
      dribbleSuccess:
        tacklePower + context.random() * 30 >
        context.actorDribbling * 0.62 + context.actorSpeed * 0.24,
    };
  }

  if (skill === EPlayerSkill.KAISER_SHOT) {
    const keeperStability =
      context.keeperReflex * 0.16 + context.keeperDiving * 0.1 + context.keeperReach * 0.08;

    return {
      skill,
      label: SKILL_META[skill].label,
      attackBonus: 32 + context.actorShoot * 0.2,
      defensePenalty: keeperStability * 0.62,
      event: EMatchEvent.SKILL_USED,
    };
  }

  if (skill === EPlayerSkill.EAGLE_EYE) {
    const fieldScan = context.attackScore * 0.18 + context.actorSpeed * 0.08;

    return {
      skill,
      label: SKILL_META[skill].label,
      attackBonus: 24 + fieldScan,
      defensePenalty: context.defenderTackle * 0.2,
      event: EMatchEvent.SKILL_USED,
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
  const targetX = clamp(50 + (random() - 0.5) * 10, 42, 58);
  const lightningPhase = random() * Math.PI;

  for (let index = 1; index <= totalSteps; index += 1) {
    const progress = index / totalSteps;
    const zigzag = Math.sin(progress * Math.PI * 5 + lightningPhase) * (1 - progress) * 1.8;
    const x = clamp(lerp(fromX, targetX, progress) + zigzag, 8, 92);
    const y = clamp(fromY + (goalY - fromY) * progress, 6, 94);
    points.push({ x, y });
  }

  points[points.length - 1] = { x: targetX, y: clamp(goalY, 6, 94) };
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

export function buildLightningDribbleTrajectory(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  segments: number,
  random: () => number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [{ x: fromX, y: fromY }];
  const totalSteps = Math.max(6, segments);
  const side = random() > 0.5 ? 1 : -1;

  for (let index = 1; index <= totalSteps; index += 1) {
    const progress = index / totalSteps;
    const burstProgress = 1 - Math.pow(1 - progress, 1.45);
    const evadeArc = Math.sin(progress * Math.PI) * side * 4.8;
    const firstTouchCut = Math.sin(progress * Math.PI * 2) * side * (1 - progress) * 1.15;

    points.push({
      x: clamp(lerp(fromX, toX, progress) + evadeArc + firstTouchCut, 6, 94),
      y: clamp(lerp(fromY, toY, burstProgress), 5, 95),
    });
  }

  points[points.length - 1] = {
    x: clamp(toX, 6, 94),
    y: clamp(toY, 5, 95),
  };
  return points;
}

export function buildEagleEyePassTrajectory(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  side: "home" | "away",
  segments: number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [{ x: fromX, y: fromY }];
  const totalSteps = Math.max(4, segments);
  const direction = side === "home" ? -1 : 1;
  const sideBend = fromX < toX ? 1 : -1;

  for (let index = 1; index <= totalSteps; index += 1) {
    const progress = index / totalSteps;
    const arc = Math.sin(progress * Math.PI);
    const scanBend = Math.sin(progress * Math.PI * 2) * 2.5;
    points.push({
      x: clamp(fromX + (toX - fromX) * progress + sideBend * arc * 5 + scanBend, 4, 96),
      y: clamp(fromY + (toY - fromY) * progress - direction * arc * 7.5, 4, 96),
    });
  }

  return points;
}

export function getSkillLabel(skill: EPlayerSkill | null): string {
  if (!skill) {
    return "Build-up";
  }
  return SKILL_META[skill]?.label ?? "Skill";
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}
