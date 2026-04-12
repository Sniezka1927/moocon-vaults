import { cron, Patterns } from '@elysiajs/cron'
import Elysia, { t } from 'elysia'
import { processPoints } from './cron'
import { db } from '../../db'
import type { PointsRow } from '../../db'
import { ROUND_TIME } from 'ts-sdk'

// Cron job for points distribution (runs every 10 minutes, processes newly revealed drawings)
// GET /api/points/:wallet — query points for a wallet
export const pointsHandler = new Elysia({
  prefix: '/api/points',
  name: 'points'
})
  .use(
    cron({
      name: 'points-heartbeat',
      pattern: Patterns.everyMinutes(ROUND_TIME),
      run: processPoints
    })
  )
  .get(
    '/:wallet',
    ({ params }) => {
      const row = db
        .query<PointsRow, [string]>('SELECT * FROM points WHERE user_id = ?')
        .get(params.wallet)

      if (!row) {
        return {
          wallet: params.wallet,
          stake_points: 0,
          referral_points: 0,
          total_points: 0,
          multiplier: 1
        }
      }

      return {
        wallet: params.wallet,
        stake_points: row.stake_points,
        referral_points: row.referral_points,
        total_points: row.stake_points + row.referral_points,
        multiplier: row.multiplier ?? 1
      }
    },
    {
      params: t.Object({ wallet: t.String() })
    }
  )
