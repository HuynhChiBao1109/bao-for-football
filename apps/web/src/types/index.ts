import type { StatKey } from '../lib/constants';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type SessionUser = {
  id: number;
  username: string;
  isAdmin: boolean;
};

export type Session = {
  token: string;
  user: SessionUser;
};

// ─── Club ─────────────────────────────────────────────────────────────────────

export type Club = {
  id: number;
  name: string;
  logo?: string;
  leagueId?: number;
  leagueName?: string;
  budget?: number;
};

export type League = {
  id: number;
  name: string;
  countryId?: number;
  country?: Country;
  logo?: string;
};

export type Country = {
  id: number;
  name: string;
  code?: string;
  flag?: string;
};

// ─── Player (user card) ────────────────────────────────────────────────────────

export type PlayerStats = Record<StatKey, number>;

export type UserPlayerCard = {
  userPlayerId: number;
  templateId: number;
  name: string;
  imageUrl?: string;
  clubImage?: string;
  baseClub?: string;
  season?: string;
  level: number;
  currentExp: number;
  currentPoints: number;
  baseStats: PlayerStats;
  bonusStats: PlayerStats;
  totalStats: PlayerStats;
  nationality?: string;
  avatarUrl?: string;
  skills?: SpecialSkill[];
  country?: Country;
  positions?: Array<{
    position: string;
    effect: number;
  }>;
};

// ─── Admin Player ──────────────────────────────────────────────────────────────

export type AdminPlayer = {
  id: number;
  name: string;
  countryId: number;
  clubId: number;
  country?: Country;
  avatar?: string;
  nationality?: string;
  baseClub: string;
  season: string;
  sourceType: string;
  specialSkill?: string;
  skills?: SpecialSkill[];
  positions?: Array<{
    position: string;
    effect: number;
  }>;
} & Partial<PlayerStats>;

export type AdminPlayerFilter = {
  name?: string;
  countryId?: number | null;
  baseClub?: string;
  season?: string;
};

// ─── Skills ───────────────────────────────────────────────────────────────────

export type SpecialSkill = {
  id: number;
  name: string;
  description?: string;
  buffType?: string;
  buffValue?: number;
};

// ─── Session Data (from /me) ───────────────────────────────────────────────────

export type SessionData = {
  user?: { id: number; username: string };
  team?: {
    clubId: number;
    clubName: string;
    budget: number;
    rankPoint: number;
    tacticsTeamId: string;
  } | null;
  teams?: Array<Record<string, unknown>>;
};

// ─── Tactics ──────────────────────────────────────────────────────────────────

export type TacticsGameplay = {
  passSpeedScale: number;
  interceptionRadius: number;
  gkBuildUpBias: number;
  tempoScale: number;
};

export type Tactics = {
  formation: string;
  passRatio: number;
  shotRatio: number;
  pressure: number;
  mode: string;
  lineup?: Array<{
    slotId: string;
    position: string;
    userPlayerId: number;
  }>;
  gameplay: TacticsGameplay;
};

// ─── AI Campaign ──────────────────────────────────────────────────────────────

export type AiStage = {
  stageNo: number;
  clubName: string;
  enemyStatBonus: number;
  rewardMoney: number;
  rewardExp: number;
  isUnlocked: boolean;
  isCleared: boolean;
};

export type CampaignMatch = {
  id: number | string;
  campainId: number | string;
  level: number;
  competitorClubId?: number | string;
  matchReward: number | string;
  competitorClub?: {
    id: number | string;
    name: string;
    imgUrl?: string;
  };
};

// ─── Gacha ────────────────────────────────────────────────────────────────────

export type GachaBanner = {
  id: number;
  bannerCode: string;
  bannerName: string;
  bannerImageUrl: string;
  playerId: number;
  expiredAt?: string;
  status: number;
  statusLabel: string;
  createdAt: string;
};

export type GachaResult = {
  userId: number;
  rarity: string;
  bannerCode: string;
  season: string;
  isSpecial: boolean;
  isPityTriggered: boolean;
  totalRolls: number;
  rollsSinceLastSpecial: number;
  nextRollGuaranteedHint: boolean;
  // Player obtained from this roll
  playerId: number;
  playerName: string;
  playerImageUrl: string;
  costDeducted: number;
};
