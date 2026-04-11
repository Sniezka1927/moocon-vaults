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
  createAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  getAccount
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
  sleep,
  assertBalance
} from './test-utils'

describe('reward-lifecycle', () => {
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
  let userAta: PublicKey
  let vaultTokenAccount: PublicKey
  let vaultPda: PublicKey
  let vaultIndex: number
  let pMint: PublicKey
  const DECIMALS = 6
  const DEPOSIT_AMOUNT = 1_000_000_000_000n

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

    vault.fetcher.state = null
    const stateAcc = await vault.fetcher.getState()
    vaultIndex = stateAcc.lastVault
    ;[vaultPda] = vault.fetcher.getVaultAddress(vaultIndex)
    pMint = await createMint(provider.connection, admin, vaultPda, null, 6)

    const initVaultIx = await vault.initializeVaultIx({
      admin: admin.publicKey,
      mint,
      pMint,
      minDeposit: 0n,
      lending: DUMMY_WRITABLE,
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

    userAta = await createAccount(
      provider.connection,
      user,
      mint,
      user.publicKey,
      Keypair.generate()
    )
  })
  it('deposit', async () => {
    await mintTo(
      provider.connection,
      admin,
      mint,
      userAta,
      admin,
      DEPOSIT_AMOUNT
    ) // 10M tokens

    const depositorPTokenAccount = getAssociatedTokenAddressSync(
      pMint,
      user.publicKey
    )

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
    assert.equal(tokenAcc.amount, 0n)

    await assertBalance(
      provider.connection,
      user.publicKey,
      pMint,
      DEPOSIT_AMOUNT
    )
  })

  it('ROUND commit accumulates daily+weekly jackpots', async () => {
    vault.fetcher.vaults.clear()
    const vaultBefore = await vault.fetcher.getVaultByIndex(vaultIndex)
    const round = vaultBefore.currentRound

    const { merkleRoot, secretSeed, secretHash, vrfSeed } = makeVrfParams(20)
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
      vaultFTokenAccount: vaultTokenAccount,
      vaultTokenAccount,
      claimAccount: DUMMY_WRITABLE,
      lendingAccounts: dummyLending({ lending: DUMMY_WRITABLE }),
      treasury: (await vrf.getNetworkState()).config.treasury,
      networkState: networkStateAccountAddress(),
      request
    })
    await signAndSend(provider.connection, new Transaction().add(commitIx), [
      vrfAuthority
    ])

    vault.fetcher.vaults.clear()
    const vaultAfter = await vault.fetcher.getVaultByIndex(vaultIndex)
    assert.ok(
      vaultAfter.dailyJackpotAccumulated > 0n,
      'daily jackpot should accumulate'
    )
    assert.ok(
      vaultAfter.weeklyJackpotAccumulated > 0n,
      'weekly jackpot should accumulate'
    )
    assert.equal(vaultAfter.currentRound, round + 1)

    // Complete the round
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

    const setWinnerIx = await vault.setWinnerIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      winner: user.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(setWinnerIx), [
      vrfAuthority
    ])

    const claimIx = await vault.claimIx({
      claimer: user.publicKey,
      vaultIndex,
      claimerTokenAccount: userAta,
      mint,
      vaultTokenAccount,
      round
    })
    await signAndSend(provider.connection, new Transaction().add(claimIx), [
      user
    ])
  })

  it('DAILY commit includes accumulated jackpot and resets', async () => {
    vault.fetcher.vaults.clear()
    const vaultBefore = await vault.fetcher.getVaultByIndex(vaultIndex)
    const round = vaultBefore.currentRound
    const weeklyJackpotBefore = vaultBefore.weeklyJackpotAccumulated

    const { merkleRoot, secretHash, vrfSeed } = makeVrfParams(30)
    const request = randomnessAccountAddress(vrfSeed)

    const commitIx = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      rewardType: 1,
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
      request
    })
    await signAndSend(provider.connection, new Transaction().add(commitIx), [
      vrfAuthority
    ])

    // Check reward includes daily jackpot
    const [rewardPda] = vault.fetcher.getRewardAddress(vaultPda, round)
    vault.fetcher.rewards.clear()
    const reward = await vault.fetcher.getRewardByAddress(rewardPda)
    assert.ok(reward.amount > 0n, 'reward amount should include daily jackpot')

    vault.fetcher.vaults.clear()
    const vaultAfter = await vault.fetcher.getVaultByIndex(vaultIndex)
    assert.equal(
      vaultAfter.dailyJackpotAccumulated,
      0n,
      'daily jackpot should reset'
    )
    assert.ok(
      vaultAfter.weeklyJackpotAccumulated > weeklyJackpotBefore,
      'weekly jackpot should still grow'
    )

    // Complete the round
    const { secretSeed } = makeVrfParams(30)
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

    const setWinnerIx = await vault.setWinnerIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      winner: user.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(setWinnerIx), [
      vrfAuthority
    ])

    const claimIx = await vault.claimIx({
      claimer: user.publicKey,
      vaultIndex,
      claimerTokenAccount: userAta,
      mint,
      vaultTokenAccount,
      round
    })
    await signAndSend(provider.connection, new Transaction().add(claimIx), [
      user
    ])
  })

  it('WEEKLY commit includes accumulated jackpot and resets', async () => {
    vault.fetcher.vaults.clear()
    const vaultBefore = await vault.fetcher.getVaultByIndex(vaultIndex)
    const round = vaultBefore.currentRound
    const dailyJackpotBefore = vaultBefore.dailyJackpotAccumulated

    const { merkleRoot, secretHash, vrfSeed } = makeVrfParams(40)
    const request = randomnessAccountAddress(vrfSeed)

    const commitIx = await vault.commitIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      rewardType: 2,
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
      request
    })
    await signAndSend(provider.connection, new Transaction().add(commitIx), [
      vrfAuthority
    ])

    // Check reward includes weekly jackpot
    const [rewardPda] = vault.fetcher.getRewardAddress(vaultPda, round)
    vault.fetcher.rewards.clear()
    const reward = await vault.fetcher.getRewardByAddress(rewardPda)
    assert.ok(reward.amount > 0n, 'reward amount should include weekly jackpot')

    vault.fetcher.vaults.clear()
    const vaultAfter = await vault.fetcher.getVaultByIndex(vaultIndex)
    assert.equal(
      vaultAfter.weeklyJackpotAccumulated,
      0n,
      'weekly jackpot should reset'
    )
    assert.ok(
      vaultAfter.dailyJackpotAccumulated > dailyJackpotBefore,
      'daily jackpot should still grow'
    )

    // Complete the round
    const { secretSeed } = makeVrfParams(30)
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

    const setWinnerIx = await vault.setWinnerIx({
      vrfAuthority: vrfAuthority.publicKey,
      vaultIndex,
      round,
      winner: user.publicKey
    })
    await signAndSend(provider.connection, new Transaction().add(setWinnerIx), [
      vrfAuthority
    ])

    const claimIx = await vault.claimIx({
      claimer: user.publicKey,
      vaultIndex,
      claimerTokenAccount: userAta,
      mint,
      vaultTokenAccount,
      round
    })
    await signAndSend(provider.connection, new Transaction().add(claimIx), [
      user
    ])
  })
})
