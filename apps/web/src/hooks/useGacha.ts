import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { GachaBanner, GachaResult } from '../types';

export type GachaProgress = {
  totalRolls: number;
  rollsSinceSpecial: number;
  rollsSinceLastSpecial?: number;
};

export function useGachaBanners() {
  const { token } = useAuth();
  return useQuery<GachaBanner[], Error>({
    queryKey: ['gacha-banners'],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/gacha/banners', { token });
      return (payload as GachaBanner[]) ?? [];
    },
  });
}

export function useGachaProgress(bannerCode: string | null) {
  const { token } = useAuth();
  return useQuery<GachaProgress, Error>({
    queryKey: ['gacha-progress', bannerCode],
    queryFn: async () => {
      if (!bannerCode) throw new Error('bannerCode required');
      const payload = await apiClient(`/api/v1/gacha/progress?bannerCode=${bannerCode}`, { token });
      return (payload as GachaProgress) ?? { totalRolls: 0, rollsSinceSpecial: 0 };
    },
    enabled: !!bannerCode,
  });
}

export function useGachaRoll() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<GachaResult, Error, { userId: number; bannerCode: string }>({
    mutationFn: async (body) => {
      const payload = await apiClient('/api/v1/gacha/roll', {
        method: 'POST',
        token,
        body,
      });
      return payload as GachaResult;
    },
    onSuccess: (_result, variables) => {
      void qc.invalidateQueries({ queryKey: ['gacha-progress', variables.bannerCode] });
      void qc.invalidateQueries({ queryKey: ['playerCards', token] });
      void qc.invalidateQueries({ queryKey: ['session', token] });
    },
  });
}
