import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { signAndSend, Vault } from '../../ts-sdk'
import { DEVNET_ADMIN, WALLETS } from './keypairs'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { JUPITER_USDC_ACCOUNTS } from './jupiter-accounts'

const connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' })
const vault = new Vault(connection)

const MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') // USDC mint
const P_MINT = new PublicKey('H2sg4kd9diQn2vodRk3sc6Wr7fKKoW5LcSGqsRQcp43J') // pUSDC mint

const main = async () => {
  // const depositor = DEVNET_ADMIN.publicKey
  for (const wallet of WALLETS) {
    const depositor = wallet.publicKey
    const depositorTokenAccount = getAssociatedTokenAddressSync(MINT, depositor)
    const depositorPTokenAccount = getAssociatedTokenAddressSync(
      P_MINT,
      depositor
    )
    const lendingAccounts = JUPITER_USDC_ACCOUNTS
    const amount = 3n * 10n ** 6n
    const vaultIndex = 0
    const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      MINT,
      vaultPda,
      true
    )
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      lendingAccounts.fTokenMint,
      vaultPda,
      true
    )

    const ix = await vault.depositIx({
      amount,
      depositor,
      depositorPTokenAccount,
      depositorTokenAccount,
      lendingAccounts,
      mint: MINT,
      pMint: P_MINT,
      recipientTokenAccount,
      vaultIndex: 0,
      vaultTokenAccount
    })

    const signature = await signAndSend(connection, new Transaction().add(ix), [
      wallet
    ])
    console.log('Deposit transaction signature:', signature)
  }
}

main()
