import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useWallet } from '@solana/wallet-adapter-react'
import { APP_COLORS, COLOR_TOKENS } from '@/consts'
import type { VaultWithAddress } from '@/lib/store/vault-store'
import {
  useUserTokenBalance,
  useUserDepositedAmount,
  useUserPTokenBalance,
  useNativeSolBalance,
  isNativeSol
} from '@/lib/queries/use-vaults'
import { useDeposit, useWithdraw } from '@/lib/queries/use-vault-actions'
import { MAX_U64 } from 'ts-sdk'

interface Props {
  vault: VaultWithAddress
  metadata: { name: string; icon: string; decimals: number }
  tvl: string | null
  tvlUsd: string | null
  avgApr: number | null
  price: number | null
  open: boolean
  onClose: () => void
}

const DEFAULT_TOKEN_DECIMALS = 6

function fmtToken(amount: number, decimals: number) {
  if (!Number.isFinite(amount)) return '0'
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  })
}

function trimDecimals(value: number, decimals: number) {
  if (!Number.isFinite(value)) return '0'
  return parseFloat(value.toFixed(decimals)).toString()
}

function rawToDisplay(raw: bigint, decimals: number) {
  return Number(raw) / 10 ** decimals
}

function normalizeDecimals(decimals: number) {
  const parsed = Number(decimals)
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_TOKEN_DECIMALS
  return Math.min(parsed, 18)
}

function toSafeNumber(value: number) {
  return Number.isFinite(value) ? value : 0
}

