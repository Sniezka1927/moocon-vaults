import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import type { DrawingCheckResponse, DrawingsListResponse } from '@/lib/api/types'

export function useDrawingCheck(wallet: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.drawings.check(wallet ?? ''),
    queryFn: () => apiFetch<DrawingCheckResponse>(`/api/drawing/check/${wallet}`),
    enabled: Boolean(wallet),
    staleTime: 30_000,
    gcTime: 120_000,
  })
}

export function useDrawings(page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.drawings.list(page, limit),
    queryFn: () =>
      apiFetch<DrawingsListResponse>(`/api/drawing?page=${page}&limit=${limit}`),
    staleTime: 30_000,
    gcTime: 120_000,
    refetchInterval: 30_000,
  })
}

export function useDrawingsByVault(vault: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.drawings.byVault(vault, page, limit),
    queryFn: () =>
      apiFetch<DrawingsListResponse>(`/api/drawing/${vault}?page=${page}&limit=${limit}`),
    enabled: Boolean(vault),
    staleTime: 30_000,
    gcTime: 120_000,
  })
}
