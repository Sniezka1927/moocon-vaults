import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction
} from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import {
  JUPITER_USDC_ACCOUNTS,
  JUPITER_WSOL_ACCOUNTS,
  signAndSend,
  Vault
} from '../../ts-sdk'
import { DEVNET_ADMIN, VRF_KEYPAIR, WALLETS } from './keypairs'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT
} from '@solana/spl-token'

const connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' })
const vault = new Vault(connection)

const MINT = new PublicKey('So11111111111111111111111111111111111111112') // USDC mint
const P_MINT = new PublicKey('DmJfQTLJ2S6UCdoqc7ZFV3AY3WZyo3w2Bhjhtw3pFVX3') // pUSDC mint
const VAULT_INDEX = 0
const main = async () => {
  // const depositor = DEVNET_ADMIN.publicKey
  const wallet = VRF_KEYPAIR
  // for (const wallet of WALLETS) {
  const depositor = wallet.publicKey
  const depositorTokenAccount = getAssociatedTokenAddressSync(MINT, depositor)
  const depositorPTokenAccount = getAssociatedTokenAddressSync(
    P_MINT,
    depositor
  )
  const lendingAccounts = JUPITER_WSOL_ACCOUNTS
  const amount = 10n ** 6n
  const vaultPda = vault.fetcher.getVaultAddress(VAULT_INDEX)[0]
  const vaultTokenAccount = getAssociatedTokenAddressSync(MINT, vaultPda, true)
  const recipientTokenAccount = getAssociatedTokenAddressSync(
    lendingAccounts.fTokenMint,
    vaultPda,
    true
  )

  const isWsol = MINT.equals(NATIVE_MINT)
  const wrapIxs = isWsol
    ? [
        createAssociatedTokenAccountIdempotentInstruction(
          depositor,
          depositorTokenAccount,
          depositor,
          NATIVE_MINT
        ),
        SystemProgram.transfer({
          fromPubkey: depositor,
          toPubkey: depositorTokenAccount,
          lamports: amount
        }),
        createSyncNativeInstruction(depositorTokenAccount)
      ]
    : []

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

  const tx = new Transaction().add(...wrapIxs, ix)
  const signature = await signAndSend(connection, tx, [wallet])
  console.log('Deposit transaction signature:', signature)
  // }
}

main()
