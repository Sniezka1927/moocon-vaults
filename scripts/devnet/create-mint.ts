// === Lending Vault (ID: 2, mint: 4zMMC9sr…) — CPI Accounts ===
//   lending_program                  7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3
//   lending                          98Uy7eonumvRbhQvP5Jt7B3WjNqpndioMF99xvR7sDVa
//   lending_admin                    DeF2BVMjWdCamK71nqBZ7uzQkLeW9MJ6C7zoCKLJXEmW
//   mint                             4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
//   f_token_mint                     2Wx1tTo8PkTP95NyKoFNPTtcLnYaSowDkExwbHDKAZQu
//   supply_token_reserves_liquidity  644Eh222dNe1V6sSRkYHBcdpxfjtxBBptAJ6mZujRRNo
//   lending_supply_position_on_liq   B5JAZXGKaZfWsUrauprZVNQM7HwXN8AfKVTt25qtDKYV
//   rate_model                       CpSRFppSpkdPw7juvRpSxwVyZMN3y8g7cHXCbrc3MBUs
//   vault                            CWFPa1gcDqGyeTHTmdbhGjCnQv7eRfdhnBpZKFzNr1R2
//   liquidity                        DFHSbFzMU67yHK9yLsLBLso7aEnzrB4ZQR7KBujmSU3M
//   liquidity_program                5uDkCoM96pwGYhAUucvCzLfm5UcjVRuxz6gH81RnRBmL
//   rewards_rate_model               GGtryeuwjcWoG6zg4Xi1vUJN1xRhypms4xt129BKTUxt
//   token_program                    TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
//   associated_token_program         ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
//   system_program                   11111111111111111111111111111111
// //   decimals=6  exchange_price=1007187541376  last_update=2026-01-08T07:40:42.000Z

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { DEVNET_RPC } from '../consts'
import { MPL_TOKEN_PROGRAM_ID, signAndSend, Vault } from '../../ts-sdk'
import { DEVNET_ADMIN } from './keypairs'
import { createMintWithMetadataIxs } from '../../ts-sdk/utils'
import { getMint } from '@solana/spl-token'

const connection = new Connection(DEVNET_RPC, 'confirmed')
const vault = new Vault(connection)

const main = async () => {
  const mintKeypairInput = Keypair.generate()
  console.log('Crearting mint with metadata on devnet...')
  console.log('Publickey:', mintKeypairInput.publicKey.toBase58())

  const state = await vault.fetcher.getState()
  const [vaultPda] = vault.fetcher.getVaultAddress(state.lastVault)
  const { instructions, mintKeypair } = await createMintWithMetadataIxs({
    connection: connection,
    vault: vaultPda,
    payer: DEVNET_ADMIN.publicKey,
    name: 'pSOL',
    symbol: 'pSOL',
    uri: 'https://example.com/metadata.json',
    decimals: 9,
    preparedKeypair: mintKeypairInput
  })

  const tx = new Transaction().add(...instructions)
  await signAndSend(connection, tx, [DEVNET_ADMIN, mintKeypair])

  // Verify mint account
  const mintAccount = await getMint(connection, mintKeypair.publicKey)
  console.log('Mint account:', mintAccount)

  // Verify metadata account
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      MPL_TOKEN_PROGRAM_ID.toBuffer(),
      mintKeypair.publicKey.toBuffer()
    ],
    MPL_TOKEN_PROGRAM_ID
  )
  const metadataAccount = await connection.getAccountInfo(metadataPda)
  console.log('Metadata account:', metadataAccount)
}

main()
