import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import type { PointsResponse } from '@/lib/api/types'

export function usePoints(wallet: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.points.byWallet(wallet ?? ''),
    queryFn: () => apiFetch<PointsResponse>(`/api/points/${wallet}`),
    enabled: Boolean(wallet),
    staleTime: 30_000,
    gcTime: 120_000,
  })
}
