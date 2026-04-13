import { DEVNET_ADMIN, VRF_KEYPAIR, WALLETS } from './keypairs'

const main = () => {
  console.log('Admin', DEVNET_ADMIN.publicKey.toBase58())
  console.log('VRF Authority', VRF_KEYPAIR.publicKey.toBase58())
  for (const wallet of WALLETS) {
    console.log('Wallet', wallet.publicKey.toBase58())
  }
}

main()
