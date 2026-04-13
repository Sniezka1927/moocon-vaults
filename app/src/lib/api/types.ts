// ── Shared ────────────────────────────────────────────────────────────────────

export interface Pagination {
  page: number
  limit: number
  total: number
}

// ── Drawing ───────────────────────────────────────────────────────────────────

export interface Drawing {
  id: number
  vault: string
  mint: string | null
  round: number
  reward_type: number
  total_tickets: number
  winner_index: number | null
  winner_wallet: string | null
  commit_tx: string | null
  reveal_tx: string | null
  amount: number | null
  merkle_root: string | null
  secret_seed: string | null
  secret_hash: string | null
  vrf_seed: string | null
  request: string | null
  snapshot_at: number
  revealed_at: number | null
  winner_apr_percent: number | null
}

export interface DrawingWithTickets extends Drawing {
  your_tickets: number
}

export interface DrawingCheckResponse {
  participating: boolean
  drawings: DrawingWithTickets[]
}

export interface DrawingsListResponse {
  drawings: Drawing[]
  pagination: Pagination
  winners_compound_average_apy_percent_by_vault?: Record<string, number | null>
  winners_compound_average_apy_percent?: number | null
}

// ── Proofs ────────────────────────────────────────────────────────────────────

export interface ProofParticipant {
  wallet: string
  tickets: number
  proof: string
}

export interface ProofConfig {
  vault: string
  mint: string | null
  round: number
  reward_type: number
  total_tickets: number
  merkle_root: string | null
  winner_wallet: string | null
}

export interface ProofContext {
  drawing_id: number
  snapshot_at: number | null
  revealed_at: number | null
  amount: number | null
}

export interface DrawingProofsResponse {
  config: ProofConfig
  context: ProofContext
  participants: ProofParticipant[]
}

export interface WalletProofResponse {
  wallet: string
  tickets: number
  proof: string
}

// ── Mint metadata ─────────────────────────────────────────────────────────────

export interface MintData {
  address: string
  symbol: string | null
  icon: string | null
  price: number | null
  decimals: number
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface StatDataPoint {
  tvl_usd: number
  total_rewards_usd: number
  unique_users: number
  recorded_at: number
}

export interface StatsResponse {
  data: StatDataPoint[]
  next_cursor: number | null
}

// ── Points ────────────────────────────────────────────────────────────────────

export interface PointsResponse {
  wallet: string
  stake_points: number
  referral_points: number
  total_points: number
  multiplier: number
}

// ── Referrals ─────────────────────────────────────────────────────────────────

export interface ReferralsResponse {
  code: string | null
  referredBy: string | null
  referrals: string[]
}

export interface CreateReferralBody {
  wallet: string
  code: string
  signature: string
  ledger?: boolean
}

export interface UseReferralBody {
  wallet: string
  code: string
  signature: string
  ledger?: boolean
}

export interface ReferralSuccessResponse {
  success: true
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface VaultEvent {
  id: number
  drawing_id: number | null
  signature: string
  slot: number
  block_time: number
  event_name: string
  vault: string
  round: number
  decoded: Record<string, unknown>
  amount: number | null
  merkle_root: string | null
  secret_hash: string | null
  vrf_seed: string | null
  secret_seed: string | null
  randomness: string | null
  winner_index: number | null
  created_at: number
}

export interface EventsListResponse {
  events: VaultEvent[]
  pagination: Pagination
}

export interface EventMatch {
  merkle_root: boolean | null
  secret_hash: boolean | null
  vrf_seed: boolean | null
  winner_index: boolean | null
  randomness: boolean | null
}

export interface EventDetailResponse {
  drawing: Drawing
  commit_event: VaultEvent | null
  reveal_event: VaultEvent | null
  match: EventMatch
}
