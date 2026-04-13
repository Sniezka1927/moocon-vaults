import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import type { EventsListResponse, EventDetailResponse } from '@/lib/api/types'

export function useEvents(page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.events.list(page, limit),
    queryFn: () =>
      apiFetch<EventsListResponse>(`/api/events?page=${page}&limit=${limit}`),
    staleTime: 30_000,
    gcTime: 300_000,
  })
}

export function useEventDetail(vault: string, round: number) {
  return useQuery({
    queryKey: queryKeys.events.byVaultRound(vault, round),
    queryFn: () =>
      apiFetch<EventDetailResponse>(`/api/events/${vault}/${round}`),
    enabled: Boolean(vault) && round >= 0,
    staleTime: 300_000,
    gcTime: 600_000,
  })
}
