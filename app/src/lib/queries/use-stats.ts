import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import type { StatsResponse } from '@/lib/api/types'

interface UseStatsOptions {
  interval: '1h' | '4h' | '1d'
  limit?: number
  cursor?: string | null
}

export function useStats({ interval, limit = 100, cursor = null }: UseStatsOptions) {
  const params = new URLSearchParams({ interval, limit: String(limit) })
  if (cursor) params.set('cursor', cursor)

  return useQuery({
    queryKey: queryKeys.stats.list(interval, limit, cursor),
    queryFn: () => apiFetch<StatsResponse>(`/api/stats?${params.toString()}`),
    staleTime: 60_000,
    gcTime: 600_000,
  })
}
