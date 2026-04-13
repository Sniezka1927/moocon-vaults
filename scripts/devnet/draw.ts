import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { signAndSend, Vault } from '../../ts-sdk'
import { DEVNET_ADMIN, VRF_KEYPAIR, WALLETS } from './keypairs'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { JUPITER_USDC_ACCOUNTS } from './jupiter-accounts'
import {
  networkStateAccountAddress,
  Orao,
  randomnessAccountAddress
} from '@orao-network/solana-vrf'
import { AnchorProvider, Wallet } from '@coral-xyz/anchor'
import { getClaimAccount } from '../../ts-sdk/utils'

const connection = new Connection(DEVNET_RPC, { commitment: 'confirmed' })
const vault = new Vault(connection)
const provider = new AnchorProvider(
  connection,
  DEVNET_ADMIN as unknown as Wallet,
  {
    commitment: 'confirmed'
  }
)
const vrf = new Orao(provider)

const MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') // USDC mint

const main = async () => {
  const lendingAccounts = JUPITER_USDC_ACCOUNTS
  const vaultIndex = 0
  const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
  const vaultTokenAccount = getAssociatedTokenAddressSync(MINT, vaultPda, true)
  const vaultFTokenAccount = getAssociatedTokenAddressSync(
    lendingAccounts.fTokenMint,
    vaultPda,
    true
  )

  const round = 0 //(await vault.fetcher.getVaultByIndex(vaultIndex)).currentRound
  console.log('Current round:', round)

  // Generate VRF params
  const merkleRoot = new Array(32).fill(11)
  const secretSeed = new Array(32).fill(12)
  const secretHash = new Array(32).fill(0)
  for (let i = 0; i < 32; i++) secretHash[i] = merkleRoot[i] ^ secretSeed[i]
  const vrfSeed = Buffer.from(
    merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
  )

  // === COMMIT ===
  console.log('Committing...')
  const networkStateAcc = await vrf.getNetworkState()
  const commitIx = await vault.commitIx({
    vrfAuthority: VRF_KEYPAIR.publicKey,
    vaultIndex,
    round,
    rewardType: 0,
    tickets: 100n,
    merkleRoot,
    secretHash,
    mint: MINT,
    vaultFTokenAccount,
    vaultTokenAccount,
    claimAccount: getClaimAccount(MINT, lendingAccounts.lendingAdmin),
    lendingAccounts,
    treasury: networkStateAcc.config.treasury,
    networkState: networkStateAccountAddress(),
    request: randomnessAccountAddress(vrfSeed)
  })

  // const commitSig = await signAndSend(connection, new Transaction().add(commitIx), [VRF_KEYPAIR])
  // console.log('Commit tx:', commitSig)

  // === WAIT FOR VRF FULFILLMENT ===
  console.log('Waiting for VRF fulfillment...')
  const randomness = await vrf.waitFulfilled(vrfSeed)
  console.log(
    'VRF fulfilled, randomness:',
    Buffer.from(randomness.randomness).toString('hex').slice(0, 32) + '...'
  )

  // === REVEAL ===
  console.log('Revealing...')
  const revealIx = await vault.revealIx({
    authority: VRF_KEYPAIR.publicKey,
    vaultIndex,
    round,
    secretSeed,
    request: randomnessAccountAddress(vrfSeed)
  })

  const revealSig = await signAndSend(
    connection,
    new Transaction().add(revealIx),
    [VRF_KEYPAIR]
  )
  console.log('Reveal tx:', revealSig)

  // === SET WINNER ===
  console.log('Setting winner...')
  const winner = WALLETS[0].publicKey
  const setWinnerIx = await vault.setWinnerIx({
    vrfAuthority: VRF_KEYPAIR.publicKey,
    vaultIndex,
    round,
    winner
  })

  const setWinnerSig = await signAndSend(
    connection,
    new Transaction().add(setWinnerIx),
    [VRF_KEYPAIR]
  )
  console.log('Set winner tx:', setWinnerSig)
  console.log('Winner:', winner.toBase58())

  console.log('Draw complete!')
}

main()
