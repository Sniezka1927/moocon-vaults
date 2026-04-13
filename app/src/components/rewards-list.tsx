import { useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { APP_COLORS } from '@/consts'
import { useMintStore } from '@/lib/store/mint-store'
import { solscanUrl } from '@/lib/utils'
import { useDrawings } from '@/lib/queries'
import type { Drawing } from '@/lib/api/types'
import { ProofModal } from './proof-modal'

function shortKey(key: string | null) {
  if (!key) return '—'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

function fmtAmount(amount: number | null) {
  if (amount === null) return '0.00'
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })
}

function fmtDate(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function RewardsList() {
  const { connection } = useConnection()
  const isDevnet = connection.rpcEndpoint.includes('devnet')
  const { data, isLoading } = useDrawings(1, 20)
  const drawings = data?.drawings ?? []
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null)
  const getMint = useMintStore((s) => s.getMint)

  function fmtTokenAmount(amount: number | null, mint: string | null) {
    const metadata = mint ? getMint(mint) : undefined
    const decimals = metadata?.decimals ?? 6
    if (amount === null) return '0.00'
    const tokenAmount = amount / 10 ** decimals
    return fmtAmount(tokenAmount)
  }

  function vaultLabel(vault: string) {
    return shortKey(vault)
  }

  return (
    <div
      className="rounded-2xl border"
      style={{
        borderColor: APP_COLORS.page.cardBorder,
        backgroundColor: APP_COLORS.page.cardBackground
      }}
    >
      <div
        className="border-b p-5"
        style={{ borderColor: APP_COLORS.page.cardBorder }}
      >
        <p
          className="text-sm font-medium"
          style={{ color: APP_COLORS.page.cardValue }}
        >
          Latest Winners
        </p>
      </div>

      <div className="max-h-[420px] overflow-auto">
        {isLoading && (
          <p
            className="px-5 py-8 text-center text-xs"
            style={{ color: APP_COLORS.page.cardLabel }}
          >
            Loading...
          </p>
        )}

        {!isLoading && drawings.length === 0 && (
          <p
            className="px-5 py-8 text-center text-xs"
            style={{ color: APP_COLORS.page.cardLabel }}
          >
            No rewards yet.
          </p>
        )}

        {!isLoading && drawings.length > 0 && (
          <table className="w-full min-w-[940px] text-xs">
            <thead
              className="sticky top-0 z-10"
              style={{ backgroundColor: APP_COLORS.page.cardBackground }}
            >
              <tr
                className="border-b"
                style={{ borderColor: APP_COLORS.page.cardBorder }}
              >
                {['Vault', 'Tickets', 'Payout', 'Winner', 'APR', 'Revealed', ''].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left uppercase tracking-[0.1em]"
                      style={{ color: APP_COLORS.page.cardLabel }}
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {drawings.map((d) => {
                const metadata = d.mint ? getMint(d.mint) : undefined

                return (
                  <tr
                    key={d.id}
                    className="border-b align-middle last:border-0"
                    style={{ borderColor: APP_COLORS.page.cardBorder }}
                  >
                    <td
                      className="px-4 py-3 font-mono"
                      style={{ color: APP_COLORS.page.cardValue }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {metadata?.icon && (
                          <img
                            src={metadata.icon}
                            alt={metadata.symbol ?? ''}
                            className="h-6 w-6 rounded-full object-contain"
                          />
                        )}
                        <span>{vaultLabel(d.vault)}</span>
                      </span>
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: APP_COLORS.page.cardValue }}
                    >
                      {Number(d.total_tickets).toLocaleString()}
                    </td>
                    <td
                      className="px-4 py-3 font-medium"
                      style={{ color: APP_COLORS.page.cardValue }}
                    >
                      {metadata?.icon ? (
                        <span className="inline-flex items-center gap-1.5">
                          <img
                            src={metadata.icon}
                            alt={metadata.symbol ?? ''}
                            className="h-6 w-6 rounded-full object-contain"
                          />
                          <span>{fmtTokenAmount(d.amount, d.mint)}</span>
                        </span>
                      ) : (
                        fmtTokenAmount(d.amount, d.mint)
                      )}
                    </td>
                    <td
                      className="px-4 py-3 font-mono"
                      style={{ color: APP_COLORS.page.cardLabel }}
                    >
                      {d.winner_wallet ? (
                        <a
                          href={solscanUrl(`/account/${d.winner_wallet}`, isDevnet)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-dotted underline-offset-2"
                          style={{ color: APP_COLORS.page.eyebrow }}
                        >
                          {shortKey(d.winner_wallet)}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      className="px-4 py-3 font-medium"
                      style={{ color: APP_COLORS.page.cardValue }}
                    >
                      {d.winner_apr_percent !== null
                        ? `${d.winner_apr_percent.toFixed(2)}%`
                        : '—'}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: APP_COLORS.page.cardLabel }}
                    >
                      {fmtDate(d.revealed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedDrawing(d)}
                        className="inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
                        style={{
                          color: APP_COLORS.page.cardValue,
                          borderColor: APP_COLORS.page.cardBorder,
                          backgroundColor: 'rgba(129, 146, 183, 0.08)'
                        }}
                      >
                        View proof
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ProofModal
        drawing={selectedDrawing}
        open={selectedDrawing !== null}
        onClose={() => setSelectedDrawing(null)}
      />
    </div>
  )
}
