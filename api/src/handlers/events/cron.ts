import { parseEvents } from 'ts-sdk'
import { connection, vault } from '../../consts'
import { db } from '../../db'
import type { DrawingRow } from '../../db'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numArrayToHex(arr: number[]): string {
  return Buffer.from(arr).toString('hex')
}

// ---------------------------------------------------------------------------
// Parse and save events for a single transaction
// ---------------------------------------------------------------------------

async function parseTxEvents(
  drawing: DrawingRow,
  signature: string
): Promise<void> {
  if (signature.startsWith('seed')) {
    return
  }
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0
  })

  if (!tx?.meta?.logMessages) {
    console.warn(`events: no log messages for sig=${signature}`)
    return
  }

  const rawLogs = JSON.stringify(tx.meta.logMessages)
  const slot = tx.slot
  const blockTime = tx.blockTime ?? null

  const events = await parseEvents(vault.program, connection, signature)

  for (const event of events) {
    if (event.name !== 'commitEvent' && event.name !== 'revealEvent') continue

    const d = event.data

    let amount: bigint | null = null
    let merkleRoot: string | null = null
    let secretHash: string | null = null
    let vrfSeed: string | null = null
    let secretSeed: string | null = null
    let randomness: string | null = null
    let winnerIndex: bigint | null = null

    if (event.name === 'commitEvent') {
      amount = BigInt(d.amount.toString())
      merkleRoot = numArrayToHex(d.merkleRoot)
      secretHash = numArrayToHex(d.secretHash)
      vrfSeed = numArrayToHex(d.vrfSeed)
    } else {
      secretSeed = numArrayToHex(d.secretSeed)
      randomness = numArrayToHex(d.randomness)
      winnerIndex = BigInt(d.winnerIndex.toString())
    }

    const decoded = JSON.stringify({
      vault: d.vault?.toBase58?.() ?? String(d.vault),
      round: Number(d.round),
      ...(event.name === 'commitEvent'
        ? { amount: amount?.toString(), merkleRoot, secretHash, vrfSeed }
        : { secretSeed, randomness, winnerIndex: winnerIndex?.toString() })
    })

    db.query(
      `INSERT OR IGNORE INTO vault_events (
        drawing_id, signature, slot, block_time, event_name,
        vault, round, raw_logs, decoded,
        amount, merkle_root, secret_hash, vrf_seed,
        secret_seed, randomness, winner_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      drawing.id,
      signature,
      slot,
      blockTime,
      event.name,
      drawing.vault,
      Number(drawing.round),
      rawLogs,
      decoded,
      amount,
      merkleRoot,
      secretHash,
      vrfSeed,
      secretSeed,
      randomness,
      winnerIndex
    )

    console.log(
      `events: saved ${event.name} drawingId=${String(drawing.id)} round=${String(
        drawing.round
      )} sig=${signature}`
    )
  }
}

// ---------------------------------------------------------------------------
// Entry point (called by Elysia cron every minute)
// ---------------------------------------------------------------------------

export const processEvents = async () => {
  try {
    // Drawings with commit_tx not yet parsed
    const unparsedCommits = db
      .query<DrawingRow, []>(
        `SELECT d.* FROM drawings d
         WHERE d.commit_tx IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM vault_events ve
             WHERE ve.signature = d.commit_tx
           )`
      )
      .all()

    for (const drawing of unparsedCommits) {
      try {
        await parseTxEvents(drawing, drawing.commit_tx!)
      } catch (err) {
        console.error(
          { err, sig: drawing.commit_tx },
          'events: failed to parse commit tx'
        )
      }
    }

    // Drawings with reveal_tx not yet parsed
    const unparsedReveals = db
      .query<DrawingRow, []>(
        `SELECT d.* FROM drawings d
         WHERE d.reveal_tx IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM vault_events ve
             WHERE ve.signature = d.reveal_tx
           )`
      )
      .all()

    for (const drawing of unparsedReveals) {
      try {
        await parseTxEvents(drawing, drawing.reveal_tx!)
      } catch (err) {
        console.error(
          { err, sig: drawing.reveal_tx },
          'events: failed to parse reveal tx'
        )
      }
    }
  } catch (err) {
    console.error({ err }, 'fatal events cron error')
  }
}
