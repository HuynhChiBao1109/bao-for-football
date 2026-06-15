import { UserPlayerCardResponse } from "../player/player.service";
import { MatchSnapshot, SimulationEventDraft } from "../match/match-simulation.util";

export type TrainingEventType =
  | "warmup"
  | "sprint"
  | "passing"
  | "pass_normal"
  | "pass_through"
  | "pass_lob"
  | "shooting"
  | "skill"
  | "dribble_magic"
  | "tank_tackle"
  | "free_kick_pass"
  | "free_kick_through"
  | "free_kick_lob"
  | "free_kick_shoot";

export type TrainingPoint = { x: number; y: number };

export type TrainingPlayerState = {
  userPlayerId: number;
  name: string;
  position: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  event?: TrainingEventType | null;
};

export type TrainingBallState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  ownerPlayerId: number | null;
  path: TrainingPoint[];
};

export type TrainingRoomState = {
  tick: number;
  snapshot: MatchSnapshot;
  event: SimulationEventDraft;
  players: UserPlayerCardResponse[];
  playerStates: TrainingPlayerState[];
  ball: TrainingBallState;
  metrics: {
    event: TrainingEventType | "idle";
    playerSpeed: number;
    ballSpeed: number;
    distance: number;
    durationSeconds: number;
  };
  eventLog: Array<{
    tick: number;
    event: TrainingEventType | "idle";
    label: string;
    playerName: string;
  }>;
};

export type TrainingEventInput = {
  event: TrainingEventType;
  selectedPlayerId?: number;
  activePlayerIds?: number[];
  positions?: Record<string, TrainingPoint>;
  tick?: number;
};
