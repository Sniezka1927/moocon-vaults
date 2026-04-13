import { describe, expect, test } from 'bun:test'
import {
  intersectSnapshotEntries,
  type SnapshotEntry
} from '../src/handlers/drawing/cron/eligibility'

function entry(wallet: string, tickets: number): SnapshotEntry {
  return { wallet, tickets: String(tickets) }
}

describe('intersectSnapshotEntries', () => {
  test('excludes wallet that leaves once, even if it returns later', () => {
    const initial = [entry('A', 10), entry('B', 5)]

    const afterScan1 = intersectSnapshotEntries(initial, [entry('A', 10), entry('B', 5)])
    const afterScan2 = intersectSnapshotEntries(afterScan1, [entry('A', 9)])
    const afterScan3 = intersectSnapshotEntries(afterScan2, [entry('A', 8), entry('B', 5)])

    expect(afterScan3).toEqual([entry('A', 8)])
  })

  test('does not include wallet that joins after the initial snapshot', () => {
    const initial = [entry('A', 10)]

    const afterScan = intersectSnapshotEntries(initial, [entry('A', 10), entry('C', 7)])

    expect(afterScan).toEqual([entry('A', 10)])
  })

  test('keeps the minimum tickets across scans', () => {
    const initial = [entry('A', 10)]

    const afterScan1 = intersectSnapshotEntries(initial, [entry('A', 7)])
    const afterScan2 = intersectSnapshotEntries(afterScan1, [entry('A', 9)])

    expect(afterScan2).toEqual([entry('A', 7)])
  })

  test('returns empty snapshot when all holders drop out', () => {
    const initial = [entry('A', 10), entry('B', 4)]

    const afterScan = intersectSnapshotEntries(initial, [entry('C', 99)])

    expect(afterScan).toEqual([])
  })
})
