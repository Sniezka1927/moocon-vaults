import { Connection, SystemProgram } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'
import type { PremiumVaults } from './idl/premium_vaults'
import IDL from './idl/premium_vaults.json'
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor'
import { Fetcher } from './fetcher'
import type {
  IInitializeIx,
  ISetVrfAuthorityIx,
  IInitializeVaultIx,
  ISetWithdrawFeeIx,
  ISyncRateIx,
  ICommitIx,
  IRevealIx,
  ISetWinnerIx,
  IDepositIx,
  IWithdrawIx,
  IClaimIx,
  ICollectFeeIx
} from './types'
import { VRF_PROGRAM_ID } from './consts'

export class Vault {
  connection: Connection
  program: Program<PremiumVaults>
  fetcher: Fetcher

  constructor(connection: Connection) {
    this.connection = connection
    this.program = new Program<PremiumVaults>(
      IDL,
      new AnchorProvider(connection, {} as any)
    )
    this.fetcher = new Fetcher(this.program)
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async initializeIx(params: IInitializeIx) {
    const { admin, vrfAuthority } = params
    const [state] = this.fetcher.getStateAddress()

    return await this.program.methods
      .initialize(vrfAuthority)
      .accountsStrict({
        admin,
        state,
        systemProgram: SystemProgram.programId
      })
      .instruction()
  }

  async setVrfAuthorityIx(params: ISetVrfAuthorityIx) {
    const { admin, newVrfAuthority } = params
    const [state] = this.fetcher.getStateAddress()

    return await this.program.methods
      .setVrfAuthority(newVrfAuthority)
      .accountsStrict({
        admin,
        state
      })
      .instruction()
  }

  async initializeVaultIx(params: IInitializeVaultIx) {
    const { admin, mint, fMint, lending, pMint, minDeposit, withdrawFee } =
      params
    const [state] = this.fetcher.getStateAddress()
    const stateAccount = await this.fetcher.getState()
    const [vault] = this.fetcher.getVaultAddress(stateAccount.lastVault)

    return await this.program.methods
      .initializeVault(
        new BN(minDeposit.toString()),
        new BN(withdrawFee.toString())
      )
      .accountsStrict({
        admin,
        state,
        vault,
        lending,
        mint,
        fMint,
        pMint,
        systemProgram: SystemProgram.programId
      })
      .instruction()
  }

  async setWithdrawFeeIx(params: ISetWithdrawFeeIx) {
    const { admin, vaultIndex, withdrawFee } = params
    const [state] = this.fetcher.getStateAddress()
    const [vault] = this.fetcher.getVaultAddress(vaultIndex)

    return await this.program.methods
      .setWithdrawFee(vaultIndex, new BN(withdrawFee.toString()))
      .accountsStrict({
        admin,
        state,
        vault
      })
      .instruction()
  }

  async syncRateIx(params: ISyncRateIx) {
    const { admin, vaultIndex, lending } = params
    const [state] = this.fetcher.getStateAddress()
    const [vault] = this.fetcher.getVaultAddress(vaultIndex)

    return await this.program.methods
      .syncRate(vaultIndex)
      .accountsStrict({
        admin,
        state,
        vault,
        lending
      })
      .instruction()
  }

  // ── Authority (VRF) ────────────────────────────────────────────────────────

  async commitIx(params: ICommitIx) {
    const {
      vrfAuthority,
      vaultIndex,
      round,
      rewardType,
      tickets,
      merkleRoot,
      secretHash,
      mint,
      vaultFTokenAccount,
      fTokenMint,
      lending,
      treasury,
      networkState,
      request
    } = params
    const [state] = this.fetcher.getStateAddress()
    const [vault] = this.fetcher.getVaultAddress(vaultIndex)
    const [reward] = this.fetcher.getRewardAddress(vault, round)
    const tokenProgram = await this.fetcher.getTokenProgram(mint)

    return await this.program.methods
      .commit(
        vaultIndex,
        round,
        rewardType,
        new BN(tickets.toString()),
        merkleRoot,
        secretHash
      )
      .accountsStrict({
        vrfAuthority,
        state,
        vault,
        lending,
        mint,
        vaultFTokenAccount,
        fTokenMint,
        reward,
        treasury,
        networkState,
        request,
        vrf: VRF_PROGRAM_ID,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .instruction()
  }

  async revealIx(params: IRevealIx) {
    const { authority, vaultIndex, round, secretSeed, request } = params
    const [state] = this.fetcher.getStateAddress()
    const [vault] = this.fetcher.getVaultAddress(vaultIndex)
    const [reward] = this.fetcher.getRewardAddress(vault, round)

    return await this.program.methods
      .reveal(vaultIndex, round, secretSeed)
      .accountsStrict({
        vrfAuthority: authority,
        state,
        vault,
        reward,
        request
      })
      .instruction()
  }

  async setWinnerIx(params: ISetWinnerIx) {
    const { vrfAuthority, vaultIndex, round, winner } = params
    const [state] = this.fetcher.getStateAddress()
    const [vault] = this.fetcher.getVaultAddress(vaultIndex)
    const [reward] = this.fetcher.getRewardAddress(vault, round)

    return await this.program.methods
      .setWinner(vaultIndex, round)
      .accountsStrict({
        vrfAuthority,
        state,
        vault,
        reward,
        winner
      })
      .instruction()
  }

  // ── User ──────────────────────────────────────────────────────────────────

  async depositIx(params: IDepositIx) {
    const {
      depositor,
      vaultIndex,
      amount,
      depositorTokenAccount,
      vaultTokenAccount,
      recipientTokenAccount,
      mint,
      pMint,
      depositorPTokenAccount,
      lendingAccounts
    } = params
    const [state] = this.fetcher.getStateAddress()
    const [premiumVault] = this.fetcher.getVaultAddress(vaultIndex)
    const tokenProgram = await this.fetcher.getTokenProgram(mint)

    return await this.program.methods
      .deposit(vaultIndex, new BN(amount.toString()))
      .accountsStrict({
        depositor,
        state,
        premiumVault,
        depositorTokenAccount,
        vaultTokenAccount,
        recipientTokenAccount,
        mint,
        pMint,
        depositorPTokenAccount,
        lendingAdmin: lendingAccounts.lendingAdmin,
        lending: lendingAccounts.lending,
        fTokenMint: lendingAccounts.fTokenMint,
        supplyTokenReservesLiquidity:
          lendingAccounts.supplyTokenReservesLiquidity,
        lendingSupplyPositionOnLiquidity:
          lendingAccounts.lendingSupplyPositionOnLiquidity,
        rateModel: lendingAccounts.rateModel,
        vault: lendingAccounts.vault,
        liquidity: lendingAccounts.liquidity,
        liquidityProgram: lendingAccounts.liquidityProgram,
        rewardsRateModel: lendingAccounts.rewardsRateModel,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        lendingProgram: lendingAccounts.lendingProgram
      })
      .instruction()
  }

  async withdrawIx(params: IWithdrawIx) {
    const {
      withdrawer,
      vaultIndex,
      amount,
      vaultFTokenAccount,
      vaultTokenAccount,
      withdrawerTokenAccount,
      mint,
      pMint,
      withdrawerPTokenAccount,
      claimAccount,
      lendingAccounts
    } = params
    const [premiumVault] = this.fetcher.getVaultAddress(vaultIndex)
    const tokenProgram = await this.fetcher.getTokenProgram(mint)

    return await this.program.methods
      .withdraw(vaultIndex, new BN(amount.toString()))
      .accountsStrict({
        withdrawer,
        premiumVault,
        vaultFTokenAccount,
        vaultTokenAccount,
        withdrawerTokenAccount,
        mint,
        pMint,
        withdrawerPTokenAccount,
        lendingAdmin: lendingAccounts.lendingAdmin,
        lending: lendingAccounts.lending,
        fTokenMint: lendingAccounts.fTokenMint,
        supplyTokenReservesLiquidity:
          lendingAccounts.supplyTokenReservesLiquidity,
        lendingSupplyPositionOnLiquidity:
          lendingAccounts.lendingSupplyPositionOnLiquidity,
        rateModel: lendingAccounts.rateModel,
        vault: lendingAccounts.vault,
        claimAccount,
        liquidity: lendingAccounts.liquidity,
        liquidityProgram: lendingAccounts.liquidityProgram,
        rewardsRateModel: lendingAccounts.rewardsRateModel,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        lendingProgram: lendingAccounts.lendingProgram
      })
      .instruction()
  }

  async claimIx(params: IClaimIx) {
    const { claimer, vaultIndex, round, pMint } = params
    const [state] = this.fetcher.getStateAddress()
    const [vault] = this.fetcher.getVaultAddress(vaultIndex)
    const [reward] = this.fetcher.getRewardAddress(vault, round)

    const claimerPTokenAccount = getAssociatedTokenAddressSync(pMint, claimer)

    // Fetch state for rentRecipient (vrf_authority)
    const stateAccount = await this.fetcher.getState()

    return await this.program.methods
      .claim(vaultIndex, round)
      .accountsStrict({
        claimer,
        state,
        vault,
        reward,
        pMint,
        claimerPTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rentRecipient: stateAccount.vrfAuthority
      })
      .instruction()
  }

  async collectFeeIx(params: ICollectFeeIx) {
    const {
      admin,
      vaultIndex,
      vaultFTokenAccount,
      vaultTokenAccount,
      adminTokenAccount,
      mint,
      claimAccount,
      lendingAccounts
    } = params
    const [state] = this.fetcher.getStateAddress()
    const [vault] = this.fetcher.getVaultAddress(vaultIndex)
    const tokenProgram = await this.fetcher.getTokenProgram(mint)

    return await this.program.methods
      .collectFee(vaultIndex)
      .accountsStrict({
        admin,
        state,
        vault,
        vaultFTokenAccount,
        vaultTokenAccount,
        adminTokenAccount,
        mint,
        lendingAdmin: lendingAccounts.lendingAdmin,
        lending: lendingAccounts.lending,
        fTokenMint: lendingAccounts.fTokenMint,
        supplyTokenReservesLiquidity:
          lendingAccounts.supplyTokenReservesLiquidity,
        lendingSupplyPositionOnLiquidity:
          lendingAccounts.lendingSupplyPositionOnLiquidity,
        rateModel: lendingAccounts.rateModel,
        lendingVault: lendingAccounts.vault,
        claimAccount,
        liquidity: lendingAccounts.liquidity,
        liquidityProgram: lendingAccounts.liquidityProgram,
        rewardsRateModel: lendingAccounts.rewardsRateModel,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .instruction()
  }
}
