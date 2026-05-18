import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import { useAuth } from './useAuth'
import type { GachaResult } from '../types'

export function useGachaRoll() {
  const { token } = useAuth()

  return useMutation<GachaResult, Error, { userId: number; bannerCode: string }>({
    mutationFn: async (body) => {
      const payload = await apiClient('/api/v1/gacha/roll', {
        method: 'POST',
        token,
        body,
      })
      return payload?.data as GachaResult
    },
  })
}
