import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { MatchNextTickResponse, MatchStartResponse, MatchState, Tactics } from '../types';
import { normalizeTacticsResponse } from './useTactics';

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

export function useUpdateMatchTactics(matchId: string | undefined) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<Tactics & { teamId: number; side: 'home' | 'away' }, Error, Tactics>({
    mutationFn: async (tactics) => {
      if (!matchId) {
        throw new Error('Missing match id');
      }

      const payload = await apiClient(`/api/v1/matches/${matchId}/tactics`, {
        method: 'PATCH',
        token,
        body: {
          mentality: tactics.mentality,
          defensiveWidth: tactics.defensiveWidth,
          defensiveDepth: tactics.defensiveDepth,
          buildUpPlay: tactics.buildUpPlay,
          chanceCreation: tactics.chanceCreation,
          attackingWidth: tactics.attackingWidth,
          playersInBox: tactics.playersInBox,
          corners: tactics.corners,
          freeKicks: tactics.freeKicks,
        },
      });

      return {
        ...normalizeTacticsResponse({ ...tactics, ...payload }),
        teamId: Number(payload.teamId),
        side: payload.side === 'away' ? 'away' : 'home',
      };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['tactics', `team-${updated.teamId}`], updated);
      void queryClient.invalidateQueries({ queryKey: ['match', token, matchId] });
    },
  });
}
