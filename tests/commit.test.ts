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
  InitBuilder
} from '@orao-network/solana-vrf'
import { Vault } from '../ts-sdk/vault'
import { signAndSend } from '../ts-sdk/utils'
import {
  VRF_TEST_AUTHORITY,
  VRF_FULFILLMENT_AUTHORITY,
  airdrop,
  dummyLending
} from './test-utils'

describe('commit-', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const vrf = new Orao(provider)
  const admin = VRF_TEST_AUTHORITY
  const vrfAuthority = VRF_TEST_AUTHORITY
  const fulfillmentAuthority = VRF_FULFILLMENT_AUTHORITY
  const DUMMY_WRITABLE = Keypair.generate().publicKey

  let vault: Vault
  let mint: PublicKey
  let vaultTokenAccount: PublicKey
  let vaultIndex: number
  let vaultPda: PublicKey
  let pMint: PublicKey

  const DECIMALS = 6

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

    vault.fetcher.state = null
    const stateAcc = await vault.fetcher.getState()
    vaultIndex = stateAcc.lastVault
    ;[vaultPda] = vault.fetcher.getVaultAddress(vaultIndex)

    pMint = await createMint(
      provider.connection,
      admin,
      vaultPda,
      null,
      DECIMALS
    )

    const initVaultIx = await vault.initializeVaultIx({
      admin: admin.publicKey,
      mint,
      minDeposit: 0n,
      lending: DUMMY_WRITABLE,
      pMint,
      withdrawFee: 0n
    })
    await signAndSend(provider.connection, new Transaction().add(initVaultIx), [
      admin
    ])

    vaultTokenAccount = await createAccount(
      provider.connection,
      admin,
      mint,
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

  it('commit fails with wrong round', async () => {
    vault.fetcher.vaults.clear()
    const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
    const wrongRound = vaultAccount.currentRound + 999

    const merkleRoot = new Array(32).fill(7)
    const secretHash = new Array(32).fill(0)
    for (let i = 0; i < 32; i++) secretHash[i] = merkleRoot[i] ^ 8
    const vrfSeed = Buffer.from(
      merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
    )

    const ix = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round: wrongRound,
      rewardType: 0,
      tickets: 100n,
      merkleRoot,
      secretHash,
      mint,
      vaultFTokenAccount: vaultTokenAccount,
      vaultTokenAccount,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE }),
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState: networkStateAccountAddress(),
      request: randomnessAccountAddress(vrfSeed)
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        vrfAuthority
      ])
      assert.fail('Should have thrown InvalidRound')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('InvalidRound')) ?? true)
    }
  })

  it('commit fails before sync_rate', async () => {
    const unsyncedMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      DECIMALS
    )
    vault.fetcher.state = null
    const stateAcc = await vault.fetcher.getState()
    const unsyncedIndex = stateAcc.lastVault
    const vaultPda = vault.fetcher.getVaultAddress(unsyncedIndex)[0]
    const pMint = await createMint(
      provider.connection,
      admin,
      vaultPda,
      null,
      DECIMALS
    )

    const initVaultIx = await vault.initializeVaultIx({
      admin: admin.publicKey,
      mint: unsyncedMint,
      minDeposit: 0n,
      lending: DUMMY_WRITABLE,
      pMint,
      withdrawFee: 0n
    })
    await signAndSend(provider.connection, new Transaction().add(initVaultIx), [
      admin
    ])

    const [unsyncedPda] = vault.fetcher.getVaultAddress(unsyncedIndex)
    const unsyncedVaultToken = await createAccount(
      provider.connection,
      admin,
      unsyncedMint,
      unsyncedPda,
      Keypair.generate()
    )

    const merkleRoot = new Array(32).fill(9)
    const secretHash = new Array(32).fill(0)
    for (let i = 0; i < 32; i++) secretHash[i] = merkleRoot[i] ^ 10
    const vrfSeed = Buffer.from(
      merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
    )

    const ix = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex: unsyncedIndex,
      round: 0,
      rewardType: 0,
      tickets: 100n,
      merkleRoot,
      secretHash,
      mint: unsyncedMint,
      vaultFTokenAccount: unsyncedVaultToken,
      vaultTokenAccount: unsyncedVaultToken,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE }),
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState: networkStateAccountAddress(),
      request: randomnessAccountAddress(vrfSeed)
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        vrfAuthority
      ])
      assert.fail('Should have thrown NotSynced')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('NotSynced')) ?? true)
    }
  })

  it('commit fails with invalid reward_type', async () => {
    vault.fetcher.vaults.clear()
    const round = (await vault.fetcher.getVaultByIndex(vaultIndex)).currentRound

    const merkleRoot = new Array(32).fill(11)
    const secretHash = new Array(32).fill(0)
    for (let i = 0; i < 32; i++) secretHash[i] = merkleRoot[i] ^ 12
    const vrfSeed = Buffer.from(
      merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
    )

    const ix = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      rewardType: 3,
      tickets: 100n,
      merkleRoot,
      secretHash,
      mint,
      vaultFTokenAccount: vaultTokenAccount,
      vaultTokenAccount,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE }),
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState: networkStateAccountAddress(),
      request: randomnessAccountAddress(vrfSeed)
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        vrfAuthority
      ])
      assert.fail('Should have thrown InvalidRewardType')
    } catch (e: any) {
      assert.ok(
        e.logs?.some((l: string) => l.includes('InvalidRewardType')) ?? true
      )
    }
  })

  it('commit fails for non-vrf-authority', async () => {
    vault.fetcher.vaults.clear()
    const round = (await vault.fetcher.getVaultByIndex(vaultIndex)).currentRound

    const nonAuth = Keypair.generate()
    await airdrop(provider.connection, nonAuth.publicKey, LAMPORTS_PER_SOL)

    const merkleRoot = new Array(32).fill(13)
    const secretHash = new Array(32).fill(0)
    for (let i = 0; i < 32; i++) secretHash[i] = merkleRoot[i] ^ 14
    const vrfSeed = Buffer.from(
      merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
    )

    const ix = await vault.commitIx({
      vrfAuthority: nonAuth.publicKey,
      vaultIndex,
      round,
      rewardType: 0,
      tickets: 100n,
      merkleRoot,
      secretHash,
      mint,
      vaultFTokenAccount: vaultTokenAccount,
      vaultTokenAccount,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE }),
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState: networkStateAccountAddress(),
      request: randomnessAccountAddress(vrfSeed)
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
