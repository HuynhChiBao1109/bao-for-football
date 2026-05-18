import { useMutation, useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import { useAuth } from './useAuth'
import type { Tactics } from '../types'

export function useTactics(tacticsTeamId: string | undefined) {
  const { token } = useAuth()

  return useQuery<Tactics | null>({
    queryKey: ['tactics', tacticsTeamId],
    queryFn: async () => {
      try {
        const payload = await apiClient(`/api/v1/tactics/${tacticsTeamId}`, { token })
        const data = payload?.data
        if (!data) return null
        return {
          formation: data.formation ?? '4-3-3',
          passRatio: Math.round(Number(data.passRatio ?? 0) * 100),
          shotRatio: Math.round(Number(data.shotRatio ?? 0) * 100),
          pressure: Math.round(Number(data.pressure ?? 0) * 100),
          mode: data.mode ?? 'casual',
          lineup: Array.isArray(data.lineup)
            ? data.lineup
                .filter((item: { slotId?: string; position?: string; userPlayerId?: number }) => item?.slotId && item?.position && Number(item?.userPlayerId || 0) > 0)
                .map((item: { slotId: string; position: string; userPlayerId: number }) => ({
                  slotId: String(item.slotId),
                  position: String(item.position),
                  userPlayerId: Number(item.userPlayerId),
                }))
            : [],
          gameplay: {
            passSpeedScale: Number(data.gameplay?.passSpeedScale ?? 1.05),
            interceptionRadius: Number(data.gameplay?.interceptionRadius ?? 1.02),
            gkBuildUpBias: Number(data.gameplay?.gkBuildUpBias ?? 1),
            tempoScale: Number(data.gameplay?.tempoScale ?? 1.05),
          },
        } as Tactics
      } catch (err: unknown) {
        if ((err as { status?: number }).status === 404) return null
        throw err
      }
    },
    enabled: Boolean(token && tacticsTeamId),
  })
}

export function useSaveTactics() {
  const { token } = useAuth()

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
              }))
            : [],
          gameplay: body.gameplay,
        },
      })
      const data = payload?.data
      return {
        formation: data.formation,
        passRatio: Math.round(Number(data.passRatio ?? 0) * 100),
        shotRatio: Math.round(Number(data.shotRatio ?? 0) * 100),
        pressure: Math.round(Number(data.pressure ?? 0) * 100),
        mode: data.mode ?? 'casual',
        lineup: Array.isArray(data.lineup)
          ? data.lineup
              .filter((item: { slotId?: string; position?: string; userPlayerId?: number }) => item?.slotId && item?.position && Number(item?.userPlayerId || 0) > 0)
              .map((item: { slotId: string; position: string; userPlayerId: number }) => ({
                slotId: String(item.slotId),
                position: String(item.position),
                userPlayerId: Number(item.userPlayerId),
              }))
          : [],
        gameplay: {
          passSpeedScale: Number(data.gameplay?.passSpeedScale ?? 1.05),
          interceptionRadius: Number(data.gameplay?.interceptionRadius ?? 1.02),
          gkBuildUpBias: Number(data.gameplay?.gkBuildUpBias ?? 1),
          tempoScale: Number(data.gameplay?.tempoScale ?? 1.05),
        },
      } as Tactics
    },
  })
}
