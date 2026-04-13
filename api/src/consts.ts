import { Connection, Keypair } from '@solana/web3.js'
import { AnchorProvider, Wallet } from '@coral-xyz/anchor'
import { Orao } from '@orao-network/solana-vrf'
import { Vault } from 'ts-sdk'

export const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://devnet.helius-rpc.com/?api-key=4d822bc4-b5a2-4ccb-be0a-f2c7b1b399da',
  'confirmed'
)
export const vault = new Vault(connection)


export const vrfAuthority = process.env.VRF_AUTHORITY_PK
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.VRF_AUTHORITY_PK)))
  : Keypair.generate()


const provider = new AnchorProvider(
  connection,
  vrfAuthority as unknown as Wallet,
  {
    commitment: 'confirmed'
  }
)
export const orao = new Orao(provider)
