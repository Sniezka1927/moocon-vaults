import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import { BN } from '@coral-xyz/anchor'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction
} from '@solana/web3.js'
import { createMint, createAccount } from '@solana/spl-token'
import {
  Orao,
  networkStateAccountAddress,
  randomnessAccountAddress,
  FulfillBuilder,
  InitBuilder
} from '@orao-network/solana-vrf'
import nacl from 'tweetnacl'
import { Vault } from '../ts-sdk/vault'
import { signAndSend } from '../ts-sdk/utils'
import {
  VRF_TEST_AUTHORITY,
  VRF_FULFILLMENT_AUTHORITY,
  airdrop,
  sleep
} from './test-utils'

describe('reveal-', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const vrf = new Orao(provider)
  const admin = VRF_TEST_AUTHORITY
  const vrfAuthority = VRF_TEST_AUTHORITY
  const fulfillmentAuthority = VRF_FULFILLMENT_AUTHORITY
  const DUMMY_WRITABLE = Keypair.generate().publicKey

  let vault: Vault
  let mint: PublicKey
  let fMint: PublicKey
  let vaultFTokenAccount: PublicKey
  let vaultIndex: number
  let vaultPda: PublicKey
  let pMint: PublicKey

  const DECIMALS = 6

  async function emulateFulfill(seed: Buffer) {
    const signature = nacl.sign.detached(seed, fulfillmentAuthority.secretKey)
    await new FulfillBuilder(vrf, seed).rpc(
      fulfillmentAuthority.publicKey,
      signature
    )
  }

  function makeVrfParams(fillByte: number) {
    const merkleRoot = new Array(32).fill(fillByte)
    const secretSeed = new Array(32).fill(fillByte + 1)
    const secretHash = new Array(32).fill(0)
    for (let i = 0; i < 32; i++) secretHash[i] = merkleRoot[i] ^ secretSeed[i]
    const vrfSeed = Buffer.from(
      merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
    )
    return { merkleRoot, secretSeed, secretHash, vrfSeed }
  }

  before(async () => {
    vault = new Vault(provider.connection)

    await airdrop(provider.connection, admin.publicKey, 10 * LAMPORTS_PER_SOL)

    try {
      const initIx = await vault.initializeIx({
        admin: admin.publicKey,
        vrfAuthority: vrfAuthority.publicKey
      })
      await signAndSend(provider.connection, new Transaction().add(initIx), [
        admin
      ])
    } catch {
      /* already exists */
    }

    mint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      DECIMALS
    )

    fMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      DECIMALS
    )

    vault.fetcher.state = null
    const stateAcc = await vault.fetcher.getState()
    vaultIndex = stateAcc.lastVault
    ;[vaultPda] = vault.fetcher.getVaultAddress(vaultIndex)

    // Create pMint owned by vaultPda
    pMint = await createMint(provider.connection, admin, vaultPda, null, 6)

    const initVaultIx = await vault.initializeVaultIx({
      admin: admin.publicKey,
      mint,
      fMint,
      lending: DUMMY_WRITABLE,
      minDeposit: 0n,
      pMint,
      withdrawFee: 0n
    })
    await signAndSend(provider.connection, new Transaction().add(initVaultIx), [
      admin
    ])

    vaultFTokenAccount = await createAccount(
      provider.connection,
      admin,
      fMint,
      vaultPda,
      Keypair.generate()
    )

    const syncIx = await vault.syncRateIx({
      admin: admin.publicKey,
      vaultIndex,
      lending: DUMMY_WRITABLE
    })
    await signAndSend(provider.connection, new Transaction().add(syncIx), [
      admin
    ])

    try {
      const treasury = Keypair.generate()
      await new InitBuilder(
        vrf,
        Keypair.generate().publicKey,
        treasury.publicKey,
        [fulfillmentAuthority.publicKey],
        new BN(2 * LAMPORTS_PER_SOL)
      ).rpc()
    } catch {
      /* VRF already initialized */
    }
  })

  it('reveal fails when called twice', async () => {
    vault.fetcher.vaults.clear()
    const round = (await vault.fetcher.getVaultByIndex(vaultIndex)).currentRound

    const { merkleRoot, secretSeed, secretHash, vrfSeed } = makeVrfParams(70)
    const request = randomnessAccountAddress(vrfSeed)

    // Commit
    const commitIx = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      rewardType: 0,
      tickets: 100n,
      merkleRoot,
      secretHash,
      mint,
      vaultFTokenAccount,
      fTokenMint: fMint,
      lending: DUMMY_WRITABLE,
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState: networkStateAccountAddress(),
      request
    })
    await signAndSend(provider.connection, new Transaction().add(commitIx), [
      vrfAuthority
    ])

    // Fulfill and reveal
    await Promise.all([vrf.waitFulfilled(vrfSeed), emulateFulfill(vrfSeed)])
    await sleep(2000)

    const revealIx = await vault.revealIx({
      authority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      secretSeed,
      request
    })
    await signAndSend(provider.connection, new Transaction().add(revealIx), [
      vrfAuthority
    ])

    // Try revealing again
    const revealIx2 = await vault.revealIx({
      authority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      secretSeed,
      request
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(revealIx2), [
        vrfAuthority
      ])
      assert.fail('Should have thrown AlreadyClaimed')
    } catch (e: any) {
      assert.ok(
        e.logs?.some((l: string) => l.includes('AlreadyClaimed')) ?? true
      )
    }
  })

  it('reveal fails for non-vrf-authority', async () => {
    vault.fetcher.vaults.clear()
    const round = (await vault.fetcher.getVaultByIndex(vaultIndex)).currentRound

    const { merkleRoot, secretSeed, secretHash, vrfSeed } = makeVrfParams(80)
    const request = randomnessAccountAddress(vrfSeed)

    // Commit
    const commitIx = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      rewardType: 0,
      tickets: 100n,
      merkleRoot,
      secretHash,
      mint,
      vaultFTokenAccount,
      fTokenMint: fMint,
      lending: DUMMY_WRITABLE,
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState: networkStateAccountAddress(),
      request
    })
    await signAndSend(provider.connection, new Transaction().add(commitIx), [
      vrfAuthority
    ])

    // Fulfill
    await Promise.all([vrf.waitFulfilled(vrfSeed), emulateFulfill(vrfSeed)])
    await sleep(2000)

    // Reveal with non-authority
    const nonAuth = Keypair.generate()
    await airdrop(provider.connection, nonAuth.publicKey, LAMPORTS_PER_SOL)

    const ix = await vault.revealIx({
      authority: nonAuth.publicKey,
      vaultIndex,
      round,
      secretSeed,
      request
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        nonAuth
      ])
      assert.fail('Should have thrown Unauthorized')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('Unauthorized')) ?? true)
    }
  })
})
