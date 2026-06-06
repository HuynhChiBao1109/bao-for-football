import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { MatchStartResponse, MatchState } from '../types';

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
