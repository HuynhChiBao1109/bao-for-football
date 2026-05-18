import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { Club } from '../types';

export function useClubDetail(clubId: number | undefined) {
  const { token } = useAuth();

  return useQuery<Club>({
    queryKey: ['club', clubId],
    queryFn: async () => {
      const data = await apiClient(`/api/v1/clubs/${clubId}`, { token });
      return data as Club;
    },
    enabled: Boolean(clubId && token),
    staleTime: 5 * 60_000,
  });
}
