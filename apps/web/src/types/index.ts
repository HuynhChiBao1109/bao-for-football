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
  slug?: string;
  logo?: string;
  imgUrl?: string;
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
  slug?: string;
  flag?: string;
};

export type ClubPlayerPreview = {
  id: number;
  name: string;
  season?: string;
  countryId?: number | null;
  clubId?: number | null;
  height?: number;
  bodyType?: string;
  pass?: number;
  longPass?: number;
  vision?: number;
  shoot?: number;
  tackle?: number;
  balance?: number;
  dribbling?: number;
  acceleration?: number;
  speed?: number;
  stamina?: number;
  positions?: Array<{
    position: string;
    rating?: number;
    effect?: number;
  }>;
};

// ─── Player (user card) ────────────────────────────────────────────────────────

export type PlayerStats = Record<StatKey, number>;

export type UserPlayerCard = {
  userPlayerId: number;
  templateId: number;
  name: string;
  imageUrl?: string;
  clubImage?: string;
  clubSlug?: string;
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
    x?: number;
    y?: number;
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
  campainLevel?: number;
  competitorId?: number | string;
  matchReward: number | string;
  campain?: {
    id: number | string;
    level: number;
  };
  competitor?: {
    id: number | string;
    name: string;
    imgUrl?: string;
    type?: number | string;
  };
  match?: {
    id: number | string;
    status: string;
    homeTeamId?: number | string;
    awayTeamId?: number | string;
    homeScore?: number | null;
    awayScore?: number | null;
  } | null;
};

export type PlayerMoveIntent =
  | 'anchor'
  | 'run'
  | 'press'
  | 'support'
  | 'pass_support'
  | 'attack_space'
  | 'chase'
  | 'cover'
  | 'cover_space'
  | 'mark'
  | 'track'
  | 'overlap'
  | 'underlap'
  | 'cut_inside'
  | 'hold_width'
  | 'hold_depth'
  | 'hold_line'
  | 'idle'
  | 'kickoff'
  | 'recover';

export type PlayerMotion = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  intent: PlayerMoveIntent;
  directionX?: number;
  directionY?: number;
  targetX?: number;
  targetY?: number;
};

export type PlayerAIState =
  | 'IDLE'
  | 'HOLD_POSITION'
  | 'MOVE_TO_SPACE'
  | 'PRESS_BALL'
  | 'SUPPORT_ATTACK'
  | 'MARK_OPPONENT'
  | 'RECEIVE_PASS'
  | 'DRIBBLE'
  | 'PASS_SUPPORT'
  | 'ATTACK_SPACE'
  | 'OVERLAP'
  | 'UNDERLAP'
  | 'CUT_INSIDE'
  | 'HOLD_WIDTH'
  | 'HOLD_DEPTH'
  | 'COVER_SPACE'
  | 'MARK_MAN'
  | 'TRACK_RUNNER'
  | 'RECOVER_SHAPE'
  | 'HOLD_LINE'
  | 'RECOVER_DEFENSE'
  | 'BLOCK_LANE'
  | 'INTERCEPT'
  | 'RETREAT'
  | 'STAY_ONSIDE'
  | 'CHECK_BACK_ONSIDE'
  | 'CURVED_RUN'
  | 'DELAY_RUN'
  | 'ATTACK_SPACE_BEHIND'
  | 'RUN_ON_SHOULDER'
  | 'DIAGONAL_RUN'
  | 'THIRD_MAN_RUN'
  | 'BACK_POST_RUN'
  | 'DROP_SHORT'
  | 'KEEPER_DIVE'
  | 'KEEPER_CATCH'
  | 'KEEPER_HOLD'
  | 'TACKLE_APPROACH'
  | 'TACKLE_COMMIT'
  | 'TACKLE_RECOVERY';

export type PlayerTackleState = {
  phase: 'idle' | 'approach' | 'commit' | 'recovery';
  style: 'standing' | 'sliding' | null;
  targetPlayerId: number | null;
  phaseStartedTick: number;
  recoveryUntilTick: number;
  cooldownUntilTick: number;
  approachTarget: { x: number; y: number } | null;
  lastOutcome: 'won' | 'loose_ball' | 'foul' | 'beaten' | null;
};

