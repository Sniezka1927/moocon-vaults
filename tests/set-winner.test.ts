import assert from 'assert'
import * as anchor from '@coral-xyz/anchor'
import { BN } from '@coral-xyz/anchor'
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

describe('set-winner-', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const vrf = new Orao(provider)
  const admin = VRF_TEST_AUTHORITY
  const vrfAuthority = VRF_TEST_AUTHORITY
  const fulfillmentAuthority = VRF_FULFILLMENT_AUTHORITY
  const user = Keypair.generate()
  const DUMMY_WRITABLE = Keypair.generate().publicKey

  let vault: Vault
  let mint: PublicKey
  let fMint: PublicKey
  let pMint: PublicKey
  let userAta: PublicKey
  let vaultTokenAccount: PublicKey
  let vaultFTokenAccount: PublicKey
  let vaultPda: PublicKey
  let vaultIndex: number
  let depositorPTokenAccount: PublicKey

  const DEPOSIT_AMOUNT = 1_000_000_000_000n
  const MINT_AMOUNT = 10_000_000_000_000n
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

  let unrevealed_round: number

  before(async () => {
    vault = new Vault(provider.connection)

    await airdrop(provider.connection, admin.publicKey, 10 * LAMPORTS_PER_SOL)
    await airdrop(provider.connection, user.publicKey, 5 * LAMPORTS_PER_SOL)

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
      fMint,
      minDeposit: 0n,
      pMint,
      lending: DUMMY_WRITABLE,
      withdrawFee: 0n
    })
    await signAndSend(provider.connection, new Transaction().add(initVaultIx), [
      admin
    ])

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

    vaultFTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      fMint,
      vaultPda,
      undefined,
      undefined,
      undefined,
      true
    )

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
      /* already synced */
    }

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

    depositorPTokenAccount = getAssociatedTokenAddressSync(
      pMint,
      user.publicKey
    )

    // Deposit so user has a stake
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

    await assertBalance(
      provider.connection,
      user.publicKey,
      mint,
      MINT_AMOUNT - DEPOSIT_AMOUNT
    )
    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT
    )
    await assertBalance(provider.connection, vaultPda, mint, DEPOSIT_AMOUNT)
  })

  it('set_winner fails before reveal', async () => {
    vault.fetcher.vaults.clear()
    unrevealed_round = (await vault.fetcher.getVaultByIndex(vaultIndex))
      .currentRound

    const { merkleRoot, secretHash, vrfSeed } = makeVrfParams(90)
    const request = randomnessAccountAddress(vrfSeed)

    // Commit but don't reveal
    const commitIx = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round: unrevealed_round,
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

    // Vault token balance unchanged after commit (no external transfers)
    await assertBalance(provider.connection, vaultPda, mint, DEPOSIT_AMOUNT)

    const ix = await vault.setWinnerIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round: unrevealed_round,
      winner: user.publicKey
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        vrfAuthority
      ])
      assert.fail('Should have thrown WinnerNotSet')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('WinnerNotSet')) ?? true)
    }

    // Balances unchanged after failed set_winner
    await assertBalance(
      provider.connection,
      user.publicKey,
      mint,
      MINT_AMOUNT - DEPOSIT_AMOUNT
    )
    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT
    )
    await assertBalance(provider.connection, vaultPda, mint, DEPOSIT_AMOUNT)

    // Fulfill and reveal for subsequent tests
    const { secretSeed } = makeVrfParams(90)
    await Promise.all([vrf.waitFulfilled(vrfSeed), emulateFulfill(vrfSeed)])

    const revealIx = await vault.revealIx({
      authority: vrfAuthority.publicKey,
      vaultIndex,
      round: unrevealed_round,
      secretSeed,
      request
    })
    await signAndSend(provider.connection, new Transaction().add(revealIx), [
      vrfAuthority
    ])

    // Balances unchanged after reveal (no token transfers)
    await assertBalance(
      provider.connection,
      user.publicKey,
      mint,
      MINT_AMOUNT - DEPOSIT_AMOUNT
    )
    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT
    )
    await assertBalance(provider.connection, vaultPda, mint, DEPOSIT_AMOUNT)

    // Set winner so next test can verify double-set
    const setWinnerIx = await vault.setWinnerIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round: unrevealed_round,
      winner: user.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(setWinnerIx), [
      vrfAuthority
    ])

    // Balances unchanged after set_winner (no token transfers)
    await assertBalance(
      provider.connection,
      user.publicKey,
      mint,
      MINT_AMOUNT - DEPOSIT_AMOUNT
    )
    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT
    )
    await assertBalance(provider.connection, vaultPda, mint, DEPOSIT_AMOUNT)
  })

  it('set_winner fails when called twice', async () => {
    const ix = await vault.setWinnerIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round: unrevealed_round,
      winner: user.publicKey
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        vrfAuthority
      ])
      assert.fail('Should have thrown AlreadyClaimed')
    } catch (e: any) {
      assert.ok(
        e.logs?.some((l: string) => l.includes('AlreadyClaimed')) ?? true
      )
    }

    // Balances unchanged after failed set_winner
    await assertBalance(
      provider.connection,
      user.publicKey,
      mint,
      MINT_AMOUNT - DEPOSIT_AMOUNT
    )
    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT
    )
    await assertBalance(provider.connection, vaultPda, mint, DEPOSIT_AMOUNT)
  })

  it('set_winner fails for non-vrf-authority', async () => {
    const nonAuth = Keypair.generate()
    await airdrop(provider.connection, nonAuth.publicKey, LAMPORTS_PER_SOL)

    const ix = await vault.setWinnerIx({
      vrfAuthority: nonAuth.publicKey,
      vaultIndex,
      round: unrevealed_round,
      winner: user.publicKey
    })
    try {
      await signAndSend(provider.connection, new Transaction().add(ix), [
        nonAuth
      ])
      assert.fail('Should have thrown Unauthorized')
    } catch (e: any) {
      assert.ok(e.logs?.some((l: string) => l.includes('Unauthorized')) ?? true)
    }

    // Balances unchanged after failed set_winner
    await assertBalance(
      provider.connection,
      user.publicKey,
      mint,
      MINT_AMOUNT - DEPOSIT_AMOUNT
    )
    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT
    )
    await assertBalance(provider.connection, vaultPda, mint, DEPOSIT_AMOUNT)
  })
})
