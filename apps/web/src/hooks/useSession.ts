import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import { useAuth } from './useAuth'
import type { SessionData } from '../types'

export function useSession() {
  const { token } = useAuth()

  return useQuery<SessionData>({
    queryKey: ['session', token],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/auth/me', { token })
      return (payload?.data ?? null) as SessionData
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  })
}
