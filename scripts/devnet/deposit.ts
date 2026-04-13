import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { JUPITER_USDC_ACCOUNTS, signAndSend, Vault } from '../../ts-sdk'
import { DEVNET_ADMIN, WALLETS } from './keypairs'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

const connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' })
const vault = new Vault(connection)

const MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') // USDC mint
const P_MINT = new PublicKey('5ZP4x2Q5cYjd3feJMpJtkY5AmJ9ify71qxMBQUHSXqPi') // pUSDC mint
const VAULT_INDEX = 1
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
    const vaultPda = vault.fetcher.getVaultAddress(VAULT_INDEX)[0]
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
      vaultIndex: VAULT_INDEX,
      vaultTokenAccount
    })

    const signature = await signAndSend(connection, new Transaction().add(ix), [
      wallet
    ])
    console.log('Deposit transaction signature:', signature)
  }
}

main()
