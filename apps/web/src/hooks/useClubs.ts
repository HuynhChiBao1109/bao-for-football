import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Club } from '../types';

export function useClubs() {
  return useQuery<Club[]>({
    queryKey: ['clubs'],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/auth/clubs');
      return Array.isArray(payload) ? payload : [];
    },
    staleTime: 5 * 60_000,
  });
}
