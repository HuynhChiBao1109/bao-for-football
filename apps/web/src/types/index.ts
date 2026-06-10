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
  user?: { id: number; userName: string };
  team?: {
    id: number;
    userId: number;
    teamName: string;
    imgUrl?: string;
    rankPoint: number;
    budget?: number;
  } | null;
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
  competitorId?: number | string;
  matchReward: number | string;
  competitor?: {
    id: number | string;
    name: string;
    imgUrl?: string;
    type?: number | string;
  };
};

export type PlayerMoveIntent =
  | 'anchor'
  | 'run'
  | 'press'
  | 'support'
  | 'chase'
  | 'cover'
  | 'mark'
  | 'overlap'
  | 'idle'
  | 'kickoff'
  | 'recover';

export type PlayerMotion = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  intent: PlayerMoveIntent;
};

export type MatchPitchPlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  position: string;
  jerseyNumber?: number | string;
  teamSide?: 'home' | 'away';
  x: number;
  y: number;
  hasBall: boolean;
  card?: 'yellow' | 'red' | null;
  activeSkill?: number | null;
  move?: PlayerMotion;
};

export type MatchSnapshot = {
  frameId?: number;
  tick?: number;
  durationMs?: number;
  matchStep?:
    | 'first_half_start'
    | 'play'
    | 'half_time'
    | 'second_half_start'
    | 'full_time';
  minute: number;
  second?: number;
  clockLabel: string;
  phase?: string;
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';
  ball: {
    x: number;
    y: number;
    fromX?: number;
    fromY?: number;
    ownerPlayerId: string | null;
    speed?: number;
    ownerSide?: 'home' | 'away' | null;
    trajectory?: Array<{ x: number; y: number }>;
    skillTrajectory?: number | null;
  };
  highlight: {
    event: number | null;
    label: string;
    teamSide?: 'home' | 'away' | null;
    actorPlayerId?: string | null;
    secondaryPlayerId?: string | null;
    skill?: number | null;
  };
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
};

export type MatchEventRecord = {
  id?: number | string;
  minute: number;
  event: number;
  teamId?: number | string | null;
  actorPlayerId?: number | string | null;
  secondaryPlayerId?: number | string | null;
  payload?: Record<string, unknown> | null;
};

export type MatchPlayerStats = {
  id?: number | string;
  playerId: number | string;
  goals: number;
  assists: number;
  rating: number;
  shots: number;
  passes: number;
  tackles: number;
};

export type MatchState = {
  id: number | string;
  status: string;
  homeTeamId?: number | string;
  awayTeamId?: number | string;
  homeScore: number;
  awayScore: number;
  currentMinute: number;
  clockSeconds: number;
  latestSnapshot?: MatchSnapshot | null;
  homeLineup?: Array<Record<string, unknown>> | null;
  awayLineup?: Array<Record<string, unknown>> | null;
  matchEvents?: MatchEventRecord[];
  matchPlayerStats?: MatchPlayerStats[];
};

export type MatchStartResponse = {
  matchId: string;
  status: string;
  latestSnapshot?: MatchSnapshot | null;
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
