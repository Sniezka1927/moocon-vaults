import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { signAndSend, Vault } from '../../ts-sdk'
import { WALLETS } from './keypairs'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

const connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' })
const vault = new Vault(connection)

const MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') // USDC mint

const main = async () => {
  const claimer = WALLETS[0] // winner set in draw.ts
  const vaultIndex = 0
  const round = 0

  const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
  const vaultTokenAccount = getAssociatedTokenAddressSync(MINT, vaultPda, true)
  const claimerTokenAccount = getAssociatedTokenAddressSync(
    MINT,
    claimer.publicKey
  )

  const ix = await vault.claimIx({
    claimer: claimer.publicKey,
    vaultIndex,
    round,
    mint: MINT,
    vaultTokenAccount,
    claimerTokenAccount
  })

  const sig = await signAndSend(connection, new Transaction().add(ix), [
    claimer
  ])
  console.log('Claim tx:', sig)
}

main()
