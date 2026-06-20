import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { MatchNextTickResponse, MatchStartResponse, MatchState } from '../types';

export function useStartCampaignMatch() {
  const { token } = useAuth();

  return useMutation<MatchStartResponse, Error, { campainMatchId: number | string }>({
    mutationFn: async ({ campainMatchId }) => {
      return apiClient('/api/v1/matches/campaign/start', {
        method: 'POST',
        token,
        body: { campainMatchId },
      }) as Promise<MatchStartResponse>;
    },
  });
}

export function useMatch(matchId: string | undefined) {
  const { token } = useAuth();

  return useQuery<MatchState>({
    queryKey: ['match', token, matchId],
    enabled: Boolean(token && matchId),
    queryFn: async () => {
      return apiClient(`/api/v1/matches/${matchId}`, { token }) as Promise<MatchState>;
    },
  });
}

export function useGetNextMatchTick(matchId: string | undefined) {
  const { token } = useAuth();

  return useMutation<MatchNextTickResponse, Error>({
    mutationFn: async () => {
      if (!matchId) {
        throw new Error('Missing match id');
      }

      return apiClient(`/api/v1/matches/${matchId}/next-tick`, {
        method: 'POST',
        token,
      }) as Promise<MatchNextTickResponse>;
    },
  });
}

export function useStartAutoMatchTick(matchId: string | undefined) {
  const { token } = useAuth();

  return useMutation<{ matchId: string; autoTicking: boolean }, Error>({
    mutationFn: async () => {
      if (!matchId) {
        throw new Error('Missing match id');
      }

      return apiClient(`/api/v1/matches/${matchId}/auto-tick/start`, {
        method: 'POST',
        token,
      }) as Promise<{ matchId: string; autoTicking: boolean }>;
    },
  });
}

export function useStopAutoMatchTick(matchId: string | undefined) {
  const { token } = useAuth();

  return useMutation<{ matchId: string; autoTicking: boolean }, Error>({
    mutationFn: async () => {
      if (!matchId) {
        throw new Error('Missing match id');
      }

      return apiClient(`/api/v1/matches/${matchId}/auto-tick/stop`, {
        method: 'POST',
        token,
      }) as Promise<{ matchId: string; autoTicking: boolean }>;
    },
  });
}

export function useResetMatch(matchId: string | undefined) {
  const { token } = useAuth();

  return useMutation<MatchState, Error>({
    mutationFn: async () => {
      if (!matchId) {
        throw new Error('Missing match id');
      }

      return apiClient(`/api/v1/matches/${matchId}/reset`, {
        method: 'POST',
        token,
      }) as Promise<MatchState>;
    },
  });
}
