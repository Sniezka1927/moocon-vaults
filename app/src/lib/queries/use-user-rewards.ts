import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaults } from '@/lib/vaults/context'

export function useUserRewards() {
  const vault = useVaults()
  const { publicKey } = useWallet()

  return useQuery({
    queryKey: ['rewards', 'user', publicKey?.toBase58() ?? ''],
    queryFn: () => vault!.fetcher.getRewardsForAddress(publicKey!),
    enabled: Boolean(vault && publicKey),
    staleTime: 30_000,
    gcTime: 120_000,
    refetchInterval: 30_000,
  })
}
