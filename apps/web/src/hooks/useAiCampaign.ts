import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { AiStage } from '../types';

export function useAiStages() {
  const { token } = useAuth();

  return useQuery<AiStage[]>({
    queryKey: ['aiStages', token],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/ai/stages', { token });
      return Array.isArray(payload) ? payload : [];
    },
    enabled: Boolean(token),
  });
}

export function useAiStageDetail(stageNo: number | null) {
  const { token } = useAuth();

  return useQuery<AiStage | null>({
    queryKey: ['aiStage', stageNo],
    queryFn: async () => {
      const payload = await apiClient(`/api/v1/ai/stages/${stageNo}`, { token });
      return (payload ?? null) as AiStage;
    },
    enabled: Boolean(token && stageNo),
  });
}

export function useSubmitStageResult() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<unknown, Error, { stageNo: number; isWin: boolean }>({
    mutationFn: async ({ stageNo, isWin }) => {
      const payload = await apiClient(`/api/v1/ai/stages/${stageNo}/result`, {
        method: 'POST',
        token,
        body: { isWin },
      });
      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aiStages'] });
      qc.invalidateQueries({ queryKey: ['aiStage'] });
    },
  });
}

export function useStartMatch() {
  const { token } = useAuth();

  return useMutation<string, Error, { awayClubName: string; mode: string; stageNo: number }>({
    mutationFn: async (body) => {
      const payload = await apiClient('/api/v1/matches/start', {
        method: 'POST',
        token,
        body,
      });
      const matchId = payload?.matchId;
      if (!matchId) throw new Error('Server không trả về matchId');
      return matchId as string;
    },
  });
}

export function useFinalizeMatch() {
  const { token } = useAuth();

  return useMutation<
    void,
    Error,
    {
      matchId: string;
      homeScore: number;
      awayScore: number;
      homeStats?: object;
      awayStats?: object;
      scorers?: unknown[];
    }
  >({
    mutationFn: async ({ matchId, ...body }) => {
      await apiClient(`/api/v1/matches/${matchId}/finalize`, {
        method: 'POST',
        token,
        body,
      });
    },
  });
}
