import { Keypair } from '@solana/web3.js'
import { writeFileSync } from 'fs'

const N = 50
const main = () => {
  const kps: Keypair[] = []
  for (let i = 0; i < N; i++) {
    const keypair = Keypair.generate()
    console.log(`Wallet ${i}: ${keypair.publicKey.toBase58()}`)
    kps.push(keypair)
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
