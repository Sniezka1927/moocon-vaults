import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { signAndSend, Vault } from '../../ts-sdk'
import { WALLETS } from './keypairs'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

const connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' })
const vault = new Vault(connection)

const MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') // USDC mint

BigInt.prototype.toJSON = function () {
  return this.toString()
}

const main = async () => {
  const vaultIndex = 0

  for (const wallet of WALLETS) {
    console.log(wallet.publicKey.toBase58(), 'fetching rewards...')
    const rewards = await vault.fetcher.getRewardsForAddress(wallet.publicKey)
    const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      MINT,
      vaultPda,
      true
    )
    const claimerTokenAccount = getAssociatedTokenAddressSync(
      MINT,
      wallet.publicKey
    )

    for (const reward of rewards) {
      const ix = await vault.claimIx({
        claimer: wallet.publicKey,
        vaultIndex,
        round: reward.round,
        mint: MINT,
        vaultTokenAccount,
        claimerTokenAccount
      })

      const sig = await signAndSend(connection, new Transaction().add(ix), [
        wallet
      ])
      console.log('Claim tx:', sig)
    }
  }
}

main()
