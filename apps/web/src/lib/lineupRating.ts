import type { StatKey } from './constants';
import type { UserPlayerCard } from '../types';

type StatWeight = {
  key: StatKey;
  weight: number;
};

const POSITION_PROFILES: Record<string, readonly StatWeight[]> = {
  GK: [
    { key: 'gkReach', weight: 0.34 },
    { key: 'gkReflex', weight: 0.33 },
    { key: 'gkParrying', weight: 0.25 },
    { key: 'passing', weight: 0.08 },
  ],
  LB: [
    { key: 'defensiveAwareness', weight: 0.27 },
    { key: 'standingTackle', weight: 0.24 },
    { key: 'pace', weight: 0.25 },
    { key: 'stamina', weight: 0.12 },
    { key: 'passing', weight: 0.12 },
  ],
  CB: [
    { key: 'defensiveAwareness', weight: 0.3 },
    { key: 'standingTackle', weight: 0.24 },
    { key: 'duels', weight: 0.2 },
    { key: 'strength', weight: 0.16 },
    { key: 'longPass', weight: 0.1 },
  ],
  RB: [
    { key: 'defensiveAwareness', weight: 0.27 },
    { key: 'standingTackle', weight: 0.24 },
    { key: 'pace', weight: 0.25 },
    { key: 'stamina', weight: 0.12 },
    { key: 'passing', weight: 0.12 },
  ],
  CDM: [
    { key: 'defensiveAwareness', weight: 0.26 },
    { key: 'standingTackle', weight: 0.22 },
    { key: 'duels', weight: 0.18 },
    { key: 'strength', weight: 0.14 },
    { key: 'passing', weight: 0.12 },
    { key: 'longPass', weight: 0.08 },
  ],
  CM: [
    { key: 'passing', weight: 0.24 },
    { key: 'vision', weight: 0.22 },
    { key: 'stamina', weight: 0.17 },
    { key: 'duels', weight: 0.12 },
    { key: 'defensiveAwareness', weight: 0.1 },
    { key: 'shooting', weight: 0.15 },
  ],
  LCM: [
    { key: 'passing', weight: 0.24 },
    { key: 'vision', weight: 0.2 },
    { key: 'stamina', weight: 0.16 },
    { key: 'duels', weight: 0.12 },
    { key: 'defensiveAwareness', weight: 0.12 },
    { key: 'shooting', weight: 0.16 },
  ],
  RCM: [
    { key: 'passing', weight: 0.24 },
    { key: 'vision', weight: 0.2 },
    { key: 'stamina', weight: 0.16 },
    { key: 'duels', weight: 0.12 },
    { key: 'defensiveAwareness', weight: 0.12 },
    { key: 'shooting', weight: 0.16 },
  ],
  AM: [
    { key: 'vision', weight: 0.2 },
    { key: 'passing', weight: 0.18 },
    { key: 'dribbling', weight: 0.18 },
    { key: 'technique', weight: 0.16 },
    { key: 'shooting', weight: 0.16 },
    { key: 'attackingAwareness', weight: 0.12 },
  ],
  LM: [
    { key: 'pace', weight: 0.24 },
    { key: 'dribbling', weight: 0.2 },
    { key: 'passing', weight: 0.18 },
    { key: 'stamina', weight: 0.16 },
    { key: 'vision', weight: 0.12 },
    { key: 'curve', weight: 0.1 },
  ],
  RM: [
    { key: 'pace', weight: 0.24 },
    { key: 'dribbling', weight: 0.2 },
    { key: 'passing', weight: 0.18 },
    { key: 'stamina', weight: 0.16 },
    { key: 'vision', weight: 0.12 },
    { key: 'curve', weight: 0.1 },
  ],
  LW: [
    { key: 'pace', weight: 0.25 },
    { key: 'dribbling', weight: 0.24 },
    { key: 'shooting', weight: 0.2 },
    { key: 'attackingAwareness', weight: 0.15 },
    { key: 'curve', weight: 0.08 },
    { key: 'passing', weight: 0.08 },
  ],
  RW: [
    { key: 'pace', weight: 0.25 },
    { key: 'dribbling', weight: 0.24 },
    { key: 'shooting', weight: 0.2 },
    { key: 'attackingAwareness', weight: 0.15 },
    { key: 'curve', weight: 0.08 },
    { key: 'passing', weight: 0.08 },
  ],
  SS: [
    { key: 'shooting', weight: 0.25 },
    { key: 'attackingAwareness', weight: 0.22 },
    { key: 'dribbling', weight: 0.18 },
    { key: 'technique', weight: 0.14 },
    { key: 'passing', weight: 0.11 },
    { key: 'pace', weight: 0.1 },
  ],
  ST: [
    { key: 'shooting', weight: 0.34 },
    { key: 'attackingAwareness', weight: 0.2 },
    { key: 'pace', weight: 0.18 },
    { key: 'dribbling', weight: 0.12 },
    { key: 'technique', weight: 0.08 },
    { key: 'strength', weight: 0.08 },
  ],
};

function normalizeLineupRole(role: string): string {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();
  if (normalized === 'ST2' || normalized === 'CF') return 'ST';
  if (normalized === 'DM' || normalized === 'DMF') return 'CDM';
  if (normalized === 'AMF') return 'AM';
  if (normalized === 'LMF') return 'LM';
  if (normalized === 'RMF') return 'RM';
  return normalized;
}

export function lineupPositionScore(card: UserPlayerCard, role: string): number {
  const profile = POSITION_PROFILES[normalizeLineupRole(role)] ?? POSITION_PROFILES.CM;
  const stats = card.totalStats ?? {};
  const score = profile.reduce((sum, item) => sum + Number(stats[item.key] ?? 0) * item.weight, 0);
  return Number(score.toFixed(2));
}
