import { useQuery } from '@tanstack/react-query'
import { useConnection } from '@solana/wallet-adapter-react'
import { getAssociatedTokenAddressSync, getAccount, NATIVE_MINT } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { getLendingAccountsForMint, parseVault } from 'ts-sdk'
import { useVaults } from '@/lib/vaults/context'
import { queryKeys } from '@/lib/api/query-keys'
import type { VaultWithAddress } from '@/lib/store/vault-store'
import { useMintStore } from '@/lib/store/mint-store'

export function isNativeSol(mint: PublicKey) {
  return mint.equals(NATIVE_MINT)
}

export function useAllVaults() {
  const vault = useVaults()

  return useQuery({
    queryKey: queryKeys.vaults.all(),
    queryFn: async (): Promise<VaultWithAddress[]> => {
      console.log('vault', vault)
      if (!vault) throw new Error('Vault program not initialized')
      console.log(
        '[useAllVaults] fetching, programId:',
        vault.program.programId.toBase58()
      )
      try {
        const entries = await vault.program.account.vault.all()
        console.log('[useAllVaults] raw entries:', entries.length, entries)
        const state = await vault.fetcher.getState()
        const result: VaultWithAddress[] = []
        for (let i = 0; i <= state.lastVault; i++) {
          const [addr] = vault.fetcher.getVaultAddress(i)
          const entry = entries.find((e) => e.publicKey.equals(addr))
          if (entry) result.push({ index: i, address: addr, ...parseVault(entry.account) })
        }
        console.log('[useAllVaults] parsed:', result)
        return result
      } catch (err) {
        console.error('[useAllVaults] error:', err)
        throw err
      }
    },
    enabled: Boolean(vault),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 30_000
  })
}

export function useUserTokenBalance(
  mint: PublicKey | undefined,
  owner: PublicKey | null | undefined
) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: queryKeys.user.tokenBalance(mint?.toBase58() ?? '', owner?.toBase58() ?? ''),
    queryFn: async (): Promise<bigint> => {
      const ata = getAssociatedTokenAddressSync(mint!, owner!)
      try {
        const account = await getAccount(connection, ata)
        return BigInt(account.amount.toString())
      } catch {
        return 0n
      }
    },
    enabled: Boolean(mint) && Boolean(owner),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 15_000,
  })
}

export function useUserPTokenBalance(
  vault: VaultWithAddress | undefined,
  owner: PublicKey | null | undefined,
  decimals: number
) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: queryKeys.user.pTokenBalance(vault?.address.toBase58() ?? '', owner?.toBase58() ?? ''),
    queryFn: async (): Promise<number> => {
      const pAta = getAssociatedTokenAddressSync(vault!.pMint, owner!)
      try {
        const { amount } = await getAccount(connection, pAta)
        return Number(amount) / 10 ** decimals
      } catch {
        return 0
      }
    },
    enabled: Boolean(vault) && Boolean(owner),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 15_000,
  })
}

export function useUserDepositedAmount(
  vault: VaultWithAddress | undefined,
  owner: PublicKey | null | undefined,
  decimals: number
) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: queryKeys.user.deposited(vault?.address.toBase58() ?? '', owner?.toBase58() ?? ''),
    queryFn: async (): Promise<number> => {
      const pAta = getAssociatedTokenAddressSync(vault!.pMint, owner!)
      try {
        const { amount } = await getAccount(connection, pAta)
        return Number(amount) / 10 ** decimals
      } catch {
        return 0
      }
    },
    enabled: Boolean(vault) && Boolean(owner),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 15_000,
  })
}

export function useUserTotalDepositsUsd(
  vaults: VaultWithAddress[],
  owner: PublicKey | null | undefined
) {
  const { connection } = useConnection()
  const getMint = useMintStore((s) => s.getMint)

  return useQuery({
    queryKey: queryKeys.user.totalDepositsUsd(owner?.toBase58() ?? ''),
    queryFn: async (): Promise<number> => {
      let total = 0
      for (const vault of vaults) {
        const la = getLendingAccountsForMint(vault.mint)
        const decimals = la?.decimal ?? 6
        const price = getMint(vault.mint.toBase58())?.price ?? 0
        if (price === 0) continue
        const pAta = getAssociatedTokenAddressSync(vault.pMint, owner!)
        try {
          const { amount } = await getAccount(connection, pAta)
          const underlyingAmount = Number(amount) / 10 ** decimals
          total += underlyingAmount * price
        } catch {
          // ATA doesn't exist — balance is 0
        }
      }
      return total
    },
    enabled: Boolean(owner) && vaults.length > 0,
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 15_000,
  })
}

export function useVaultTokenBalance(
  vaultAddress: PublicKey | undefined,
  mint: PublicKey | undefined
) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: queryKeys.vaults.tokenBalance(
      vaultAddress?.toBase58() ?? '',
      mint?.toBase58() ?? ''
    ),
    queryFn: async (): Promise<bigint> => {
      if (!vaultAddress || !mint)
        throw new Error('Missing vault address or mint')
      const ata = getAssociatedTokenAddressSync(mint, vaultAddress, true)
      const account = await getAccount(connection, ata)
      return BigInt(account.amount.toString())
    },
    enabled: Boolean(vaultAddress) && Boolean(mint),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 30_000
  })
}

export function useNativeSolBalance(owner: PublicKey | null | undefined) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['user', 'nativeSol', owner?.toBase58() ?? ''],
    queryFn: async (): Promise<bigint> => {
      const lamports = await connection.getBalance(owner!)
      return BigInt(lamports)
    },
    enabled: Boolean(owner),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 15_000,
  })
}
