export const queryKeys = {
  vaults: {
    all: () => ['vaults', 'all'] as const,
    tokenBalance: (vaultAddr: string, mint: string) =>
      ['vaults', 'tokenBalance', vaultAddr, mint] as const,
  },
  proofs: {
    byDrawing: (id: string) => ['proofs', id] as const,
    byDrawingWallet: (id: string, wallet: string) => ['proofs', id, wallet] as const,
    byVaultRound: (vault: string, round: number) => ['proofs', 'vault', vault, round] as const,
  },
  drawings: {
    check: (wallet: string) => ['drawings', 'check', wallet] as const,
    list: (page: number, limit: number) => ['drawings', 'list', page, limit] as const,
    byVault: (vault: string, page: number, limit: number) =>
      ['drawings', 'vault', vault, page, limit] as const,
  },
  stats: {
    list: (interval: string, limit: number, cursor: string | null) =>
      ['stats', interval, limit, cursor] as const,
  },
  points: {
    byWallet: (wallet: string) => ['points', wallet] as const,
  },
  referrals: {
    byWallet: (wallet: string) => ['referrals', wallet] as const,
  },
  events: {
    list: (page: number, limit: number) => ['events', 'list', page, limit] as const,
    byVaultRound: (vault: string, round: number) => ['events', vault, round] as const,
  },
  mintData: {
    all: () => ['mintData'] as const,
  },
  user: {
    tokenBalance: (mint: string, owner: string) => ['user', 'tokenBalance', mint, owner] as const,
    deposited:    (vault: string, owner: string) => ['user', 'deposited',   vault, owner] as const,
    pTokenBalance:(vault: string, owner: string) => ['user', 'pTokenBalance', vault, owner] as const,
    totalDepositsUsd: (owner: string) => ['user', 'totalDepositsUsd', owner] as const,
  },
} as const
