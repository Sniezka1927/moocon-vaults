import { PublicKey } from '@solana/web3.js'
import { ILendingAccounts, LendingAccountsByMint } from './types'
import { NATIVE_MINT } from '@solana/spl-token'

export const VAULT_SEED = 'vault'
export const STATE_SEED = 'state'
export const REWARD_SEED = 'reward'
export const VRF_PROGRAM_ID = new PublicKey(
  'VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y'
)
export const MPL_TOKEN_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
)
export const ROUND_TIME = 30 // minutes per round
export const GLOBAL_ACCOUNTS_TTL = 86400
export const REWARD_TYPE_TIER_0 = 0
export const REWARD_TYPE_TIER_1 = 1
export const HASH_SIZE = 32
export const MAX_U64 = BigInt('0xffffffffffffffff')
export const MIN_TICKETS_FOR_REFERRAL = 0n
export const USDC_MINT = new PublicKey(
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
)

export const JUPITER_USDC_ACCOUNTS: ILendingAccounts = {
  mint: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  fTokenMint: new PublicKey('2Wx1tTo8PkTP95NyKoFNPTtcLnYaSowDkExwbHDKAZQu'),
  lending: new PublicKey('98Uy7eonumvRbhQvP5Jt7B3WjNqpndioMF99xvR7sDVa'),
  lendingAdmin: new PublicKey('DeF2BVMjWdCamK71nqBZ7uzQkLeW9MJ6C7zoCKLJXEmW'),
  lendingProgram: new PublicKey('7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3'),
  lendingSupplyPositionOnLiquidity: new PublicKey(
    'B5JAZXGKaZfWsUrauprZVNQM7HwXN8AfKVTt25qtDKYV'
  ),
  liquidity: new PublicKey('DFHSbFzMU67yHK9yLsLBLso7aEnzrB4ZQR7KBujmSU3M'),
  liquidityProgram: new PublicKey(
    '5uDkCoM96pwGYhAUucvCzLfm5UcjVRuxz6gH81RnRBmL'
  ),
  rateModel: new PublicKey('CpSRFppSpkdPw7juvRpSxwVyZMN3y8g7cHXCbrc3MBUs'),
  rewardsRateModel: new PublicKey(
    'GGtryeuwjcWoG6zg4Xi1vUJN1xRhypms4xt129BKTUxt'
  ),
  supplyTokenReservesLiquidity: new PublicKey(
    '644Eh222dNe1V6sSRkYHBcdpxfjtxBBptAJ6mZujRRNo'
  ),
  vault: new PublicKey('CWFPa1gcDqGyeTHTmdbhGjCnQv7eRfdhnBpZKFzNr1R2'),
  decimal: 6
}

export const LENDING_ACCOUNTS_BY_MINT: LendingAccountsByMint = {
  [USDC_MINT.toBase58()]: JUPITER_USDC_ACCOUNTS
}

export const STATS_INTERVALS: Record<string, number> = {
  '1h': 3600,
  '4h': 14400,
  '1d': 86400
}

export function getLendingAccountsForMint(
  mint: PublicKey
): ILendingAccounts | null {
  return LENDING_ACCOUNTS_BY_MINT[mint.toBase58()] ?? null
}
