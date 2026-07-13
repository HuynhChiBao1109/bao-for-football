import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { Tactics } from '../types';

function normalizeRatio(value: unknown, fallback = 0): number {
  const num = Number(value ?? fallback);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(num <= 1 ? num * 100 : num);
}

type RawTacticsLineupItem = {
  slotId?: string;
  position?: string;
  userPlayerId?: number;
  x?: number;
  y?: number;
};

function normalizeCoordinate(value: unknown): number | undefined {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) return undefined;
  return Math.max(0, Math.min(100, Math.round(coordinate * 10) / 10));
}

function normalizeLineup(value: unknown): NonNullable<Tactics['lineup']> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item: RawTacticsLineupItem) =>
        item?.slotId && item?.position && Number(item?.userPlayerId || 0) > 0,
    )
    .map((item: RawTacticsLineupItem) => ({
      slotId: String(item.slotId),
      position: String(item.position),
      userPlayerId: Number(item.userPlayerId),
      x: normalizeCoordinate(item.x),
      y: normalizeCoordinate(item.y),
    }));
}

export function useTactics(tacticsTeamId: string | undefined) {
  const { token } = useAuth();

  return useQuery<Tactics | null>({
    queryKey: ['tactics', tacticsTeamId],
    queryFn: async () => {
      try {
        const data = await apiClient(`/api/v1/tactics/${tacticsTeamId}`, { token });
        if (!data) return null;
        return {
          formation: data.formation ?? '4-3-3',
          passRatio: normalizeRatio(data.passRatio),
          shotRatio: normalizeRatio(data.shotRatio),
          pressure: normalizeRatio(data.pressure),
          mode: data.mode ?? 'casual',
          lineup: normalizeLineup(data.lineup),
          gameplay: {
            passSpeedScale: Number(data.gameplay?.passSpeedScale ?? 1.05),
            interceptionRadius: Number(data.gameplay?.interceptionRadius ?? 1.02),
            gkBuildUpBias: Number(data.gameplay?.gkBuildUpBias ?? 1),
            tempoScale: Number(data.gameplay?.tempoScale ?? 1.05),
          },
        } as Tactics;
      } catch (err: unknown) {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },
    enabled: Boolean(token && tacticsTeamId),
    refetchOnMount: 'always',
  });
}

export function useSaveTactics() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation<Tactics, Error, { teamId: string } & Omit<Tactics, never>>({
    mutationFn: async (body) => {
      const payload = await apiClient('/api/v1/tactics', {
        method: 'POST',
        token,
        body: {
          teamId: body.teamId,
          formation: body.formation,
          passRatio: Number(body.passRatio),
          shotRatio: Number(body.shotRatio),
          pressure: Number(body.pressure),
          mode: body.mode,
          lineup: Array.isArray(body.lineup)
            ? body.lineup.map((item) => ({
              slotId: item.slotId,
              position: item.position,
              userPlayerId: Number(item.userPlayerId),
              x: normalizeCoordinate(item.x),
              y: normalizeCoordinate(item.y),
            }))
            : [],
          gameplay: body.gameplay,
        },
      });
      const data = payload;
      return {
        formation: data.formation,
        passRatio: normalizeRatio(data.passRatio),
        shotRatio: normalizeRatio(data.shotRatio),
        pressure: normalizeRatio(data.pressure),
        mode: data.mode ?? 'casual',
        lineup: normalizeLineup(data.lineup),
        gameplay: {
          passSpeedScale: Number(data.gameplay?.passSpeedScale ?? 1.05),
          interceptionRadius: Number(data.gameplay?.interceptionRadius ?? 1.02),
          gkBuildUpBias: Number(data.gameplay?.gkBuildUpBias ?? 1),
          tempoScale: Number(data.gameplay?.tempoScale ?? 1.05),
        },
      } as Tactics;
    },
    onSuccess: (updated, variables) => {
      qc.setQueryData(['tactics', variables.teamId], updated);
      void qc.invalidateQueries({ queryKey: ['tactics', variables.teamId] });
    },
  });
}