export type OffsideDebug = {
  isOffsidePosition: boolean;
  offsideLineY: number;
  safeLineY: number;
  distanceToOffsideLine: number;
  runTimingState: PlayerAIState;
  isRequestingThroughBall: boolean;
  isCheckingBack: boolean;
  isLegalReceiver: boolean;
  status?: OffsidePositionStatus;
  predictedStatus?: OffsidePositionStatus;
  predictedRunnerPosition?: PitchPoint;
  predictedOffsideLineY?: number;
  runTarget?: PitchPoint;
  runPath?: PitchPoint[];
  timingState?: RunTimingState;
  runSignals?: RunTimingSignal[];
};

export type PitchPoint = { x: number; y: number };
export type OffsidePositionStatus = 'onside' | 'near_line' | 'offside';
export type RunTimingState =
  | 'HoldPosition'
  | 'OfferSupport'
  | 'PrepareRun'
  | 'TriggerRun'
  | 'CurveRun'
  | 'CheckBack'
  | 'ReceivePass'
  | 'AbortRun';
export type TimedRunType =
  | 'BehindLine'
  | 'Diagonal'
  | 'HalfSpace'
  | 'Wide'
  | 'CrossFace'
  | 'DropShort'
  | 'ThirdMan'
  | 'Support';
export type RunTimingSignal = 'RequestRun' | 'HoldRun' | 'TriggerRun' | 'DelayPass';
export type AttackingRunDecision = {
  playerId: number | string;
  state: RunTimingState;
  runType: TimedRunType;
  lane: 'left_wide' | 'left_half' | 'central' | 'right_half' | 'right_wide';
  target: PitchPoint;
  path: PitchPoint[];
  currentStatus: OffsidePositionStatus;
  predictedStatus: OffsidePositionStatus;
  currentPosition: PitchPoint;
  predictedRunnerPosition: PitchPoint;
  currentOffsideLine: number;
  predictedOffsideLine: number;
  safeLineY: number;
  passReleaseTime: number;
  estimatedBallArrivalTime: number;
  predictedOffsideRisk: number;
  timingQuality: number;
  passLaneQuality: number;
  carrierCanRelease: boolean;
  signals: RunTimingSignal[];
  utility: number;
  reason: string;
  rejectedPassReason: string | null;
  scores: Array<{ state: RunTimingState; runType: TimedRunType; score: number }>;
};

export type AttackingRunTimingEvaluation = {
  side: 'home' | 'away';
  currentLine: { effectiveLineY: number; safeLineY: number };
  predictedLine: { effectiveLineY: number; safeLineY: number };
  passReleaseTime: number;
  defenseDepth: 'high' | 'balanced' | 'deep';
  offsideTrapActive: boolean;
  decisions: AttackingRunDecision[];
  rejectedPasses: Array<{
    playerId: number | string;
    reason: string;
    currentStatus: OffsidePositionStatus;
    predictedStatus: OffsidePositionStatus;
    predictedPosition: PitchPoint;
    predictedLineY: number;
    passReleaseTime: number;
  }>;
};

export type AttackingPassStyle =
  | 'short'
  | 'long'
  | 'through'
  | 'one_touch'
  | 'one_two'
  | 'cross'
  | 'switch'
  | 'cut_back'
  | 'back';

export type AttackingShotStyle =
  | 'normal'
  | 'long_range'
  | 'first_time'
  | 'placed'
  | 'power'
  | 'header';

export type AttackingActionKind = 'hold' | 'wait' | 'carry_ball' | 'dribble' | 'pass' | 'shoot';

export type AttackingActionMemory = {
  currentAction: AttackingActionKind | null;
  actionStartedTick: number;
  lastEvaluationTick: number;
  lastEvaluationPosition: { x: number; y: number };
  minimumCommitUntilTick: number;
  dribbleCooldownUntilTick: number;
  decisionCooldownUntilTick?: number;
};

export type AttackingSupportRole =
  | 'BallSupport'
  | 'ForwardOption'
  | 'WidthProvider'
  | 'DepthSupport'
  | 'Runner'
  | 'RestDefense'
  | 'BoxOccupier';

export type AttackingLateralZone =
  | 'left_wing'
  | 'left_half_space'
  | 'center'
  | 'right_half_space'
  | 'right_wing';

