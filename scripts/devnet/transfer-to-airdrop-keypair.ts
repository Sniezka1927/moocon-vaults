import {
  Keypair,
  SystemProgram,
  PublicKey,
  Transaction,
  Connection
} from '@solana/web3.js'
import { writeFileSync } from 'fs'
import KEYPAIRS from './faucet-wallets.json'
import {
  getAssociatedTokenAddressSync,
  // createAssociatedTokenAccountIdempotent,
  createTransferCheckedInstruction
} from '@solana/spl-token'
import { signAndSend } from '../../ts-sdk'
import { DEVNET_RPC } from '../consts'

const connection = new Connection(DEVNET_RPC, 'confirmed')
const USDC_DEVNET = new PublicKey(
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
)
const main = async () => {
  const kps: Keypair[] = []
  const airdropper = Keypair.fromSecretKey(Uint8Array.from(KEYPAIRS[0]))

  for (let i = 1; i < KEYPAIRS.length; i++) {
    const keypair = Keypair.fromSecretKey(Uint8Array.from(KEYPAIRS[i]))
    console.log(`Wallet ${i}: ${keypair.publicKey.toBase58()}`)
    kps.push(keypair)

    const transferIx = SystemProgram.transfer({
      fromPubkey: airdropper.publicKey,
      toPubkey: keypair.publicKey,
      lamports: 1_000_000 // 1 SOL
    })

    const source = getAssociatedTokenAddressSync(USDC_DEVNET, keypair.publicKey)
    const destination = getAssociatedTokenAddressSync(
      USDC_DEVNET,
      airdropper.publicKey
    )

    // const createDestinationAtaIx = await createAssociatedTokenAccountIdempotent(
    //   connection,
    //   airdropper,
    //   USDC_DEVNET,
    //   airdropper.publicKey
    // )

    const usdcTransfer = createTransferCheckedInstruction(
      source,
      USDC_DEVNET,
      destination,
      keypair.publicKey,
      20_000_000,
      6
    )

    const tx = new Transaction().add(transferIx, usdcTransfer)
    await signAndSend(connection, tx, [airdropper, keypair])
  }
  writeFileSync(
    'scripts/faucet-wallets.json',
    JSON.stringify(
      kps.map((kp) => Array.from(kp.secretKey)),
      null,
      2
    )
  )
}

main()
