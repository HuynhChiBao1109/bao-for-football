import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { UserPlayerCard } from '../types';
import { DEFAULT_STATS, STAT_KEYS, type StatKey } from '../lib/constants';

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStats(input: unknown) {
  const source = (input ?? {}) as Record<string, unknown>;
  return STAT_KEYS.reduce((acc, key) => ({ ...acc, [key]: toNumber(source[key]) }), {
    ...DEFAULT_STATS,
  });
}

function normalizePlayerCard(input: unknown): UserPlayerCard {
  const card = (input ?? {}) as Record<string, unknown>;
  const baseStats = normalizeStats(card.baseStats);
  const bonusStats = normalizeStats(card.bonusStats);
  const totalStats =
    card.totalStats && typeof card.totalStats === 'object'
      ? normalizeStats(card.totalStats)
      : STAT_KEYS.reduce(
          (acc, key) => ({ ...acc, [key]: toNumber(baseStats[key]) + toNumber(bonusStats[key]) }),
          { ...DEFAULT_STATS },
        );

  return {
    ...(card as UserPlayerCard),
    userPlayerId: toNumber(card.userPlayerId),
    templateId: toNumber(card.templateId ?? card.playerTemplateId),
    level: toNumber(card.level),
    currentExp: toNumber(card.currentExp ?? card.exp),
    currentPoints: toNumber(card.currentPoints),
    baseStats,
    bonusStats,
    totalStats,
    positions: Array.isArray(card.positions)
      ? card.positions.map((item) => ({
          position: String((item as Record<string, unknown>)?.position ?? ''),
          effect: toNumber((item as Record<string, unknown>)?.effect ?? 1),
        }))
      : [],
  };
}

export function usePlayerCards() {
  const { token } = useAuth();

  return useQuery<UserPlayerCard[]>({
    queryKey: ['playerCards', token],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/players', { token });
      return Array.isArray(payload) ? payload.map((item) => normalizePlayerCard(item)) : [];
    },
    enabled: Boolean(token),
  });
}

export function useAllocateStats() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<UserPlayerCard, Error, { playerId: number; delta: Record<StatKey, number> }>({
    mutationFn: async ({ playerId, delta }) => {
      const payload = await apiClient(`/api/v1/players/${playerId}/allocate`, {
        method: 'POST',
        token,
        body: delta,
      });
      return normalizePlayerCard(payload);
    },
    onSuccess: (updated) => {
      qc.setQueryData<UserPlayerCard[]>(
        ['playerCards', token],
        (prev) =>
          prev?.map((card) => (card.userPlayerId === updated.userPlayerId ? updated : card)) ?? [],
      );
    },
  });
}
