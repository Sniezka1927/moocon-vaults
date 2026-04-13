import { WalletError } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import React, { useCallback, useMemo } from 'react'
import '@solana/wallet-adapter-react-ui/styles.css'

export function WalletButton() {
  return (
    <WalletMultiButton
      style={{
        fontSize: '0.7rem',
        padding: '0.2rem 0.75rem',
        height: '2rem',
        lineHeight: '1',
        minHeight: 'unset',
      }}
    />
  )
}

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => import.meta.env.VITE_SOLANA_RPC_URL ?? clusterApiUrl('devnet'), [])

  const onError = useCallback((error: WalletError) => {
    console.error(error)
  }, [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} onError={onError} autoConnect={true}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
