import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { CampaignMatch } from '../types';

function normalizeCampaignMatches(payload: unknown): CampaignMatch[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const directMatches = payload.filter(
    (item) => item && typeof item === 'object' && 'campainId' in (item as object),
  ) as CampaignMatch[];
  if (directMatches.length > 0) {
    return directMatches.sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0));
  }

  const fromCampains = payload
    .flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [] as CampaignMatch[];
      }
      const matches = (item as { campainMatches?: CampaignMatch[] }).campainMatches;
      return Array.isArray(matches) ? matches : [];
    })
    .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0));

  return fromCampains;
}

export function useCampainMatches(teamId: number) {
  const { token } = useAuth();

  return useQuery<CampaignMatch[]>({
    queryKey: ['campainMatches', token, teamId],
    queryFn: async () => {
      const payload = await apiClient(`/api/v1/campains/team/${teamId}`, { token });
      return normalizeCampaignMatches(payload);
    },
    enabled: Boolean(token && teamId > 0),
  });
}

export function useCreateCompainNormal() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<CampaignMatch[], Error, { teamId: number }>({
    mutationFn: async ({ teamId }) => {
      const payload = await apiClient(`/api/v1/campains/team/${teamId}/normal`, {
        method: 'POST',
        token,
      });
      return normalizeCampaignMatches(payload);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['campainMatches', token, variables.teamId] });
    },
  });
}
