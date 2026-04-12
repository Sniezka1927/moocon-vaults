import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { LENDING_ACCOUNTS_BY_MINT, getLendingAccountsForMint } from 'ts-sdk'
import { connection, vault } from '../../consts'
import { db } from '../../db'

const prices = new Map<string, number>()
const tokenMetadata = new Map<string, { symbol: string; icon: string | null }>()

export function maybeDevnet(mint: string) {
  if (connection.rpcEndpoint.includes('devnet')) {
    // MAP DEVNET MINTS TO MAINNET FOR PRICE FEED
    switch (mint) {
      // DEVNET jlUSDC
      case '2Wx1tTo8PkTP95NyKoFNPTtcLnYaSowDkExwbHDKAZQu':
        return '9BEcn9aPEmhSPbPQeFGjidRiEKki46fVQDyPpSQXPA2D'
      // DEVNET USDC
      case '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU':
        return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      default:
        return mint
    }
  } else {
    return mint
  }
}
export function getPrice(mint: string): number | undefined {
  return prices.get(maybeDevnet(mint))
}

export async function fetchTokenMetadata() {
  for (const la of Object.values(LENDING_ACCOUNTS_BY_MINT)) {
    const mint = la.mint.toBase58()
    if (tokenMetadata.has(mint)) continue
    const priceMint = maybeDevnet(mint)
    try {
      const headers: Record<string, string> = {}
      if (process.env.JUPITER_API_KEY) {
        headers['x-api-key'] = process.env.JUPITER_API_KEY
      }
      const res = await fetch(
        `https://api.jup.ag/tokens/v2/search?query=${priceMint}`,
        { headers }
      )
      if (!res.ok) continue
      const json = (await res.json()) as Array<{
        symbol: string
        icon?: string
      }>
      const token = json.find((t) => t.symbol)
      if (!token) continue
      tokenMetadata.set(mint, {
        symbol: token.symbol,
        icon: token.icon ?? null
      })
    } catch {
      // metadata fetch failed for this mint, keep existing cached value
    }
  }
}

export function getTokenMetadata(mint: string) {
  return tokenMetadata.get(mint) ?? null
}

export async function fetchPrices() {
  const allMints: string[] = []

  for (const la of Object.values(LENDING_ACCOUNTS_BY_MINT)) {
    allMints.push(maybeDevnet(la.fTokenMint.toBase58()))
    allMints.push(maybeDevnet(la.mint.toBase58()))
  }

  const ids = [...new Set(allMints)].join(',')
  const headers: Record<string, string> = {}
  if (process.env.JUPITER_API_KEY) {
    headers['x-api-key'] = process.env.JUPITER_API_KEY
  }
  const res = await fetch(`https://api.jup.ag/price/v3?ids=${ids}`, { headers })

  if (!res.ok) throw new Error(`jupiter price api returned ${res.status}`)

  const json = (await res.json()) as Record<string, { usdPrice: number }>

  for (const [mint, entry] of Object.entries(json)) {
    if (entry?.usdPrice != null) {
      prices.set(mint, entry.usdPrice)
    }
  }

  console.log(`prices updated for ${Object.keys(json).length} mints`)
}

export async function takeStatsSnapshot() {
  const vaults = await vault.fetcher.getAllVaults(true)
  let tvlUsd = 0
  const uniqueWallets = new Set<string>()

  for (let i = 0; i < vaults.length; i++) {
    const v = vaults[i]
    const lendingAccounts = getLendingAccountsForMint(v.mint)
    if (!lendingAccounts) continue

    const fTokenPrice = prices.get(
      maybeDevnet(lendingAccounts.fTokenMint.toBase58())
    )

    if (fTokenPrice == null) continue

    const vaultPda = vault.fetcher.getVaultAddress(i)[0]
    const ata = getAssociatedTokenAddressSync(
      lendingAccounts.fTokenMint,
      vaultPda,
      true
    )

    try {
      const bal = await connection.getTokenAccountBalance(ata)
      const uiAmount = bal.value.uiAmount ?? 0
      tvlUsd += uiAmount * fTokenPrice
    } catch {
      // ATA may not exist yet
    }

    try {
      const holders = await vault.fetcher.getEligibleWallets(v.pMint)
      const denominator = 10n ** BigInt(lendingAccounts.decimal)

      for (const holder of holders) {
        if (holder.amount / denominator > 0n) {
          uniqueWallets.add(holder.wallet.toBase58())
        }
      }
    } catch {
      // Skip wallet count for this vault if holder fetch fails
    }
  }

  // Total rewards distributed in USD (amount_usd is computed at commit time in drawing cron)
  const totalRewardsUsd =
    db
      .query<{ total: number | null }, []>(
        'SELECT SUM(amount_usd) as total FROM drawings WHERE revealed_at IS NOT NULL'
      )
      .get()!.total ?? 0

  // Unique wallets with non-zero eligible balance across all vaults.
  const uniqueUsers = uniqueWallets.size

  db.query(
    'INSERT INTO snapshots (tvl_usd, total_rewards_usd, unique_users, recorded_at) VALUES (?, ?, ?, unixepoch())'
  ).run(tvlUsd, totalRewardsUsd, uniqueUsers)

  console.log(
    `stats snapshot tvl=${tvlUsd.toFixed(2)} rewards=${totalRewardsUsd.toFixed(
      4
    )} users=${uniqueUsers}`
  )
}
