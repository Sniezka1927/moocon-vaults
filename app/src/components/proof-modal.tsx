import * as Dialog from '@radix-ui/react-dialog'
import { useConnection } from '@solana/wallet-adapter-react'
import { APP_COLORS } from '@/consts'
import { useMintStore } from '@/lib/store/mint-store'
import { solscanUrl } from '@/lib/utils'
import type { Drawing } from '@/lib/api/types'
import { API_BASE_URL } from '@/lib/api/client'
import { Button } from '@/components/ui/button'

interface ProofModalProps {
  drawing: Drawing | null
  open: boolean
  onClose: () => void
}

function fmtDate(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: APP_COLORS.page.cardLabel }}
    >
      {children}
    </div>
  )
}

function HashPill({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
  return (
    <span
      className="inline-block break-all rounded-md px-2 py-1 font-mono text-[11px] leading-relaxed"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        color: APP_COLORS.page.cardValue,
        border: `1px solid ${APP_COLORS.page.cardBorder}`
      }}
    >
      {value}
    </span>
  )
}

function TxLink({ tx, isDevnet }: { tx: string | null; isDevnet: boolean }) {
  if (!tx) return <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
  return (
    <a
      href={solscanUrl(`/tx/${tx}`, isDevnet)}
      target="_blank"
      rel="noreferrer"
      title={tx}
      className="inline-block break-all rounded-md px-2 py-1 font-mono text-[11px] leading-relaxed underline decoration-dotted underline-offset-2"
      style={{
        color: APP_COLORS.page.eyebrow,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        border: `1px solid ${APP_COLORS.page.cardBorder}`
      }}
    >
      {tx}
    </a>
  )
}

function WalletLink({
  wallet,
  isDevnet
}: {
  wallet: string | null
  isDevnet: boolean
}) {
  if (!wallet)
    return <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
  return (
    <a
      href={solscanUrl(`/account/${wallet}`, isDevnet)}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-dotted underline-offset-2"
      style={{ color: APP_COLORS.page.eyebrow }}
    >
      {wallet}
    </a>
  )
}

