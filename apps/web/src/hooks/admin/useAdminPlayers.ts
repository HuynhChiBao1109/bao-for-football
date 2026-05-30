import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, apiClient } from '../../lib/apiClient';
import { useAuth } from '../useAuth';
import type { AdminPlayer, AdminPlayerFilter } from '../../types';

function normalizePositions(input: unknown): Array<{ position: string; effect: number }> {
  if (input == null) return [];

  let parsed = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => ({
      position: String((item as Record<string, unknown>)?.position ?? ''),
      effect: Number((item as Record<string, unknown>)?.effect ?? 1),
    }))
    .filter((item) => item.position);
}

function normalizeAdminPlayer(input: unknown): AdminPlayer {
  const player = (input ?? {}) as Record<string, unknown>;
  const avatar =
    (typeof player.avatar === 'string' && player.avatar) ||
    (typeof player.avatarUrl === 'string' && player.avatarUrl) ||
    (typeof player.imageUrl === 'string' && player.imageUrl) ||
    '';

  return {
    ...(player as AdminPlayer),
    id: Number(player.id ?? 0),
    countryId: Number(player.countryId ?? 0),
    clubId: Number(player.clubId ?? 0),
    avatar,
    positions: normalizePositions(player.positions),
    skills: Array.isArray(player.skills) ? (player.skills as AdminPlayer['skills']) : [],
    sourceType: String(player.sourceType ?? 'base'),
  };
}

export function useAdminPlayers(filter: AdminPlayerFilter = {}, enabled = true) {
  const { token } = useAuth();

  return useQuery<AdminPlayer[]>({
    queryKey: ['adminPlayers', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.name) params.set('name', filter.name);
      if (filter.countryId) params.set('countryId', String(filter.countryId));
      if (filter.baseClub) params.set('baseClub', filter.baseClub);
      const qs = params.toString();

      const payload = await apiClient(`/api/v1/admin/players${qs ? `?${qs}` : ''}`, { token });
      return Array.isArray(payload) ? payload.map((item) => normalizeAdminPlayer(item)) : [];
    },
    enabled: Boolean(token && enabled),
  });
}

export function useAdminPlayer(id: number | null) {
  const { token } = useAuth();

  return useQuery<AdminPlayer>({
    queryKey: ['adminPlayer', id],
    queryFn: async () => {
      const payload = await apiClient(`/api/v1/admin/players/${id}`, { token });
      return normalizeAdminPlayer(payload);
    },
    enabled: Boolean(token && id),
  });
}

export function useCreateAdminPlayer() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<AdminPlayer, Error, FormData>({
    mutationFn: async (formData) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/players`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const isJSON = response.headers.get('content-type')?.includes('application/json');
      const data = isJSON ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Create player failed');
      }
      return normalizeAdminPlayer(data?.data ?? data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminPlayers'] }),
  });
}

export function useUpdateAdminPlayer() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<AdminPlayer, Error, { playerId: number; formData: FormData }>({
    mutationFn: async ({ playerId, formData }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/players/${playerId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const isJSON = response.headers.get('content-type')?.includes('application/json');
      const data = isJSON ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Update player failed');
      }
      return normalizeAdminPlayer(data?.data ?? data);
    },
    onSuccess: (_data, { playerId }) => {
      qc.invalidateQueries({ queryKey: ['adminPlayers'] });
      qc.invalidateQueries({ queryKey: ['adminPlayer', playerId] });
    },
  });
}

export function useDeleteAdminPlayer() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, { playerId: number }>({
    mutationFn: async ({ playerId }) => {
      await apiClient(`/api/v1/admin/players/${playerId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: (_data, { playerId }) => {
      qc.invalidateQueries({ queryKey: ['adminPlayers'] });
      qc.removeQueries({ queryKey: ['adminPlayer', playerId] });
    },
  });
}
