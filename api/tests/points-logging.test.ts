import { describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, rmSync } from 'fs'
import { db } from '../src/db'

const ts = Date.now()
const LOG_TEST_VAULT = `ppLogVault_${ts}`
const LOG_TEST_WALLET = `ppLogWallet_${ts}`
const LOG_TEST_REFERRER = `ppLogRef_${ts}`
const LOG_TEST_PROOF = Buffer.from('deadbeef', 'hex')
const MERKLE = Buffer.alloc(32, 0x11)
const SECRET = Buffer.alloc(32, 0x22)

describe('points cron logging', () => {
  test('writes timestamped detailed logs to file while processing drawing', async () => {
    const logPath = `/tmp/points-cron-log-${Date.now()}.txt`
    process.env.POINTS_CRON_LOG_PATH = logPath

    const { processPoints } = await import(
      `../src/handlers/points/cron.ts?log_run=${Date.now()}`
    )

    db.run('DELETE FROM points WHERE user_id IN (?, ?)', [
      LOG_TEST_WALLET,
      LOG_TEST_REFERRER
    ])
    db.run('DELETE FROM referrals WHERE user_id = ?', [LOG_TEST_WALLET])

    db.run(
      'INSERT INTO referrals (user_id, code, referred_by) VALUES (?, ?, ?)',
      [LOG_TEST_WALLET, `code_${Date.now()}`, LOG_TEST_REFERRER]
    )

    const insert = db
      .query(
        `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash, revealed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`
      )
      .run(LOG_TEST_VAULT, 1, 0, 100, 0, MERKLE, SECRET)

    const drawingId = (insert as any).lastInsertRowid as bigint

    db.run(
      'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)',
      [drawingId, LOG_TEST_WALLET, 10, LOG_TEST_PROOF]
    )

    try {
      await processPoints()

      const content = readFileSync(logPath, 'utf8')
      expect(content).toContain('points tick start')
      expect(content).toContain('processing drawing for points')
      expect(content).toContain('wallet scoring computed')
      expect(content).toContain('referral points awarded')
      expect(content).toContain('points tick complete')
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    } finally {
      db.run('DELETE FROM proofs WHERE drawing_id = ?', [drawingId])
      db.run('DELETE FROM drawings WHERE id = ?', [drawingId])
      db.run('DELETE FROM points WHERE user_id IN (?, ?)', [
        LOG_TEST_WALLET,
        LOG_TEST_REFERRER
      ])
      db.run('DELETE FROM referrals WHERE user_id = ?', [LOG_TEST_WALLET])
      rmSync(logPath, { force: true })
      delete process.env.POINTS_CRON_LOG_PATH
    }
  })

  test('logger does not throw when file append fails', async () => {
    const blockedPath = `/tmp/points-log-dir-${Date.now()}`
    rmSync(blockedPath, { recursive: true, force: true })
    mkdirSync(blockedPath, { recursive: true })

    try {
      process.env.POINTS_CRON_LOG_PATH = blockedPath

      const { pointsLogInfo } = await import(
        `../src/handlers/points/logger.ts?append_fail=${Date.now()}`
      )

      expect(() => pointsLogInfo('append failure test')).not.toThrow()
    } finally {
      rmSync(blockedPath, { recursive: true, force: true })
      delete process.env.POINTS_CRON_LOG_PATH
    }
  })
})
