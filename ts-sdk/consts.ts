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

export const JUPITER_WSOL_ACCOUNTS: ILendingAccounts = {
  mint: new PublicKey('So11111111111111111111111111111111111111112'),
  fTokenMint: new PublicKey('BG892DUQW1NHQLinc4mabqH7EVeEfFWpVibAiNnggwmU'),
  lending: new PublicKey('GAvizzttfkgetRzkZY9fqzCYo3fJULM7E9V1Gq5CVTNS'),
  lendingAdmin: new PublicKey('DeF2BVMjWdCamK71nqBZ7uzQkLeW9MJ6C7zoCKLJXEmW'),
  lendingProgram: new PublicKey('7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3'),
  lendingSupplyPositionOnLiquidity: new PublicKey(
    'Gi2KLaG18VZYF6TG8qhTbuVjw3pANXuMjYsZkskasXzR'
  ),
  liquidity: new PublicKey('DFHSbFzMU67yHK9yLsLBLso7aEnzrB4ZQR7KBujmSU3M'),
  liquidityProgram: new PublicKey(
    '5uDkCoM96pwGYhAUucvCzLfm5UcjVRuxz6gH81RnRBmL'
  ),
  rateModel: new PublicKey('HNT4VUeaBaBMqqCa1oJWwG8g1TApZfAJR6e34h9JL5c1'),
  rewardsRateModel: new PublicKey(
    'CnKAZc6aSnncZRRM9K1bsP1ngS6yAayYYDBQBcQdTwef'
  ),
  supplyTokenReservesLiquidity: new PublicKey(
    'BA6Sg5PUACHHUgK9emXGLdLXEVuPvWGZADo5ZqTLqVi1'
  ),
  vault: new PublicKey('GoT7214qjHGt6QNqQKhQmqFFVT3qVwzjZvUZK4enV8E7'),
  decimal: 9
}
export const LENDING_ACCOUNTS_BY_MINT: LendingAccountsByMint = {
  [USDC_MINT.toBase58()]: JUPITER_USDC_ACCOUNTS,
  [NATIVE_MINT.toBase58()]: JUPITER_WSOL_ACCOUNTS
}
export const VAULT_COMMIT_DEPOSIT_AMOUNTS: Record<string, bigint> = {
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 1_000n, // USDC, 6 decimals — 0.001 USDC
  So11111111111111111111111111111111111111112: 1_0_000n // WSOL, 9 decimals — 0.00001 SOL
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
