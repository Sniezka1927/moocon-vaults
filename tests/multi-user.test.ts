import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import { BN } from '@coral-xyz/anchor'
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
import { Vault } from '../ts-sdk/vault'
import { signAndSend } from '../ts-sdk/utils'
import {
  VRF_TEST_AUTHORITY,
  VRF_FULFILLMENT_AUTHORITY,
  airdrop,
  dummyLending,
  assertBalance
} from './test-utils'
import { MAX_U64 } from '../ts-sdk'

describe('premium-vaults multi-user', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const vrf = new Orao(provider)

  const admin = VRF_TEST_AUTHORITY
  const vrfAuthority = VRF_TEST_AUTHORITY
  const fulfillmentAuthority = VRF_FULFILLMENT_AUTHORITY

  const DUMMY_WRITABLE = Keypair.generate().publicKey
  const DECIMALS = 6

  const userA = Keypair.generate()
  const userB = Keypair.generate()
  const userC = Keypair.generate()

  const MINT_AMOUNT = 10_000_000_000_000n // 10M tokens
  const DEPOSIT_A = 1_000_000_000_000n // 1M tokens
  const DEPOSIT_B = 2_000_000_000_000n // 2M tokens
  const DEPOSIT_C = 3_000_000_000_000n // 3M tokens
  const MIN_DEPOSIT = 0n
  const TOTAL = DEPOSIT_A + DEPOSIT_B + DEPOSIT_C

  let vault: Vault
  let mint: PublicKey
  let fTokenMint: PublicKey
  let vaultTokenAccount: PublicKey
  let vaultFTokenAccount: PublicKey
  let vaultPda: PublicKey
  let vaultIndex: number
  let pMint: PublicKey

  let ataA: PublicKey
  let ataB: PublicKey
  let ataC: PublicKey

  let depositorPTokenAccountA: PublicKey
  let depositorPTokenAccountB: PublicKey
  let depositorPTokenAccountC: PublicKey

  async function emulateFulfill(seed: Buffer) {
    const signature = nacl.sign.detached(seed, fulfillmentAuthority.secretKey)
    await new FulfillBuilder(vrf, seed).rpc(
      fulfillmentAuthority.publicKey,
      signature
    )
  }

  before(async () => {
    vault = new Vault(provider.connection)

    // Airdrop to admin and all users
    await Promise.all([
      airdrop(provider.connection, admin.publicKey, 5 * LAMPORTS_PER_SOL),
      airdrop(provider.connection, userA.publicKey, 5 * LAMPORTS_PER_SOL),
      airdrop(provider.connection, userB.publicKey, 5 * LAMPORTS_PER_SOL),
      airdrop(provider.connection, userC.publicKey, 5 * LAMPORTS_PER_SOL)
    ])

    // Initialize protocol state
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

    // Initialize vault
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

    // Create fToken mint (before vault init)
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
      lending: DUMMY_WRITABLE,
      minDeposit: MIN_DEPOSIT,
      pMint,
      withdrawFee: 0n
    })
    await signAndSend(provider.connection, new Transaction().add(initVaultIx), [
      admin
    ])

    // Create vault token ATA
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

    // Create vault fToken ATA
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

    // Sync rate
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

    // Init VRF
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

    // Create user ATAs and mint tokens
    ataA = await createAssociatedTokenAccount(
      provider.connection,
      userA,
      mint,
      userA.publicKey,
      undefined,
      undefined,
      undefined,
      true
    )
    ataB = await createAssociatedTokenAccount(
      provider.connection,
      userB,
      mint,
      userB.publicKey,
      undefined,
      undefined,
      undefined,
      true
    )
    ataC = await createAssociatedTokenAccount(
      provider.connection,
      userC,
      mint,
      userC.publicKey,
      undefined,
      undefined,
      undefined,
      true
    )

    await Promise.all([
      mintTo(provider.connection, admin, mint, ataA, admin, MINT_AMOUNT),
      mintTo(provider.connection, admin, mint, ataB, admin, MINT_AMOUNT),
      mintTo(provider.connection, admin, mint, ataC, admin, MINT_AMOUNT)
    ])

    depositorPTokenAccountA = getAssociatedTokenAddressSync(
      pMint,
      userA.publicKey
    )
    depositorPTokenAccountB = getAssociatedTokenAddressSync(
      pMint,
      userB.publicKey
    )
    depositorPTokenAccountC = getAssociatedTokenAddressSync(
      pMint,
      userC.publicKey
    )
  })

  it('all users deposit', async () => {
    const deposits: [Keypair, PublicKey, PublicKey, bigint, bigint][] = [
      [
        userA,
        ataA,
        depositorPTokenAccountA,
        DEPOSIT_A,
        MINT_AMOUNT - DEPOSIT_A
      ],
      [
        userB,
        ataB,
        depositorPTokenAccountB,
        DEPOSIT_B,
        MINT_AMOUNT - DEPOSIT_B
      ],
      [userC, ataC, depositorPTokenAccountC, DEPOSIT_C, MINT_AMOUNT - DEPOSIT_C]
    ]

    let runningVaultBalance = 0n

    for (const [
      user,
      ata,
      depositorPTokenAccount,
      amount,
      expectedUserMint
    ] of deposits) {
      const ix = await vault.depositIx({
        depositor: user.publicKey,
        vaultIndex,
        amount,
        depositorTokenAccount: ata,
        vaultTokenAccount,
        recipientTokenAccount: DUMMY_WRITABLE,
        mint,
        pMint,
        depositorPTokenAccount,
        lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE })
      })
      await signAndSend(provider.connection, new Transaction().add(ix), [user])

      runningVaultBalance += amount

      await assertBalance(
        provider.connection,
        user.publicKey,
        mint,
        expectedUserMint
      )
      await assertBalance(provider.connection, user.publicKey, pMint, amount)
      assert.equal(
        (await getAccount(provider.connection, vaultTokenAccount)).amount,
        runningVaultBalance
      )
    }
  })

  it('lottery round: commit, fulfill, reveal, setWinner', async () => {
    vault.fetcher.vaults.clear()
    const vaultBefore = await vault.fetcher.getVaultByIndex(vaultIndex)
    const round = vaultBefore.currentRound

    const vaultTokenBeforeCommit = (
      await getAccount(provider.connection, vaultTokenAccount)
    ).amount

    const merkleRoot = new Array(32).fill(10)
    const secretSeed = new Array(32).fill(20)
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

    assert.equal(
      (await getAccount(provider.connection, vaultTokenAccount)).amount,
      vaultTokenBeforeCommit
    )

    // Fulfill VRF
    await Promise.all([vrf.waitFulfilled(vrfSeed), emulateFulfill(vrfSeed)])

    // Reveal
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

    assert.equal(
      (await getAccount(provider.connection, vaultTokenAccount)).amount,
      vaultTokenBeforeCommit
    )

    // Set winner = userB
    const setWinnerIx = await vault.setWinnerIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      winner: userB.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(setWinnerIx), [
      vrfAuthority
    ])

    assert.equal(
      (await getAccount(provider.connection, vaultTokenAccount)).amount,
      vaultTokenBeforeCommit
    )
  })

  it('winner (userB) claims reward', async () => {
    vault.fetcher.vaults.clear()
    const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
    const round = vaultAccount.currentRound - 1

    // Get reward amount
    vault.fetcher.rewards.clear()
    const [rewardPda] = vault.fetcher.getRewardAddress(vaultPda, round)
    const reward = await vault.fetcher.getRewardByAddress(rewardPda)
    const rewardAmount = reward.amount

    const userBMintBefore = (await getAccount(provider.connection, ataB)).amount
    const userBPTokenBefore = (
      await getAccount(
        provider.connection,
        getAssociatedTokenAddressSync(pMint, userB.publicKey)
      )
    ).amount
    const vaultMintBefore = (
      await getAccount(provider.connection, vaultTokenAccount)
    ).amount

    // Claim
    const claimIx = await vault.claimIx({
      claimer: userB.publicKey,
      vaultIndex,
      round,
      pMint
    })
    await signAndSend(provider.connection, new Transaction().add(claimIx), [
      userB
    ])

    // pToken balance increased by reward amount
    assert.equal(
      (
        await getAccount(
          provider.connection,
          getAssociatedTokenAddressSync(pMint, userB.publicKey)
        )
      ).amount,
      userBPTokenBefore + rewardAmount
    )

    // Token balance unchanged (no transfer, only pToken mint)
    assert.equal(
      (await getAccount(provider.connection, ataB)).amount,
      userBMintBefore
    )

    // Vault token balance unchanged
    assert.equal(
      (await getAccount(provider.connection, vaultTokenAccount)).amount,
      vaultMintBefore
    )

    // Verify reward account closed
    const rewardInfo = await provider.connection.getAccountInfo(rewardPda)
    assert.equal(rewardInfo, null, 'Reward account should be closed')

    // Mint tokens to vault to cover the reward pTokens (in production this comes from lending yield)
    await mintTo(
      provider.connection,
      admin,
      mint,
      vaultTokenAccount,
      admin,
      rewardAmount
    )
  })

  it('all users withdraw full balance', async () => {
    // Get reward amount for assertions
    vault.fetcher.vaults.clear()
    const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
    const round = vaultAccount.currentRound - 1
    // Reward account is closed, but we know rewardAmount from the commit (local mode: 1000 rate delta)
    // UserB has DEPOSIT_B + rewardAmount pTokens, others have their deposit amounts

    const users: [Keypair, PublicKey, PublicKey][] = [
      [userA, ataA, depositorPTokenAccountA],
      [userB, ataB, depositorPTokenAccountB],
      [userC, ataC, depositorPTokenAccountC]
    ]

    let expectedVaultBalance = (
      await getAccount(provider.connection, vaultTokenAccount)
    ).amount

    for (const [user, ata, withdrawerPTokenAccount] of users) {
      const userMintBefore = (await getAccount(provider.connection, ata)).amount
      const userPTokenBefore = (
        await getAccount(provider.connection, withdrawerPTokenAccount)
      ).amount

      const ix = await vault.withdrawIx({
        withdrawer: user.publicKey,
        vaultIndex,
        amount: MAX_U64,
        vaultFTokenAccount,
        vaultTokenAccount,
        withdrawerTokenAccount: ata,
        mint,
        pMint,
        withdrawerPTokenAccount,
        claimAccount: DUMMY_WRITABLE,
        lendingAccounts: dummyLending({ fTokenMint })
      })
      await signAndSend(provider.connection, new Transaction().add(ix), [user])

      expectedVaultBalance -= userPTokenBefore

      // User gets back tokens equal to their pToken balance
      assert.equal(
        (await getAccount(provider.connection, ata)).amount,
        userMintBefore + userPTokenBefore
      )
      assert.equal(
        (await getAccount(provider.connection, withdrawerPTokenAccount)).amount,
        0n
      )
      assert.equal(
        (await getAccount(provider.connection, vaultTokenAccount)).amount,
        expectedVaultBalance
      )
    }

    await assertBalance(provider.connection, userA.publicKey, mint, MINT_AMOUNT)
    await assertBalance(provider.connection, userA.publicKey, pMint, 0n)

    await assertBalance(provider.connection, userB.publicKey, pMint, 0n)

    await assertBalance(provider.connection, userC.publicKey, mint, MINT_AMOUNT)
    await assertBalance(provider.connection, userC.publicKey, pMint, 0n)
  })
})
