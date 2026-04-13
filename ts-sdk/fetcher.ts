import { PublicKey } from '@solana/web3.js'
import {
  AccountLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { MooconVaults } from './idl/moocon_vaults'
import { BN, IdlAccounts, Program } from '@coral-xyz/anchor'
import {
  VAULT_SEED,
  STATE_SEED,
  REWARD_SEED,
  GLOBAL_ACCOUNTS_TTL
} from './consts'
import { IHolders } from './types'

// Raw types as decoded by Anchor (u64 = BN)
type RawVault = IdlAccounts<MooconVaults>['vault']
type RawState = IdlAccounts<MooconVaults>['state']
type RawReward = IdlAccounts<MooconVaults>['reward']

// Parsed types with u64 as bigint, u32 as number
export type VaultAccount = {
  mint: PublicKey
  fMint: PublicKey
  pMint: PublicKey
  lending: PublicKey

  minDeposit: bigint
  accumulatedFee: bigint
  withdrawFee: bigint

  lastRate: bigint
  distributionTiers: [DistributionTier, DistributionTier]
  currentRound: number
  bump: number
}

export type DistributionTier = {
  distributedAt: bigint
  interval: bigint
  rewardShare: bigint
  accumulated: bigint
}

export type StateAccount = {
  admin: PublicKey
  vrfAuthority: PublicKey
  lastVault: number
  bump: number
}

export type RewardAccount = {
  claimer: PublicKey
  vault: PublicKey
  amount: bigint
  totalTickets: bigint
  winnerIndex: bigint
  round: number
  rewardType: number
  bump: number
}

enum Keys {
  Vaults = 'vaults',
  Stakes = 'stakes',
  Rewards = 'rewards'
}

type Cached<T> = T & { ts: number }

export class Fetcher {
  state: StateAccount | null
  program: Program<MooconVaults>
  lastAllVaultsTs: number;

  [Keys.Vaults]: Map<string, Cached<VaultAccount>>;
  [Keys.Rewards]: Map<string, Cached<RewardAccount>>

  mintOwners: Map<string, PublicKey>

  constructor(program: Program<MooconVaults>) {
    this.program = program
    this.vaults = new Map()
    this.rewards = new Map()
    this.state = null
    this.mintOwners = new Map()
    this.lastAllVaultsTs = 0
  }

  now() {
    return Math.floor(new Date().getTime() / 1e3)
  }

  private isFresh(ts: number, ttl: number = GLOBAL_ACCOUNTS_TTL) {
    return ts + ttl > this.now()
  }

  private getCached<T>(
    map: Map<string, Cached<T>>,
    address: PublicKey
  ): T | null {
    const entry = map.get(address.toBase58())
    if (!entry || !this.isFresh(entry.ts)) return null
    const { ts: _, ...account } = entry as any
    return account as T
  }

  private setCached<T>(
    map: Map<string, Cached<T>>,
    address: PublicKey,
    value: T
  ) {
    map.set(address.toBase58(), { ...(value as any), ts: this.now() })
  }

  // ── State ────────────────────────────────────────────────────────────────

  async getState(forceFetch = false): Promise<StateAccount> {
    if (!forceFetch && this.state !== null) {
      return this.state
    }
    const [address] = this.getStateAddress()
    const raw = await this.program.account.state.fetch(address)
    this.state = parseState(raw)
    return this.state
  }

  getStateAddress(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(STATE_SEED)],
      this.program.programId
    )
  }

  // ── Vaults ──────────────────────────────────────────────────────────────

  async getAllVaults(forceFetch = false): Promise<VaultAccount[]> {
    // const now = this.now()
    // if (!forceFetch && this.isFresh(this.lastAllVaultsTs)) {
    //   return Array.from(this.vaults.values()).map(({ ts: _, ...v }) => v as VaultAccount)
    // }
    const entries = await this.program.account.vault.all()
    // for (const e of entries) {
    //   this.setCached(this.vaults, e.publicKey, parseVault(e.account))
    // }
    // this.lastAllVaultsTs = now
    return entries.map((e) => parseVault(e.account))
  }

  async getVaultByIndex(index: number): Promise<VaultAccount> {
    const [address] = this.getVaultAddress(index)
    return this.getVaultByAddress(address)
  }

  async getVaultByAddress(address: PublicKey): Promise<VaultAccount> {
    // const cached = this.getCached(this.vaults, address)
    // if (cached) return cached
    const account = parseVault(await this.program.account.vault.fetch(address))
    // this.setCached(this.vaults, address, account)
    return account
  }

  getVaultAddress(index: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED), indexToBytes(index)],
      this.program.programId
    )
  }

  // ── Reward ───────────────────────────────────────────────────────────────

  async getReward(vault: PublicKey, round: number): Promise<RewardAccount> {
    const [address] = this.getRewardAddress(vault, round)
    return this.getRewardByAddress(address)
  }

  async getRewardsForAddress(wallet: PublicKey): Promise<RewardAccount[]> {
    const entries = await this.program.account.reward.all([
      {
        memcmp: {
          offset: 8, // discriminator
          bytes: wallet.toBase58()
        }
      }
    ])
    return entries.map((e) => parseReward(e.account))
  }

  async getRewardByAddress(address: PublicKey): Promise<RewardAccount> {
    // const cached = this.getCached(this.rewards, address)
    // if (cached) return cached
    const account = parseReward(
      await this.program.account.reward.fetch(address)
    )
    // this.setCached(this.rewards, address, account)
    return account
  }

  async getAllRewards(): Promise<RewardAccount[]> {
    const entries = await this.program.account.reward.all()
    // for (const e of entries) {
    //   this.setCached(this.rewards, e.publicKey, parseReward(e.account))
    // }
    return entries.map((e) => parseReward(e.account))
  }

  getRewardAddress(vault: PublicKey, round: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(REWARD_SEED), vault.toBytes(), indexToBytes(round)],
      this.program.programId
    )
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  async getEligibleWallets(pMint: PublicKey): Promise<IHolders[]> {
    const rawTokenAccounts =
      await this.program.provider.connection.getProgramAccounts(
        TOKEN_PROGRAM_ID,
        {
          filters: [
            { memcmp: { offset: 0, bytes: pMint.toBase58() } }, // mint
            { dataSize: 165 }
          ]
        }
      )

    const holders = rawTokenAccounts.map(({ account }) => {
      const decoded = AccountLayout.decode(account.data)

      return {
        wallet: new PublicKey(decoded.owner), // actual wallet owner
        amount: BigInt(decoded.amount.toString()) // SPL token amount
      }
    })

    return holders.filter((h) => h.amount > 0n)
  }
  async getTokenProgram(mint: PublicKey): Promise<PublicKey> {
    const key = mint.toBase58()
    const cached = this.mintOwners.get(key)
    if (cached) return cached

    const info = await this.program.provider.connection.getAccountInfo(mint)
    if (!info) throw new Error(`Mint account not found: ${key}`)
    const tokenProgram = info.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID
    this.mintOwners.set(key, tokenProgram)
    return tokenProgram
  }
}

