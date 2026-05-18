import { useMutation, useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import { useAuth } from './useAuth'
import type { GachaBanner, GachaResult } from '../types'

export function useGachaBanners() {
  const { token } = useAuth()
  return useQuery<GachaBanner[], Error>({
    queryKey: ['gacha-banners'],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/gacha/banners', { token })
      return (payload?.data as GachaBanner[]) ?? []
    },
  })
}

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
