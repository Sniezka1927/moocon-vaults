import BN from 'bn.js'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { DEVNET_RPC } from './consts'

// Devnet program IDs (different from mainnet)
const DEVNET_LENDING_PROGRAM = new PublicKey(
  '7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3'
)
const DEVNET_LIQUIDITY_PROGRAM = new PublicKey(
  '5uDkCoM96pwGYhAUucvCzLfm5UcjVRuxz6gH81RnRBmL'
)

// Well-known programs
const TOKEN_PROGRAM = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
)
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
)
const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111')

// Known discriminators from the IDL
const LENDING_DISC = Buffer.from([135, 199, 82, 16, 249, 131, 182, 241])
const LENDING_ADMIN_DISC = Buffer.from([42, 8, 33, 220, 163, 40, 210, 5])

const connection = new Connection(DEVNET_RPC, 'confirmed')

// Global PDAs (not per-vault)
const [lendingAdmin] = PublicKey.findProgramAddressSync(
  [Buffer.from('lending_admin')],
  DEVNET_LENDING_PROGRAM
)
const [liquidityPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('liquidity')],
  DEVNET_LIQUIDITY_PROGRAM
)

/**
 * Decode a Lending account from raw data.
 * Layout (after 8-byte discriminator):
 *   pubkey  mint                    (32 bytes)
 *   pubkey  fTokenMint              (32 bytes)
 *   u16     lendingId               (2 bytes)
 *   u8      decimals                (1 byte)
 *   pubkey  rewardsRateModel        (32 bytes)
 *   u64     liquidityExchangePrice  (8 bytes)
 *   u64     tokenExchangePrice      (8 bytes)
 *   i64     lastUpdateTimestamp     (8 bytes)
 *   pubkey  tokenReservesLiquidity  (32 bytes)
 *   pubkey  supplyPositionOnLiq     (32 bytes)
 *   u8      bump                    (1 byte)
 */
function decodeLendingAccount(data: Buffer) {
  let offset = 8 // skip discriminator
  const mint = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32
  const fTokenMint = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32
  const lendingId = data.readUInt16LE(offset)
  offset += 2
  const decimals = data.readUInt8(offset)
  offset += 1
  const rewardsRateModel = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32
  const liquidityExchangePrice = new BN(data.subarray(offset, offset + 8), 'le')
  offset += 8
  const tokenExchangePrice = new BN(data.subarray(offset, offset + 8), 'le')
  offset += 8
  const lastUpdateTimestamp = new BN(data.subarray(offset, offset + 8), 'le')
  offset += 8
  const tokenReservesLiquidity = new PublicKey(
    data.subarray(offset, offset + 32)
  )
  offset += 32
  const supplyPositionOnLiquidity = new PublicKey(
    data.subarray(offset, offset + 32)
  )
  offset += 32
  const bump = data.readUInt8(offset)
  offset += 1

  return {
    mint,
    fTokenMint,
    lendingId,
    decimals,
    rewardsRateModel,
    liquidityExchangePrice: liquidityExchangePrice.toString(),
    tokenExchangePrice: tokenExchangePrice.toString(),
    lastUpdateTimestamp: new Date(
      lastUpdateTimestamp.toNumber() * 1000
    ).toISOString(),
    tokenReservesLiquidity,
    supplyPositionOnLiquidity,
    bump
  }
}

async function main() {
  console.log('=== Vaults — CPI Account Tables (devnet) ===\n')

  const lendingAccounts = await connection.getProgramAccounts(
    DEVNET_LENDING_PROGRAM
  )
  console.log(
    `Lending program: ${DEVNET_LENDING_PROGRAM.toBase58()} (${lendingAccounts.length} accounts)\n`
  )

  for (const acc of lendingAccounts) {
    const data = Buffer.from(acc.account.data)
    const disc = data.subarray(0, 8)

    if (!disc.equals(LENDING_DISC)) continue

    const v = decodeLendingAccount(data)

    // Per-vault PDA derivations
    const [rateModel] = PublicKey.findProgramAddressSync(
      [Buffer.from('rate_model'), v.mint.toBuffer()],
      DEVNET_LIQUIDITY_PROGRAM
    )
    const vault = getAssociatedTokenAddressSync(v.mint, liquidityPda, true)

    const label = `ID: ${v.lendingId}, mint: ${v.mint.toBase58().slice(0, 8)}…`
    console.log(`=== Lending Vault (${label}) — CPI Accounts ===`)
    const rows: [string, string][] = [
      ['lending_program', DEVNET_LENDING_PROGRAM.toBase58()],
      ['lending', acc.pubkey.toBase58()],
      ['lending_admin', lendingAdmin.toBase58()],
      ['mint', v.mint.toBase58()],
      ['f_token_mint', v.fTokenMint.toBase58()],
      ['supply_token_reserves_liquidity', v.tokenReservesLiquidity.toBase58()],
      [
        'lending_supply_position_on_liq',
        v.supplyPositionOnLiquidity.toBase58()
      ],
      ['rate_model', rateModel.toBase58()],
      ['vault', vault.toBase58()],
      ['liquidity', liquidityPda.toBase58()],
      ['liquidity_program', DEVNET_LIQUIDITY_PROGRAM.toBase58()],
      ['rewards_rate_model', v.rewardsRateModel.toBase58()],
      ['token_program', TOKEN_PROGRAM.toBase58()],
      ['associated_token_program', ASSOCIATED_TOKEN_PROGRAM.toBase58()],
      ['system_program', SYSTEM_PROGRAM.toBase58()]
    ]
    const maxKey = Math.max(...rows.map(([k]) => k.length))
    for (const [k, val] of rows) {
      console.log(`  ${k.padEnd(maxKey)}  ${val}`)
    }
    console.log(
      `  decimals=${v.decimals}  exchange_price=${v.tokenExchangePrice}  last_update=${v.lastUpdateTimestamp}`
    )
    console.log()
  }
}

main().catch(console.error)
