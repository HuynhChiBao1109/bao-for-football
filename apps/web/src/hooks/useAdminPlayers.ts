import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL, apiClient } from '../lib/apiClient'
import { useAuth } from './useAuth'
import type { AdminPlayer, AdminPlayerFilter } from '../types'

export function useAdminPlayers(filter: AdminPlayerFilter = {}) {
  const { token } = useAuth()

  return useQuery<AdminPlayer[]>({
    queryKey: ['adminPlayers', filter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filter.name) params.set('name', filter.name)
      if (filter.countryId) params.set('countryId', String(filter.countryId))
      if (filter.baseClub) params.set('baseClub', filter.baseClub)
      const qs = params.toString()

      const payload = await apiClient(`/api/v1/admin/players${qs ? `?${qs}` : ''}`, { token })
      const data = payload?.data ?? payload
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(token),
  })
}

export function useAdminPlayer(id: number | null) {
  const { token } = useAuth()

  return useQuery<AdminPlayer>({
    queryKey: ['adminPlayer', id],
    queryFn: async () => {
      const payload = await apiClient(`/api/v1/admin/players/${id}`, { token })
      return (payload?.data ?? payload) as AdminPlayer
    },
    enabled: Boolean(token && id),
  })
}

export function useCreateAdminPlayer() {
  const { token } = useAuth()
  const qc = useQueryClient()

  return useMutation<AdminPlayer, Error, FormData>({
    mutationFn: async (formData) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/players`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const isJSON = response.headers.get('content-type')?.includes('application/json')
      const data = isJSON ? await response.json() : null
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Create player failed')
      }
      return (data?.data ?? data) as AdminPlayer
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminPlayers'] }),
  })
}
