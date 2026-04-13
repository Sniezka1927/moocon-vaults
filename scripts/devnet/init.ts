import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { signAndSend, Vault } from '../../ts-sdk'
import { DEVNET_ADMIN, VRF_KEYPAIR } from './keypairs'

const connection = new Connection(DEVNET_RPC, 'confirmed')
const vault = new Vault(connection)

const main = async () => {
  console.log('Initializing vault program on devnet...')
  console.log('Admin:', DEVNET_ADMIN.publicKey.toBase58())
  console.log('VRF Authority:', VRF_KEYPAIR.publicKey.toBase58())
  const ix = await vault.initializeIx({
    admin: DEVNET_ADMIN.publicKey,
    vrfAuthority: VRF_KEYPAIR.publicKey
  })

  await signAndSend(connection, new Transaction().add(ix), [DEVNET_ADMIN])

  const state = await vault.fetcher.getState()
  console.log('State:', state)
}

main()
