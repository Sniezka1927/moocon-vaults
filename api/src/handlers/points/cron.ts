import { ROUND_TIME } from 'ts-sdk'
import { db } from '../../db'
import type { DrawingRow, ProofRow, ReferralRow } from '../../db'

const ROUNDS_PER_YEAR = (365 * 24 * 60) / ROUND_TIME
const K = ROUNDS_PER_YEAR / Math.LN10

export function getConsecutiveRounds(
  wallet: string,
  currentDrawingId: bigint
): number {
  const drawings = db
    .query<Pick<DrawingRow, 'id'>, []>(
      `SELECT id FROM drawings WHERE revealed_at IS NOT NULL ORDER BY revealed_at DESC`
    )
    .all()

  const currentIdx = drawings.findIndex((d) => d.id === currentDrawingId)
  if (currentIdx === -1) return 1

  let streak = 0
  for (let i = currentIdx; i < drawings.length; i++) {
    const row = db
      .query<{ count: number }, [bigint, string]>(
        'SELECT COUNT(*) as count FROM proofs WHERE drawing_id = ? AND wallet = ?'
      )
      .get(drawings[i].id, wallet)
    if (!row || !row.count) break
    streak++
  }
  return Math.max(streak, 1)
}

function getConsecutiveMultiplier(wallet: string, drawingId: bigint): number {
  const t = getConsecutiveRounds(wallet, drawingId)
  return Math.min(10, Math.exp(t / K))
}

export async function processPoints(): Promise<void> {
  const unprocessed = db
    .query<Pick<DrawingRow, 'id'>, []>(
      'SELECT id FROM drawings WHERE revealed_at IS NOT NULL AND points_processed_at IS NULL'
    )
    .all()

  for (const drawing of unprocessed) {
    const proofs = db
      .query<Pick<ProofRow, 'wallet' | 'tickets'>, [bigint]>(
        'SELECT wallet, tickets FROM proofs WHERE drawing_id = ?'
      )
      .all(drawing.id)

    for (const proof of proofs) {
      const multiplier = getConsecutiveMultiplier(proof.wallet, drawing.id)
      const effectiveTickets = Math.floor(Number(proof.tickets) * multiplier)

      // Award stake points to participant
      db.run(
        `INSERT INTO points (user_id, stake_points, multiplier, updated_at)
         VALUES (?, ?, ?, unixepoch())
         ON CONFLICT(user_id) DO UPDATE SET
           stake_points = COALESCE(stake_points, 0) + excluded.stake_points,
           multiplier   = excluded.multiplier,
           updated_at   = unixepoch()`,
        [proof.wallet, effectiveTickets, multiplier]
      )

      // Award referral points to referrer (0.5 per effective ticket)
      const referral = db
        .query<Pick<ReferralRow, 'referred_by'>, [string]>(
          'SELECT referred_by FROM referrals WHERE user_id = ? AND referred_by IS NOT NULL'
        )
        .get(proof.wallet)

      if (referral?.referred_by) {
        const referralPoints = Math.floor(effectiveTickets * 0.5)
        if (referralPoints > 0) {
          db.run(
            `INSERT INTO points (user_id, referral_points, updated_at)
             VALUES (?, ?, unixepoch())
             ON CONFLICT(user_id) DO UPDATE SET
               referral_points = COALESCE(referral_points, 0) + excluded.referral_points,
               updated_at = unixepoch()`,
            [referral.referred_by, referralPoints]
          )
        }
      }
    }

    db.run(
      'UPDATE drawings SET points_processed_at = unixepoch() WHERE id = ?',
      [drawing.id]
    )
  }
}
