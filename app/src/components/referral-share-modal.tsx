import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { APP_COLORS } from '@/consts'
import { Button } from '@/components/ui/button'
import { ReferralShareCard } from '@/components/referral-share-card'

interface Props {
  code: string
  open: boolean
  onClose: () => void
}

const btnStyle: React.CSSProperties = {
  backgroundColor: APP_COLORS.vault.stakeButtonBackground,
  borderColor: APP_COLORS.vault.stakeButtonBorder,
  color: APP_COLORS.vault.stakeButtonText,
  borderRadius: '0.75rem',
  whiteSpace: 'nowrap'
}

export function ReferralShareModal({ code, open, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  async function generatePng() {
    if (!cardRef.current) throw new Error('Card not ready')
    return toPng(cardRef.current, { pixelRatio: 1 })
  }

  async function handleCopy() {
    setBusy(true)
    try {
      const dataUrl = await generatePng()
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      toast.success('Image copied to clipboard!')
    } catch {
      toast.error('Failed to copy image')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload() {
    setBusy(true)
    try {
      const dataUrl = await generatePng()
      const link = document.createElement('a')
      link.download = `moocon-referral-${code}.png`
      link.href = dataUrl
      link.click()
    } catch {
      toast.error('Failed to generate image')
    } finally {
      setBusy(false)
    }
  }

  function handleShareX() {
    const text = encodeURIComponent(
      `Join me on Moocon! Use my referral code: ${code}\n${window.location.origin}?ref=${code}`
    )
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank')
  }

  const CARD_W = 1200
  const CARD_H = 630
  const SCALE = 0.38

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
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl focus:outline-none"
          style={{
            backgroundColor: APP_COLORS.app.background,
            borderColor: APP_COLORS.page.cardBorder,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Card preview */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              width: CARD_W * SCALE,
              height: CARD_H * SCALE,
              margin: '0 auto',
              border: `1px solid ${APP_COLORS.page.cardBorder}`
            }}
          >
            <div
              style={{
                transform: `scale(${SCALE})`,
                transformOrigin: 'top left',
                width: CARD_W,
                height: CARD_H
              }}
            >
              <ReferralShareCard code={code} cardRef={cardRef} />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              style={{ ...btnStyle, height: 'auto', padding: '0.625rem' }}
              disabled={busy}
              onClick={handleCopy}
            >
              Copy Image
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              style={{ ...btnStyle, height: 'auto', padding: '0.625rem' }}
              disabled={busy}
              onClick={handleDownload}
            >
              Download
            </Button>
            <Button
              className="flex-1"
              style={{
                backgroundColor: APP_COLORS.walletButton.background,
                color: APP_COLORS.walletButton.text,
                borderRadius: '0.75rem',
                fontWeight: 700,
                border: 'none',
                height: 'auto',
                padding: '0.625rem'
              }}
              onClick={handleShareX}
            >
              Share on X
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