function indexToBytes(index: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(index)
  return buf
}

function bnToBigInt(v: BN): bigint {
  return BigInt(v.toString())
}

export function parseVault(raw: RawVault): VaultAccount {
  const distributionTiers = raw.distributionTiers.map(parseDistributionTier) as [
    DistributionTier,
    DistributionTier
  ]

  return {
    mint: raw.mint,
    fMint: raw.fMint,
    pMint: raw.pMint,
    lending: raw.lending,
    minDeposit: bnToBigInt(raw.minDeposit),
    lastRate: bnToBigInt(raw.lastRate),
    withdrawFee: bnToBigInt(raw.withdrawFee),
    accumulatedFee: bnToBigInt(raw.accumulatedFee),
    distributionTiers,
    currentRound: raw.currentRound,
    bump: raw.bump
  }
}

function parseDistributionTier(raw: {
  distributedAt: BN
  interval: BN
  rewardShare: BN
  accumulated: BN
}): DistributionTier {
  return {
    distributedAt: bnToBigInt(raw.distributedAt),
    interval: bnToBigInt(raw.interval),
    rewardShare: bnToBigInt(raw.rewardShare),
    accumulated: bnToBigInt(raw.accumulated)
  }
}

function parseState(raw: RawState): StateAccount {
  return {
    admin: raw.admin,
    vrfAuthority: raw.vrfAuthority,
    lastVault: raw.lastVault,
    bump: raw.bump
  }
}

function parseReward(raw: RawReward): RewardAccount {
  return {
    claimer: raw.claimer,
    vault: raw.vault,
    amount: bnToBigInt(raw.amount),
    totalTickets: bnToBigInt(raw.totalTickets),
    winnerIndex: bnToBigInt(raw.winnerIndex),
    round: raw.round,
    rewardType: raw.rewardType,
    bump: raw.bump
  }
}
