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

function shortKey(key: string | null) {
  if (!key) return '—'
  return `${key.slice(0, 6)}…${key.slice(-6)}`
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

function Row({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      className="grid grid-cols-[160px_1fr] gap-3 border-b py-2.5 last:border-0"
      style={{ borderColor: APP_COLORS.page.cardBorder }}
    >
      <span
        className="text-xs font-medium uppercase tracking-[0.08em]"
        style={{ color: APP_COLORS.page.cardLabel }}
      >
        {label}
      </span>
      <span
        className="break-all font-mono text-xs"
        style={{ color: APP_COLORS.page.cardValue }}
      >
        {children}
      </span>
    </div>
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
      className="underline decoration-dotted underline-offset-2"
      style={{ color: APP_COLORS.page.eyebrow }}
    >
      {tx}
    </a>
  )
}

function WalletLink({ wallet, isDevnet }: { wallet: string | null; isDevnet: boolean }) {
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
          className="fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 border p-6 shadow-2xl focus:outline-none"
          style={{
            backgroundColor: APP_COLORS.page.cardBackground,
            borderColor: APP_COLORS.page.cardBorder,
            maxWidth: '706px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            className="mb-4 flex items-start justify-between border-b pb-4"
            style={{ borderColor: APP_COLORS.page.cardBorder }}
          >
            <div>
              <Dialog.Title
                className="text-sm font-semibold"
                style={{ color: APP_COLORS.page.cardValue }}
              >
                Drawing Proof
              </Dialog.Title>
              {drawing && (
                <Dialog.Description
                  className="mt-0.5 text-xs"
                  style={{ color: APP_COLORS.page.cardLabel }}
                >
                  Round #{Number(drawing.round)} · {metadata?.symbol ?? 'Unknown'}
                </Dialog.Description>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={!drawing}
                className="px-4 text-xs uppercase tracking-widest font-bold border-none"
                style={{
                  backgroundColor: APP_COLORS.walletButton.background,
                  color: APP_COLORS.walletButton.text
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = APP_COLORS.walletButton.backgroundHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = APP_COLORS.walletButton.background
                }}
                onClick={() => window.open(`${API_BASE_URL}/api/proofs/${drawing!.id}`, '_blank')}
              >
                View Snapshot
              </Button>
              <Dialog.Close
                className="p-1 text-xs transition-colors"
                style={{ color: APP_COLORS.page.cardLabel }}
                aria-label="Close"
              >
                ✕
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto">
            {drawing && (
              <>
                <Row label="Round">{Number(drawing.round)}</Row>
                <Row label="Vault">
                  <WalletLink wallet={drawing.vault} isDevnet={isDevnet} />
                </Row>
                <Row label="Vault Mint">
                  {drawing.mint ? (
                    <span className="inline-flex items-center gap-1.5">
                      {metadata?.icon && (
                        <img
                          src={metadata.icon}
                          alt={metadata.symbol ?? ''}
                          className="h-6 w-6 rounded-full object-contain"
                        />
                      )}
                      <WalletLink wallet={drawing.mint} isDevnet={isDevnet} />
                    </span>
                  ) : (
                    <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
                  )}
                </Row>
                <Row label="Winner Index">
                  {drawing.winner_index != null ? (
                    Number(drawing.winner_index)
                  ) : (
                    <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
                  )}
                </Row>
                <Row label="Winner Wallet">
                  <WalletLink wallet={drawing.winner_wallet} isDevnet={isDevnet} />
                </Row>
                <Row label="Commit Tx">
                  <TxLink tx={drawing.commit_tx} isDevnet={isDevnet} />
                </Row>
                <Row label="Reveal Tx">
                  <TxLink tx={drawing.reveal_tx} isDevnet={isDevnet} />
                </Row>
                <Row label="Yield">
                  {drawing.amount != null ? (
                    <span className="inline-flex items-center gap-1.5">
                      {metadata?.icon && (
                        <img
                          src={metadata.icon}
                          alt={metadata.symbol ?? ''}
                          className="h-6 w-6 rounded-full object-contain"
                        />
                      )}
                      <span>
                        {tokenAmount} {metadata?.symbol ?? ''}
                      </span>
                    </span>
                  ) : (
                    <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
                  )}
                </Row>
                <Row label="Total Tickets">
                  {Number(drawing.total_tickets).toLocaleString()}
                </Row>
                <Row label="Merkle Root">
                  {drawing.merkle_root ?? (
                    <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
                  )}
                </Row>
                <Row label="Secret Seed">
                  {drawing.secret_seed ?? (
                    <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
                  )}
                </Row>
                <Row label="Secret Hash">
                  {drawing.secret_hash ?? (
                    <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
                  )}
                </Row>
                <Row label="VRF Seed">
                  {drawing.vrf_seed ?? (
                    <span style={{ color: APP_COLORS.page.cardLabel }}>—</span>
                  )}
                </Row>
                <Row label="Request PDA">
                  <WalletLink wallet={drawing.request} isDevnet={isDevnet} />
                </Row>
                <Row label="Revealed At">{fmtDate(drawing.revealed_at)}</Row>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
