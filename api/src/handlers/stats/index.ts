import { cron, Patterns } from '@elysiajs/cron'
import Elysia, { t } from 'elysia'
import {
  fetchPrices,
  fetchTokenMetadata,
  getPrice,
  getTokenMetadata,
  takeStatsSnapshot
} from './cron'
import { db, type SnapshotRow } from '../../db'
import { LENDING_ACCOUNTS_BY_MINT, STATS_INTERVALS } from 'ts-sdk'

export const statsHandler = new Elysia({ prefix: '/api/stats', name: 'stats' })
  .use(
    cron({
      name: 'stats-heartbeat',
      pattern: Patterns.everyMinutes(5),
      run: async () => {
        try {
          await fetchPrices()
          await fetchTokenMetadata().catch((err) =>
            console.log({ err }, 'token metadata fetch failed')
          )
          await takeStatsSnapshot()
        } catch (err) {
          console.error({ err }, 'stats cron error')
        }
      }
    })
  )
  .onStart(async () => {
    await fetchPrices()
    await fetchTokenMetadata().catch((err) =>
      console.log({ err }, 'token metadata fetch failed')
    )
  })
  .get('/mint-data', () => {
    const result: Array<{
      address: string
      symbol: string | null
      icon: string | null
      price: number | null
    }> = []
    for (const la of Object.values(LENDING_ACCOUNTS_BY_MINT)) {
      const address = la.mint.toBase58()
      const meta = getTokenMetadata(address)
      const price = getPrice(address) ?? null
      result.push({
        address,
        symbol: meta?.symbol ?? null,
        icon: meta?.icon ?? null,
        price
      })
      result.push({
        address: la.fTokenMint.toBase58(),
        symbol: meta?.symbol ?? null,
        icon: meta?.icon ?? null,
        price
      })
    }
    return result
  })
  .get(
    '/',
    ({ query }) => {
      const intervalSec = STATS_INTERVALS[query.interval]
      if (!intervalSec) {
        return {
          error: `invalid interval, must be one of: ${Object.keys(STATS_INTERVALS).join(', ')}`
        }
      }

      const limit = Math.min(200, Math.max(1, Number(query.limit ?? 100)))
      const cursor = query.cursor
        ? Number(query.cursor)
        : Math.floor(Date.now() / 1000)

      const rows = db
        .query<
          SnapshotRow & { bucket: number },
          [number, number, number, number]
        >(
          `SELECT tvl_usd, total_rewards_usd, unique_users, recorded_at,
                  (recorded_at / ?) * ? as bucket
           FROM snapshots
           WHERE recorded_at < ?
           GROUP BY bucket
           HAVING recorded_at = MAX(recorded_at)
           ORDER BY bucket DESC
           LIMIT ?`
        )
        .all(intervalSec, intervalSec, cursor, limit)

      const nextCursor =
        rows.length === limit ? rows[rows.length - 1].recorded_at : null

      return {
        data: rows.map((r) => ({
          tvl_usd: r.tvl_usd,
          total_rewards_usd: r.total_rewards_usd,
          unique_users: r.unique_users,
          recorded_at: r.recorded_at
        })),
        next_cursor: nextCursor
      }
    },
    {
      query: t.Object({
        interval: t.String(),
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String())
      })
    }
  )
