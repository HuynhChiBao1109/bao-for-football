import type { Tactics, TacticsMentality, TacticsPlayStyle } from '../types';

export const DEFAULT_TACTICS: Tactics = {
  formation: '4-3-3',
  passRatio: 50,
  shotRatio: 50,
  pressure: 50,
  mentality: 'balanced',
  defensiveWidth: 5,
  defensiveDepth: 5,
  buildUpPlay: 'balanced',
  chanceCreation: 'balanced',
  attackingWidth: 5,
  playersInBox: 5,
  corners: 3,
  freeKicks: 3,
  mode: 'casual',
  lineup: [],
  gameplay: {
    passSpeedScale: 1.05,
    interceptionRadius: 1.02,
    gkBuildUpBias: 1,
    tempoScale: 1.05,
  },
};

export const MENTALITY_OPTIONS: Array<{ value: TacticsMentality; label: string }> = [
  { value: 'park_the_bus', label: 'Xe buýt' },
  { value: 'ultra_defensive', label: 'Tổng phòng thủ' },
  { value: 'defensive', label: 'Phòng thủ' },
  { value: 'balanced', label: 'Trung bình' },
  { value: 'attacking', label: 'Tấn công' },
  { value: 'ultra_attacking', label: 'Tổng tấn công' },
  { value: 'high_line', label: 'Dâng cao' },
];

export const PLAY_STYLE_OPTIONS: Array<{ value: TacticsPlayStyle; label: string }> = [
  { value: 'long_ball', label: 'Chuyền dài' },
  { value: 'short_passing', label: 'Chuyền ngắn' },
  { value: 'balanced', label: 'Cân bằng' },
  { value: 'counter_attack', label: 'Phản công' },
];

export function normalizeTacticLevel(value: unknown, fallback: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.round(numeric)));
}

export function normalizeMentality(value: unknown): TacticsMentality {
  const normalized = String(value ?? '');
  return MENTALITY_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as TacticsMentality)
    : DEFAULT_TACTICS.mentality;
}

export function normalizePlayStyle(value: unknown): TacticsPlayStyle {
  const normalized = String(value ?? '');
  return PLAY_STYLE_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as TacticsPlayStyle)
    : 'balanced';
}
