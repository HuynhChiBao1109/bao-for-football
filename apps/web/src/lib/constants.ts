export const STAT_FIELDS = [
  { key: 'shooting', label: 'Dứt điểm' },
  { key: 'passing', label: 'Chuyền ngắn' },
  { key: 'longPass', label: 'Chuyền dài' },
  { key: 'vision', label: 'Tầm nhìn' },
  { key: 'attackingAwareness', label: 'Nhận thức tấn công' },
  { key: 'defensiveAwareness', label: 'Nhận thức phòng thủ' },
  { key: 'duels', label: 'Tranh chấp' },
  { key: 'pace', label: 'Tốc độ' },
  { key: 'stamina', label: 'Thể lực' },
  { key: 'balance', label: 'Thăng bằng' },
  { key: 'technique', label: 'Kỹ thuật' },
  { key: 'determination', label: 'Quyết đoán' },
  { key: 'strength', label: 'Sức mạnh' },
  { key: 'standingTackle', label: 'Tắc bóng' },
  { key: 'slidingTackle', label: 'Xoạc bóng' },
  { key: 'dribbling', label: 'Rê bóng' },
  { key: 'curve', label: 'Sút xoáy' },
  { key: 'gkParrying', label: 'GK Parrying' },
  { key: 'gkReflex', label: 'GK Reflex' },
  { key: 'gkReach', label: 'GK Reach' },
] as const;

export type StatKey = (typeof STAT_FIELDS)[number]['key'];

export const STAT_KEYS = STAT_FIELDS.map((f) => f.key) as StatKey[];

export const DEFAULT_STATS = STAT_KEYS.reduce(
  (acc, key) => ({ ...acc, [key]: 0 }),
  {} as Record<StatKey, number>,
);