export function DepositWithdrawModal({
  vault,
  metadata,
  tvl,
  tvlUsd,
  avgApr,
  price,
  open,
  onClose
}: Props) {
  const { publicKey } = useWallet()
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [inputValue, setInputValue] = useState('')
  const [isMaxWithdraw, setIsMaxWithdraw] = useState(false)

  const isSol = isNativeSol(vault.mint)
  const { data: userTokenRaw = 0n } = useUserTokenBalance(vault.mint, publicKey)
  const { data: nativeSolRaw = 0n } = useNativeSolBalance(
    isSol ? publicKey : null
  )
  const { data: userDeposited = 0 } = useUserDepositedAmount(
    vault,
    publicKey,
    metadata.decimals
  )
  const { data: userPTokenBalance = 0 } = useUserPTokenBalance(
    vault,
    publicKey,
    metadata.decimals
  )

  const deposit = useDeposit(vault)
  const withdraw = useWithdraw(vault)

  const tokenDecimals = normalizeDecimals(metadata.decimals)
  const isPending = deposit.isPending || withdraw.isPending
  const parsed = parseFloat(inputValue) || 0
  const minDeposit = toSafeNumber(
    Number(vault.minDeposit) / 10 ** tokenDecimals
  )
  const depositBalanceRaw = isSol ? nativeSolRaw : userTokenRaw
  const userTokenDisplay = toSafeNumber(
    rawToDisplay(depositBalanceRaw, tokenDecimals)
  )
  const depositedAmount = toSafeNumber(userDeposited)
  const pTokenBalance = toSafeNumber(userPTokenBalance)

  // Validation
  let validationMsg = ''
  if (tab === 'deposit' && parsed > 0) {
    if (parsed > userTokenDisplay) validationMsg = 'Insufficient balance'
    else if (parsed < minDeposit)
      validationMsg = `Minimum deposit: ${fmtToken(minDeposit, tokenDecimals)} ${metadata.name}`
  }
  if (
    tab === 'withdraw' &&
    parsed > 0 &&
    !isMaxWithdraw &&
    parsed > pTokenBalance
  ) {
    validationMsg = 'Insufficient deposited amount'
  }

  const canSubmit =
    (parsed > 0 || isMaxWithdraw) && !validationMsg && !isPending

  function handleHalf() {
    if (tab === 'deposit') {
      setInputValue(trimDecimals(userTokenDisplay / 2, tokenDecimals))
    } else {
      setIsMaxWithdraw(false)
      setInputValue(trimDecimals(pTokenBalance / 2, tokenDecimals))
    }
  }

  function handleMax() {
    if (tab === 'deposit') {
      setInputValue(trimDecimals(userTokenDisplay, tokenDecimals))
    } else {
      setIsMaxWithdraw(true)
      setInputValue(trimDecimals(pTokenBalance, tokenDecimals))
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return
    const rawAmount = BigInt(Math.floor(parsed * 10 ** tokenDecimals))

    if (tab === 'deposit') {
      deposit.mutate(rawAmount, { onSuccess: onClose })
    } else {
      withdraw.mutate(isMaxWithdraw ? MAX_U64 : rawAmount, {
        onSuccess: onClose
      })
    }
  }

  function handleTabChange(next: 'deposit' | 'withdraw') {
    setTab(next)
    setInputValue('')
    setIsMaxWithdraw(false)
  }

  const availableLabel =
    tab === 'deposit'
      ? `${fmtToken(userTokenDisplay, tokenDecimals)} ${metadata.name}`
      : `${fmtToken(pTokenBalance, tokenDecimals)} p${metadata.name}`
  const tvlLabel =
    tvl === '—' ? '—' : tvl !== null ? `${tvl} ${metadata.name}` : '…'
  const tvlDisplay = tvlUsd !== null ? tvlUsd : tvlLabel
  const depositedUsd =
    price !== null
      ? (depositedAmount * price).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD'
        })
      : null

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
            backgroundColor: 'rgba(4, 8, 20, 0.8)',
            backdropFilter: 'blur(4px)'
          }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl focus:outline-none"
          style={{
            backgroundColor: APP_COLORS.app.background,
            borderColor: APP_COLORS.page.cardBorder,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={metadata.icon}
                alt={metadata.name}
                className="h-6 w-6 rounded-full object-contain"
              />
              <Dialog.Title
                className="text-base font-semibold"
                style={{ color: APP_COLORS.page.cardValue }}
              >
                {metadata.name}
              </Dialog.Title>
            </div>
            <Dialog.Close
              className="rounded p-1 text-sm leading-none transition-opacity hover:opacity-60"
              style={{ color: APP_COLORS.page.cardLabel }}
              aria-label="Close"
            >
              ✕
            </Dialog.Close>
          </div>

          {/* ── Stats card ── */}
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: APP_COLORS.page.cardBorder,
              backgroundColor: APP_COLORS.page.cardBackground
            }}
          >
            <div>
              <p
                className="text-xs font-medium"
                style={{ color: APP_COLORS.page.cardLabel }}
              >
                Deposited
              </p>
              <p
                className="mt-0.5 text-lg font-semibold"
                style={{ color: APP_COLORS.page.cardValue }}
              >
                {fmtToken(depositedAmount, tokenDecimals)} {metadata.name}
              </p>
              <p
                className="text-xs"
                style={{ color: APP_COLORS.page.description }}
              >
                {depositedUsd ?? '$0.00'}
              </p>
            </div>
          </div>

          {/* ── APY row ── */}
          <div className="flex items-center justify-between px-1">
            <span
              className="text-xs font-medium"
              style={{ color: APP_COLORS.page.cardLabel }}
            >
              APR
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: COLOR_TOKENS.secondary }}
            >
              {avgApr !== null ? `${avgApr.toFixed(2)}%` : '—'}
            </span>
          </div>

          {/* ── Vault TVL row ── */}
          <div className="flex items-center justify-between px-1">
            <span
              className="text-xs font-medium "
              style={{ color: APP_COLORS.page.cardLabel }}
            >
              Vault TVL
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: APP_COLORS.page.cardValue }}
            >
              {tvlDisplay}
            </span>
          </div>

          {/* ── Divider ── */}
          <div
            className="h-px"
            style={{ backgroundColor: APP_COLORS.page.cardBorder }}
          />

          {/* ── Tab switcher ── */}
          <div
            className="flex rounded-xl p-1"
            style={{
              backgroundColor: APP_COLORS.page.cardBackground,
              border: `1px solid ${APP_COLORS.page.cardBorder}`
            }}
          >
            {(['deposit', 'withdraw'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className="flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors"
                style={
                  tab === t
                    ? {
                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                        color: COLOR_TOKENS.secondary
                      }
                    : { color: APP_COLORS.page.cardLabel }
                }
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Input section ── */}
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: APP_COLORS.page.cardBorder,
              backgroundColor: APP_COLORS.page.cardBackground
            }}
          >
            {/* Top row */}
            <div className="mb-3 flex items-center justify-between">
              <span
                className="text-xs font-medium"
                style={{ color: APP_COLORS.page.cardValue }}
              >
                {tab === 'deposit' ? 'Deposit' : 'Withdraw'}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs"
                  style={{ color: APP_COLORS.page.cardLabel }}
                >
                  {availableLabel}
                </span>
                {(['HALF', 'MAX'] as const).map((lbl) => (
                  <button
                    key={lbl}
                    onClick={lbl === 'HALF' ? handleHalf : handleMax}
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: COLOR_TOKENS.secondary,
                      border: `1px solid rgba(59, 130, 246, 0.25)`
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <img
                  src={metadata.icon}
                  alt={metadata.name}
                  className="h-6 w-6 rounded-full object-contain"
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: APP_COLORS.page.cardValue }}
                >
                  {metadata.name}
                </span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0.00"
                value={inputValue}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d*\.?\d*$/.test(v)) {
                    const dotIdx = v.indexOf('.')
                    if (
                      dotIdx === -1 ||
                      v.length - dotIdx - 1 <= tokenDecimals
                    ) {
                      setIsMaxWithdraw(false)
                      setInputValue(v)
                    }
                  }
                }}
                className="w-40 bg-transparent text-right text-2xl font-semibold outline-none placeholder:opacity-30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{ color: APP_COLORS.page.cardValue }}
              />
            </div>

            {/* Subline */}
            <p
              className="mt-1 text-right text-xs"
              style={{ color: validationMsg ? APP_COLORS.error.text : APP_COLORS.page.cardLabel }}
            >
              {validationMsg || '\u00A0'}
            </p>
          </div>

          {/* ── Submit button ── */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-xl py-3 text-sm font-bold uppercase tracking-widest transition-opacity disabled:opacity-40"
            style={{
              backgroundColor: APP_COLORS.walletButton.background,
              color: APP_COLORS.walletButton.text
            }}
          >
            {isPending
              ? 'Confirming…'
              : tab === 'deposit'
                ? 'Deposit'
                : 'Withdraw'}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
