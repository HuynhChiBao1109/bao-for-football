export const PlayerSeason = {
  Normal: 'normal',
  SpecialYear: 'special year',
  SpecialMatch: 'special match',
  MomentTime: 'moment time',
} as const;

export type PlayerSeason = (typeof PlayerSeason)[keyof typeof PlayerSeason];

export const PLAYER_SEASON_OPTIONS = [
  { value: PlayerSeason.Normal, label: 'Binh thuong (Normal)' },
  { value: PlayerSeason.SpecialYear, label: 'Mua giai dac biet (Special Year)' },
  { value: PlayerSeason.SpecialMatch, label: 'Tran dau dac biet (Special Match)' },
  { value: PlayerSeason.MomentTime, label: 'Khoanh khac tran dau (Moment Time)' },
] as const;

export const PlayerPosition = {
  GK: 'GK',
  LB: 'LB',
  CB: 'CB',
  RB: 'RB',
  LWB: 'LWB',
  RWB: 'RWB',
  CDM: 'CDM',
  CM: 'CM',
  CAM: 'CAM',
  LMF: 'LMF',
  RMF: 'RMF',
  DMF: 'DMF',
  CMF: 'CMF',
  AMF: 'AMF',
  CF: 'CF',
  LW: 'LW',
  RW: 'RW',
  SS: 'SS',
} as const;

export type PlayerPosition = (typeof PlayerPosition)[keyof typeof PlayerPosition];

export const PLAYER_POSITION_OPTIONS = Object.values(PlayerPosition);
