import { useState } from 'react'
import { ReferralShareModal } from '@/components/referral-share-modal'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js'
import { toast } from 'sonner'
import bs58 from 'bs58'
import { APP_COLORS } from '@/consts'
import { Button } from '@/components/ui/button'
import { useReferrals, useCreateReferral, useUseReferral } from '@/lib/queries'
import { getReferralMessage, getCreateReferralMessage } from 'ts-sdk'
import { getFriendlyError } from '@/lib/app-providers'

const fieldStyle: React.CSSProperties = {
  backgroundColor: '#0A0F1E',
  border: `1px solid ${APP_COLORS.page.cardBorder}`,
  color: APP_COLORS.page.cardValue,
  caretColor: APP_COLORS.page.cardValue
}

const btnStyle: React.CSSProperties = {
  backgroundColor: APP_COLORS.vault.stakeButtonBackground,
  borderColor: APP_COLORS.vault.stakeButtonBorder,
  color: APP_COLORS.vault.stakeButtonText,
  borderRadius: 0,
  whiteSpace: 'nowrap'
}

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
)

export function ReferralPanel() {
  const { publicKey, connected, signMessage, signTransaction } = useWallet()
  const { connection } = useConnection()
  const wallet = publicKey?.toBase58() ?? null

  const [shareOpen, setShareOpen] = useState(false)
  const [createCode, setCreateCode] = useState('')
  const [useCode, setUseCode] = useState(
    () => new URLSearchParams(window.location.search).get('ref') ?? ''
  )
  const [isLedger, setIsLedger] = useState(
    () => localStorage.getItem('useLedger') === 'true'
  )

  const { data: referrals, isLoading } = useReferrals(wallet)
  const createReferral = useCreateReferral()
  const useReferral = useUseReferral()

  async function ledgerSign(message: string): Promise<string> {
    if (!signTransaction || !publicKey) throw new Error('Wallet not ready')
    const tx = new Transaction()
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(message, 'utf-8')
      })
    )
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.lastValidBlockHeight = lastValidBlockHeight
    tx.feePayer = publicKey
    const signed = await signTransaction(tx)
    return bs58.encode(signed.serialize())
  }

  async function handleCreate() {
    if (!wallet || !createCode.trim()) return
    if (!isLedger && !signMessage) return
    if (isLedger && !signTransaction) return
    try {
      const code = createCode.trim()
      const message = getCreateReferralMessage(code, wallet)
      let signature: string
      if (isLedger) {
        signature = await ledgerSign(message)
      } else {
        const sigBytes = await signMessage!(new TextEncoder().encode(message))
        signature = bs58.encode(sigBytes)
      }
      createReferral.mutate(
        { wallet, code, signature, ledger: isLedger || undefined },
        {
          onSuccess: () => {
            toast.success('Referral code created!')
            setCreateCode('')
          },
          onError: (e) => toast.error(getFriendlyError(e))
        }
      )
    } catch {
      toast.error('Signature rejected')
    }
  }

  async function handleUse() {
    if (!wallet || !useCode.trim()) return
    if (!isLedger && !signMessage) return
    if (isLedger && !signTransaction) return
    try {
      const code = useCode.trim()
      const message = getReferralMessage(code, wallet)
      let signature: string
      if (isLedger) {
        signature = await ledgerSign(message)
      } else {
        const sigBytes = await signMessage!(new TextEncoder().encode(message))
        signature = bs58.encode(sigBytes)
      }
      useReferral.mutate(
        { wallet, code, signature, ledger: isLedger || undefined },
        {
          onSuccess: () => {
            toast.success('Referral code applied!')
            setUseCode('')
          },
          onError: (e) => toast.error(getFriendlyError(e))
        }
      )
    } catch {
      toast.error('Signature rejected')
    }
  }

  const hasCode = Boolean(referrals?.code)
  const hasReferredBy = Boolean(referrals?.referredBy)

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <p
          className="text-[10px] uppercase tracking-[0.12em]"
          style={{ color: APP_COLORS.page.cardLabel }}
        >
          Referral Program
        </p>
        <label
          className="flex items-center gap-1.5 cursor-pointer select-none"
          style={{ color: APP_COLORS.page.cardLabel }}
        >
          <span className="text-[10px] uppercase tracking-[0.12em]">
            Using Ledger
          </span>
          <div
            onClick={() => {
              const next = !isLedger
              setIsLedger(next)
              localStorage.setItem('useLedger', String(next))
            }}
            className="w-3.5 h-3.5 rounded-none border cursor-pointer flex items-center justify-center"
            style={{
              borderColor: APP_COLORS.page.cardLabel,
              backgroundColor: isLedger
                ? APP_COLORS.page.cardLabel
                : 'transparent'
            }}
          >
            {isLedger && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5L4.5 7.5L8 3"
                  stroke="#0B1628"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </label>
      </div>

      {/* Create referral code */}
      <div className="flex flex-col gap-1.5">
        <p
          className="text-[10px] uppercase tracking-[0.12em]"
          style={{ color: APP_COLORS.page.cardLabel }}
        >
          Your Referral Code
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={hasCode ? (referrals?.code ?? '') : createCode}
            onChange={(e) => !hasCode && setCreateCode(e.target.value)}
            readOnly={hasCode || !connected}
            placeholder={connected ? 'Choose a code...' : 'Connect wallet'}
            className="flex-1 rounded-none px-4 py-2.5 text-sm outline-none"
            style={{
              ...fieldStyle,
              color: hasCode ? APP_COLORS.page.cardLabel : fieldStyle.color,
              opacity: hasCode ? 0.7 : 1
            }}
          />
          {hasCode ? (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                className="w-[60px]"
                style={{
                  ...btnStyle,
                  height: 'auto',
                  paddingTop: '0.625rem',
                  paddingBottom: '0.625rem'
                }}
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}?ref=${referrals!.code}`
                  )
                  toast.success('Referral link copied!')
                }}
              >
                Copy
              </Button>
              <Button
                variant="outline"
                className="w-[60px]"
                style={{
                  ...btnStyle,
                  height: 'auto',
                  paddingTop: '0.625rem',
                  paddingBottom: '0.625rem'
                }}
                onClick={() => setShareOpen(true)}
              >
                Share
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-[80px] shrink-0"
              style={{
                ...btnStyle,
                height: 'auto',
                paddingTop: '0.625rem',
                paddingBottom: '0.625rem'
              }}
              disabled={
                createReferral.isPending ||
                !connected ||
                isLoading ||
                !createCode.trim()
              }
              onClick={handleCreate}
            >
              {createReferral.isPending ? 'Creating...' : 'Create'}
            </Button>
          )}
        </div>
      </div>

      {/* Use a referral code */}
      <div className="flex flex-col gap-1.5">
        <p
          className="text-[10px] uppercase tracking-[0.12em]"
          style={{ color: APP_COLORS.page.cardLabel }}
        >
          Redeem a Code
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={hasReferredBy ? (referrals?.referredBy ?? '') : useCode}
            onChange={(e) => !hasReferredBy && setUseCode(e.target.value)}
            readOnly={hasReferredBy || !connected}
            placeholder={
              connected ? "Enter friend's code..." : 'Connect wallet'
            }
            className="flex-1 rounded-none px-4 py-2.5 text-sm outline-none"
            style={{
              ...fieldStyle,
              color: hasReferredBy
                ? APP_COLORS.page.cardLabel
                : fieldStyle.color,
              opacity: hasReferredBy ? 0.7 : 1
            }}
          />
          <Button
            className="w-[80px] shrink-0"
            style={{
              backgroundColor: APP_COLORS.walletButton.background,
              color: APP_COLORS.walletButton.text,
              borderRadius: 0,
              fontWeight: 700,
              border: 'none',
              whiteSpace: 'nowrap',
              height: 'auto',
              paddingTop: '0.625rem',
              paddingBottom: '0.625rem'
            }}
            disabled={
              hasReferredBy ||
              useReferral.isPending ||
              !connected ||
              isLoading ||
              !useCode.trim()
            }
            onClick={handleUse}
          >
            {useReferral.isPending ? 'Applying...' : 'Apply'}
          </Button>
        </div>
      </div>
      {hasCode && (
        <ReferralShareModal
          code={referrals!.code!}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}
