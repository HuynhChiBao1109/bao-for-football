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
      const data = (payload ?? {}) as any;

      return {
        ...data,
        user: data?.user
          ? {
              id: Number(data.user.id ?? 0),
              userName: String(data.user.userName ?? data.user.username ?? ''),
            }
          : undefined,
        team: data?.team
          ? {
              id: Number(data.team.id ?? 0),
              userId: Number(data.team.userId ?? 0),
              teamName: String(data.team.teamName ?? ''),
              imgUrl: data.team.imgUrl ? String(data.team.imgUrl) : undefined,
              rankPoint: Number(data.team.rankPoint ?? 0),
              budget: data.team.budget ? Number(data.team.budget) : undefined,
            }
          : null,
      } as SessionData;
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  });
}