export type AttackingVerticalZone = 'defensive_third' | 'middle_third' | 'final_third';

export type AttackingTargetZone = {
  lane: AttackingLateralZone;
  third: AttackingVerticalZone;
  key: string;
};

export type AttackingStructureAssignment = {
  playerId: number | string;
  supportRole: AttackingSupportRole;
  target: { x: number; y: number };
  targetZone: AttackingTargetZone;
  occupiedZoneCount: number;
  nearestTeammateDistance: number;
  formationInfluence: number;
  ballShiftInfluence: number;
  reason: string;
};

export type AttackingStructureEvaluation = {
  side: 'home' | 'away';
  assignments: AttackingStructureAssignment[];
  zoneOccupancy: Record<string, number>;
  warnings: string[];
  shape: {
    ballSupportCount: number;
    forwardOptionCount: number;
    leftWidthCount: number;
    rightWidthCount: number;
    depthThreatCount: number;
    restDefenseCount: number;
  };
};

export type AttackingIntent = {
  playerId: number | string;
  runType:
    | 'RECEIVE'
    | 'ONE_TWO_RETURN'
    | 'THIRD_MAN_RUN'
    | 'OVERLAP'
    | 'UNDERLAP'
    | 'BOX_RUN'
    | 'STRETCH'
    | 'SUPPORT'
    | 'HOLD_POSITION';
  communication: 'request_ball' | 'announce_run' | 'offer_support' | 'hold_position';
  target: { x: number; y: number };
  priority: number;
  expiresAtTick: number;
  runSignal?: RunTimingSignal;
  timingState?: RunTimingState;
  runTiming?: AttackingRunDecision;
  supportRole?: AttackingSupportRole;
  targetZone?: AttackingTargetZone;
  occupiedZoneCount?: number;
  nearestTeammateDistance?: number;
  structureReason?: string;
};

export type DefensiveState =
  | 'HoldShape'
  | 'TrackRunner'
  | 'MarkOpponent'
  | 'PressBall'
  | 'Cover'
  | 'BlockLane'
  | 'Tackle'
  | 'Intercept'
  | 'Retreat';

export type DefensiveAssignment = {
  defenderId: number | string;
  state: DefensiveState;
  target: { x: number; y: number };
  opponentId: number | string | null;
  utility: number;
  confidence: number;
  reason: string;
  scores: Array<{ state: DefensiveState; score: number }>;
};

export type MatchPitchPlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  position: string;
  jerseyNumber?: number | string;
  teamSide?: 'home' | 'away';
  skills?: number[];
  skillCharges?: Array<{ skill: number; charge: number }>;
  x: number;
  y: number;
  homeX?: number;
  homeY?: number;
  vx?: number;
  vy?: number;
  targetX?: number;
  targetY?: number;
  aiState?: PlayerAIState;
  hasBall: boolean;
  card?: 'yellow' | 'red' | null;
  tackleState?: PlayerTackleState;
  activeSkill?: number | null;
  offside?: OffsideDebug;
  attackingIntent?: AttackingIntent | null;
  runTiming?: AttackingRunDecision | null;
  defensiveAssignment?: DefensiveAssignment | null;
  move?: PlayerMotion;
};

export type MatchTeamSummary = {
  shots: number;
  shotsOnTarget: number;
  passesAttempted: number;
  passesCompleted: number;
  possessionMs: number;
  tackles: number;
  fouls: number;
  offsides: number;
  corners: number;
  saves: number;
};

export type MatchGoalScorer = {
  playerId: number | string;
  name: string;
  side: 'home' | 'away';
  goals: number;
  minutes: number[];
};

export type MatchSummary = {
  home: MatchTeamSummary;
  away: MatchTeamSummary;
  scorers: MatchGoalScorer[];
};

