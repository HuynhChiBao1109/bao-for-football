import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { Tactics } from '../types';
import {
  DEFAULT_TACTICS,
  normalizeMentality,
  normalizePlayStyle,
  normalizeTacticLevel,
} from '../lib/tactics';

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

type RawTacticsResponse = Record<string, unknown> & {
  gameplay?: {
    passSpeedScale?: unknown;
    interceptionRadius?: unknown;
    gkBuildUpBias?: unknown;
    tempoScale?: unknown;
  };
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

export function normalizeTacticsResponse(data: RawTacticsResponse): Tactics {
  return {
    formation: String(data.formation ?? DEFAULT_TACTICS.formation),
    passRatio: normalizeRatio(data.passRatio, DEFAULT_TACTICS.passRatio),
    shotRatio: normalizeRatio(data.shotRatio, DEFAULT_TACTICS.shotRatio),
    pressure: normalizeRatio(data.pressure, DEFAULT_TACTICS.pressure),
    mentality: normalizeMentality(data.mentality),
    defensiveWidth: normalizeTacticLevel(data.defensiveWidth, 5, 10),
    defensiveDepth: normalizeTacticLevel(data.defensiveDepth, 5, 10),
    buildUpPlay: normalizePlayStyle(data.buildUpPlay),
    chanceCreation: normalizePlayStyle(data.chanceCreation),
    attackingWidth: normalizeTacticLevel(data.attackingWidth, 5, 10),
    playersInBox: normalizeTacticLevel(data.playersInBox, 5, 10),
    corners: normalizeTacticLevel(data.corners, 3, 5),
    freeKicks: normalizeTacticLevel(data.freeKicks, 3, 5),
    mode: String(data.mode ?? DEFAULT_TACTICS.mode),
    lineup: normalizeLineup(data.lineup),
    gameplay: {
      passSpeedScale: Number(
        data.gameplay?.passSpeedScale ?? DEFAULT_TACTICS.gameplay.passSpeedScale,
      ),
      interceptionRadius: Number(
        data.gameplay?.interceptionRadius ?? DEFAULT_TACTICS.gameplay.interceptionRadius,
      ),
      gkBuildUpBias: Number(data.gameplay?.gkBuildUpBias ?? DEFAULT_TACTICS.gameplay.gkBuildUpBias),
      tempoScale: Number(data.gameplay?.tempoScale ?? DEFAULT_TACTICS.gameplay.tempoScale),
    },
  };
}

export function useTactics(tacticsTeamId: string | undefined) {
  const { token } = useAuth();

  return useQuery<Tactics | null>({
    queryKey: ['tactics', tacticsTeamId],
    queryFn: async () => {
      try {
        const data = await apiClient(`/api/v1/tactics/${tacticsTeamId}`, { token });
        if (!data) return null;
        return normalizeTacticsResponse(data);
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
          mentality: body.mentality,
          defensiveWidth: Number(body.defensiveWidth),
          defensiveDepth: Number(body.defensiveDepth),
          buildUpPlay: body.buildUpPlay,
          chanceCreation: body.chanceCreation,
          attackingWidth: Number(body.attackingWidth),
          playersInBox: Number(body.playersInBox),
          corners: Number(body.corners),
          freeKicks: Number(body.freeKicks),
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
      return normalizeTacticsResponse(data);
    },
    onSuccess: (updated, variables) => {
      qc.setQueryData(['tactics', variables.teamId], updated);
      void qc.invalidateQueries({ queryKey: ['tactics', variables.teamId] });
    },
  });
}