export function ProofModal({ drawing, open, onClose }: ProofModalProps) {
  const { connection } = useConnection()
  const isDevnet = connection.rpcEndpoint.includes('devnet')
  const getMint = useMintStore((s) => s.getMint)
  const metadata = drawing?.mint ? getMint(drawing.mint) : undefined
  const decimals = metadata?.decimals ?? 6
  const tokenAmount =
    drawing?.amount != null
      ? (drawing.amount / 10 ** decimals).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        })
      : '—'

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{
            backgroundColor: 'rgba(4, 8, 20, 0.75)',
            backdropFilter: 'blur(4px)'
          }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-0 shadow-2xl focus:outline-none"
          style={{
            backgroundColor: APP_COLORS.page.cardBackground,
            borderColor: APP_COLORS.page.cardBorder,
            maxWidth: '620px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between rounded-t-2xl px-6 py-4"
            style={{ backgroundColor: APP_COLORS.page.cardHeaderBackground }}
          >
            <div>
              <Dialog.Title
                className="text-base font-bold tracking-tight"
                style={{ color: APP_COLORS.page.cardValue }}
              >
                Drawing Proof
              </Dialog.Title>
              {drawing && (
                <Dialog.Description
                  className="mt-0.5 text-xs"
                  style={{ color: APP_COLORS.page.cardLabel }}
                >
                  Round #{Number(drawing.round)} &middot;{' '}
                  {metadata?.symbol ?? 'Unknown'}
                </Dialog.Description>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={!drawing}
                className="rounded-lg border-none px-4 text-xs font-bold uppercase tracking-widest"
                style={{
                  backgroundColor: APP_COLORS.walletButton.background,
                  color: APP_COLORS.walletButton.text
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    APP_COLORS.walletButton.backgroundHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    APP_COLORS.walletButton.background
                }}
                onClick={() =>
                  window.open(
                    `${API_BASE_URL}/api/proofs/${drawing!.id}`,
                    '_blank'
                  )
                }
              >
                View Snapshot
              </Button>
              <Dialog.Close
                className="rounded-md p-1.5 transition-colors hover:bg-white/5"
                style={{ color: APP_COLORS.page.cardLabel }}
                aria-label="Close"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-6 py-5">
            {drawing && (
              <div className="flex flex-col gap-5">
                {/* Winner Highlight Card */}
                <div
                  className="rounded-xl border-l-[3px] p-4"
                  style={{
                    borderLeftColor: APP_COLORS.walletButton.background,
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    border: `1px solid ${APP_COLORS.page.cardBorder}`,
                    borderLeft: `3px solid ${APP_COLORS.walletButton.background}`
                  }}
                >
                  <div className="mb-3 flex items-baseline justify-between">
                    <div>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: APP_COLORS.page.cardLabel }}
                      >
                        Round
                      </span>
                      <span
                        className="ml-2 text-2xl font-bold tabular-nums"
                        style={{ color: APP_COLORS.page.cardValue }}
                      >
                        #{Number(drawing.round)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: APP_COLORS.page.cardLabel }}
                      >
                        Total Tickets
                      </span>
                      <span
                        className="ml-2 text-sm font-semibold tabular-nums"
                        style={{ color: APP_COLORS.page.cardValue }}
                      >
                        {Number(drawing.total_tickets).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div
                    className="mb-3 grid grid-cols-2 gap-3 border-t pt-3"
                    style={{ borderColor: APP_COLORS.page.cardBorder }}
                  >
                    <div>
                      <div
                        className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: APP_COLORS.page.cardLabel }}
                      >
                        Winner Index
                      </div>
                      <div
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: APP_COLORS.page.cardValue }}
                      >
                        {drawing.winner_index != null
                          ? Number(drawing.winner_index)
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div
                        className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: APP_COLORS.page.cardLabel }}
                      >
                        Winner Wallet
                      </div>
                      <div className="truncate font-mono text-xs">
                        <WalletLink
                          wallet={drawing.winner_wallet}
                          isDevnet={isDevnet}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2 border-t pt-3"
                    style={{ borderColor: APP_COLORS.page.cardBorder }}
                  >
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: APP_COLORS.page.cardLabel }}
                    >
                      Yield
                    </div>
                    {drawing.amount != null ? (
                      <span className="inline-flex items-center gap-1.5">
                        {metadata?.icon && (
                          <img
                            src={metadata.icon}
                            alt={metadata.symbol ?? ''}
                            className="h-5 w-5 rounded-full object-contain"
                          />
                        )}
                        <span
                          className="text-lg font-bold tabular-nums"
                          style={{ color: APP_COLORS.page.cardValue }}
                        >
                          {tokenAmount}
                        </span>
                        <span
                          className="text-xs font-medium"
                          style={{ color: APP_COLORS.page.cardLabel }}
                        >
                          {metadata?.symbol ?? ''}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: APP_COLORS.page.cardLabel }}>
                        —
                      </span>
                    )}
                  </div>
                </div>

                {/* Vault Info */}
                <div>
                  <SectionLabel>Vault Info</SectionLabel>
                  <div
                    className="rounded-lg border p-3"
                    style={{
                      borderColor: APP_COLORS.page.cardBorder,
                      backgroundColor: 'rgba(15, 23, 42, 0.4)'
                    }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div
                          className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em]"
                          style={{ color: APP_COLORS.page.cardLabel }}
                        >
                          Vault
                        </div>
                        <div className="truncate font-mono text-xs">
                          <WalletLink
                            wallet={drawing.vault}
                            isDevnet={isDevnet}
                          />
                        </div>
                      </div>
                      <div>
                        <div
                          className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em]"
                          style={{ color: APP_COLORS.page.cardLabel }}
                        >
                          Vault Mint
                        </div>
                        {drawing.mint ? (
                          <div className="flex items-center gap-1.5 truncate font-mono text-xs">
                            {metadata?.icon && (
                              <img
                                src={metadata.icon}
                                alt={metadata.symbol ?? ''}
                                className="h-4 w-4 shrink-0 rounded-full object-contain"
                              />
                            )}
                            <WalletLink
                              wallet={drawing.mint}
                              isDevnet={isDevnet}
                            />
                          </div>
                        ) : (
                          <span style={{ color: APP_COLORS.page.cardLabel }}>
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactions */}
                <div>
                  <SectionLabel>Transactions</SectionLabel>
                  <div className="flex flex-col gap-2">
                    <div>
                      <div
                        className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em]"
                        style={{ color: APP_COLORS.page.cardLabel }}
                      >
                        Commit TX
                      </div>
                      <TxLink tx={drawing.commit_tx} isDevnet={isDevnet} />
                    </div>
                    <div>
                      <div
                        className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em]"
                        style={{ color: APP_COLORS.page.cardLabel }}
                      >
                        Reveal TX
                      </div>
                      <TxLink tx={drawing.reveal_tx} isDevnet={isDevnet} />
                    </div>
                  </div>
                </div>

                {/* Cryptographic Proof */}
                <div>
                  <SectionLabel>Cryptographic Proof</SectionLabel>
                  <div
                    className="rounded-lg border p-3"
                    style={{
                      borderColor: APP_COLORS.page.cardBorder,
                      backgroundColor: 'rgba(15, 23, 42, 0.4)'
                    }}
                  >
                    <div className="flex flex-col gap-2.5">
                      {[
                        { label: 'Merkle Root', value: drawing.merkle_root },
                        { label: 'Secret Seed', value: drawing.secret_seed },
                        { label: 'Secret Hash', value: drawing.secret_hash },
                        { label: 'VRF Seed', value: drawing.vrf_seed }
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div
                            className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em]"
                            style={{ color: APP_COLORS.page.cardLabel }}
                          >
                            {label}
                          </div>
                          <HashPill value={value} />
                        </div>
                      ))}
                      <div>
                        <div
                          className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em]"
                          style={{ color: APP_COLORS.page.cardLabel }}
                        >
                          Request PDA
                        </div>
                        <div className="font-mono text-xs">
                          <WalletLink
                            wallet={drawing.request}
                            isDevnet={isDevnet}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Revealed At */}
                <div
                  className="flex items-center justify-between border-t pt-3"
                  style={{ borderColor: APP_COLORS.page.cardBorder }}
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: APP_COLORS.page.cardLabel }}
                  >
                    Revealed At
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: APP_COLORS.page.cardValue }}
                  >
                    {fmtDate(drawing.revealed_at)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
