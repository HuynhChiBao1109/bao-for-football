import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import { useAuth } from './useAuth'
import type { UserPlayerCard } from '../types'
import type { StatKey } from '../lib/constants'

export function usePlayerCards() {
  const { token } = useAuth()

  return useQuery<UserPlayerCard[]>({
    queryKey: ['playerCards', token],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/players', { token })
      return Array.isArray(payload?.data) ? payload.data : []
    },
    enabled: Boolean(token),
  })
}

export function useAllocateStats() {
  const { token } = useAuth()
  const qc = useQueryClient()

  return useMutation<UserPlayerCard, Error, { playerId: number; delta: Record<StatKey, number> }>({
    mutationFn: async ({ playerId, delta }) => {
      const payload = await apiClient(`/api/v1/players/${playerId}/allocate`, {
        method: 'POST',
        token,
        body: delta,
      })
      return payload?.data as UserPlayerCard
    },
    onSuccess: (updated) => {
      qc.setQueryData<UserPlayerCard[]>(['playerCards', token], (prev) =>
        prev?.map((card) => (card.userPlayerId === updated.userPlayerId ? updated : card)) ?? [],
      )
    },
  })
}
