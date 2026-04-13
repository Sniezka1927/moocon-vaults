import { useEffect } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useQueryClient } from '@tanstack/react-query'
import { parseVault } from 'ts-sdk'
import { useVaults } from '@/lib/vaults/context'
import { queryKeys } from '@/lib/api/query-keys'
import type { VaultWithAddress } from '@/lib/store/vault-store'

export function useVaultSubscriptions(vaults: VaultWithAddress[]) {
  const { connection } = useConnection()
  const vault = useVaults()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!vault || vaults.length === 0) return

    const subIds = vaults.map(({ address }) => {
      return connection.onAccountChange(
        address,
        (accountInfo) => {
          try {
            const raw = vault.program.coder.accounts.decode('vault', accountInfo.data)
            const parsed = parseVault(raw)
            queryClient.setQueryData(
              queryKeys.vaults.all(),
              (old: VaultWithAddress[] | undefined) =>
                old?.map((v) => (v.address.equals(address) ? { ...v, ...parsed } : v))
            )
          } catch (err) {
            console.error('[useVaultSubscriptions] failed to decode vault account:', err)
          }
        },
        'confirmed'
      )
    })

    return () => {
      for (const id of subIds) {
        connection.removeAccountChangeListener(id).catch(() => {})
      }
    }
  }, [connection, vault, queryClient, vaults])
}
