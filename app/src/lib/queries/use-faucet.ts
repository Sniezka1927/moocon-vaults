import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction
} from '@solana/spl-token'
import { toast } from 'sonner'
import { FAUCET_KEYPAIR, USDC_MINT, USDC_AMOUNT, WSOL_AMOUNT } from '@/consts'
import { openSolscan } from '@/lib/utils'

const faucetKeypair = Keypair.fromSecretKey(Uint8Array.from(FAUCET_KEYPAIR))

export function useFaucet() {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error('Wallet not connected')

      const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, publicKey)

      const [solBalance, usdcBalance] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getTokenAccountBalance(usdcAta).then(
          (res) => Number(res.value.amount),
          () => 0
        )
      ])

      const needsSol = solBalance < WSOL_AMOUNT
      const needsUsdc = usdcBalance < USDC_AMOUNT

      if (!needsSol && !needsUsdc) {
        toast.info('You already have enough SOL and USDC')
        return null
      }

      const tx = new Transaction()

      if (needsSol) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: faucetKeypair.publicKey,
            toPubkey: publicKey,
            lamports: WSOL_AMOUNT
          })
        )
      }

      if (needsUsdc) {
        const senderAta = getAssociatedTokenAddressSync(USDC_MINT, faucetKeypair.publicKey)

        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(
            faucetKeypair.publicKey,
            usdcAta,
            publicKey,
            USDC_MINT
          ),
          createTransferCheckedInstruction(
            senderAta,
            USDC_MINT,
            usdcAta,
            faucetKeypair.publicKey,
            USDC_AMOUNT,
            6
          )
        )
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.lastValidBlockHeight = lastValidBlockHeight
      tx.feePayer = faucetKeypair.publicKey
      tx.sign(faucetKeypair)

      const signature = await connection.sendRawTransaction(tx.serialize())
      await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature })

      return signature
    },
    onSuccess: (sig) => {
      if (!sig) return
      toast.success('Faucet tokens sent!', {
        action: {
          label: '↗ View on Solscan',
          onClick: () => openSolscan(`/tx/${sig}`, connection.rpcEndpoint)
        },
        classNames: {
          actionButton:
            '!bg-[#0F1D3A] !border !border-[#2563EB40] !text-[#60A5FA] hover:!bg-[#1E293B]'
        }
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user', 'nativeSol'] }),
        queryClient.invalidateQueries({ queryKey: ['user', 'tokenBalance'] })
      ])
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Faucet request failed')
    }
  })
}
