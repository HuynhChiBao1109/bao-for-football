import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { Country } from '../types';

export function useCountries() {
  const { token } = useAuth();

  return useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/admin/countries', { token });
      return Array.isArray(payload) ? payload : [];
    },
    enabled: Boolean(token),
    staleTime: 10 * 60_000,
  });
}
