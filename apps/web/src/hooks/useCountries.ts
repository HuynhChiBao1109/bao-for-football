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
      const data = payload?.data ?? payload;
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(token),
    staleTime: 10 * 60_000,
  });
}
