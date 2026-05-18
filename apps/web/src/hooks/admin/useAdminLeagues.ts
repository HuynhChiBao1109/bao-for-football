import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, apiClient } from '../../lib/apiClient';
import { useAuth } from '../useAuth';
import type { League } from '../../types';

export function useAdminLeagues() {
  const { token } = useAuth();

  return useQuery<League[]>({
    queryKey: ['adminLeagues'],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/admin/leagues', { token });
      const data = payload?.data ?? payload;
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });
}

export function useCreateLeague() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<League, Error, { name: string; countryId: number; logo: string }>({
    mutationFn: async (body) => {
      const payload = await apiClient('/api/v1/admin/leagues', {
        method: 'POST',
        token,
        body,
      });
      return (payload?.data ?? payload) as League;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminLeagues'] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useUpdateLeague() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<
    League,
    Error,
    { leagueId: number; name: string; countryId: number; logo: string }
  >({
    mutationFn: async ({ leagueId, ...body }) => {
      const payload = await apiClient(`/api/v1/admin/leagues/${leagueId}`, {
        method: 'PUT',
        token,
        body,
      });
      return (payload?.data ?? payload) as League;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminLeagues'] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useDeleteLeague() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, { leagueId: number }>({
    mutationFn: async ({ leagueId }) => {
      await apiClient(`/api/v1/admin/leagues/${leagueId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminLeagues'] });
      qc.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useUploadAdminImage() {
  const { token } = useAuth();

  return useMutation<string, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/uploads/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Không thể upload hình ảnh');
      }

      const imageURL = payload?.data?.url;
      if (!imageURL) {
        throw new Error('Upload thành công nhưng không nhận được URL ảnh');
      }

      return imageURL as string;
    },
  });
}
