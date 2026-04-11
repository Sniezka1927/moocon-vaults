import { Keypair, PublicKey, Connection } from '@solana/web3.js'
import { ILendingAccounts } from '../ts-sdk/types'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

export const VRF_TEST_AUTHORITY = Keypair.fromSecretKey(
  new Uint8Array([
    159, 135, 155, 179, 232, 49, 146, 104, 123, 170, 173, 186, 139, 35, 73, 143,
    133, 30, 197, 1, 186, 223, 14, 174, 38, 116, 212, 31, 162, 246, 70, 121, 71,
    213, 150, 217, 213, 200, 116, 81, 220, 31, 84, 86, 216, 104, 85, 227, 232,
    56, 113, 225, 190, 87, 152, 72, 169, 95, 174, 86, 2, 37, 92, 12
  ])
)

export const JUP_LOCAL = Keypair.fromSecretKey(
  new Uint8Array([
    89, 145, 205, 84, 139, 245, 243, 158, 181, 116, 146, 139, 35, 40, 253, 109,
    180, 245, 37, 170, 196, 213, 125, 38, 185, 51, 177, 76, 215, 103, 193, 242,
    74, 46, 58, 206, 100, 45, 50, 253, 142, 62, 243, 126, 224, 119, 183, 111,
    117, 98, 133, 251, 23, 77, 74, 158, 242, 255, 58, 94, 222, 6, 142, 199
  ])
)

export const VRF_FULFILLMENT_AUTHORITY = Keypair.fromSecretKey(
  new Uint8Array([
    220, 197, 65, 75, 241, 167, 39, 105, 192, 230, 218, 130, 191, 156, 228, 231,
    181, 120, 74, 101, 57, 94, 122, 227, 183, 157, 189, 162, 143, 150, 160, 212,
    189, 196, 12, 204, 211, 191, 133, 21, 40, 50, 38, 247, 60, 21, 30, 29, 157,
    196, 240, 7, 141, 32, 108, 162, 140, 102, 82, 44, 27, 225, 230, 146
  ])
)

export async function airdrop(
  connection: Connection,
  pubkey: PublicKey,
  lamports: number
) {
  const sig = await connection.requestAirdrop(pubkey, lamports)
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  )
}

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

// Non-program pubkey safe for #[account(mut)] dummy accounts.
// PublicKey.default = System Program and cannot be marked writable.
const DUMMY_KEY = Keypair.generate().publicKey

export function dummyLending(
  overrides?: Partial<ILendingAccounts>
): ILendingAccounts {
  return {
    lendingAdmin: DUMMY_KEY,
    lending: DUMMY_KEY,
    fTokenMint: DUMMY_KEY,
    supplyTokenReservesLiquidity: DUMMY_KEY,
    lendingSupplyPositionOnLiquidity: DUMMY_KEY,
    rateModel: DUMMY_KEY,
    vault: DUMMY_KEY,
    liquidity: DUMMY_KEY,
    liquidityProgram: DUMMY_KEY,
    rewardsRateModel: DUMMY_KEY,
    lendingProgram: JUP_LOCAL.publicKey,
    ...overrides
  }
}

export const assertBalance = async (
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  expected: bigint
) => {
  const ata = getAssociatedTokenAddressSync(mint, owner, true)
  const balance = await connection.getTokenAccountBalance(ata)
  if (BigInt(balance.value.amount) !== expected) {
    throw new Error(
      `Expected ${expected}, got ${
        balance.value.amount
      } for account ${ata.toBase58()} owner ${owner.toBase58()} mint ${mint.toBase58()}`
    )
  }
}
