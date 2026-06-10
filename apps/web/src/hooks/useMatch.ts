import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['match', token, matchId] });
    },
  });
}
