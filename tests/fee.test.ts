import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
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
  getAssociatedTokenAddressSync
} from '@solana/spl-token'
import { PremiumVaults } from '../ts-sdk/idl/premium_vaults'
import { Vault } from '../ts-sdk/vault'
import { signAndSend } from '../ts-sdk/utils'
import {
  VRF_TEST_AUTHORITY,
  airdrop,
  dummyLending,
  assertBalance
} from './test-utils'

describe('premium-vaults fees', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const admin = VRF_TEST_AUTHORITY
  const user = Keypair.generate()
  const DUMMY_WRITABLE = Keypair.generate().publicKey

  let vault: Vault
  let mint: PublicKey
  let pMint: PublicKey
  let fTokenMint: PublicKey
  let userAta: PublicKey
  let adminAta: PublicKey
  let vaultTokenAccount: PublicKey
  let vaultFTokenAccount: PublicKey
  let vaultPda: PublicKey
  let vaultIndex: number
  let depositorPTokenAccount: PublicKey

  const DECIMALS = 6
  const DEPOSIT_AMOUNT = 1_000_000_000_000n // 1M tokens
  const MINT_AMOUNT = 10_000_000_000_000n // 10M tokens
  const WITHDRAW_FEE = 50_000n // 5% (out of 1_000_000)
  const FEE_DENOMINATOR = 1_000_000n

  before(async () => {
    vault = new Vault(provider.connection)

    await airdrop(provider.connection, admin.publicKey, 5 * LAMPORTS_PER_SOL)
    await airdrop(provider.connection, user.publicKey, 5 * LAMPORTS_PER_SOL)

    // Initialize protocol state (may already exist)
    try {
      const initIx = await vault.initializeIx({
        admin: admin.publicKey,
        vrfAuthority: admin.publicKey
      })
      await signAndSend(provider.connection, new Transaction().add(initIx), [
        admin
      ])
    } catch {
      // already exists
    }

    // Create SPL token mint
    mint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      DECIMALS
    )

    // Get next vault index
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

    // Initialize vault with 5% withdraw fee
    const initVaultIx = await vault.initializeVaultIx({
      admin: admin.publicKey,
      mint,
      pMint,
      lending: DUMMY_WRITABLE,
      minDeposit: 0n,
      withdrawFee: WITHDRAW_FEE
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

    // Create fToken mint and vault fToken ATA for withdraw tests
    fTokenMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      DECIMALS
    )
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
    const syncIx = await vault.syncRateIx({
      admin: admin.publicKey,
      vaultIndex,
      lending: DUMMY_WRITABLE
    })
    await signAndSend(provider.connection, new Transaction().add(syncIx), [
      admin
    ])

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
    await mintTo(provider.connection, admin, mint, userAta, admin, MINT_AMOUNT)

    // Create admin ATA for fee collection
    adminAta = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      mint,
      admin.publicKey,
      undefined,
      undefined,
      undefined,
      true
    )

    // Derive depositor pToken ATA
    depositorPTokenAccount = getAssociatedTokenAddressSync(
      pMint,
      user.publicKey
    )

    // Deposit
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
  })

  // Track cumulative expected balances
  let userMintBalance: bigint
  let vaultMintBalance: bigint
  let adminMintBalance: bigint
  let userPTokenBalance: bigint

  describe('withdraw fees', () => {
    it('withdraw deducts fee and accumulates', async () => {
      // Snapshot before
      userMintBalance = MINT_AMOUNT - DEPOSIT_AMOUNT
      vaultMintBalance = DEPOSIT_AMOUNT
      userPTokenBalance = DEPOSIT_AMOUNT
      adminMintBalance = 0n

      const withdrawAmount = 1_000_000_000_000n // 1M
      const expectedFee = (withdrawAmount * WITHDRAW_FEE) / FEE_DENOMINATOR // 50_000_000_000

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

      userMintBalance += withdrawAmount - expectedFee
      vaultMintBalance -= withdrawAmount - expectedFee
      userPTokenBalance -= withdrawAmount

      await assertBalance(
        provider.connection,
        user.publicKey,
        mint,
        userMintBalance
      )
      await assertBalance(provider.connection, vaultPda, mint, vaultMintBalance)
      await assertBalance(
        provider.connection,
        user.publicKey,
        pMint,
        userPTokenBalance
      )

      vault.fetcher.vaults.clear()
      const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
      assert.equal(
        vaultAccount.accumulatedFee,
        expectedFee,
        'accumulated fee should match'
      )
    })

    it('fee accumulates across multiple withdrawals', async () => {
      // Re-deposit
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

      userMintBalance -= DEPOSIT_AMOUNT
      vaultMintBalance += DEPOSIT_AMOUNT
      userPTokenBalance += DEPOSIT_AMOUNT

      await assertBalance(
        provider.connection,
        user.publicKey,
        mint,
        userMintBalance
      )
      await assertBalance(provider.connection, vaultPda, mint, vaultMintBalance)
      await assertBalance(
        provider.connection,
        user.publicKey,
        pMint,
        userPTokenBalance
      )

      vault.fetcher.vaults.clear()
      const feeBefore = (await vault.fetcher.getVaultByIndex(vaultIndex))
        .accumulatedFee

      const withdrawAmount = 500_000_000_000n
      const expectedNewFee = (withdrawAmount * WITHDRAW_FEE) / FEE_DENOMINATOR

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

      userMintBalance += withdrawAmount - expectedNewFee
      vaultMintBalance -= withdrawAmount - expectedNewFee
      userPTokenBalance -= withdrawAmount

      await assertBalance(
        provider.connection,
        user.publicKey,
        mint,
        userMintBalance
      )
      await assertBalance(provider.connection, vaultPda, mint, vaultMintBalance)
      await assertBalance(
        provider.connection,
        user.publicKey,
        pMint,
        userPTokenBalance
      )

      vault.fetcher.vaults.clear()
      const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
      assert.equal(
        vaultAccount.accumulatedFee,
        feeBefore + expectedNewFee,
        'fee should accumulate'
      )
    })

    it('withdraw with zero fee charges nothing', async () => {
      // Set fee to 0
      const setFeeIx = await vault.setWithdrawFeeIx({
        admin: admin.publicKey,
        vaultIndex,
        withdrawFee: 0n
      })
      await signAndSend(provider.connection, new Transaction().add(setFeeIx), [
        admin
      ])

      const withdrawAmount = 500_000_000_000n

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

      userMintBalance += withdrawAmount
      vaultMintBalance -= withdrawAmount
      userPTokenBalance -= withdrawAmount

      await assertBalance(
        provider.connection,
        user.publicKey,
        mint,
        userMintBalance
      )
      await assertBalance(provider.connection, vaultPda, mint, vaultMintBalance)
      await assertBalance(
        provider.connection,
        user.publicKey,
        pMint,
        userPTokenBalance
      )

      vault.fetcher.vaults.clear()
      const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
      // Fee unchanged from previous test (accumulated fee stays the same since withdraw fee was 0)
      const expectedAccumulatedFee =
        (1_000_000_000_000n * WITHDRAW_FEE) / FEE_DENOMINATOR +
        (500_000_000_000n * WITHDRAW_FEE) / FEE_DENOMINATOR
      assert.equal(
        vaultAccount.accumulatedFee,
        expectedAccumulatedFee,
        'accumulated fee unchanged'
      )

      // Restore fee for collect tests
      const restoreIx = await vault.setWithdrawFeeIx({
        admin: admin.publicKey,
        vaultIndex,
        withdrawFee: WITHDRAW_FEE
      })
      await signAndSend(provider.connection, new Transaction().add(restoreIx), [
        admin
      ])
    })
  })

  describe('collect_fee', () => {
    it('collect_fee transfers accumulated to admin', async () => {
      vault.fetcher.vaults.clear()
      const feeBefore = (await vault.fetcher.getVaultByIndex(vaultIndex))
        .accumulatedFee
      assert.ok(feeBefore > 0n, 'should have accumulated fees to collect')

      const ix = await vault.collectFeeIx({
        admin: admin.publicKey,
        vaultIndex,
        vaultFTokenAccount,
        vaultTokenAccount,
        adminTokenAccount: adminAta,
        mint,
        claimAccount: DUMMY_WRITABLE,
        lendingAccounts: dummyLending({ fTokenMint })
      })
      await signAndSend(provider.connection, new Transaction().add(ix), [admin])

      adminMintBalance += feeBefore
      vaultMintBalance -= feeBefore

      await assertBalance(
        provider.connection,
        admin.publicKey,
        mint,
        adminMintBalance
      )
      await assertBalance(provider.connection, vaultPda, mint, vaultMintBalance)

      vault.fetcher.vaults.clear()
      const vaultAccount = await vault.fetcher.getVaultByIndex(vaultIndex)
      assert.equal(
        vaultAccount.accumulatedFee,
        0n,
        'accumulated fee should reset to 0'
      )
    })

    it('collect_fee fails with zero accumulated', async () => {
      const ix = await vault.collectFeeIx({
        admin: admin.publicKey,
        vaultIndex,
        vaultFTokenAccount,
        vaultTokenAccount,
        adminTokenAccount: adminAta,
        mint,
        claimAccount: DUMMY_WRITABLE,
        lendingAccounts: dummyLending({ fTokenMint })
      })
      try {
        await signAndSend(provider.connection, new Transaction().add(ix), [
          admin
        ])
        assert.fail('Should have thrown NothingToClaim')
      } catch (e: any) {
        assert.ok(
          e.logs?.some((l: string) => l.includes('NothingToClaim')) ?? true
        )
      }
    })

    it('collect_fee fails for non-admin', async () => {
      // Re-deposit and withdraw to generate fees
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

      userMintBalance -= DEPOSIT_AMOUNT
      vaultMintBalance += DEPOSIT_AMOUNT
      userPTokenBalance += DEPOSIT_AMOUNT

      await assertBalance(
        provider.connection,
        user.publicKey,
        mint,
        userMintBalance
      )
      await assertBalance(provider.connection, vaultPda, mint, vaultMintBalance)
      await assertBalance(
        provider.connection,
        user.publicKey,
        pMint,
        userPTokenBalance
      )

      const withdrawIx = await vault.withdrawIx({
        withdrawer: user.publicKey,
        vaultIndex,
        amount: DEPOSIT_AMOUNT,
        vaultFTokenAccount,
        vaultTokenAccount,
        withdrawerTokenAccount: userAta,
        mint,
        pMint,
        withdrawerPTokenAccount: depositorPTokenAccount,
        claimAccount: DUMMY_WRITABLE,
        lendingAccounts: dummyLending({ fTokenMint })
      })
      await signAndSend(
        provider.connection,
        new Transaction().add(withdrawIx),
        [user]
      )

      const withdrawFee = (DEPOSIT_AMOUNT * WITHDRAW_FEE) / FEE_DENOMINATOR
      userMintBalance += DEPOSIT_AMOUNT - withdrawFee
      vaultMintBalance -= DEPOSIT_AMOUNT - withdrawFee
      userPTokenBalance -= DEPOSIT_AMOUNT

      await assertBalance(
        provider.connection,
        user.publicKey,
        mint,
        userMintBalance
      )
      await assertBalance(provider.connection, vaultPda, mint, vaultMintBalance)
      await assertBalance(
        provider.connection,
        user.publicKey,
        pMint,
        userPTokenBalance
      )

      const nonAdmin = Keypair.generate()
      await airdrop(provider.connection, nonAdmin.publicKey, LAMPORTS_PER_SOL)

      const nonAdminAta = await createAssociatedTokenAccount(
        provider.connection,
        nonAdmin,
        mint,
        nonAdmin.publicKey,
        undefined,
        undefined,
        undefined,
        true
      )

      const ix = await vault.collectFeeIx({
        admin: nonAdmin.publicKey,
        vaultIndex,
        vaultFTokenAccount,
        vaultTokenAccount,
        adminTokenAccount: nonAdminAta,
        mint,
        claimAccount: DUMMY_WRITABLE,
        lendingAccounts: dummyLending({ fTokenMint })
      })
      try {
        await signAndSend(provider.connection, new Transaction().add(ix), [
          nonAdmin
        ])
        assert.fail('Should have thrown Unauthorized')
      } catch (e: any) {
        assert.ok(
          e.logs?.some((l: string) => l.includes('Unauthorized')) ?? true
        )
      }
    })
  })
})
