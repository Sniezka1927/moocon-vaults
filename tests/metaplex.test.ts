import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction
} from '@solana/web3.js'
import { getMint } from '@solana/spl-token'
import { Vault } from '../ts-sdk/vault'
import { createMintWithMetadataIxs, signAndSend } from '../ts-sdk/utils'
import { MPL_TOKEN_PROGRAM_ID } from '../ts-sdk/consts'
import { VRF_TEST_AUTHORITY, airdrop } from './test-utils'

describe('metaplex mint with metadata', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const payer = VRF_TEST_AUTHORITY
  let vault: Vault
  let vaultPda: PublicKey

  before(async () => {
    vault = new Vault(provider.connection)
    await airdrop(provider.connection, payer.publicKey, 2 * LAMPORTS_PER_SOL)
    ;[vaultPda] = vault.fetcher.getVaultAddress(0)
  })

  it('creates mint with metadata and transfers authority to vault', async () => {
    const mintKeypairInput = Keypair.generate()

    const { instructions, mintKeypair } = await createMintWithMetadataIxs({
      connection: provider.connection,
      vault: vaultPda,
      payer: payer.publicKey,
      name: 'Test Token',
      symbol: 'TST',
      uri: 'https://example.com/metadata.json',
      decimals: 6,
      preparedKeypair: mintKeypairInput
    })

    assert.ok(
      mintKeypair.publicKey.equals(mintKeypairInput.publicKey),
      'should use provided keypair'
    )

    const tx = new Transaction().add(...instructions)
    await signAndSend(provider.connection, tx, [payer, mintKeypair])

    // Verify mint account
    const mintAccount = await getMint(
      provider.connection,
      mintKeypair.publicKey
    )
    assert.ok(
      mintAccount.mintAuthority!.equals(vaultPda),
      'mint authority should be vault PDA'
    )
    assert.equal(mintAccount.decimals, 6, 'decimals mismatch')
    assert.equal(
      mintAccount.freezeAuthority,
      null,
      'freeze authority should be null'
    )

    // Verify metadata account
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        MPL_TOKEN_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer()
      ],
      MPL_TOKEN_PROGRAM_ID
    )
    const metadataAccount =
      await provider.connection.getAccountInfo(metadataPda)
    assert.ok(metadataAccount !== null, 'metadata account should exist')

    // Parse name/symbol from metadata (borsh encoded, after fixed header)
    // Metadata layout: 1 (key) + 32 (update_authority) + 32 (mint) + 4+name + 4+symbol + 4+uri
    const data = metadataAccount!.data
    const nameLen = data.readUInt32LE(1 + 32 + 32)
    const nameStr = data
      .subarray(1 + 32 + 32 + 4, 1 + 32 + 32 + 4 + nameLen)
      .toString('utf8')
      .replace(/\0/g, '')
    const symbolOffset = 1 + 32 + 32 + 4 + nameLen
    const symbolLen = data.readUInt32LE(symbolOffset)
    const symbolStr = data
      .subarray(symbolOffset + 4, symbolOffset + 4 + symbolLen)
      .toString('utf8')
      .replace(/\0/g, '')
    const uriOffset = symbolOffset + 4 + symbolLen
    const uriLen = data.readUInt32LE(uriOffset)
    const uriStr = data
      .subarray(uriOffset + 4, uriOffset + 4 + uriLen)
      .toString('utf8')
      .replace(/\0/g, '')

    assert.equal(nameStr, 'Test Token', 'name mismatch')
    assert.equal(symbolStr, 'TST', 'symbol mismatch')
    assert.equal(uriStr, 'https://example.com/metadata.json', 'uri mismatch')
  })
})
