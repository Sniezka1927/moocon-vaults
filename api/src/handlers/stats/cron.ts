import { AccountLayout, getAssociatedTokenAddressSync } from '@solana/spl-token'
import { AccountInfo, PublicKey } from '@solana/web3.js'
import { LENDING_ACCOUNTS_BY_MINT, getLendingAccountsForMint } from 'ts-sdk'
import { connection, vault } from '../../consts'
import { db } from '../../db'
import { statsLogError, statsLogInfo } from './logger'

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
      // DEVNET fWSOL
      case 'BG892DUQW1NHQLinc4mabqH7EVeEfFWpVibAiNnggwmU':
        return 'So11111111111111111111111111111111111111112'
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
    } catch (err) {
      statsLogError('token metadata fetch failed', { mint: priceMint, err })
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

  statsLogInfo('prices updated', { count: Object.keys(json).length })
}

type VaultEntry = {
  vaultIndex: number
  ata: PublicKey
  fTokenPrice: number
  decimal: number
  pMint: PublicKey
}

export async function takeStatsSnapshot() {
  const vaults = await vault.fetcher.getAllVaults(true)
  let tvlUsd = 0
  const uniqueWallets = new Set<string>()

  // Collect all ATAs upfront
  const entries: VaultEntry[] = []
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
    entries.push({
      vaultIndex: i,
      ata,
      fTokenPrice,
      decimal: lendingAccounts.decimal,
      pMint: v.pMint
    })
  }

  if (entries.length === 0) {
    statsLogInfo('stats snapshot skipped - no vault entries with known prices')
    return
  }

  // Batch fetch all fToken ATAs in one RPC call
  let accountInfos: (AccountInfo<Buffer> | null)[]
  try {
    accountInfos = await connection.getMultipleAccountsInfo(
      entries.map((e) => e.ata)
    )
  } catch (err) {
    statsLogError('getMultipleAccountsInfo failed', { err })
    return
  }

  const foundCount = accountInfos.filter(Boolean).length
  if (foundCount === 0) {
    statsLogInfo('stats snapshot skipped - all vault ATAs missing on-chain', {
      checked: entries.length
    })
    return
  }

  for (let j = 0; j < entries.length; j++) {
    const { vaultIndex, fTokenPrice, decimal, pMint } = entries[j]
    const info = accountInfos[j]

    if (info) {
      try {
        const { amount } = AccountLayout.decode(info.data)
        const uiAmount = Number(amount) / 10 ** decimal
        tvlUsd += uiAmount * fTokenPrice
        statsLogInfo('vault token balance', {
          vaultIndex,
          ata: entries[j].ata.toBase58(),
          rawAmount: amount.toString(),
          uiAmount,
          fTokenPrice,
          contributionUsd: uiAmount * fTokenPrice
        })
      } catch (err) {
        statsLogError('token account decode failed', { vaultIndex, err })
      }
    } else {
      statsLogInfo('vault token account not found', {
        vaultIndex,
        ata: entries[j].ata.toBase58()
      })
    }

    try {
      const lendingAccounts = getLendingAccountsForMint(
        vaults[vaultIndex].mint
      )!
      const holders = await vault.fetcher.getEligibleWallets(pMint)
      const denominator = 10n ** BigInt(lendingAccounts.decimal)

      for (const holder of holders) {
        if (holder.amount / denominator > 0n) {
          uniqueWallets.add(holder.wallet.toBase58())
        }
      }
    } catch (err) {
      statsLogError('eligible wallets fetch failed', { vaultIndex, err })
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

  statsLogInfo('stats snapshot taken', {
    tvlUsd: tvlUsd.toFixed(2),
    totalRewardsUsd: totalRewardsUsd.toFixed(4),
    uniqueUsers
  })
}
