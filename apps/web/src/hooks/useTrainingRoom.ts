import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { MatchEventRecord, MatchSnapshot, UserPlayerCard } from '../types';

export type TrainingEventType =
  | 'warmup'
  | 'sprint'
  | 'passing'
  | 'pass_normal'
  | 'pass_through'
  | 'pass_lob'
  | 'shooting'
  | 'skill'
  | 'dribble_magic'
  | 'dribble_lightning'
  | 'tank_tackle'
  | 'free_kick_pass'
  | 'free_kick_through'
  | 'free_kick_lob'
  | 'free_kick_shoot';
export type TrainingPoint = { x: number; y: number };

export type TrainingRoomState = {
  tick: number;
  snapshot: MatchSnapshot;
  event: MatchEventRecord;
  players: UserPlayerCard[];
  playerStates: Array<{
    userPlayerId: number;
    name: string;
    position: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    speed: number;
    event?: TrainingEventType | null;
  }>;
  ball: {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    speed: number;
    ownerPlayerId: number | null;
    path: TrainingPoint[];
  };
  metrics: {
    event: TrainingEventType | 'idle';
    playerSpeed: number;
    ballSpeed: number;
    distance: number;
    durationSeconds: number;
  };
  eventLog: Array<{
    tick: number;
    event: TrainingEventType | 'idle';
    label: string;
    playerName: string;
  }>;
};

export function useTrainingRoom() {
  const { token } = useAuth();

  return useQuery<TrainingRoomState>({
    queryKey: ['trainingRoom', token],
    queryFn: () => apiClient('/api/v1/training-room', { token }) as Promise<TrainingRoomState>,
    enabled: Boolean(token),
  });
}

export function useTriggerTrainingEvent() {
  const { token } = useAuth();

  return useMutation<
    TrainingRoomState,
    Error,
    {
      event: TrainingEventType;
      selectedPlayerId?: number | null;
      activePlayerIds?: number[];
      positions: Record<string, TrainingPoint>;
      tick: number;
    }
  >({
    mutationFn: (body) =>
      apiClient('/api/v1/training-room/event', {
        method: 'POST',
        token,
        body,
      }) as Promise<TrainingRoomState>,
  });
}
