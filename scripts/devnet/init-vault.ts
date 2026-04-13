import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { signAndSend, Vault } from '../../ts-sdk'
import { DEVNET_ADMIN, VRF_KEYPAIR } from './keypairs'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'

const connection = new Connection(DEVNET_RPC, 'confirmed')
const vault = new Vault(connection)

const MINT = new PublicKey('So11111111111111111111111111111111111111112') // SOL mint
const F_MINT = new PublicKey('BG892DUQW1NHQLinc4mabqH7EVeEfFWpVibAiNnggwmU') // fSOL mint
const P_MINT = new PublicKey('3TvPcR2nsJyvayNxTyUK1uqcoks6zMqYf28vezSZE23H') // pSOL mint
const JUPITER_LENDING_ACCOUNT_PDA = new PublicKey(
  'GAvizzttfkgetRzkZY9fqzCYo3fJULM7E9V1Gq5CVTNS'
) // devnet jupiter lending account pda
const VAULT_INDEX = 1
const MIN_DEPOSIT = 0n // 1 USDC in lamports
const WITHDRAWAL_FEE = 50n // 5bps withdrawal fee

const main = async () => {
  console.log('Initializing vault on devnet...')

  const ix = await vault.initializeVaultIx({
    admin: DEVNET_ADMIN.publicKey,
    lending: JUPITER_LENDING_ACCOUNT_PDA,
    minDeposit: MIN_DEPOSIT,
    mint: MINT,
    pMint: P_MINT,
    withdrawFee: WITHDRAWAL_FEE
  })

  // Create vault ATA's
  const [vaultPda] = vault.fetcher.getVaultAddress(VAULT_INDEX)

  const ataPda = getAssociatedTokenAddressSync(MINT, vaultPda, true)
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    DEVNET_ADMIN.publicKey,
    ataPda,
    vaultPda,
    MINT
  )

  const createFAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    DEVNET_ADMIN.publicKey,
    getAssociatedTokenAddressSync(F_MINT, vaultPda, true),
    vaultPda,
    F_MINT
  )

  const syncRateIx = await vault.syncRateIx({
    admin: DEVNET_ADMIN.publicKey,
    vaultIndex: VAULT_INDEX,
    lending: JUPITER_LENDING_ACCOUNT_PDA
  })

  const tx = new Transaction().add(ix, createAtaIx, createFAtaIx, syncRateIx)

  const signature = await signAndSend(connection, tx, [DEVNET_ADMIN])

  console.log('Initialization transaction signature:', signature)
}

main()
