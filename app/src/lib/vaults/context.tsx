import { createContext, useContext, useMemo } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { Vault } from 'ts-sdk'

const VaultsContext = createContext<Vault | null>(null)

export function VaultsProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection()
  console.log('[VaultsProvider] connection endpoint:', connection.rpcEndpoint)
  const vault = useMemo(() => new Vault(connection), [connection])

  return (
    <VaultsContext.Provider value={vault}>{children}</VaultsContext.Provider>
  )
}

export function useVaults() {
  return useContext(VaultsContext)
}
