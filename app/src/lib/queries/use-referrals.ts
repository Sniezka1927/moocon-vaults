import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import type {
  ReferralsResponse,
  CreateReferralBody,
  UseReferralBody,
  ReferralSuccessResponse,
} from '@/lib/api/types'

export function useReferrals(wallet: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.referrals.byWallet(wallet ?? ''),
    queryFn: () => apiFetch<ReferralsResponse>(`/api/referrals?wallet=${wallet}`),
    enabled: Boolean(wallet),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}

export function useCreateReferral() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateReferralBody) =>
      apiFetch<ReferralSuccessResponse>('/api/referrals', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.referrals.byWallet(variables.wallet),
      })
    },
  })
}

export function useUseReferral() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UseReferralBody) =>
      apiFetch<ReferralSuccessResponse>('/api/referrals/use', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.referrals.byWallet(variables.wallet),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.points.byWallet(variables.wallet),
      })
    },
  })
}
