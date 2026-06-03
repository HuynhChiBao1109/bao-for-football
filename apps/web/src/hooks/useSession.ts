import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { SessionData } from '../types';

export function useSession() {
  const { token } = useAuth();

  return useQuery<SessionData>({
    queryKey: ['session', token],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/auth/me', { token });
      const data = (payload ?? {}) as SessionData & { teams?: any[] };
      const teams = Array.isArray((data as any).team)
        ? ((data as any).team as any[])
        : Array.isArray(data.teams)
          ? data.teams
          : [];

      const normalizedTeam = !Array.isArray((data as any).team)
        ? (data as any).team
        : teams[0] ?? null;

      return {
        ...data,
        team: normalizedTeam ?? undefined,
        teams,
      } as SessionData;
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  });
}
