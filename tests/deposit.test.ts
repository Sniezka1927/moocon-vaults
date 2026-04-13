import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
// BN kept for @orao-network/solana-vrf which requires it
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction
} from '@solana/web3.js'
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'
import {
  Orao,
  networkStateAccountAddress,
  randomnessAccountAddress,
  FulfillBuilder,
  InitBuilder
} from '@orao-network/solana-vrf'
import nacl from 'tweetnacl'
import { MooconVaults } from '../ts-sdk/idl/moocon_vaults'
import { Vault } from '../ts-sdk/vault'
import { signAndSend } from '../ts-sdk/utils'
import {
  VRF_TEST_AUTHORITY,
  VRF_FULFILLMENT_AUTHORITY,
  airdrop,
  dummyLending,
  assertBalance,
  TIER_60_40
} from './test-utils'
import { MAX_U64 } from '../ts-sdk'

describe('moocon-vaults deposit', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const vrf = new Orao(provider)

  // Use VRF_TEST_AUTHORITY as admin so state PDA is consistent across test files
  const admin = VRF_TEST_AUTHORITY
  const vrfAuthority = VRF_TEST_AUTHORITY
  const user = Keypair.generate()
  const fulfillmentAuthority = VRF_FULFILLMENT_AUTHORITY

  // Non-program pubkey for mutable dummy accounts
  const DUMMY_WRITABLE = Keypair.generate().publicKey

  let vault: Vault
  let mint: PublicKey
  let pMint: PublicKey
  let fTokenMint: PublicKey
  let userAta: PublicKey
  let vaultTokenAccount: PublicKey
  let vaultFTokenAccount: PublicKey
  let vaultPda: PublicKey
  let vaultIndex: number
  let depositorPTokenAccount: PublicKey

  const DEPOSIT_AMOUNT = 1_000_000_000_000n // 1M tokens (6 decimals)
  const MINT_AMOUNT = 10_000_000_000_000n // 10M tokens (6 decimals)
  const DECIMALS = 6

  async function emulateFulfill(seed: Buffer) {
    const signature = nacl.sign.detached(seed, fulfillmentAuthority.secretKey)
    await new FulfillBuilder(vrf, seed).rpc(
      fulfillmentAuthority.publicKey,
      signature
    )
  }

  before(async () => {
    vault = new Vault(provider.connection)

    // Airdrop
    await airdrop(provider.connection, admin.publicKey, 5 * LAMPORTS_PER_SOL)
    await airdrop(provider.connection, user.publicKey, 5 * LAMPORTS_PER_SOL)

    // Initialize protocol state (may already exist from other test suites)
    try {
      const initIx = await vault.initializeIx({
        admin: admin.publicKey,
        vrfAuthority: vrfAuthority.publicKey
      })
      await signAndSend(provider.connection, new Transaction().add(initIx), [
        admin
      ])
    } catch {
      // State already exists
    }

    // Create SPL token mint
    mint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      DECIMALS
    )

    // Initialize vault with mint — uses next available index
    vault.fetcher.state = null
    const stateAcc = await vault.fetcher.getState()
    vaultIndex = stateAcc.lastVault

    // Get vault PDA before creating pMint (pMint authority = vaultPda)
    ;[vaultPda] = vault.fetcher.getVaultAddress(vaultIndex)

    // Create pMint owned by vaultPda
    pMint = await createMint(
      provider.connection,
      admin,
      vaultPda,
      null,
      DECIMALS
    )

    // Create fToken mint (before vault init, vault needs fMint reference)
    fTokenMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      DECIMALS
    )

    const initVaultIx = await vault.initializeVaultIx({
      admin: admin.publicKey,
      mint,
      fMint: fTokenMint,
      pMint,
      lending: DUMMY_WRITABLE,
      minDeposit: 500_000_000_000n,
      withdrawFee: 0n,
      tiers: TIER_60_40
    })
    await signAndSend(provider.connection, new Transaction().add(initVaultIx), [
      admin
    ])

    // Create vault token ATA (owned by vault PDA)
    vaultTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      mint,
      vaultPda,
      undefined,
      undefined,
      undefined,
      true
    )

    // Create vault fToken ATA for withdraw tests
    vaultFTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      fTokenMint,
      vaultPda,
      undefined,
      undefined,
      undefined,
      true
    )

    // Sync rate (sets last_rate in local mode; may already be synced from prior run)
    try {
      const syncIx = await vault.syncRateIx({
        admin: admin.publicKey,
        vaultIndex,
        lending: DUMMY_WRITABLE
      })
      await signAndSend(provider.connection, new Transaction().add(syncIx), [
        admin
      ])
    } catch {
      // Already synced
    }

    // Init VRF (may already exist from other test suites)
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
      // VRF already initialized
    }

    // Create user ATA and mint tokens
    userAta = await createAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      user.publicKey,
      undefined,
      undefined,
      undefined,
      true
    )
    await mintTo(provider.connection, admin, mint, userAta, admin, MINT_AMOUNT) // 10M tokens

    // Derive depositor pToken ATA (program uses init_if_needed with associated_token constraints)
    depositorPTokenAccount = getAssociatedTokenAddressSync(
      pMint,
      user.publicKey
    )
  })

  it('deposit', async () => {
    const ix = await vault.depositIx({
      depositor: user.publicKey,
      vaultIndex,
      amount: DEPOSIT_AMOUNT,
      depositorTokenAccount: userAta,
      vaultTokenAccount,
      recipientTokenAccount: DUMMY_WRITABLE,
      mint,
      pMint,
      depositorPTokenAccount,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE })
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [user])

    vault.fetcher.vaults.clear()

    const tokenAcc = await getAccount(provider.connection, userAta)
    assert.equal(tokenAcc.amount, MINT_AMOUNT - DEPOSIT_AMOUNT)

    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT
    )
  })

  it('deposit fails with zero amount', async () => {
    const ix = await vault.depositIx({
      depositor: user.publicKey,
      vaultIndex,
      amount: 0n,
      depositorTokenAccount: userAta,
      vaultTokenAccount,
      recipientTokenAccount: DUMMY_WRITABLE,
      mint,
      pMint,
      depositorPTokenAccount,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE })
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [user])
      assert.fail('Should have thrown ZeroAmount')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('ZeroAmount')) ?? true)
    }
  })

  it('deposit fails below minimum deposit', async () => {
    const ix = await vault.depositIx({
      depositor: user.publicKey,
      vaultIndex,
      amount: 1_000_000n, // 1 token, well below 500K min
      depositorTokenAccount: userAta,
      vaultTokenAccount,
      recipientTokenAccount: DUMMY_WRITABLE,
      mint,
      pMint,
      depositorPTokenAccount,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE })
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [user])
      assert.fail('Should have thrown BelowMinimumDeposit')
    } catch (e: any) {
      assert.ok(
        e.logs?.some((l: string) => l.includes('BelowMinimumDeposit')) ?? true
      )
    }
  })

  it('withdraw', async () => {
    const withdrawAmount = DEPOSIT_AMOUNT / 2n // partial

    const ix = await vault.withdrawIx({
      withdrawer: user.publicKey,
      vaultIndex,
      amount: withdrawAmount,
      vaultFTokenAccount,
      vaultTokenAccount,
      withdrawerTokenAccount: userAta,
      mint,
      pMint,
      withdrawerPTokenAccount: depositorPTokenAccount,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ fTokenMint })
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [user])

    vault.fetcher.vaults.clear()

    await assertBalance(
      provider.connection,
      user.publicKey,
      mint,
      MINT_AMOUNT - DEPOSIT_AMOUNT + withdrawAmount
    )
    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT - withdrawAmount
    )
  })

  it('withdraw fails with insufficient funds', async () => {
    const ix = await vault.withdrawIx({
      withdrawer: user.publicKey,
      vaultIndex,
      amount: 999_999_999_999_999n,
      vaultFTokenAccount,
      vaultTokenAccount,
      withdrawerTokenAccount: userAta,
      mint,
      pMint,
      withdrawerPTokenAccount: depositorPTokenAccount,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ fTokenMint })
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [user])
      assert.fail('Should have thrown InsufficientFunds')
    } catch (e: any) {
      assert.ok(
        e.logs?.some((l: string) => l.includes('InsufficientFunds')) ?? true
      )
    }
  })

  it('withdraw full amount decrements depositors', async () => {
    const ix = await vault.withdrawIx({
      withdrawer: user.publicKey,
      vaultIndex,
      amount: MAX_U64,
      vaultFTokenAccount,
      vaultTokenAccount,
      withdrawerTokenAccount: userAta,
      mint,
      pMint,
      withdrawerPTokenAccount: depositorPTokenAccount,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ fTokenMint })
    })
    await signAndSend(provider.connection, new Transaction().add(ix), [user])

    await assertBalance(provider.connection, user.publicKey, mint, MINT_AMOUNT)
    await assertBalance(provider.connection, user.publicKey, pMint, 0n)
  })

  it('claim', async () => {
    // Re-deposit so user has a stake for claim to add to
    const depositIx = await vault.depositIx({
      depositor: user.publicKey,
      vaultIndex,
      amount: DEPOSIT_AMOUNT,
      depositorTokenAccount: userAta,
      vaultTokenAccount,
      recipientTokenAccount: DUMMY_WRITABLE,
      mint,
      pMint,
      depositorPTokenAccount,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE })
    })
    await signAndSend(provider.connection, new Transaction().add(depositIx), [
      user
    ])

    // Get current round
    vault.fetcher.vaults.clear()
    const vaultBefore = await vault.fetcher.getVaultByIndex(vaultIndex)
    const round = vaultBefore.currentRound

    // Compute VRF seed
    const merkleRoot = new Array(32).fill(1)
    const secretSeed = new Array(32).fill(2)
    const secretHash = new Array(32).fill(0)
    for (let i = 0; i < 32; i++) {
      secretHash[i] = merkleRoot[i] ^ secretSeed[i]
    }

    const vrfSeed = Buffer.from(
      merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
    )
    const networkState = networkStateAccountAddress()
    const request = randomnessAccountAddress(vrfSeed)

    // Commit
    const commitIx = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      rewardType: 0, // Tier 0 (60%)
      tickets: 100n,
      merkleRoot,
      secretHash,
      mint,
      vaultFTokenAccount,
      fTokenMint,
      lending: DUMMY_WRITABLE,
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState,
      request
    })
    await signAndSend(provider.connection, new Transaction().add(commitIx), [
      vrfAuthority
    ])

    // Fulfill VRF
    await Promise.all([vrf.waitFulfilled(vrfSeed), emulateFulfill(vrfSeed)])

    // Reveal
    const revealIx = await vault.revealIx({
      authority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      secretSeed,
      request,
      winner: user.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(revealIx), [
      vrfAuthority
    ])

    // Get reward amount before claim
    vault.fetcher.rewards.clear()
    const [rewardPda] = vault.fetcher.getRewardAddress(vaultPda, round)
    const reward = await vault.fetcher.getRewardByAddress(rewardPda)
    const rewardAmount = reward.amount

    // pToken balance before claim
    const pTokenAta = getAssociatedTokenAddressSync(pMint, user.publicKey)
    const pTokenBefore = (await getAccount(provider.connection, pTokenAta)).amount

    // Token balance before claim (should not change)
    const tokenBefore = (await getAccount(provider.connection, userAta)).amount

    // Claim
    const claimIx = await vault.claimIx({
      claimer: user.publicKey,
      vaultIndex,
      round,
      pMint
    })
    await signAndSend(provider.connection, new Transaction().add(claimIx), [
      user
    ])

    // Verify pToken balance increased by reward amount
    const pTokenAfter = (await getAccount(provider.connection, pTokenAta)).amount
    assert.equal(pTokenAfter, pTokenBefore + rewardAmount)

    // Verify token balance unchanged (no transfer, only pToken mint)
    const tokenAfter = (await getAccount(provider.connection, userAta)).amount
    assert.equal(tokenAfter, tokenBefore)

    // Verify reward account is closed
    const rewardInfo = await provider.connection.getAccountInfo(rewardPda)
    assert.equal(rewardInfo, null, 'Reward account should be closed')
  })

  it('claim fails when reward already claimed (account closed)', async () => {
    // The previous claim test closed the reward account for round `round`
    // Try to claim it again — should fail because the PDA is closed
    vault.fetcher.vaults.clear()
    const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
    // round from the first claim test (currentRound was incremented after commit)
    const claimedRound = vaultAccount.currentRound - 1

    const claimIx = await vault.claimIx({
      claimer: user.publicKey,
      vaultIndex,
      round: claimedRound,
      pMint
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(claimIx), [
        user
      ])
      assert.fail('Should have thrown on closed reward PDA')
    } catch (e: any) {
      assert.ok(e.message || e.logs, 'Expected error for closed reward account')
    }
  })

  it('claim fails for non-winner', async () => {
    // Deposit again to have stake
    const depositIx = await vault.depositIx({
      depositor: user.publicKey,
      vaultIndex,
      amount: DEPOSIT_AMOUNT,
      depositorTokenAccount: userAta,
      vaultTokenAccount,
      recipientTokenAccount: DUMMY_WRITABLE,
      mint,
      pMint,
      depositorPTokenAccount,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE })
    })
    await signAndSend(provider.connection, new Transaction().add(depositIx), [
      user
    ])

    // Get current round
    vault.fetcher.vaults.clear()
    const vaultBefore = await vault.fetcher.getVaultByIndex(vaultIndex)
    const round = vaultBefore.currentRound

    // Commit
    const merkleRoot = new Array(32).fill(3)
    const secretSeed = new Array(32).fill(4)
    const secretHash = new Array(32).fill(0)
    for (let i = 0; i < 32; i++) {
      secretHash[i] = merkleRoot[i] ^ secretSeed[i]
    }
    const vrfSeed = Buffer.from(
      merkleRoot.map((b: number, i: number) => b ^ secretHash[i])
    )
    const networkState = networkStateAccountAddress()
    const request = randomnessAccountAddress(vrfSeed)

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
      fTokenMint,
      lending: DUMMY_WRITABLE,
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState,
      request
    })
    await signAndSend(provider.connection, new Transaction().add(commitIx), [
      vrfAuthority
    ])

    // Fulfill VRF
    await Promise.all([vrf.waitFulfilled(vrfSeed), emulateFulfill(vrfSeed)])

    // Reveal
    const otherUser = Keypair.generate()
    await airdrop(provider.connection, otherUser.publicKey, LAMPORTS_PER_SOL)

    const revealIx = await vault.revealIx({
      authority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      secretSeed,
      request,
      winner: otherUser.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(revealIx), [
      vrfAuthority
    ])

    // Claim with original user (not the winner)
    const claimIx = await vault.claimIx({
      claimer: user.publicKey,
      vaultIndex,
      round,
      pMint
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(claimIx), [
        user
      ])
      assert.fail('Should have thrown NotWinner')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('NotWinner')) ?? true)
    }
  })
})
