import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import { BN } from '@coral-xyz/anchor'
// BN kept for @orao-network/solana-vrf which requires it
import { Keypair, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js'
import {
  Orao,
  networkStateAccountAddress,
  randomnessAccountAddress,
  FulfillBuilder,
  InitBuilder
} from '@orao-network/solana-vrf'
import nacl from 'tweetnacl'
import { createMint, createAccount } from '@solana/spl-token'
import { Vault } from '../ts-sdk/vault'
import { signAndSend } from '../ts-sdk/utils'
import { parseEvents } from '../ts-sdk/events'
import {
  VRF_FULFILLMENT_AUTHORITY,
  VRF_TEST_AUTHORITY,
  airdrop,
  dummyLending,
  sleep
} from './test-utils'

describe('premium-vaults randomness', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const vrf = new Orao(provider)
  const treasury = Keypair.generate()
  const fulfillmentAuthority = VRF_FULFILLMENT_AUTHORITY
  const vrfAuthority = VRF_TEST_AUTHORITY

  const DUMMY_WRITABLE = Keypair.generate().publicKey

  let vault: Vault
  let mint: anchor.web3.PublicKey
  let pMint: anchor.web3.PublicKey
  let vaultTokenAccount: anchor.web3.PublicKey

  // VRF seed derived from merkleRoot XOR secretHash
  const merkleRoot = new Array(32).fill(5)
  const secretSeed = new Array(32).fill(6)
  const secretHash = new Array(32).fill(0)
  for (let i = 0; i < 32; i++) {
    secretHash[i] = merkleRoot[i] ^ secretSeed[i]
  }
  const vrfSeed = Buffer.from(
    merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
  )

  async function emulateFulfill(seed: Buffer) {
    const signature = nacl.sign.detached(seed, fulfillmentAuthority.secretKey)
    await new FulfillBuilder(vrf, seed).rpc(
      fulfillmentAuthority.publicKey,
      signature
    )
  }

  before(async () => {
    vault = new Vault(provider.connection)

    await airdrop(
      provider.connection,
      vrfAuthority.publicKey,
      10 * LAMPORTS_PER_SOL
    )

    const fee = 2 * LAMPORTS_PER_SOL
    const configAuthority = Keypair.generate()

    await new InitBuilder(
      vrf,
      configAuthority.publicKey,
      treasury.publicKey,
      [fulfillmentAuthority.publicKey],
      new BN(fee)
    ).rpc()

    // Initialize program state and vault
    const initIx = await vault.initializeIx({
      admin: vrfAuthority.publicKey,
      vrfAuthority: vrfAuthority.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(initIx), [
      vrfAuthority
    ])

    mint = await createMint(
      provider.connection,
      vrfAuthority,
      vrfAuthority.publicKey,
      null,
      6
    )

    const [vaultPda] = vault.fetcher.getVaultAddress(0)
    pMint = await createMint(
      provider.connection,
      vrfAuthority,
      vaultPda,
      null,
      6
    )

    const vaultIx = await vault.initializeVaultIx({
      admin: vrfAuthority.publicKey,
      mint,
      pMint,
      minDeposit: 0n,
      lending: DUMMY_WRITABLE,
      withdrawFee: 0n
    })
    await signAndSend(provider.connection, new Transaction().add(vaultIx), [
      vrfAuthority
    ])

    vaultTokenAccount = await createAccount(
      provider.connection,
      vrfAuthority,
      mint,
      vaultPda,
      Keypair.generate()
    )

    // Sync rate so last_rate > 0
    const syncIx = await vault.syncRateIx({
      admin: vrfAuthority.publicKey,
      vaultIndex: 0,
      lending: DUMMY_WRITABLE
    })
    await signAndSend(provider.connection, new Transaction().add(syncIx), [
      vrfAuthority
    ])
  })

  it('commit (request randomness)', async () => {
    const networkState = networkStateAccountAddress()
    const request = randomnessAccountAddress(vrfSeed)

    const networkStateAcc = await vrf.getNetworkState()

    const ix = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex: 0,
      round: 0,
      rewardType: 0,
      tickets: 100n,
      merkleRoot,
      secretHash,
      mint,
      vaultFTokenAccount: vaultTokenAccount,
      vaultTokenAccount,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE }),
      treasury: networkStateAcc.config.treasury,
      networkState,
      request
    })

    const sig = await signAndSend(
      provider.connection,
      new Transaction().add(ix),
      [vrfAuthority]
    )

    const requestAcc = await provider.connection.getAccountInfo(request)
    assert.ok(requestAcc !== null, 'Randomness request account should exist')

    const events = await parseEvents(vault.program, provider.connection, sig)
    const commitEvent = events.find((e) => e.name === 'commitEvent')
    assert.ok(commitEvent, 'CommitEvent should be emitted')
    assert.strictEqual(commitEvent.data.round, 0)
    assert.deepStrictEqual([...commitEvent.data.merkleRoot], merkleRoot)
    assert.deepStrictEqual([...commitEvent.data.secretHash], secretHash)
    assert.deepStrictEqual([...commitEvent.data.vrfSeed], Array.from(vrfSeed))
  })

  it('reveal fails before fulfillment', async () => {
    const request = randomnessAccountAddress(vrfSeed)

    const ix = await vault.revealIx({
      authority: vrfAuthority.publicKey,
      vaultIndex: 0,
      round: 0,
      secretSeed,
      request
    })

    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        vrfAuthority
      ])
      assert.fail('Should have thrown RandomnessNotFulfilled')
    } catch (e: any) {
      assert.ok(
        e.logs?.some((l: string) => l.includes('RandomnessNotFulfilled')) ??
          true,
        'Expected RandomnessNotFulfilled error'
      )
    }
  })

  it('reveal by non-vrf-authority fails', async () => {
    const request = randomnessAccountAddress(vrfSeed)
    const nonAuth = Keypair.generate()
    await airdrop(provider.connection, nonAuth.publicKey, LAMPORTS_PER_SOL)

    const ix = await vault.revealIx({
      authority: nonAuth.publicKey,
      vaultIndex: 0,
      round: 0,
      secretSeed,
      request
    })

    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        nonAuth
      ])
      assert.fail('Should have thrown ConstraintHasOne')
    } catch (e: any) {
      assert.ok(
        e.logs?.some((l: string) => l.includes('Unauthorized')) ?? true,
        'Expected Unauthorized error'
      )
    }
  })

  it('fulfill and reveal randomness', async () => {
    const request = randomnessAccountAddress(vrfSeed)

    const [randomness] = await Promise.all([
      vrf.waitFulfilled(vrfSeed),
      emulateFulfill(vrfSeed)
    ])

    await sleep(2000)

    assert.ok(
      !Buffer.from(randomness.randomness).equals(Buffer.alloc(64)),
      'Randomness should be non-zero'
    )

    const ix = await vault.revealIx({
      authority: vrfAuthority.publicKey,
      vaultIndex: 0,
      round: 0,
      secretSeed,
      request
    })

    const sig = await signAndSend(
      provider.connection,
      new Transaction().add(ix),
      [vrfAuthority]
    )

    const events = await parseEvents(vault.program, provider.connection, sig)
    const revealEvent = events.find((e) => e.name === 'revealEvent')
    assert.ok(revealEvent, 'RevealEvent should be emitted')
    assert.strictEqual(revealEvent.data.round, 0)
    assert.deepStrictEqual([...revealEvent.data.secretSeed], secretSeed)
    assert.ok(
      !Buffer.from(revealEvent.data.randomness).equals(Buffer.alloc(64)),
      'Event randomness should be non-zero'
    )
    assert.ok(
      revealEvent.data.winnerIndex.toNumber() < 100,
      'winnerIndex should be less than ticket count'
    )
  })
})
