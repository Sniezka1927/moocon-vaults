import { Database } from 'bun:sqlite'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

// Allow JSON.stringify to serialize BigInt values returned by safeIntegers
declare global {
  interface BigInt {
    toJSON(): string
  }
}
BigInt.prototype.toJSON = function () {
  return this.toString()
}

const DB_PATH = process.env.DB_PATH ?? './data/app.db'

mkdirSync(dirname(DB_PATH), { recursive: true })

function migrateReferralsCodeNullable(db: Database): void {
  const col = db
    .query<{ notnull: number }, []>(
      `SELECT "notnull" FROM pragma_table_info('referrals') WHERE name = 'code'`
    )
    .get()
  if (!col || col.notnull === 0) return // already nullable or column missing
  db.run(`
    CREATE TABLE referrals_new (
      user_id     TEXT PRIMARY KEY,
      code        TEXT UNIQUE,
      referred_by TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run('INSERT INTO referrals_new SELECT * FROM referrals')
  db.run('DROP TABLE referrals')
  db.run('ALTER TABLE referrals_new RENAME TO referrals')
}

function initializeSchema(db: Database): void {
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')

  db.run(`
    CREATE TABLE IF NOT EXISTS referrals (
      user_id     TEXT PRIMARY KEY,
      code        TEXT UNIQUE,
      referred_by TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Migrate: make code column nullable (was NOT NULL in older schema)
  migrateReferralsCodeNullable(db)

  db.run(`
    CREATE TABLE IF NOT EXISTS points (
      user_id    TEXT PRIMARY KEY,
      points     INTEGER NOT NULL DEFAULT 0,
      tickets    INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  addColumnIfMissing(db, 'points', 'stake_points', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(
    db,
    'points',
    'referral_points',
    'INTEGER NOT NULL DEFAULT 0'
  )
  addColumnIfMissing(db, 'points', 'multiplier', 'REAL NOT NULL DEFAULT 1.0')

  db.run(`
    CREATE TABLE IF NOT EXISTS drawings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      vault         TEXT NOT NULL,
      mint          TEXT,
      round         INTEGER NOT NULL,
      reward_type   INTEGER NOT NULL,
      total_tickets INTEGER NOT NULL,
      winner_index  INTEGER,
      winner_wallet TEXT,
      commit_tx     TEXT,
      reveal_tx     TEXT,
      amount        INTEGER NOT NULL,
      merkle_root   BLOB,
      secret_hash   BLOB,
      vrf_seed      BLOB,
      secret_seed   BLOB,
      randomness    BLOB,
      snapshot_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      committed_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      revealed_at   INTEGER,
      apr           REAL,
      UNIQUE(vault, round)
    )
  `)
  addColumnIfMissing(db, 'drawings', 'mint', 'TEXT')
  addColumnIfMissing(db, 'drawings', 'commit_tx', 'TEXT')
  addColumnIfMissing(db, 'drawings', 'reveal_tx', 'TEXT')
  addColumnIfMissing(db, 'drawings', 'request', 'TEXT')
  addColumnIfMissing(db, 'drawings', 'initial_snapshot', 'TEXT')
  addColumnIfMissing(db, 'drawings', 'eligible_snapshot', 'TEXT')
  addColumnIfMissing(
    db,
    'drawings',
    'eligibility_blocked',
    'INTEGER NOT NULL DEFAULT 0'
  )
  addColumnIfMissing(db, 'drawings', 'last_eligibility_scan_at', 'INTEGER')
  addColumnIfMissing(db, 'drawings', 'points_processed_at', 'INTEGER')
  addColumnIfMissing(db, 'drawings', 'amount_usd', 'REAL')
  addColumnIfMissing(db, 'drawings', 'apr', 'REAL')

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_drawings_vault_round ON drawings(vault, round)'
  )

  db.run(`
    CREATE TABLE IF NOT EXISTS proofs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      drawing_id INTEGER NOT NULL REFERENCES drawings(id),
      wallet     TEXT NOT NULL,
      tickets    INTEGER NOT NULL,
      proof      BLOB NOT NULL,
      UNIQUE(drawing_id, wallet)
    )
  `)
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_proofs_drawing_id ON proofs(drawing_id)'
  )
  db.run('CREATE INDEX IF NOT EXISTS idx_proofs_wallet ON proofs(wallet)')

  db.run(`
    CREATE TABLE IF NOT EXISTS stats (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      vault              TEXT NOT NULL,
      round              INTEGER NOT NULL,
      reward_type        INTEGER NOT NULL,
      total_tickets      INTEGER NOT NULL,
      tier_0_accumulated INTEGER NOT NULL DEFAULT 0,
      tier_1_accumulated INTEGER NOT NULL DEFAULT 0,
      winner_wallet      TEXT,
      amount_won         INTEGER,
      recorded_at        INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  addColumnIfMissing(
    db,
    'stats',
    'tier_0_accumulated',
    'INTEGER NOT NULL DEFAULT 0'
  )
  addColumnIfMissing(
    db,
    'stats',
    'tier_1_accumulated',
    'INTEGER NOT NULL DEFAULT 0'
  )
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_stats_recorded_at ON stats(recorded_at)'
  )

  db.run(`
    CREATE TABLE IF NOT EXISTS vault_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      drawing_id   INTEGER REFERENCES drawings(id),
      signature    TEXT NOT NULL UNIQUE,
      slot         INTEGER,
      block_time   INTEGER,
      event_name   TEXT NOT NULL,
      vault        TEXT NOT NULL,
      round        INTEGER NOT NULL,
      raw_logs     TEXT NOT NULL,
      decoded      TEXT NOT NULL,
      amount       INTEGER,
      merkle_root  TEXT,
      secret_hash  TEXT,
      vrf_seed     TEXT,
      secret_seed  TEXT,
      randomness   TEXT,
      winner_index INTEGER,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_vault_events_vault_round ON vault_events(vault, round)'
  )
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_vault_events_drawing_id ON vault_events(drawing_id)'
  )

  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      tvl_usd           REAL NOT NULL,
      total_rewards_usd REAL NOT NULL,
      unique_users      INTEGER NOT NULL,
      recorded_at       INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_snapshots_recorded_at ON snapshots(recorded_at)'
  )
}

function addColumnIfMissing(
  db: Database,
  table: string,
  column: string,
  columnDefinition: string
): void {
  const existing = db
    .query<{ name: string }, [string]>(
      `SELECT name FROM pragma_table_info('${table}') WHERE name = ?`
    )
    .get(column)
  if (existing) return
  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDefinition}`)
}

const db = new Database(DB_PATH, { create: true, safeIntegers: true })
initializeSchema(db)

export { db }

export interface ReferralRow {
  user_id: string
  code: string | null
  referred_by: string | null
  created_at: number
}

export interface PointsRow {
  user_id: string
  points: bigint
  tickets: bigint
  stake_points: bigint
  referral_points: bigint
  multiplier: number
  updated_at: number
}

export interface DrawingRow {
  id: bigint
  vault: string
  mint: string | null
  round: bigint
  reward_type: number
  total_tickets: bigint
  winner_index: bigint | null
  winner_wallet: string | null
  commit_tx: string | null
  reveal_tx: string | null
  request: string | null
  amount: bigint
  merkle_root: Uint8Array | null
  secret_hash: Uint8Array | null
  vrf_seed: Uint8Array | null
  secret_seed: Uint8Array | null
  randomness: Uint8Array | null
  initial_snapshot: string | null
  eligible_snapshot: string | null
  eligibility_blocked: number | bigint
  last_eligibility_scan_at: number | null
  snapshot_at: number | null
  committed_at: number
  revealed_at: number | null
  points_processed_at: number | null
  amount_usd: number | null
  apr: number | null
}

export interface ProofRow {
  id: bigint
  drawing_id: bigint
  wallet: string
  tickets: bigint
  proof: Uint8Array
}

export interface VaultEventRow {
  id: bigint
  drawing_id: bigint | null
  signature: string
  slot: bigint | null
  block_time: bigint | null
  event_name: string
  vault: string
  round: bigint
  raw_logs: string
  decoded: string
  amount: bigint | null
  merkle_root: string | null
  secret_hash: string | null
  vrf_seed: string | null
  secret_seed: string | null
  randomness: string | null
  winner_index: bigint | null
  created_at: bigint
}

export interface StatsRow {
  id: bigint
  vault: string
  round: bigint
  reward_type: number
  total_tickets: bigint
  tier_0_accumulated: bigint
  tier_1_accumulated: bigint
  winner_wallet: string | null
  amount_won: bigint | null
  recorded_at: number
}

export interface SnapshotRow {
  id: number
  tvl_usd: number
  total_rewards_usd: number
  unique_users: number
  recorded_at: number
}
