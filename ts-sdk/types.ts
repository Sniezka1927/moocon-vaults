import { Connection, Keypair, PublicKey } from '@solana/web3.js'

export interface IInitializeIx {
  admin: PublicKey
  vrfAuthority: PublicKey
}

export interface ISetVrfAuthorityIx {
  admin: PublicKey
  newVrfAuthority: PublicKey
}

export interface IInitializeVaultIx {
  admin: PublicKey
  mint: PublicKey
  fMint: PublicKey
  pMint: PublicKey
  lending: PublicKey
  minDeposit: bigint
  withdrawFee: bigint
  tiers: [DistributionTierInput, DistributionTierInput]
}

export interface DistributionTierInput {
  interval: bigint
  rewardShare: bigint
  accumulated?: bigint
  distributedAt?: bigint
}

export interface ISetWithdrawFeeIx {
  admin: PublicKey
  vaultIndex: number
  withdrawFee: bigint
}

export interface ILendingAccounts {
  lendingAdmin: PublicKey
  lending: PublicKey
  mint: PublicKey
  fTokenMint: PublicKey
  supplyTokenReservesLiquidity: PublicKey
  lendingSupplyPositionOnLiquidity: PublicKey
  rateModel: PublicKey
  vault: PublicKey
  liquidity: PublicKey
  liquidityProgram: PublicKey
  rewardsRateModel: PublicKey
  lendingProgram: PublicKey
  decimal: number
}

export type LendingAccountsByMint = Record<string, ILendingAccounts>

export interface ISyncRateIx {
  admin: PublicKey
  vaultIndex: number
  lending: PublicKey
}

export interface ICommitIx {
  vrfAuthority: PublicKey
  vaultIndex: number
  round: number
  rewardType: number
  tickets: bigint
  merkleRoot: number[]
  secretHash: number[]
  mint: PublicKey
  vaultFTokenAccount: PublicKey
  fTokenMint: PublicKey
  lending: PublicKey
  treasury: PublicKey
  networkState: PublicKey
  request: PublicKey
}

export interface ICommitWithDepositIx extends ICommitIx {
  pMint: PublicKey
  vrfAuthorityTokenAccount: PublicKey
  vrfAuthorityPTokenAccount: PublicKey
  vaultTokenAccount: PublicKey
  claimAccount: PublicKey
  lendingAccounts: ILendingAccounts
}

export interface IRevealIx {
  authority: PublicKey
  vaultIndex: number
  round: number
  secretSeed: number[]
  request: PublicKey
  winner: PublicKey
}

export interface IDepositIx {
  depositor: PublicKey
  vaultIndex: number
  amount: bigint
  depositorTokenAccount: PublicKey
  vaultTokenAccount: PublicKey
  recipientTokenAccount: PublicKey
  mint: PublicKey
  pMint: PublicKey
  depositorPTokenAccount: PublicKey
  lendingAccounts: ILendingAccounts
}

export interface IWithdrawIx {
  withdrawer: PublicKey
  vaultIndex: number
  amount: bigint
  vaultFTokenAccount: PublicKey
  vaultTokenAccount: PublicKey
  withdrawerTokenAccount: PublicKey
  mint: PublicKey
  pMint: PublicKey
  withdrawerPTokenAccount: PublicKey
  claimAccount: PublicKey
  lendingAccounts: ILendingAccounts
}

export interface ICollectFeeIx {
  admin: PublicKey
  vaultIndex: number
  vaultFTokenAccount: PublicKey
  vaultTokenAccount: PublicKey
  adminTokenAccount: PublicKey
  mint: PublicKey
  claimAccount: PublicKey
  lendingAccounts: ILendingAccounts
}

export interface IClaimIx {
  claimer: PublicKey
  vaultIndex: number
  round: number
  pMint: PublicKey
}

export interface ICreateMintIx {
  connection: Connection
  vault: PublicKey
  payer: PublicKey
  name: string
  symbol: string
  uri: string
  decimals: number
  preparedKeypair?: Keypair
  authorityOverride?: PublicKey // defaults to vault
  additionalMetadata?: Record<string, string>
}

export interface IHolders {
  wallet: PublicKey
  amount: bigint
}
