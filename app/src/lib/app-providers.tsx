import React, { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SolanaProvider } from '@/lib/solana/provider'
import { VaultsProvider } from '@/lib/vaults/context'
import { ApiError } from '@/lib/api/client'
import { useMintStore } from '@/lib/store/mint-store'

export const API_ERROR_MESSAGES: Record<string, string> = {
  'cannot use your own referral code': "You can't redeem your own referral code",
  'already used a referral code': "You've already redeemed a referral code",
  'create your own referral code before using one': 'Create your own referral code first',
  'wallet already has a referral code': 'You already have a referral code',
  'referral code not found': "That referral code doesn't exist",
  'referral code already taken': 'That code is taken, choose another',
}

export function getFriendlyError(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong'
  try {
    const parsed = JSON.parse(error.message.trim())
    const raw: string = parsed?.error ?? error.message
    if (raw.startsWith('insufficient tickets')) return 'You need at least 100 USDC deposited to create a referral code'
    return API_ERROR_MESSAGES[raw] ?? raw
  } catch {
    return error.message
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 120_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        toast.error(getFriendlyError(error))
      },
    },
  },
})

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    useMintStore.getState().fetchMints()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SolanaProvider>
        <VaultsProvider>{children}</VaultsProvider>
      </SolanaProvider>
    </QueryClientProvider>
  )
}
