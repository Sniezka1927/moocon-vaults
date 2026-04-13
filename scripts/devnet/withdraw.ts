import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { MAX_U64, signAndSend, Vault } from '../../ts-sdk'
import { DEVNET_ADMIN, WALLETS } from './keypairs'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { JUPITER_USDC_ACCOUNTS } from './jupiter-accounts'

const connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' })
const vault = new Vault(connection)

const MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') // USDC mint
const P_MINT = new PublicKey('H2sg4kd9diQn2vodRk3sc6Wr7fKKoW5LcSGqsRQcp43J') // pUSDC mint

const getClaimAccount = (assetAddress: PublicKey, user: PublicKey) => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_claim'), user.toBuffer(), assetAddress.toBuffer()],
    new PublicKey('5uDkCoM96pwGYhAUucvCzLfm5UcjVRuxz6gH81RnRBmL') //LIQUIDITY_PROGRAM_ID
  )
  return pda
}

const main = async () => {
  for (const wallet of WALLETS) {
    const withdrawer = wallet.publicKey
    const withdrawerTokenAccount = getAssociatedTokenAddressSync(
      MINT,
      withdrawer
    )
    const withdrawerPTokenAccount = getAssociatedTokenAddressSync(
      P_MINT,
      withdrawer
    )

    const lendingAccounts = JUPITER_USDC_ACCOUNTS

    const amount = 10n ** 5n

    const vaultIndex = 0
    const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      MINT,
      vaultPda,
      true
    )
    const vaultFTokenAccount = getAssociatedTokenAddressSync(
      lendingAccounts.fTokenMint,
      vaultPda,
      true
    )

    const ix = await vault.withdrawIx({
      amount,
      claimAccount: getClaimAccount(MINT, lendingAccounts.lendingAdmin),
      lendingAccounts,
      mint: MINT,
      pMint: P_MINT,
      vaultFTokenAccount,
      vaultIndex,
      vaultTokenAccount,
      withdrawer,
      withdrawerPTokenAccount,
      withdrawerTokenAccount
    })

    const signature = await signAndSend(connection, new Transaction().add(ix), [
      wallet
    ])

    console.log('Withdraw  transaction signature:', signature)
  }
}

main()
