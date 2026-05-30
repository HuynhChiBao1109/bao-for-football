import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../useAuth';
import type { SpecialSkill } from '../../types';

export function useAdminSkills() {
  const { token } = useAuth();

  return useQuery<SpecialSkill[]>({
    queryKey: ['adminSkills'],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/admin/skills', { token });
      return Array.isArray(payload) ? payload : [];
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  });
}

export function useCreateSkill() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<
    SpecialSkill,
    Error,
    { name: string; description?: string; buffType?: string; buffValue?: number }
  >({
    mutationFn: async (body) => {
      const payload = await apiClient('/api/v1/admin/skills', {
        method: 'POST',
        token,
        body,
      });
      return payload as SpecialSkill;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminSkills'] }),
  });
}

export function useAssignSkill() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, { playerId: number; skillId: number }>({
    mutationFn: async ({ playerId, skillId }) => {
      await apiClient(`/api/v1/admin/players/${playerId}/skills`, {
        method: 'POST' as const,
        token,
        body: { skillId },
      });
    },
    onSuccess: (_data, { playerId }) => {
      qc.invalidateQueries({ queryKey: ['adminPlayer', playerId] });
      qc.invalidateQueries({ queryKey: ['adminPlayers'] });
    },
  });
}

export function useRemoveSkill() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, { playerId: number; skillId: number }>({
    mutationFn: async ({ playerId, skillId }) => {
      await apiClient(`/api/v1/admin/players/${playerId}/skills/${skillId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: (_data, { playerId }) => {
      qc.invalidateQueries({ queryKey: ['adminPlayer', playerId] });
      qc.invalidateQueries({ queryKey: ['adminPlayers'] });
    },
  });
}