export type MatchSnapshot = {
  simulationRunId?: string;
  frameId?: number;
  tick?: number;
  durationMs?: number;
  matchStep?:
    | 'first_half_start'
    | 'play'
    | 'goal_celebration'
    | 'goal_reset'
    | 'half_time'
    | 'second_half_start'
    | 'full_time';
  minute: number;
  second?: number;
  displaySecond?: number;
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
    kickoffWhistle?: boolean;
  };
  homePlayers: MatchPitchPlayer[];
  awayPlayers: MatchPitchPlayer[];
  tactical?: {
    phase:
      | 'IN_POSSESSION_BUILDUP'
      | 'IN_POSSESSION_ATTACK'
      | 'DEFENSIVE_PRESS'
      | 'DEFENSIVE_BLOCK'
      | 'TRANSITION_LOST_BALL'
      | 'TRANSITION_WON_BALL';
    possessionTicks: number;
    attackingDecision?: {
      actorPlayerId: number | string;
      kind: AttackingActionKind;
      passStyle?: AttackingPassStyle;
      shotStyle?: AttackingShotStyle;
      receiverId?: number | string;
      utility: number;
      executionError: number;
      actionMemory: AttackingActionMemory;
      scores: {
        carryBall: number | null;
        dribble: number | null;
        pass: number | null;
        shoot: number | null;
        hold: number | null;
        selected: AttackingActionKind;
        passRequiredAdvantage: number;
        currentAction: AttackingActionKind | null;
        pressure: number;
        selectedReceiverId: number | string | null;
        rejectedPasses: Array<{
          id: string;
          receiverId: number | string | null;
          reason: string;
        }>;
        rejectedShots: Array<{ id: string; reason: string }>;
      };
      runTiming: AttackingRunTimingEvaluation;
      attackingStructure: AttackingStructureEvaluation;
      debugLog: string[];
    };
    defensiveDecision?: {
      side: 'home' | 'away';
      phase: 'settled' | 'counter_press' | 'retreat';
      primaryPresserId: number | string | null;
      secondaryPresserIds: Array<number | string>;
      coverPlayerId: number | string | null;
      pressTriggers: Array<
        | 'turnover'
        | 'poor_touch'
        | 'back_to_goal'
        | 'touchline_trap'
        | 'isolated_carrier'
        | 'risky_pass'
      >;
      threats: Array<{
        attackerId: number | string;
        position: { x: number; y: number };
        predictedPosition: { x: number; y: number };
        score: number;
        goalProximity: number;
        centrality: number;
        openSpace: number;
        receiveThreat: number;
        runThreat: number;
        isCarrier: boolean;
      }>;
      assignments: DefensiveAssignment[];
    };
  };
  matchStats?: MatchSummary;
  restart?: {
    kind: 'direct_free_kick' | 'indirect_free_kick';
    source: 'foul' | 'offside';
    spot: { x: number; y: number };
    takerPlayerId: number | string;
    wallPlayerIds: Array<number | string>;
    distanceToGoal: number;
    quick: boolean;
  } | null;
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
  simulationRunId?: string;
  status: string;
  homeTeamId?: number | string;
  awayTeamId?: number | string;
  homeTeam?: {
    id: number | string;
    teamName: string;
    imgUrl?: string | null;
  } | null;
  awayTeam?: {
    id: number | string;
    teamName: string;
    imgUrl?: string | null;
  } | null;
  homeScore: number;
  awayScore: number;
  currentMinute: number;
  clockSeconds: number;
  latestSnapshot?: MatchSnapshot | null;
  homeLineup?: Array<Record<string, unknown>> | null;
  awayLineup?: Array<Record<string, unknown>> | null;
  matchEvents?: MatchEventRecord[];
  matchPlayerStats?: MatchPlayerStats[];
  campainMatch?: {
    id: number | string;
    level: number;
    matchReward: number | string;
    campain?: {
      id: number | string;
      level: number;
      teamId?: number | string;
    };
  };
};

export type MatchStartResponse = {
  matchId: string;
  status?: string;
  latestSnapshot?: MatchSnapshot | null;
  homeLineup?: Array<Record<string, unknown>> | null;
  awayLineup?: Array<Record<string, unknown>> | null;
};

export type CampaignCompletion = {
  stageCleared: boolean;
  completedLevel: number;
  unlockedLevel: number | null;
  nextStageUnlocked: boolean;
  campaignCompleted: boolean;
  rewardGranted: number;
};

export type MatchNextTickResponse = {
  snapshot: MatchSnapshot;
  event: MatchEventRecord;
  campaignCompletion?: CampaignCompletion | null;
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
