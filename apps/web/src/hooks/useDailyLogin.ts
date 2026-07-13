import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';

export type DailyLoginRewardState = 'claimed' | 'claimable' | 'locked';

export type DailyLoginReward = {
  day: number;
  type: 'player' | 'money';
  label: string;
  amount?: number;
  player?: {
    id: number | null;
    name: string;
    slug: string | null;
    position: string;
  };
  state: DailyLoginRewardState;
};

export type DailyLoginStatus = {
  claimedDays: number;
  nextDay: number | null;
  canClaim: boolean;
  completed: boolean;
  lastClaimDate: string | null;
  rewards: DailyLoginReward[];
  claimedReward?: {
    day: number;
    type: 'player' | 'money';
    label: string;
    amount?: number;
    alreadyOwned?: boolean;
  };
};

export function useDailyLoginStatus(enabled = true) {
  const { token } = useAuth();

  return useQuery<DailyLoginStatus, Error>({
    queryKey: ['daily-login', token],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/daily-login', { token });
      return payload as DailyLoginStatus;
    },
    enabled: Boolean(token && enabled),
    staleTime: 30_000,
  });
}

export function useClaimDailyLogin() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<DailyLoginStatus, Error>({
    mutationFn: async () => {
      const payload = await apiClient('/api/v1/daily-login/claim', {
        method: 'POST',
        token,
      });
      return payload as DailyLoginStatus;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['daily-login', token], data);
      void queryClient.invalidateQueries({ queryKey: ['session', token] });
      void queryClient.invalidateQueries({ queryKey: ['playerCards', token] });
    },
  });
}
